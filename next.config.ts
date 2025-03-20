/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Importante para páginas que usam Firebase Authentication
  experimental: {
    appDir: true,
  },
};

module.exports = nextConfig;
