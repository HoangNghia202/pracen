// Fails fast with an actionable message instead of letting a missing
// DATABASE_URL surface as an opaque driver-level error (e.g. the Neon
// serverless client throwing deep inside a query with no hint about what's
// actually wrong). Called from `@/shared/api/db/client` at module load.
export function getDatabaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and provide a Postgres connection string (see README.md for setup instructions)."
    );
  }
  return value;
}
