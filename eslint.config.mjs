import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Gegenereerd door `npm run cf-typegen`; niet onze code om op te schonen.
    "worker-configuration.d.ts",
    // Tijdelijke bundles van `wrangler dev`/`deploy`.
    ".wrangler/**",
  ]),
]);

export default eslintConfig;
