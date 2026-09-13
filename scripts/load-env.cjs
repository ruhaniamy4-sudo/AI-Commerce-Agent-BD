/**
 * One environment file for the whole workspace.
 *
 * The root `.env` is divided into sections by an `# @app` marker. Lines before
 * the first marker go to every app; lines after a marker go only to the apps it
 * names. That keeps a single file to edit while still giving each process only
 * what it needs — the public storefront has no business holding the database
 * password, and the same name can carry a different value per app:
 *
 *     OAUTH_INTERNAL_SECRET=shared-between-agent-and-dashboard
 *
 *     # @app agent
 *     MONGODB_URI=...
 *     GOOGLE_CLIENT_ID=<the agent's Calendar client>
 *
 *     # @app dashboard
 *     GOOGLE_CLIENT_ID=<the dashboard's sign-in client>
 *
 *     # @app agent, dashboard
 *     DASHBOARD_URL=...
 *
 * An `apps/<app>/.env` file, if one exists, still wins over the root file, and
 * anything already set in the real environment — Render, Vercel, CI — is never
 * overwritten.
 */
const fs = require('node:fs');
const path = require('node:path');

const APPS = ['agent', 'dashboard', 'storefront'];
const MARKER = /^[ \t]*#[ \t]*@app[ \t]+(.+?)[ \t]*$/;

/** Walk up until the package.json that declares the workspaces is found. */
function workspaceRoot(start = __dirname) {
    let directory = start;
    for (;;) {
        const manifest = path.join(directory, 'package.json');
        if (fs.existsSync(manifest)) {
            try {
                if (JSON.parse(fs.readFileSync(manifest, 'utf8')).workspaces) return directory;
            } catch {
                // A manifest we cannot read is not the one we are looking for.
            }
        }
        const parent = path.dirname(directory);
        if (parent === directory) throw new Error(`Could not find the workspace root from ${start}`);
        directory = parent;
    }
}

/**
 * Split a file into `{ apps, body }` blocks. `apps` is null for the opening
 * block, which belongs to everyone.
 */
function sections(text) {
    const blocks = [{ apps: null, body: [] }];
    for (const line of text.split(/\r?\n/)) {
        const marker = line.match(MARKER);
        if (!marker) {
            blocks[blocks.length - 1].body.push(line);
            continue;
        }
        const named = marker[1].split(/[,\s]+/).filter(Boolean).map((name) => name.toLowerCase());
        const unknown = named.filter((name) => name !== '*' && !APPS.includes(name));
        if (unknown.length) throw new Error(`Unknown app in "# @app ${marker[1]}": ${unknown.join(', ')}`);
        blocks.push({ apps: named.includes('*') ? null : named, body: [] });
    }
    return blocks.map((block) => ({ apps: block.apps, body: block.body.join('\n') }));
}

/** The values one app is allowed to see from one file. */
function valuesFor(app, text) {
    const { parse } = require('dotenv');
    const values = {};
    for (const block of sections(text)) {
        if (block.apps && !block.apps.includes(app)) continue;
        Object.assign(values, parse(block.body));
    }
    return values;
}

/**
 * Load the environment for one app.
 *
 * @param {'agent'|'dashboard'|'storefront'} app
 * @returns {{root: string, files: string[], values: Record<string,string>}}
 */
function loadEnv(app, options = {}) {
    if (!APPS.includes(app)) throw new Error(`Unknown app "${app}"; expected one of ${APPS.join(', ')}`);
    const root = options.root || workspaceRoot();

    const values = {};
    const files = [];
    // Root first, then the app's own file, so a per-app file still wins.
    for (const file of [path.join(root, '.env'), path.join(root, 'apps', app, '.env')]) {
        if (!fs.existsSync(file)) continue;
        files.push(file);
        Object.assign(values, valuesFor(app, fs.readFileSync(file, 'utf8')));
    }

    for (const [key, value] of Object.entries(values)) {
        if (process.env[key] === undefined) process.env[key] = value;
    }
    return { root, files, values };
}

/** The subset Next.js inlines into the browser bundle. */
function publicEnv(values) {
    return Object.fromEntries(Object.entries(values).filter(([key]) => key.startsWith('NEXT_PUBLIC_')));
}

module.exports = { loadEnv, publicEnv, workspaceRoot, sections, valuesFor, APPS };
