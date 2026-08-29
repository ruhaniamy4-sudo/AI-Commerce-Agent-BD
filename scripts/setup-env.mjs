import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readEnv } from './env-utils.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = ['apps/agent/.env', 'apps/dashboard/.env', 'apps/storefront/.env'];
const generated = () => crypto.randomBytes(32).toString('base64url');
const placeholders = /^(?:$|replace_|your_|changeme|<)/i;
const agentExisting = readEnv(path.join(root, 'apps/agent/.env'));
const dashboardExisting = readEnv(path.join(root, 'apps/dashboard/.env'));
const usable = (value) => value && !placeholders.test(value) ? value : undefined;
const agentOAuthSecret = usable(agentExisting.OAUTH_INTERNAL_SECRET);
const dashboardOAuthSecret = usable(dashboardExisting.OAUTH_INTERNAL_SECRET);
const sharedOAuthSecret = agentOAuthSecret || dashboardOAuthSecret || generated();
const secrets = {
  'apps/agent/.env': {
    AUTH_JWT_SECRET: generated(),
    OAUTH_INTERNAL_SECRET: sharedOAuthSecret,
    COURIER_CREDENTIALS_ENCRYPTION_KEY: generated(),
    BOOTSTRAP_OWNER_PASSWORD: generated(),
  },
  'apps/dashboard/.env': { NEXTAUTH_SECRET: generated(), OAUTH_INTERNAL_SECRET: sharedOAuthSecret },
};
let ownerPassword;

if (agentOAuthSecret && dashboardOAuthSecret && agentOAuthSecret !== dashboardOAuthSecret) {
  console.warn('Warning: existing agent and dashboard OAUTH_INTERNAL_SECRET values differ; preserved both. Make them match before testing OAuth.');
}

for (const relative of targets) {
  const file = path.join(root, relative);
  const example = `${file}.example`;
  if (!fs.existsSync(file)) {
    if (!fs.existsSync(example)) throw new Error(`Missing template: ${path.relative(root, example)}`);
    fs.copyFileSync(example, file, fs.constants.COPYFILE_EXCL);
    console.log(`Created ${relative}`);
  } else {
    console.log(`Preserved existing ${relative}`);
  }

  const current = readEnv(file);
  const additions = [];
  for (const [key, value] of Object.entries(secrets[relative] || {})) {
    if (!(key in current) || placeholders.test(current[key])) {
      additions.push(`${key}=${value}`);
      if (key === 'BOOTSTRAP_OWNER_PASSWORD') ownerPassword = value;
    }
  }
  if (additions.length) fs.appendFileSync(file, `\n# Generated local development secrets\n${additions.join('\n')}\n`);
}

console.log('\nEnvironment files are ready. Add your MongoDB Atlas URI and Groq API key to apps/agent/.env.');
if (ownerPassword) console.log(`One-time generated bootstrap owner password: ${ownerPassword}`);
console.log('This command never generates external provider keys and never overwrites non-placeholder values.');
