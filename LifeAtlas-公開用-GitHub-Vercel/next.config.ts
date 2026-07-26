import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: ".next-build",
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
