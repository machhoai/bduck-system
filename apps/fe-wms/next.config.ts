import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
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
  const m = String(now.getMonth() + 1);
  const d = String(now.getDate());

  const buildId =
    process.env.BUILD_NUMBER ??
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
    "dev";

  return `${yy}${m}${d}.${buildId}`;
}

const appDir = dirname(fileURLToPath(import.meta.url));
const isLocalDevelopment = process.env.NODE_ENV === "development";
if (isLocalDevelopment) {
  loadEnvConfig(join(appDir, "../.."), true, console, true);
}

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  env: {
    NEXT_PUBLIC_BUILD_VERSION: generateBuildVersion(),
    NEXT_PUBLIC_LOCAL_TEST_FIREBASE_API_KEY: isLocalDevelopment
      ? process.env.TEST_NEXT_PUBLIC_FIREBASE_API_KEY
      : "",
    NEXT_PUBLIC_LOCAL_TEST_FIREBASE_AUTH_DOMAIN: isLocalDevelopment
      ? process.env.TEST_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
      : "",
    NEXT_PUBLIC_LOCAL_TEST_FIREBASE_PROJECT_ID: isLocalDevelopment
      ? process.env.TEST_NEXT_PUBLIC_FIREBASE_PROJECT_ID
      : "",
    NEXT_PUBLIC_LOCAL_TEST_FIREBASE_STORAGE_BUCKET: isLocalDevelopment
      ? process.env.TEST_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
      : "",
    NEXT_PUBLIC_LOCAL_TEST_FIREBASE_MESSAGING_SENDER_ID: isLocalDevelopment
      ? process.env.TEST_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
      : "",
    NEXT_PUBLIC_LOCAL_TEST_FIREBASE_APP_ID: isLocalDevelopment
      ? process.env.TEST_NEXT_PUBLIC_FIREBASE_APP_ID
      : "",
    NEXT_PUBLIC_LOCAL_PROD_FIREBASE_API_KEY: isLocalDevelopment
      ? process.env.PROD_NEXT_PUBLIC_FIREBASE_API_KEY
      : "",
    NEXT_PUBLIC_LOCAL_PROD_FIREBASE_AUTH_DOMAIN: isLocalDevelopment
      ? process.env.PROD_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
      : "",
    NEXT_PUBLIC_LOCAL_PROD_FIREBASE_PROJECT_ID: isLocalDevelopment
      ? process.env.PROD_NEXT_PUBLIC_FIREBASE_PROJECT_ID
      : "",
    NEXT_PUBLIC_LOCAL_PROD_FIREBASE_STORAGE_BUCKET: isLocalDevelopment
      ? process.env.PROD_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
      : "",
    NEXT_PUBLIC_LOCAL_PROD_FIREBASE_MESSAGING_SENDER_ID: isLocalDevelopment
      ? process.env.PROD_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
      : "",
    NEXT_PUBLIC_LOCAL_PROD_FIREBASE_APP_ID: isLocalDevelopment
      ? process.env.PROD_NEXT_PUBLIC_FIREBASE_APP_ID
      : "",
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
