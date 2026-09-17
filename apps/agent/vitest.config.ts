import { defineConfig } from 'vitest/config';

export default defineConfig({
    // Without this, vitest writes its cache to apps/<app>/node_modules/.vite and
    // recreates a node_modules folder inside a workspace that has no
    // dependencies of its own. Dependencies live at the root; so does the cache.
    cacheDir: '../../node_modules/.vite',
});
