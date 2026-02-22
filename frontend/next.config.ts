import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NEXT_PUBLIC_API_URL
          ? `${process.env.NEXT_PUBLIC_API_URL}/:path*`
          : 'https://intervention-analyzer-production.up.railway.app/api/:path*',
      },
    ];
  },
};

export default nextConfig;
// Force rebuild 1771778150
