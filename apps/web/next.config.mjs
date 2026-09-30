/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@keyzen/crypto', '@keyzen/db'],
};

export default nextConfig;
