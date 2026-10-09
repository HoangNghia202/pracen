import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db, schema } from "@/shared/api";
import { getUserByEmail } from "@/entities/user";
import { verifyPassword } from "@/shared/lib/password";
import { loginSchema } from "@/features/user/auth-by-credentials";
import type { User } from "@/entities/user";

type Db = Parameters<typeof getUserByEmail>[1];

export async function authorizeCredentials(
  raw: unknown,
  dbInstance: Db = db
): Promise<Pick<User, "id" | "email" | "name" | "image"> | null> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return null;

  const user = await getUserByEmail(parsed.data.email, dbInstance);
  if (!user?.passwordHash) return null;

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) return null;

  return { id: user.id, email: user.email, name: user.name, image: user.image };
}

// `@auth/drizzle-adapter`'s Postgres adapter expects its schema argument to
// use the keys `usersTable`/`accountsTable`/`sessionsTable`/
// `verificationTokensTable` (see `DefaultPostgresSchema` in
// `@auth/drizzle-adapter/lib/pg.d.ts`), not our own table export names from
// `src/shared/api/db/schema.ts` (`users`, `accounts`, `sessions`,
// `verificationTokens`). Remap them explicitly rather than passing the
// barrel's `schema` namespace straight through.
const adapterSchema = {
  usersTable: schema.users,
  accountsTable: schema.accounts,
  sessionsTable: schema.sessions,
  verificationTokensTable: schema.verificationTokens,
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, adapterSchema),
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: (raw) => authorizeCredentials(raw),
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
});
