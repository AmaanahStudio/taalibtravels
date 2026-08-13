import path from "node:path";

import type { NextConfig } from "next";

import { DEVICE_SIZES, IMAGE_SIZES } from "./scripts/image-sizes.mjs";

const nextConfig: NextConfig = {
  turbopack: {
    // Er staat ook een package-lock.json in de home-directory; zonder deze
    // regel kiest Turbopack die map als workspace-root.
    root: path.resolve(import.meta.dirname),
  },
  output: "export",
  images: {
    /*
     * Een statische export draait de Image Optimization API van Next nergens.
     * Het alternatief `unoptimized: true` levert helemaal geen `srcset` op — dan
     * haalt een telefoon dezelfde foto van 1400px binnen als een desktop. Met een
     * eigen loader mag dat wél: `scripts/build-images.mjs` maakt de WebP-varianten
     * bij het bouwen, `image-loader.ts` wijst ze aan.
     */
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",

    // Moeten gelijk blijven aan wat build-images.mjs genereert, anders vraagt de
    // browser een variant op die niet bestaat.
    deviceSizes: DEVICE_SIZES,
    imageSizes: IMAGE_SIZES,
  },

  // TODO(backend): zodra foto's van een CDN of uit MongoDB/GridFS komen, voeg
  // je hier `images.remotePatterns` toe met het toegestane domein. Zolang alles
  // uit /public komt is er geen extra configuratie nodig.
};

export default nextConfig;
