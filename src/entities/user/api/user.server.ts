import { db as defaultDb, users, schema } from "@/shared/api";
import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { User } from "../model/types";

// `PgQueryResultHKT` is the base interface both the production Neon HTTP
// driver and the PGlite test driver's concrete result-kind types extend, so
// this accepts either without needing a per-driver union.
type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export async function getUserByEmail(email: string, db: Db = defaultDb): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.email, email));
  return rows[0] ?? null;
}

export async function createUser(
  input: { email: string; name?: string; passwordHash: string },
  db: Db = defaultDb
): Promise<User> {
  const rows = await db
    .insert(users)
    .values({ email: input.email, name: input.name ?? null, passwordHash: input.passwordHash })
    .returning();
  return rows[0];
}
