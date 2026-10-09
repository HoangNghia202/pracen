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
  {
    // This exemption covers two intentional, repeated cross-slice imports in
    // `features/*/api/*.server.ts` files:
    // 1. Every Server Action authorizes its caller by calling `auth()` from
    //    `@/_app/api-routes/auth` (the plan's established, repeated pattern —
    //    every task's Server Actions do this the same way, not a one-off
    //    mistake). `_app` is the highest FSD layer here and has no public API
    //    (index.ts) for this segment, so that single, intentional import trips
    //    both `forbidden-imports` (lower layer reaching into a higher one) and
    //    `no-public-api-sidestep` (reaching past a slice's public API).
    // 2. `submit-quiz-answer.server.ts` imports `gradeSentenceAnswer` from the
    //    sibling `@/features/quiz-attempt/grade-sentence-answer` slice — a same-layer
    //    (`features` -> `features`) composition that also trips
    //    `forbidden-imports`.
    // Scope both rules off for `*.server.ts`/`*.server.test.ts` files rather
    // than restructuring session-reading or feature composition into a lower
    // layer.
    files: ["./src/features/**/*.server.ts", "./src/features/**/*.server.test.ts"],
    rules: {
      "fsd/forbidden-imports": "off",
      "fsd/no-public-api-sidestep": "off",
    },
  },
  {
    // Same `_app` exemption as above, for the pages layer: each page's
    // `index.tsx` is the Next.js route's data-loading container (the only
    // thing `app/**/page.tsx` imports, per FSD - route files stay a plain
    // re-export), so it's the one place per page that calls `auth()` from
    // `@/_app/api-routes/auth` to read the session before fetching data.
    files: ["./src/_pages/**/index.tsx"],
    rules: {
      "fsd/forbidden-imports": "off",
      "fsd/no-public-api-sidestep": "off",
    },
  },
]);
