import type { NextConfig } from "next";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Auto-generate build version: yymmd.BUILD_ID
 *
 * Priority:
 *  1. BUILD_NUMBER              — Docker / self-hosted CI (sequential number)
 *  2. VERCEL_GIT_COMMIT_SHA     — Vercel injects this automatically at build time (short git SHA)
 *  3. "dev"                     — local development fallback
 */
function generateBuildVersion(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const m  = String(now.getMonth() + 1);
  const d  = String(now.getDate());

  const buildId =
    process.env.BUILD_NUMBER ??
    (process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)) ??
    "dev";

  return `${yy}${m}${d}.${buildId}`;
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
