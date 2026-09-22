import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse ships its own pdf.js worker chunks that Turbopack must not
  // bundle — load it from node_modules at runtime instead.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
