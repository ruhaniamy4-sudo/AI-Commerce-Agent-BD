import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readEnv } from './env-utils.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const full = process.argv.includes('--full');
const agentEnv = readEnv(path.join(root, 'apps/agent/.env'));
if (full && !agentEnv.REDIS_URL && !agentEnv.REDIS_HOST && !agentEnv.REDIS_PORT) {
  console.error('Full mode requires Redis. Set REDIS_URL in apps/agent/.env, then run npm run dev:full again.');
  process.exit(1);
}

const services = [
  ['agent', ['run', 'dev', '-w', 'apps/agent']],
  ['dashboard', ['run', 'dev', '-w', 'apps/dashboard']],
  ['storefront', ['run', 'dev', '-w', 'apps/storefront', '--', '--port', '3001']],
];
if (full) services.push(['worker', ['run', 'worker', '-w', 'apps/agent']]);

console.log(`Starting SellPilot ${full ? 'full' : 'core'} development mode...`);
let stopping = false;
const children = [];

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
