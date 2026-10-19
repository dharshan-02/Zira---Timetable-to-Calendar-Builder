import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  distDir: process.env.NEXT_DIST_DIR || '.next',
  cacheComponents: true,
  partialPrefetching: true,
  // PDF.js dynamically loads its worker at runtime. Keeping it external
  // avoids Turbopack rewriting the worker path into a non-existent chunk.
  serverExternalPackages: ['pdfjs-dist'],
  // The worker is loaded with a dynamic import inside pdfjs-dist, so Next's
  // file tracer cannot reliably discover it in the standalone output.
  outputFileTracingIncludes: {
    '/api/source': ['./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'],
  },
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
