import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CLAUDE.md es la única fuente de instrucciones para agentes en este repositorio.
  agentRules: false,
  cacheComponents: true,
  // No anunciar el framework en cada respuesta (X-Powered-By: Next.js).
  poweredByHeader: false,
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
