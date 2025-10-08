import type { NextConfig } from "next";
import dotenv from "dotenv";

// Load .env at the very top
dotenv.config();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  // Any other config you need
};

export default nextConfig;
