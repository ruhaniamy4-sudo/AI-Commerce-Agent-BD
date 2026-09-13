import type { NextConfig } from "next";
import { createRequire } from "node:module";

// The storefront reads the workspace-wide .env at the repository root.
const { loadEnv, publicEnv } = createRequire(import.meta.url)("../../scripts/load-env.cjs");
const { values } = loadEnv("storefront");

const nextConfig: NextConfig = {
  transpilePackages: ['@edutechs/shared'],
  // Next only inlines browser values it can see at build time, and the root file
  // is loaded here rather than by Next itself.
  env: publicEnv(values),
};

export default nextConfig;
