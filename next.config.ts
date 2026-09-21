import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep project AGENTS.md as the Cursor/docs pointer - do not let Next overwrite it
  agentRules: false,
};

export default nextConfig;
