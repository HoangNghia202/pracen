import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
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
