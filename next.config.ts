import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep project AGENTS.md as the Cursor/docs pointer - do not let Next overwrite it
  agentRules: false,
  experimental: {
    serverActions: {
      // Own photos for posts (limit 8 MB in lib/storage) are sent through a server action.
      bodySizeLimit: "9mb",
    },
  },
};

export default nextConfig;
