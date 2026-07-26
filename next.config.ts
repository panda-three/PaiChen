import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function nextConfig(phase: string): NextConfig {
  return {
    // `next dev` and `next build` may run concurrently during verification.
    // Separate outputs prevent either compiler from invalidating the other's chunks.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
    experimental: {
      serverActions: { bodySizeLimit: "5mb" },
    },
  };
}
