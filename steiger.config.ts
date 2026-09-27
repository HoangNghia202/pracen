import { defineConfig } from "steiger";
import fsd from "@feature-sliced/steiger-plugin";

export default defineConfig([
  ...fsd.configs.recommended,
  {
    // Disable typo-in-layer-name rule to allow underscore-prefixed Next.js layers (_app, _pages)
    // The important cross-layer import enforcement via forbidden-imports still works correctly
    rules: {
      "fsd/typo-in-layer-name": "off",
      // This project is built task-by-task from an implementation plan: a
      // slice routinely lands in one task and gains its first consumer in a
      // later one (e.g. entities/user is added here but only imported once
      // the Auth.js config/Server Actions tasks land). That's normal for
      // this workflow, not dead code.
      "fsd/insignificant-slice": "off",
    },
  },
  {
    files: ["./src/**/*.test.ts", "./src/**/*.test.tsx"],
    rules: {
      // Server Action / entity tests routinely compose fixtures from sibling
      // entities (e.g. createUser + createFolder as setup for a vocab-item
      // test). That's normal test-fixture reuse, not a production import-graph
      // violation — production code still can't cross-import entities.
      "fsd/forbidden-imports": "off",
    },
  },
]);
