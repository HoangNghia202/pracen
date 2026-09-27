import { defineConfig } from "steiger";
import fsd from "@feature-sliced/steiger-plugin";

export default defineConfig([
  ...fsd.configs.recommended,
  {
    // Disable typo-in-layer-name rule to allow underscore-prefixed Next.js layers (_app, _pages)
    // The important cross-layer import enforcement via forbidden-imports still works correctly
    rules: {
      "fsd/typo-in-layer-name": "off",
    },
  },
]);
