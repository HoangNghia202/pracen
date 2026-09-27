"use server";

import { registerSchema } from "../model/schema";
import { createUser, getUserByEmail } from "@/entities/user";
import { hashPassword } from "@/shared/lib/password";
import { db as defaultDb } from "@/shared/api";

export type RegisterResult = { ok: true } | { ok: false; error: string };

// Same "optional db, defaults to the real client" shape as
// `authorizeCredentials` in `src/_app/api-routes/auth.ts`. This lets tests
// inject a PGlite test db directly instead of mocking `@/shared/api/db/client`
// — mocking that module deadlocks here, because `createTestDb` (via
// `@/shared/testing`) imports `@/shared/api` for `schema`, and that barrel
// re-exports `db` from the very module being mocked, so instantiating the
// mock factory ends up waiting on itself to finish instantiating.
type Db = Parameters<typeof getUserByEmail>[1];

export async function registerWithCredentials(
  input: unknown,
  dbInstance: Db = defaultDb
): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const existing = await getUserByEmail(parsed.data.email, dbInstance);
  if (existing) {
    return { ok: false, error: "An account with this email already exists" };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await createUser(
    { email: parsed.data.email, name: parsed.data.name, passwordHash },
    dbInstance
  );

  return { ok: true };
}
