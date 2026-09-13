/**
 * The environment loader decides what every process can read, so its rules are
 * pinned down here: who sees which section, who wins, and what never leaks
 * between apps.
 *
 * Run: node --test scripts/__tests__/load-env.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { loadEnv, valuesFor, publicEnv, workspaceRoot } = require('../load-env.cjs');

function fixture(files) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sellpilot-env-'));
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ workspaces: ['apps/*'] }));
    for (const [relative, body] of Object.entries(files)) {
        const file = path.join(root, relative);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, body);
    }
    return root;
}

const SAMPLE = [
    'OAUTH_INTERNAL_SECRET=shared',
    '',
    '# @app agent',
    'MONGODB_URI=mongodb://local',
    'GOOGLE_CLIENT_ID=agent-client',
    '',
    '# @app dashboard',
    'GOOGLE_CLIENT_ID=dashboard-client',
    'NEXTAUTH_SECRET=dashboard-only',
    '',
    '# @app agent, dashboard',
    'DASHBOARD_URL=http://localhost:3000',
    '',
    '# @app storefront',
    'NEXT_PUBLIC_SITE_URL=https://shop',
    '',
].join('\n');

test('lines above the first marker reach every app', () => {
    for (const app of ['agent', 'dashboard', 'storefront']) {
        assert.equal(valuesFor(app, SAMPLE).OAUTH_INTERNAL_SECRET, 'shared');
    }
});

test('a section reaches only the apps it names', () => {
    assert.equal(valuesFor('agent', SAMPLE).MONGODB_URI, 'mongodb://local');
    assert.equal(valuesFor('dashboard', SAMPLE).MONGODB_URI, undefined, 'the dashboard has no business holding the database URI');
    assert.equal(valuesFor('storefront', SAMPLE).MONGODB_URI, undefined, 'nor does the public storefront');
    assert.equal(valuesFor('storefront', SAMPLE).NEXTAUTH_SECRET, undefined);
});

test('a marker may name several apps', () => {
    assert.equal(valuesFor('agent', SAMPLE).DASHBOARD_URL, 'http://localhost:3000');
    assert.equal(valuesFor('dashboard', SAMPLE).DASHBOARD_URL, 'http://localhost:3000');
    assert.equal(valuesFor('storefront', SAMPLE).DASHBOARD_URL, undefined);
});

test('the same name carries a different value per app', () => {
    assert.equal(valuesFor('agent', SAMPLE).GOOGLE_CLIENT_ID, 'agent-client');
    assert.equal(valuesFor('dashboard', SAMPLE).GOOGLE_CLIENT_ID, 'dashboard-client');
    assert.equal(valuesFor('storefront', SAMPLE).GOOGLE_CLIENT_ID, undefined);
});

test('a section for an app that does not exist is a loud error, not a silent miss', () => {
    assert.throws(() => valuesFor('agent', '# @app admin\nKEY=value\n'), /Unknown app/);
});

test('a per-app file still wins over the root file', () => {
    const root = fixture({
        '.env': '# @app agent\nPORT=4000\nSHARED=root\n',
        'apps/agent/.env': 'PORT=5000\n',
    });
    const { values, files } = loadEnv('agent', { root });
    assert.equal(values.PORT, '5000');
    assert.equal(values.SHARED, 'root', 'the root file still supplies everything the app file omits');
    assert.equal(files.length, 2);
});

test('the real environment is never overwritten', () => {
    const root = fixture({ '.env': 'ALREADY_SET=from-file\n' });
    process.env.ALREADY_SET = 'from-render';
    try {
        loadEnv('agent', { root });
        assert.equal(process.env.ALREADY_SET, 'from-render', 'a deployed value must survive the file');
    } finally {
        delete process.env.ALREADY_SET;
    }
});

test('only NEXT_PUBLIC_ values are offered to the browser bundle', () => {
    assert.deepEqual(
        publicEnv({ NEXT_PUBLIC_API_URL: 'https://api', GROQ_API_KEY: 'secret' }),
        { NEXT_PUBLIC_API_URL: 'https://api' },
    );
});

test('an unknown app is rejected rather than silently reading nothing', () => {
    assert.throws(() => loadEnv('admin'), /Unknown app/);
});

test('the workspace root is found from this file', () => {
    const found = workspaceRoot();
    const manifest = JSON.parse(fs.readFileSync(path.join(found, 'package.json'), 'utf8'));
    assert.ok(manifest.workspaces);
});

test('this repository\'s own .env keeps the agent\'s secrets away from the storefront', () => {
    const file = path.join(workspaceRoot(), '.env');
    if (!fs.existsSync(file)) return; // a fresh clone has no .env yet
    const text = fs.readFileSync(file, 'utf8');
    const storefront = valuesFor('storefront', text);
    for (const secret of ['MONGODB_URI', 'GROQ_API_KEY', 'OPENAI_API_KEY', 'CLOUDINARY_API_SECRET', 'AUTH_JWT_SECRET']) {
        assert.equal(storefront[secret], undefined, `the storefront must not receive ${secret}`);
    }
    assert.ok(valuesFor('agent', text).MONGODB_URI, 'the agent still gets what it needs');
});
