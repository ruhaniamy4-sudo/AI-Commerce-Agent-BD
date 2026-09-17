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

// One PORT variable cannot serve three services. Inherited from the shell it
// reaches all of them at once: the agent binds it, Next binds it too, and
// because the agent listens on 0.0.0.0 while Next listens on ::, they can share
// a port without either reporting a conflict — the API then answers on the
// dashboard's port and nothing is listening where the dashboard looks for it.
// Every service is therefore told its own port explicitly.
const PORTS = {
  agent: Number(env.PORT) || 4000,
  dashboard: 3000,
  storefront: 3001,
};

const commands = {
  // --port keeps Next from quietly drifting to the next free port when something
  // already holds this one; a moved dashboard breaks NEXTAUTH_URL and OAuth
  // callbacks in ways that surface much later than the warning does.
  agent: ['run', 'dev', '-w', 'apps/agent'],
  dashboard: ['run', 'dev', '-w', 'apps/dashboard', '--', '--port', String(PORTS.dashboard)],
  storefront: ['run', 'dev', '-w', 'apps/storefront', '--', '--port', String(PORTS.storefront)],
};
const services = selected.map((name) => [name, commands[name]]);
if (full) services.push(['worker', ['run', 'worker', '-w', 'apps/agent']]);

// Check the ports before anything boots: otherwise the first service takes what
// it can get, the second dies on EADDRINUSE, and the real cause is buried in
// three stack traces. Both address families are probed because a server bound to
// 0.0.0.0 and one bound to :: can hold the same port without colliding.
async function portHolder(port) {
  const { createServer } = await import('node:net');
  for (const host of ['0.0.0.0', '::']) {
    const busy = await new Promise((resolve) => {
      const probe = createServer();
      probe.once('error', (error) => resolve(error.code === 'EADDRINUSE'));
      probe.once('listening', () => probe.close(() => resolve(false)));
      probe.listen(port, host);
    });
    if (busy) return true;
  }
  return false;
}

const conflicts = [];
for (const name of selected) {
  if (PORTS[name] && await portHolder(PORTS[name])) conflicts.push(`${name} (port ${PORTS[name]})`);
}
if (conflicts.length) {
  console.error(`Already in use: ${conflicts.join(', ')}.`);
  console.error('Another dev session is probably still running. Stop it, or start only what you need: npm run dev -- dashboard');
  process.exit(1);
}

console.log(`Starting SellPilot ${full ? 'full' : 'core'} development mode (${selected.join(', ')})...`);
let stopping = false;
const children = [];

for (const [name, args] of services) {
  const invocation = npmInvocation(args);
  const child = spawn(invocation.command, invocation.args, {
    cwd: root,
    // PORT is set per service rather than inherited, so a stray PORT in the
    // shell cannot point every app at the same one. The worker has no server.
    env: { ...process.env, ...(PORTS[name] ? { PORT: String(PORTS[name]) } : {}) },
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
