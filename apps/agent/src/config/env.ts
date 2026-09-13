import fs from 'node:fs';
import path from 'node:path';

/**
 * The agent's entry into the workspace-wide `.env`.
 *
 * Every file that used to call `dotenv.config()` calls `loadEnv()` instead, so
 * the whole process reads one file at the repository root no matter which
 * directory it was started from — `apps/agent`, the repo root, or `dist`.
 */

/** Walk up until the package.json that declares the workspaces is found. */
function workspaceRoot(): string {
    let directory = __dirname;
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
        if (parent === directory) throw new Error(`Could not find the workspace root from ${__dirname}`);
        directory = parent;
    }
}

let loaded = false;

/** Read the workspace environment once per process; later calls are free. */
export function loadEnv(): void {
    if (loaded) return;
    loaded = true;
    // Resolved at runtime: the loader lives outside this package's rootDir, so it
    // is shared with the two Next apps rather than duplicated three times.
    const loader = require(path.join(workspaceRoot(), 'scripts', 'load-env.cjs'));
    loader.loadEnv('agent');
}

export default loadEnv;
