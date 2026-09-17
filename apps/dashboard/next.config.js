// The dashboard reads the workspace-wide .env at the repository root.
const { loadEnv, publicEnv } = require('../../scripts/load-env.cjs')

const { values } = loadEnv('dashboard')

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@edutechs/shared'],
  reactStrictMode: true,
  // Keep `next build` from replacing assets used by a concurrently running
  // development server. Both commands otherwise share `.next`. NEXT_DIST_DIR
  // overrides it again so a second server (a benchmark, a bisect) can run
  // beside the first instead of fighting it for the same cache.
  distDir: process.env.NEXT_DIST_DIR || (process.env.NODE_ENV === 'development' ? '.next-dev' : '.next'),
  images: {
    // `domains` is deprecated in Next 16, and it never accepted a port anyway —
    // the 'localhost:3000' entry was silently doing nothing.
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
  // Next only inlines browser values it can see at build time, and the root file
  // is loaded here rather than by Next itself.
  env: publicEnv(values),
}

module.exports = nextConfig
