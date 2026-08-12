import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Er staat ook een package-lock.json in de home-directory; zonder deze
    // regel kiest Turbopack die map als workspace-root.
    root: path.resolve(import.meta.dirname),
  },
  output: "export",
  images: {
    // Bij een statische export is de ingebouwde optimizer uitgeschakeld. Met
    // een eigen loader krijgt `next/image` alsnog een echte `srcset`, wijzend
    // naar de WebP-varianten die scripts/optimize-images.mjs vooraf schrijft.
    // Zonder dit downloadt ook een telefoon de bron van 1400px.
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    // De bronfoto's zijn 1400px breed, dus grotere varianten leveren niets op.
    // Deze twee lijsten samen moeten gelijk blijven aan WIDTHS in het script en
    // in de loader.
    deviceSizes: [640, 750, 828, 1080, 1200, 1400],
    imageSizes: [256, 384],
  },

  // TODO(backend): zodra foto's van een CDN of uit MongoDB/GridFS komen, voeg
  // je hier `images.remotePatterns` toe met het toegestane domein. Zolang alles
  // uit /public komt is er geen extra configuratie nodig.
};

export default nextConfig;
