import type { NextConfig } from "next";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Auto-generate build version: yy/m/d.N
 * N = BUILD_NUMBER env var (from CI/CD pipeline), defaults to 0 for local dev
 */
function generateBuildVersion(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2); // "26"
  const m = String(now.getMonth() + 1);          // "6" (no leading zero)
  const d = String(now.getDate());               // "4" (no leading zero)
  const buildNum = process.env.BUILD_NUMBER ?? "0";
  return `${yy}${m}${d}.${buildNum}`;
}

const appDir = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  env: {
    NEXT_PUBLIC_BUILD_VERSION: generateBuildVersion(),
  },
  outputFileTracingRoot: join(appDir, "../.."),
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
    ],
  },
};

export default nextConfig;
