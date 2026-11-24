import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CLAUDE.md es la única fuente de instrucciones para agentes en este repositorio.
  agentRules: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
