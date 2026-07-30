import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Er staat ook een package-lock.json in de home-directory; zonder deze
    // regel kiest Turbopack die map als workspace-root.
    root: path.resolve(import.meta.dirname),
  },

  // TODO(backend): zodra foto's van een CDN of uit MongoDB/GridFS komen, voeg
  // je hier `images.remotePatterns` toe met het toegestane domein. Zolang alles
  // uit /public komt is er geen extra configuratie nodig.
};

export default nextConfig;
