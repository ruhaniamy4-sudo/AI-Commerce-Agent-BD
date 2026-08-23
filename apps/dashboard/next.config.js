/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost', '127.0.0.1', 'localhost:3000', 'res.cloudinary.com'],
  },
}

module.exports = nextConfig
