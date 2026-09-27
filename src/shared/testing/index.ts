// Test-only DB helpers (PGlite) live here instead of `@/shared/api` because
// `@electric-sql/pglite` is Node-only. If it were reachable from
// `@/shared/api`'s barrel, Next's Edge bundler would fail to compile
// `middleware.ts`, which imports that barrel transitively via `auth()`. Only
// import from `@/shared/testing` in test files, never from production code.
export { createTestDb } from "./db";
export type { TestDb } from "./db";
