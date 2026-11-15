import path from "node:path";

import type { NextConfig } from "next";

import { DEVICE_SIZES, IMAGE_SIZES } from "./scripts/image-sizes.mjs";

const nextConfig: NextConfig = {
  turbopack: {
    // Er staat ook een package-lock.json in de home-directory; zonder deze
    // regel kiest Turbopack die map als workspace-root.
    root: path.resolve(import.meta.dirname),
  },
  images: {
    /*
     * Eigen loader: de varianten komen uit `scripts/build-images.mjs`, niet uit de
     * Image Optimization API van Next. Zo krijgt elke foto een `srcset` zonder dat
     * er per afbeelding een Worker-aanroep nodig is.
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
