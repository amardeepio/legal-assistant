import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a self-contained .next/standalone server for the Docker image.
  output: "standalone",
  // pdf-parse ships its own pdf.js worker chunks that Turbopack must not
  // bundle — load it from node_modules at runtime instead.
  serverExternalPackages: ["pdf-parse"],
  // pdf-parse loads its pdf.js worker file by path at runtime, which Next's
  // dependency tracing misses (it only sees the static import). Copy the full
  // packages into the standalone output so /api/extract-pdf works on Cloud Run.
  outputFileTracingIncludes: {
    "/api/extract-pdf": [
      "./node_modules/.pnpm/pdf-parse@*/node_modules/pdf-parse/**",
      "./node_modules/.pnpm/pdfjs-dist@*/node_modules/pdfjs-dist/**",
    ],
  },
};

export default nextConfig;
