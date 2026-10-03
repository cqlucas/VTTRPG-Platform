import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@questdreamer/ui",
    "@questdreamer/types",
    "@questdreamer/webrtc",
  ],
};

export default nextConfig;
