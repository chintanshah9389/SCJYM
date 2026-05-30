/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@scjygm/shared"],
  images: {
    domains: ["res.cloudinary.com"],
  },
};

module.exports = nextConfig;
