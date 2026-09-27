import "@testing-library/jest-dom/vitest";

// `neon()` in src/shared/api/db/client.ts validates its connection string
// synchronously at module load, even though no test ever queries through the
// production client (every test injects a PGlite test db explicitly via the
// `db` parameter). Without this, merely importing a module that references
// the production `db` client as a default-parameter fallback crashes.
process.env.DATABASE_URL ??= "postgres://user:pass@localhost:5432/placeholder";
