import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep project AGENTS.md as the Cursor/docs pointer - do not let Next overwrite it
  agentRules: false,
  // BullMQ loads its Lua scripts and Bull Board its UI from node_modules at
  // runtime - bundling them breaks both.
  serverExternalPackages: [
    "bullmq",
    "ioredis",
    "@bull-board/api",
    "@bull-board/hono",
    "@bull-board/ui",
    "ejs",
  ],
  experimental: {
    // Coming back to a screen visited in the last 30 s does not ask the server.
    // Saves call revalidatePath, which clears this, so own changes always show.
    staleTimes: { dynamic: 30 },
    serverActions: {
      // Own photos for posts (limit 8 MB in lib/storage) are sent through a server action.
      bodySizeLimit: "9mb",
    },
  },
};

export default nextConfig;
