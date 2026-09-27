import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    // Playwright's e2e suite lives under `e2e/` and calls `test.describe()`
    // from `@playwright/test`, which throws when collected by Vitest's own
    // test runner ("Playwright Test did not expect test.describe() to be
    // called here"). Vitest's default `exclude` doesn't know about this
    // project's `e2e/` directory, so add it explicitly — Playwright's own
    // config (`playwright.config.ts`) is what actually runs those files.
    exclude: [...configDefaults.exclude, "e2e/**"],
    server: {
      // `next-auth` is an ESM package whose `lib/env.js` imports the bare
      // specifier "next/server" without a file extension. Node's native ESM
      // resolver (used for externalized/SSR deps) requires an explicit
      // extension and has no "exports" map to fall back on for the `next`
      // package, so it throws "Cannot find module .../next/server" unless
      // Vite processes the import itself. Inlining these deps routes them
      // through Vite's resolver instead of Node's raw ESM loader.
      deps: {
        inline: ["next-auth", "@auth/drizzle-adapter"],
      },
    },
  },
});
