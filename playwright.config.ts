import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // A freshly started `next dev` server compiles each route on-demand the
  // first time it's visited. In a cold worktree (no warm .next cache) the
  // very first authenticated navigation (e.g. to "/" right after
  // registering) can take several seconds to compile, which comfortably
  // exceeds Playwright's 5s/30s defaults and produces a flaky-looking
  // "URL never changed" failure that has nothing to do with the app logic.
  // Give assertions and tests more wall-clock room instead of masking it.
  expect: { timeout: 15_000 },
  timeout: 60_000,
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
  use: { baseURL: "http://localhost:3000" },
});
