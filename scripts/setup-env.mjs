import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readEnv } from './env-utils.mjs';

/**
 * Prepare the one environment file the whole workspace reads.
 *
 * There used to be three of these, which meant OAUTH_INTERNAL_SECRET had to be
 * kept identical in two places by hand. With a single sectioned file that class
 * of bug is gone, so this script only fills in the local development secrets
 * that are safe to generate — never overwriting a value that is already real.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, '.env');
const example = path.join(root, '.env.example');
const generated = () => crypto.randomBytes(32).toString('base64url');
const placeholders = /^(?:$|replace_|your_|changeme|<)/i;

// Each secret is appended under the section of the app that actually reads it.
const secrets = [
    { key: 'AUTH_JWT_SECRET', apps: 'agent' },
    { key: 'COURIER_CREDENTIALS_ENCRYPTION_KEY', apps: 'agent' },
    { key: 'BOOTSTRAP_OWNER_PASSWORD', apps: 'agent' },
    { key: 'NEXTAUTH_SECRET', apps: 'dashboard' },
    { key: 'OAUTH_INTERNAL_SECRET', apps: 'agent, dashboard' },
];

if (!fs.existsSync(file)) {
    if (!fs.existsSync(example)) throw new Error('Missing template: .env.example');
    fs.copyFileSync(example, file, fs.constants.COPYFILE_EXCL);
    console.log('Created .env');
} else {
    console.log('Preserved existing .env');
}

const current = readEnv(file);
const missing = secrets.filter(({ key }) => !(key in current) || placeholders.test(current[key]));
let ownerPassword;

if (missing.length) {
    const byApps = new Map();
    for (const { key, apps } of missing) {
        const value = generated();
        if (key === 'BOOTSTRAP_OWNER_PASSWORD') ownerPassword = value;
        byApps.set(apps, [...(byApps.get(apps) || []), `${key}=${value}`]);
    }
    // A later section wins, so appending is enough — no need to rewrite the file.
    const blocks = [...byApps].map(([apps, lines]) =>
        [`# @app ${apps}`, '# Generated local development secrets', ...lines].join('\n'));
    fs.appendFileSync(file, `\n${blocks.join('\n\n')}\n`);
    console.log(`Generated ${missing.length} local secret${missing.length === 1 ? '' : 's'}.`);
}

// A leftover per-app file silently wins over the root one, which is exactly the
// confusion this consolidation removed.
const leftovers = ['agent', 'dashboard', 'storefront']
    .map((app) => path.join(root, 'apps', app, '.env'))
    .filter((candidate) => fs.existsSync(candidate));
if (leftovers.length) {
    console.warn('\nWarning: these per-app files still override the root .env:');
    for (const leftover of leftovers) console.warn(`  ${path.relative(root, leftover)}`);
    console.warn('Move anything you still need into the root .env and delete them.');
}

console.log('\nEnvironment is ready. Add your MongoDB Atlas URI and Groq API key to .env.');
if (ownerPassword) console.log(`One-time generated bootstrap owner password: ${ownerPassword}`);
console.log('This command never generates external provider keys and never overwrites real values.');
