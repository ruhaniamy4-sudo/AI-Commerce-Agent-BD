/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@edutechs/shared'],
  reactStrictMode: true,
  // Keep `next build` from replacing assets used by a concurrently running
  // development server. Both commands otherwise share `.next`.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  images: {
    domains: ['localhost', '127.0.0.1', 'localhost:3000', 'res.cloudinary.com'],
  },
}

module.exports = nextConfig
