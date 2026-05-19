/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  experimental: {
    devtoolSegmentExplorer: false
  },
  webpack(config, { dev }) {
    if (dev) {
      config.cache = {
        type: 'memory'
      };
    }

    return config;
  }
};

module.exports = nextConfig;
