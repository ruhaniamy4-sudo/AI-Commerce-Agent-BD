import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readEnv } from './env-utils.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const full = process.argv.includes('--full');

// Each app costs a few seconds of bundler/transpile work to boot and then keeps
// a watcher and a compiler resident, so three of them racing for the same cores
// makes every one of them slower to come up. Naming the ones you are actually
// working on skips that: `npm run dev -- dashboard agent`.
const APPS = ['agent', 'dashboard', 'storefront'];
const requested = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
const unknown = requested.filter((name) => !APPS.includes(name));
if (unknown.length) {
  console.error(`Unknown app: ${unknown.join(', ')}. Expected one of ${APPS.join(', ')}.`);
  process.exit(1);
}
const selected = requested.length ? requested : APPS;

const env = readEnv(path.join(root, '.env'));
if (full && !env.REDIS_URL && !env.REDIS_HOST && !env.REDIS_PORT) {
  console.error('Full mode requires Redis. Set REDIS_URL in the root .env, then run npm run dev:full again.');
  process.exit(1);
}

function npmInvocation(args) {
  const candidates = [
    process.env.npm_execpath,
    process.env.npm_config_prefix && path.join(process.env.npm_config_prefix, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ].filter(Boolean);
  const npmCli = candidates.find((candidate) => fs.existsSync(candidate));
  if (npmCli) return { command: process.execPath, args: [npmCli, ...args] };
  if (process.platform === 'win32') {
    return { command: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', 'npm', ...args] };
  }
  return { command: 'npm', args };
}

// apps/agent and apps/dashboard both import @edutechs/shared at runtime via its
// built dist/index.js. Without this, the agent fails silently (module not found)
// and every dashboard login/signup then errors with "Unable to connect to the
// authentication service" since there is nothing listening on the agent port.
const sharedEntry = path.join(root, 'packages/shared/dist/index.js');
if (!fs.existsSync(sharedEntry)) {
  console.log('Building @edutechs/shared (missing dist output)...');
  const buildInvocation = npmInvocation(['run', 'build', '-w', 'packages/shared']);
  const build = spawnSync(buildInvocation.command, buildInvocation.args, { cwd: root, stdio: 'inherit' });
  if (build.status !== 0) {
    console.error('Failed to build @edutechs/shared. Fix the error above, then re-run npm run dev.');
    process.exit(build.status || 1);
  }
}

const commands = {
  agent: ['run', 'dev', '-w', 'apps/agent'],
  dashboard: ['run', 'dev', '-w', 'apps/dashboard'],
  storefront: ['run', 'dev', '-w', 'apps/storefront', '--', '--port', '3001'],
};
const services = selected.map((name) => [name, commands[name]]);
if (full) services.push(['worker', ['run', 'worker', '-w', 'apps/agent']]);

console.log(`Starting SellPilot ${full ? 'full' : 'core'} development mode (${selected.join(', ')})...`);
let stopping = false;
const children = [];

for (const [name, args] of services) {
  const invocation = npmInvocation(args);
  const child = spawn(invocation.command, invocation.args, {
    cwd: root,
    env: process.env,
    stdio: ['inherit', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
    windowsHide: true,
  });
  const prefix = (stream) => stream.on('data', (data) => String(data).split(/\r?\n/).filter(Boolean).forEach((line) => console.log(`[${name}] ${line}`)));
  prefix(child.stdout); prefix(child.stderr);
  child.on('error', (error) => {
    if (!stopping) {
      console.error(`[${name}] could not start: ${error.message}`);
      shutdown(1);
    }
  });
  child.on('exit', (code) => {
    if (code !== 0 && code !== null && !stopping) {
      console.error(`[${name}] exited with code ${code}`);
      shutdown(code);
    }
  });
  children.push(child);
}

function terminateTree(child) {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
    return;
  }
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
}

function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) terminateTree(child);
  setTimeout(() => process.exit(code), 250).unref();
}
process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());
