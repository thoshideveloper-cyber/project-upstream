import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A handful of static product PNGs — skip the optimizer (and the sharp dep).
  images: { unoptimized: true },
};

export default nextConfig;
