# Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Next.js 15 project from scratch and ship the Auth module — email/password registration and login, Google OAuth, session handling, route protection, and logout — as a working, testable slice with a minimal placeholder home page (the real Dashboard/Library/Quiz modules are separate, later plans).

**Architecture:** Feature-Sliced Design on Next.js App Router (`app/` is routing-only; all logic lives under `src/` in `_app → _pages → widgets → features → entities → shared` layers, enforced by Steiger). Auth.js (NextAuth v5) issues JWT sessions; the Drizzle adapter persists users/accounts in Postgres so Google OAuth account linking works. Credentials `authorize()` and all app-authored DB queries go through Drizzle directly.

**Tech Stack:** Next.js 15 (App Router) + TypeScript + React 19, Tailwind v4 + shadcn/ui ("new-york", zinc base), Auth.js v5 (`next-auth@5`) + `@auth/drizzle-adapter`, Drizzle ORM + Postgres (Neon via `@neondatabase/serverless`, HTTP driver), `@electric-sql/pglite` for tests, Zod, `bcryptjs`, Vitest + React Testing Library, Playwright for the e2e smoke test.

**Spec:**
- `docs/superpowers/specs/2026-09-27-vocab-learning-app-design.md` (sections 1-2, 3 `users` table, 4.1, 5, 6)
- `docs/superpowers/specs/2026-09-27-vocab-learning-app-design-system.md` (shadcn tokens, fonts, icons, motion — followed by every UI task below)

## Global Constraints

- Framework: Next.js 15 (App Router) + TypeScript, deployed on Vercel.
- Auth: Auth.js (NextAuth v5) — Credentials provider (bcrypt-hashed password) + Google OAuth provider.
- **Session strategy is JWT, not database** — this corrects the original spec. Auth.js v5's Credentials provider does not support the database session strategy (session strategy is set once per NextAuth instance, and Credentials requires JWT). The Drizzle adapter is still used so Google OAuth users/accounts are persisted in Postgres.
- Database: Postgres via Vercel Marketplace (Neon), Drizzle ORM.
- Register/login via email+password (bcrypt hash, Zod-validated) or Google OAuth.
- Logout clears the session and redirects to `/login`.
- Middleware guards every route except `/login` and `/register`.
- UI: shadcn/ui + Tailwind, minimal/low-distraction — one accent color, one radius scale, Geist Sans/Mono, Phosphor icons (see design-system doc). shadcn's own generated primitives may keep their internal `lucide-react` icons; all app-authored icons use Phosphor.
- FSD path aliases: `@/_app/*`, `@/_pages/*`, `@/widgets/*`, `@/features/*`, `@/entities/*`, `@/shared/*`. Steiger enforces the one-directional import rule `_app → _pages → widgets → features → entities → shared` (a layer may only import from layers to its right).
- Server-only DB/auth code lives in `*.server.ts` files. `middleware.ts` stays at the project root, outside `src/`.

**Prerequisites before Task 12 (the only task that needs a real database):** a Postgres connection string (a free Neon database works) in `.env.local` as `DATABASE_URL`, plus a Google OAuth client (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`) and an `AUTH_SECRET` (generate with `npx auth secret`). Every task before that runs entirely against an in-memory PGlite database and needs no external services.

## Review Focus

- **Duplicate email on registration** — registering with an email that already has an account must show a clear inline error, not a crash or a silent overwrite. (Task 9)
- **Wrong password / unknown email on login** — must show one generic "invalid email or password" message in both cases, never reveal which part was wrong. (Tasks 7, 9)
- **Google sign-in colliding with an existing Credentials account** — Auth.js refuses to silently link accounts (`OAuthAccountNotLinked`); the login page must show a clear message instead of a blank/confusing error state. (Task 11)
- **Direct navigation to a protected route while logged out** (not just clicking through the UI) — middleware must redirect to `/login` for any path, including `/`. (Tasks 8, 12)
- **Invalid/empty registration input** (missing fields, malformed email, short password) — rejected with inline validation errors, never a server crash. (Tasks 6, 9)

---

### Task 1: Scaffold the Next.js project + test toolchain

**Files:**
- Create: whole Next.js scaffold (`package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `.eslintrc`/`eslint.config.mjs`)
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `app/page.test.tsx`
- Modify: `.gitignore` (merge Next.js's generated ignores with the existing one)

**Interfaces:**
- Produces: a working `npm run dev` / `npm run build` / `npm test` toolchain that every later task builds on. `@/*` path alias exists (will be narrowed to per-layer aliases in Task 2).

- [ ] **Step 1: Scaffold into a temp directory, then merge into the repo**

The repo already has `docs/`, `.git/`, `.idea/`, `.remember/` — `create-next-app` refuses to run in a non-empty directory that contains folders it doesn't recognize as safe (`docs`/`.git`/`.idea` are fine, `.remember` is not), so scaffold elsewhere first and merge:

```bash
npx create-next-app@15 /tmp/pracen-scaffold \
  --typescript --tailwind --eslint --app --no-src-dir \
  --import-alias "@/*" --no-turbopack --yes
rsync -a --exclude='.git' /tmp/pracen-scaffold/ ./
rm -rf /tmp/pracen-scaffold
```

- [ ] **Step 2: Install the test toolchain**

```bash
npm install -D vitest @vitejs/plugin-react vite-tsconfig-paths jsdom \
  @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 3: Configure Vitest**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
});
```

```ts
// vitest.setup.ts
import "@testing-library/jest-dom/vitest";
```

Add to `package.json` `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write a smoke test for the scaffold**

```tsx
// app/page.test.tsx
import { render } from "@testing-library/react";
import Page from "./page";

describe("scaffold smoke test", () => {
  it("renders the default page without crashing", () => {
    render(<Page />);
  });
});
```

- [ ] **Step 5: Run it**

Run: `npm test`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 15 project with Vitest"
```

---

### Task 2: Feature-Sliced Design layout + path aliases + Steiger

**Files:**
- Modify: `tsconfig.json` (replace the generic `@/*` alias with the six layer aliases)
- Create: `src/shared/config/app-config.ts`
- Create: `src/shared/config/app-config.test.ts`
- Create: `steiger.config.ts`
- Modify: `package.json` (add `lint:fsd` script)

**Interfaces:**
- Produces: `APP_NAME` constant at `@/shared/config/app-config` (used in Task 3's page metadata).

- [ ] **Step 1: Replace the path alias with per-layer aliases**

```json
// tsconfig.json — inside "compilerOptions"
"paths": {
  "@/_app/*": ["./src/_app/*"],
  "@/_pages/*": ["./src/_pages/*"],
  "@/widgets/*": ["./src/widgets/*"],
  "@/features/*": ["./src/features/*"],
  "@/entities/*": ["./src/entities/*"],
  "@/shared/*": ["./src/shared/*"]
}
```

- [ ] **Step 2: Create the first shared-layer file**

```ts
// src/shared/config/app-config.ts
export const APP_NAME = "Vocab";
```

- [ ] **Step 3: Write a test proving the alias resolves**

```ts
// src/shared/config/app-config.test.ts
import { APP_NAME } from "@/shared/config/app-config";

it("resolves the shared layer path alias", () => {
  expect(APP_NAME).toBe("Vocab");
});
```

- [ ] **Step 4: Run it**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Install and configure Steiger**

```bash
npm install -D steiger @feature-sliced/steiger-plugin
```

```ts
// steiger.config.ts
import { defineConfig } from "steiger";
import fsd from "@feature-sliced/steiger-plugin";

export default defineConfig([...fsd.configs.recommended]);
```

Add to `package.json` `"scripts"`: `"lint:fsd": "steiger ./src"`.

- [ ] **Step 6: Run Steiger and fix whatever it reports**

Run: `npm run lint:fsd`
Expected: no errors against the one file in `src/shared`. If Steiger doesn't recognize the `_app`/`_pages` underscore-prefixed layer names out of the box, check `@feature-sliced/steiger-plugin`'s docs for a layer-name-mapping option and add it here — this convention is the officially documented Next.js workaround the design spec itself follows, so the plugin should support it, but confirm before moving on since every later task depends on this lint passing cleanly.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: set up FSD path aliases and Steiger layer linting"
```

---

### Task 3: shadcn/ui + design tokens + fonts + icons

**Files:**
- Create: `components.json` (via shadcn init, then edited)
- Modify: `app/globals.css` (theme tokens from the design-system doc)
- Modify: `app/layout.tsx` (Geist fonts, `APP_NAME` metadata)
- Create: `src/shared/ui/button.tsx`, `card.tsx`, `dialog.tsx`, `input.tsx`, `label.tsx`, `badge.tsx`, `table.tsx`, `skeleton.tsx`, `sonner.tsx`, `dropdown-menu.tsx`, `avatar.tsx`, `separator.tsx`, `form.tsx` (via shadcn add)
- Create: `src/shared/lib/cn.ts` (generated by shadcn)
- Create: `src/shared/ui/button.test.tsx`

**Interfaces:**
- Consumes: `APP_NAME` from `@/shared/config/app-config` (Task 2).
- Produces: `@/shared/ui/*` primitives and `cn()` helper used by every UI task from here on.

- [ ] **Step 1: Init shadcn with the design-system's style**

```bash
npx shadcn@latest init --yes --base-color zinc --style new-york
```

- [ ] **Step 2: Point shadcn's aliases at the FSD shared layer**

```json
// components.json — "aliases"
{
  "components": "@/shared/ui",
  "ui": "@/shared/ui",
  "utils": "@/shared/lib/cn",
  "lib": "@/shared/lib",
  "hooks": "@/shared/lib/hooks"
}
```

- [ ] **Step 3: Add the primitives this module needs (this plan's tasks) plus the ones the later Library/Quiz/Dashboard plans will need**

```bash
npx shadcn@latest add button card dialog input label badge table skeleton \
  sonner dropdown-menu avatar separator form
```

This generates `src/shared/ui/*.tsx` and `src/shared/lib/cn.ts` (a `clsx` + `tailwind-merge` wrapper).

- [ ] **Step 4: Apply the design-system's color tokens**

Replace the `:root` / `.dark` blocks in `app/globals.css` with the tokens from `docs/superpowers/specs/2026-09-27-vocab-learning-app-design-system.md` §2 (calm blue accent, not shadcn's default near-black primary):

```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.55 0.22 258);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.55 0.22 258 / 0.5);
  --radius: 0.625rem;
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.65 0.19 258);
  --primary-foreground: oklch(0.145 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.65 0.19 258 / 0.5);
}
```

- [ ] **Step 5: Wire up Geist fonts and Phosphor icons**

```bash
npm install geist @phosphor-icons/react
```

```tsx
// app/layout.tsx
import "./globals.css";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { APP_NAME } from "@/shared/config/app-config";

export const metadata = {
  title: APP_NAME,
  description: "Personal vocabulary learning app",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
```

In `app/globals.css`'s `@theme inline` block (generated by shadcn init), add:

```css
--font-sans: var(--font-geist-sans);
--font-mono: var(--font-geist-mono);
```

- [ ] **Step 6: Write a test proving the themed primitive renders correctly**

```tsx
// src/shared/ui/button.test.tsx
import { render, screen } from "@testing-library/react";
import { Button } from "./button";

it("renders a clickable, accessible button", () => {
  render(<Button>Click me</Button>);
  expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
});
```

- [ ] **Step 7: Run it**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: configure shadcn/ui theme, Geist fonts, Phosphor icons"
```

---

### Task 4: Drizzle schema for Auth.js (users, accounts, sessions, verification tokens)

**Files:**
- Create: `src/shared/api/db/schema.ts`
- Create: `drizzle.config.ts`
- Create: `.env.example`
- Modify: `.gitignore` (add `.env*.local`, `/drizzle` is committed — migrations are code)

**Interfaces:**
- Produces: `users`, `accounts`, `sessions`, `verificationTokens` Drizzle table definitions, and a generated SQL migration under `./drizzle` that Task 5's test-db helper applies.

- [ ] **Step 1: Install Drizzle**

```bash
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit
```

- [ ] **Step 2: Define the schema (the shape `@auth/drizzle-adapter`'s Postgres adapter expects, plus a `passwordHash` column for Credentials)**

```ts
// src/shared/api/db/schema.ts
import { pgTable, text, timestamp, integer, primaryKey } from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

export const users = pgTable("user", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  passwordHash: text("passwordHash"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({ columns: [account.provider, account.providerAccountId] }),
  })
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compositePk: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);
```

- [ ] **Step 3: Configure drizzle-kit**

```ts
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/shared/api/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

```
# .env.example
DATABASE_URL=
```

- [ ] **Step 4: Generate the migration**

Run: `npx drizzle-kit generate --name init_auth`
Expected: a new file appears under `./drizzle`, e.g. `drizzle/0000_init_auth.sql`, containing `CREATE TABLE` statements for `user`, `account`, `session`, `verificationToken`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Drizzle schema for users/accounts/sessions and generate migration"
```

---

### Task 5: Drizzle DB clients (production Neon + PGlite test helper)

**Files:**
- Create: `src/shared/api/db/client.ts`
- Create: `src/shared/api/db/test-db.ts`
- Create: `src/shared/api/db/test-db.test.ts`

**Interfaces:**
- Consumes: `users`/`accounts`/`sessions`/`verificationTokens` schema + `./drizzle` migrations (Task 4).
- Produces: `db` (production Neon client) at `@/shared/api/db/client`; `createTestDb(): Promise<TestDb>` at `@/shared/api/db/test-db` — every later task's tests use this instead of touching a real database.

- [ ] **Step 1: Production client (Neon HTTP driver — works in both Node and Edge runtimes, which matters once middleware touches auth state)**

```ts
// src/shared/api/db/client.ts
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

- [ ] **Step 2: Install PGlite and write the test-db helper**

```bash
npm install -D @electric-sql/pglite
```

```ts
// src/shared/api/db/test-db.ts
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";

export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;
```

- [ ] **Step 3: Write the failing test**

```ts
// src/shared/api/db/test-db.test.ts
import { createTestDb } from "./test-db";
import { users } from "./schema";

it("applies the migrations and allows inserting/reading a user", async () => {
  const db = await createTestDb();
  await db.insert(users).values({ email: "a@example.com", passwordHash: "x" });
  const rows = await db.select().from(users);
  expect(rows).toHaveLength(1);
  expect(rows[0].email).toBe("a@example.com");
});
```

- [ ] **Step 4: Run it**

Run: `npm test`
Expected: PASS. (If it fails with a missing-table error, re-check Task 4's generated migration file actually landed under `./drizzle`.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add production Neon client and PGlite test-db helper"
```

---

### Task 6: `entities/user` + password hashing + Zod schemas

**Files:**
- Create: `src/shared/lib/password.ts`
- Create: `src/shared/lib/password.test.ts`
- Create: `src/entities/user/model/types.ts`
- Create: `src/entities/user/api/user.server.ts`
- Create: `src/entities/user/api/user.server.test.ts`
- Create: `src/features/auth-by-credentials/model/schema.ts`
- Create: `src/features/auth-by-credentials/model/schema.test.ts`

**Interfaces:**
- Consumes: `createTestDb` (Task 5), `users` schema (Task 4).
- Produces: `hashPassword(password): Promise<string>`, `verifyPassword(password, hash): Promise<boolean>` at `@/shared/lib/password`; `getUserByEmail(email, db?)`, `createUser(input, db?)` at `@/entities/user/api/user.server`; `registerSchema`, `loginSchema` (+ `RegisterInput`/`LoginInput` types) at `@/features/auth-by-credentials/model/schema` — all consumed by Task 7 and Task 9.

- [ ] **Step 1: Password hashing**

```bash
npm install bcryptjs zod
npm install -D @types/bcryptjs
```

```ts
// src/shared/lib/password.ts
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

```ts
// src/shared/lib/password.test.ts
import { hashPassword, verifyPassword } from "./password";

it("hashes a password and verifies it correctly", async () => {
  const hash = await hashPassword("correct horse battery staple");
  expect(hash).not.toBe("correct horse battery staple");
  expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
  expect(await verifyPassword("wrong password", hash)).toBe(false);
});
```

Run: `npm test` — Expected: PASS.

- [ ] **Step 2: User entity types and data access**

```ts
// src/entities/user/model/types.ts
export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  passwordHash: string | null;
}
```

```ts
// src/entities/user/api/user.server.ts
import { db as defaultDb } from "@/shared/api/db/client";
import { users } from "@/shared/api/db/schema";
import { eq } from "drizzle-orm";
import type { User } from "../model/types";

type Db = Pick<typeof defaultDb, "select" | "insert">;

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
```

```ts
// src/entities/user/api/user.server.test.ts
import { createTestDb } from "@/shared/api/db/test-db";
import { getUserByEmail, createUser } from "./user.server";

describe("user entity", () => {
  it("creates a user and finds it by email", async () => {
    const db = await createTestDb();
    await createUser({ email: "jane@example.com", name: "Jane", passwordHash: "hash" }, db);
    const found = await getUserByEmail("jane@example.com", db);
    expect(found?.name).toBe("Jane");
  });

  it("returns null when no user matches the email", async () => {
    const db = await createTestDb();
    const found = await getUserByEmail("nobody@example.com", db);
    expect(found).toBeNull();
  });
});
```

Run: `npm test` — Expected: PASS.

- [ ] **Step 3: Register/login Zod schemas**

```ts
// src/features/auth-by-credentials/model/schema.ts
import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;
```

```ts
// src/features/auth-by-credentials/model/schema.test.ts
import { registerSchema, loginSchema } from "./schema";

it("rejects a password shorter than 8 characters", () => {
  const result = registerSchema.safeParse({ name: "A", email: "a@example.com", password: "short" });
  expect(result.success).toBe(false);
});

it("normalizes email to lowercase and trims whitespace", () => {
  const result = loginSchema.parse({ email: "  A@Example.com  ", password: "x" });
  expect(result.email).toBe("a@example.com");
});
```

Run: `npm test` — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add user entity, password hashing, and auth Zod schemas"
```

---

### Task 7: Auth.js configuration (Credentials + Google, JWT sessions)

**Files:**
- Create: `src/_app/api-routes/auth.ts`
- Create: `src/_app/api-routes/auth.test.ts`
- Create: `src/next-auth.d.ts` (ambient module augmentation, not layer-scoped)
- Create: `app/api/auth/[...nextauth]/route.ts`

**Interfaces:**
- Consumes: `getUserByEmail` (Task 6), `verifyPassword` (Task 6), `loginSchema` (Task 6), `db` + `schema` (Tasks 4-5).
- Produces: `authorizeCredentials(raw, db?)` (unit-testable in isolation), `handlers`, `auth`, `signIn`, `signOut` at `@/_app/api-routes/auth` — consumed by `middleware.ts` (Task 8) and `(main)/layout.tsx` (Task 11).

- [ ] **Step 1: Install Auth.js and the Drizzle adapter**

```bash
npm install next-auth@5 @auth/drizzle-adapter
```

Append to `.env.example`:

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
AUTH_SECRET=
```

- [ ] **Step 2: Type augmentation for `session.user.id`**

```ts
// src/next-auth.d.ts
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
  }
}
```

- [ ] **Step 3: Write the config, with `authorizeCredentials` extracted as a standalone, independently-testable function**

```ts
// src/_app/api-routes/auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/shared/api/db/client";
import * as schema from "@/shared/api/db/schema";
import { getUserByEmail } from "@/entities/user/api/user.server";
import { verifyPassword } from "@/shared/lib/password";
import { loginSchema } from "@/features/auth-by-credentials/model/schema";
import type { User } from "@/entities/user/model/types";

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

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, schema),
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
```

```ts
// app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/_app/api-routes/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 4: Write the failing tests — covers Review Focus #2 (generic invalid-credentials behavior)**

```ts
// src/_app/api-routes/auth.test.ts
import { createTestDb } from "@/shared/api/db/test-db";
import { createUser } from "@/entities/user/api/user.server";
import { hashPassword } from "@/shared/lib/password";
import { authorizeCredentials } from "./auth";

describe("authorizeCredentials", () => {
  it("returns the user for correct credentials", async () => {
    const db = await createTestDb();
    const passwordHash = await hashPassword("s3cret-password");
    await createUser({ email: "sam@example.com", passwordHash }, db);

    const result = await authorizeCredentials(
      { email: "sam@example.com", password: "s3cret-password" },
      db
    );
    expect(result?.email).toBe("sam@example.com");
  });

  it("returns null for a wrong password", async () => {
    const db = await createTestDb();
    const passwordHash = await hashPassword("s3cret-password");
    await createUser({ email: "sam@example.com", passwordHash }, db);

    const result = await authorizeCredentials(
      { email: "sam@example.com", password: "wrong-password" },
      db
    );
    expect(result).toBeNull();
  });

  it("returns null for an email with no account, same as a wrong password", async () => {
    const db = await createTestDb();
    const result = await authorizeCredentials(
      { email: "nobody@example.com", password: "whatever" },
      db
    );
    expect(result).toBeNull();
  });

  it("returns null for malformed input instead of throwing", async () => {
    const db = await createTestDb();
    const result = await authorizeCredentials({ email: "not-an-email" }, db);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 5: Run it**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: configure Auth.js with Credentials + Google providers, JWT sessions"
```

---

### Task 8: Route-guarding middleware

**Files:**
- Create: `src/_app/middleware-logic.ts`
- Create: `src/_app/middleware-logic.test.ts`
- Create: `middleware.ts` (project root)

**Interfaces:**
- Consumes: `auth` from `@/_app/api-routes/auth` (Task 7).
- Produces: `resolveRedirect(pathname, isAuthenticated): string | null` — pure function, independently tested; `middleware.ts` is a thin wrapper around it plus the real `auth()` session check.

- [ ] **Step 1: Write the failing tests for the pure redirect logic — covers Review Focus #4**

```ts
// src/_app/middleware-logic.test.ts
import { resolveRedirect } from "./middleware-logic";

it("sends an unauthenticated visitor on any protected route to /login", () => {
  expect(resolveRedirect("/", false)).toBe("/login");
  expect(resolveRedirect("/library", false)).toBe("/login");
});

it("lets an unauthenticated visitor reach /login and /register", () => {
  expect(resolveRedirect("/login", false)).toBeNull();
  expect(resolveRedirect("/register", false)).toBeNull();
});

it("sends an authenticated visitor away from /login and /register", () => {
  expect(resolveRedirect("/login", true)).toBe("/");
  expect(resolveRedirect("/register", true)).toBe("/");
});

it("lets an authenticated visitor reach protected routes", () => {
  expect(resolveRedirect("/", true)).toBeNull();
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test`
Expected: FAIL — `resolveRedirect` is not defined.

- [ ] **Step 3: Implement it**

```ts
// src/_app/middleware-logic.ts
const PUBLIC_PATHS = ["/login", "/register"];

export function resolveRedirect(pathname: string, isAuthenticated: boolean): string | null {
  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (!isAuthenticated && !isPublic) return "/login";
  if (isAuthenticated && isPublic) return "/";
  return null;
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Wire it into the real middleware**

```ts
// middleware.ts
import { NextResponse } from "next/server";
import { auth } from "@/_app/api-routes/auth";
import { resolveRedirect } from "@/_app/middleware-logic";

export default auth((req) => {
  const redirectTo = resolveRedirect(req.nextUrl.pathname, !!req.auth);
  if (redirectTo) {
    return NextResponse.redirect(new URL(redirectTo, req.nextUrl.origin));
  }
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add route-guarding middleware"
```

---

### Task 9: `features/auth-by-credentials` — register + login

**Files:**
- Create: `src/features/auth-by-credentials/api/register.server.ts`
- Create: `src/features/auth-by-credentials/api/register.server.test.ts`
- Create: `src/features/auth-by-credentials/ui/register-form.tsx`
- Create: `src/features/auth-by-credentials/ui/register-form.test.tsx`
- Create: `src/features/auth-by-credentials/ui/login-form.tsx`
- Create: `src/features/auth-by-credentials/ui/login-form.test.tsx`

**Interfaces:**
- Consumes: `registerSchema` (Task 6), `createUser`/`getUserByEmail` (Task 6), `hashPassword` (Task 6), `signIn` from `next-auth/react` (external package — not the `_app`-scoped one, so no layer violation).
- Produces: `registerWithCredentials(input): Promise<{ok: true} | {ok: false; error: string}>`, `<RegisterForm />`, `<LoginForm />` — consumed by `_pages/register` and `_pages/login` (Task 11).

- [ ] **Step 1: Register Server Action — covers Review Focus #1 and #5**

```ts
// src/features/auth-by-credentials/api/register.server.ts
"use server";

import { registerSchema } from "../model/schema";
import { createUser, getUserByEmail } from "@/entities/user/api/user.server";
import { hashPassword } from "@/shared/lib/password";

export type RegisterResult = { ok: true } | { ok: false; error: string };

export async function registerWithCredentials(input: unknown): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const existing = await getUserByEmail(parsed.data.email);
  if (existing) {
    return { ok: false, error: "An account with this email already exists" };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await createUser({ email: parsed.data.email, name: parsed.data.name, passwordHash });

  return { ok: true };
}
```

```ts
// src/features/auth-by-credentials/api/register.server.test.ts
import { vi } from "vitest";
import { registerWithCredentials } from "./register.server";

vi.mock("@/shared/api/db/client", async () => {
  const { createTestDb } = await import("@/shared/api/db/test-db");
  const db = await createTestDb();
  return { db };
});

describe("registerWithCredentials", () => {
  it("creates a new user for valid input", async () => {
    const result = await registerWithCredentials({
      name: "Jane",
      email: "jane@example.com",
      password: "s3cret-password",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a duplicate email with a clear message", async () => {
    await registerWithCredentials({
      name: "Jane",
      email: "dup@example.com",
      password: "s3cret-password",
    });
    const second = await registerWithCredentials({
      name: "Jane Again",
      email: "dup@example.com",
      password: "another-password",
    });
    expect(second).toEqual({ ok: false, error: "An account with this email already exists" });
  });

  it("rejects invalid input without touching the database", async () => {
    const result = await registerWithCredentials({ email: "not-an-email", password: "x" });
    expect(result.ok).toBe(false);
  });
});
```

Run: `npm test` — Expected: PASS.

- [ ] **Step 2: Register form**

```tsx
// src/features/auth-by-credentials/ui/register-form.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { registerWithCredentials } from "../api/register.server";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setIsSubmitting(true);

    const input = {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    };

    const result = await registerWithCredentials(input);
    if (!result.ok) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }

    const signInResult = await signIn("credentials", {
      email: input.email,
      password: input.password,
      redirect: false,
    });

    if (signInResult?.error) {
      setError("Account created. Please sign in.");
      setIsSubmitting(false);
      return;
    }

    router.push("/");
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required minLength={8} />
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}
```

```tsx
// src/features/auth-by-credentials/ui/register-form.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, beforeEach } from "vitest";
import { RegisterForm } from "./register-form";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const signIn = vi.fn();
vi.mock("next-auth/react", () => ({ signIn: (...args: unknown[]) => signIn(...args) }));

const registerWithCredentials = vi.fn();
vi.mock("../api/register.server", () => ({
  registerWithCredentials: (...args: unknown[]) => registerWithCredentials(...args),
}));

beforeEach(() => {
  push.mockClear();
  signIn.mockClear();
  registerWithCredentials.mockClear();
});

describe("RegisterForm", () => {
  it("shows the server error when the email is already registered", async () => {
    registerWithCredentials.mockResolvedValueOnce({
      ok: false,
      error: "An account with this email already exists",
    });
    render(<RegisterForm />);

    await userEvent.type(screen.getByLabelText("Name"), "Jane");
    await userEvent.type(screen.getByLabelText("Email"), "dup@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "s3cret-password");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(
      await screen.findByText("An account with this email already exists")
    ).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("signs in and redirects home after a successful registration", async () => {
    registerWithCredentials.mockResolvedValueOnce({ ok: true });
    signIn.mockResolvedValueOnce({ error: undefined });
    render(<RegisterForm />);

    await userEvent.type(screen.getByLabelText("Name"), "Jane");
    await userEvent.type(screen.getByLabelText("Email"), "jane@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "s3cret-password");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(push).toHaveBeenCalledWith("/");
  });
});
```

Run: `npm test` — Expected: PASS.

- [ ] **Step 3: Login form — covers Review Focus #2 (generic error message)**

```tsx
// src/features/auth-by-credentials/ui/login-form.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setIsSubmitting(true);

    const result = await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password");
      setIsSubmitting(false);
      return;
    }

    router.push("/");
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required />
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
```

```tsx
// src/features/auth-by-credentials/ui/login-form.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, beforeEach } from "vitest";
import { LoginForm } from "./login-form";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const signIn = vi.fn();
vi.mock("next-auth/react", () => ({ signIn: (...args: unknown[]) => signIn(...args) }));

beforeEach(() => {
  push.mockClear();
  signIn.mockClear();
});

describe("LoginForm", () => {
  it("shows one generic error for invalid credentials", async () => {
    signIn.mockResolvedValueOnce({ error: "CredentialsSignin" });
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText("Email"), "jane@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("redirects home on successful sign in", async () => {
    signIn.mockResolvedValueOnce({ error: undefined });
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText("Email"), "jane@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "correct-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(push).toHaveBeenCalledWith("/");
  });
});
```

Run: `npm test` — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add credentials register/login Server Action and forms"
```

---

### Task 10: `features/auth-by-google`

**Files:**
- Create: `src/features/auth-by-google/ui/google-sign-in-button.tsx`
- Create: `src/features/auth-by-google/ui/google-sign-in-button.test.tsx`

**Interfaces:**
- Produces: `<GoogleSignInButton />` — consumed by `_pages/login` and `_pages/register` (Task 11).

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/auth-by-google/ui/google-sign-in-button.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { GoogleSignInButton } from "./google-sign-in-button";

const signIn = vi.fn();
vi.mock("next-auth/react", () => ({ signIn: (...args: unknown[]) => signIn(...args) }));

it("starts the Google OAuth flow on click", async () => {
  render(<GoogleSignInButton />);
  await userEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
  expect(signIn).toHaveBeenCalledWith("google", { callbackUrl: "/" });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement it**

```tsx
// src/features/auth-by-google/ui/google-sign-in-button.tsx
"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/shared/ui/button";

export function GoogleSignInButton() {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={() => signIn("google", { callbackUrl: "/" })}
    >
      Continue with Google
    </Button>
  );
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Google sign-in button"
```

---

### Task 11: Pages, app shell, and logout

**Files:**
- Create: `src/features/logout/ui/logout-button.tsx`
- Create: `src/features/logout/ui/logout-button.test.tsx`
- Create: `src/widgets/layout/ui/header.tsx`
- Create: `src/widgets/layout/ui/header.test.tsx`
- Create: `src/_pages/home/index.tsx`
- Create: `src/_pages/login/index.tsx`
- Create: `src/_pages/login/index.test.tsx`
- Create: `src/_pages/register/index.tsx`
- Create: `app/(auth)/layout.tsx`
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/register/page.tsx`
- Create: `app/(main)/layout.tsx`
- Create: `app/(main)/page.tsx`
- Delete: `app/page.tsx`, `app/page.test.tsx` (superseded by the route groups above)

**Interfaces:**
- Consumes: `<LoginForm />`/`<RegisterForm />` (Task 9), `<GoogleSignInButton />` (Task 10), `auth` from `@/_app/api-routes/auth` (Task 7).
- Produces: the full page tree for this plan's scope: `/login`, `/register`, `/` (placeholder home).

- [ ] **Step 1: Logout button**

```tsx
// src/features/logout/ui/logout-button.tsx
"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/shared/ui/button";

export function LogoutButton() {
  return (
    <Button variant="ghost" onClick={() => signOut({ callbackUrl: "/login" })}>
      Log out
    </Button>
  );
}
```

```tsx
// src/features/logout/ui/logout-button.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { LogoutButton } from "./logout-button";

const signOut = vi.fn();
vi.mock("next-auth/react", () => ({ signOut: (...args: unknown[]) => signOut(...args) }));

it("signs out and returns to /login on click", async () => {
  render(<LogoutButton />);
  await userEvent.click(screen.getByRole("button", { name: "Log out" }));
  expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/login" });
});
```

Run: `npm test` — Expected: PASS.

- [ ] **Step 2: Header widget**

```tsx
// src/widgets/layout/ui/header.tsx
import { LogoutButton } from "@/features/logout/ui/logout-button";

interface HeaderProps {
  user: { name: string | null; email: string };
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b px-4 md:px-6">
      <span className="font-semibold">Vocab</span>
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground text-sm">{user.name ?? user.email}</span>
        <LogoutButton />
      </div>
    </header>
  );
}
```

```tsx
// src/widgets/layout/ui/header.test.tsx
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { Header } from "./header";

vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

it("shows the signed-in user's name", () => {
  render(<Header user={{ name: "Jane", email: "jane@example.com" }} />);
  expect(screen.getByText("Jane")).toBeInTheDocument();
});

it("falls back to email when the user has no name", () => {
  render(<Header user={{ name: null, email: "jane@example.com" }} />);
  expect(screen.getByText("jane@example.com")).toBeInTheDocument();
});
```

Run: `npm test` — Expected: PASS.

- [ ] **Step 3: `_pages` (thin, mostly presentational; data comes from `app/` per the FSD guide's Next.js mapping)**

```tsx
// src/_pages/home/index.tsx
export default function HomePage({ email }: { email: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">Signed in</h1>
      <p className="text-muted-foreground text-sm">
        Signed in as {email}. The Dashboard, Library, and Quiz modules are
        built out in later plans.
      </p>
    </div>
  );
}
```

```tsx
// src/_pages/login/index.tsx
import { LoginForm } from "@/features/auth-by-credentials/ui/login-form";
import { GoogleSignInButton } from "@/features/auth-by-google/ui/google-sign-in-button";

const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    "That email is already registered with a password. Sign in with your password instead.",
};

export default function LoginPage({ error }: { error?: string }) {
  const message = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      {message && <p className="text-destructive text-xs">{message}</p>}
      <LoginForm />
      <GoogleSignInButton />
      <a href="/register" className="text-muted-foreground text-sm underline">
        Need an account? Register
      </a>
    </div>
  );
}
```

```tsx
// src/_pages/login/index.test.tsx
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import LoginPage from "./index";

vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

it("shows a clear message for an OAuth/Credentials account collision", () => {
  render(<LoginPage error="OAuthAccountNotLinked" />);
  expect(
    screen.getByText(
      "That email is already registered with a password. Sign in with your password instead."
    )
  ).toBeInTheDocument();
});

it("shows no error banner when there is no error", () => {
  render(<LoginPage />);
  expect(screen.queryByText(/already registered/)).not.toBeInTheDocument();
});
```

Run: `npm test` — Expected: PASS. This covers Review Focus #3.

```tsx
// src/_pages/register/index.tsx
import { RegisterForm } from "@/features/auth-by-credentials/ui/register-form";
import { GoogleSignInButton } from "@/features/auth-by-google/ui/google-sign-in-button";

export default function RegisterPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <RegisterForm />
      <GoogleSignInButton />
      <a href="/login" className="text-muted-foreground text-sm underline">
        Already have an account? Sign in
      </a>
    </div>
  );
}
```

- [ ] **Step 4: `app/` routing (thin re-exports, per the design spec's FSD mapping)**

```tsx
// app/(auth)/layout.tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh items-center justify-center px-4">{children}</div>;
}
```

```tsx
// app/(auth)/login/page.tsx
import LoginPage from "@/_pages/login";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <LoginPage error={error} />;
}
```

```tsx
// app/(auth)/register/page.tsx
export { default } from "@/_pages/register";
```

```tsx
// app/(main)/layout.tsx
import { redirect } from "next/navigation";
import { auth } from "@/_app/api-routes/auth";
import { Header } from "@/widgets/layout/ui/header";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Header user={{ name: session.user.name ?? null, email: session.user.email! }} />
      <main className="flex-1 px-4 py-8 md:px-6">{children}</main>
    </div>
  );
}
```

```tsx
// app/(main)/page.tsx
import { auth } from "@/_app/api-routes/auth";
import HomePage from "@/_pages/home";

export default async function Page() {
  const session = await auth();
  return <HomePage email={session!.user.email!} />;
}
```

- [ ] **Step 5: Remove the scaffold placeholder**

```bash
git rm app/page.tsx app/page.test.tsx
```

- [ ] **Step 6: Run the full test suite and the Steiger lint**

Run: `npm test && npm run lint:fsd`
Expected: all tests PASS, zero Steiger violations.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add login/register/home pages, app shell, and logout"
```

---

### Task 12: End-to-end smoke test (Playwright)

This is the one task in this plan that runs against a real Postgres database rather than PGlite, since it drives the actual Next.js dev server. Complete the "Prerequisites" section above first: `DATABASE_URL`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, `AUTH_SECRET` in `.env.local`, then apply the schema to that database:

```bash
npx drizzle-kit push
```

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/auth.spec.ts`

**Interfaces:**
- Consumes: the full running app (Tasks 1-11).
- Produces: nothing consumed by later tasks — this is the plan's final verification gate.

- [ ] **Step 1: Install Playwright**

```bash
npm install -D @playwright/test
npx playwright install --with-deps chromium
```

- [ ] **Step 2: Configure it**

```ts
// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
  use: { baseURL: "http://localhost:3000" },
});
```

- [ ] **Step 3: Write the smoke test — covers Review Focus #4 end-to-end plus the full happy path**

```ts
// e2e/auth.spec.ts
import { test, expect } from "@playwright/test";

test.describe("authentication", () => {
  test("redirects an unauthenticated visitor from a protected route to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("registers, signs in, and logs out", async ({ page }) => {
    const email = `test-${Date.now()}@example.com`;

    await page.goto("/register");
    await page.getByLabel("Name").fill("Test User");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("s3cret-password");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL("http://localhost:3000/");
    await expect(page.getByText(email, { exact: false })).toBeVisible();

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
```

- [ ] **Step 4: Run it**

Add to `package.json` `"scripts"`: `"e2e": "playwright test"`.

Run: `npm run e2e`
Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: add Playwright e2e smoke test for the auth flow"
```
