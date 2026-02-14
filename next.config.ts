import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,

  async redirects() {
    return [
      {
        source: "/",
        destination: "/api/health",
        permanent: false,
      },
    ];
  },

  logging: {
    fetches: {
      fullUrl: true,
    },
  },

  serverExternalPackages: ["bcrypt"],
};

export default nextConfig;
