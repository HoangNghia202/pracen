# Copilot instructions

Vocab-learning app (folders → vocab items → quizzes with AI-graded sentence answers). Next.js 15 App Router, React 19, Drizzle ORM on Neon Postgres, Auth.js v5, Vercel AI SDK, Tailwind 4 + shadcn/ui. Package manager is **pnpm** (the README says npm; the lockfile is `pnpm-lock.yaml`).

## Commands

```bash
pnpm dev                 # next dev --turbo
pnpm build
pnpm lint                # eslint (next/core-web-vitals + next/typescript)
pnpm lint:fsd            # steiger — enforces FSD layer/public-API rules
pnpm exec tsc --noEmit   # typecheck (not part of any script)
pnpm test                # vitest run (jsdom, globals on; no external services needed)
pnpm test src/features/vocab-item/upload-vocab-file            # one folder
pnpm test path/to/file.test.ts -t "partial test name"          # one test
pnpm e2e                 # Playwright; needs a real DATABASE_URL, starts dev server itself
```

Env vars live in `.env.local` (see `.env.example`). `DATABASE_URL`, `AUTH_SECRET`, Google OAuth are required; `AI_GATEWAY_API_KEY` is optional (AI features degrade gracefully). `AI_GATEWAY_MODEL` defaults to `google/gemini-2.5-flash`.

## Architecture: Feature-Sliced Design

Layers, each may only import from layers to its right:

```
_app → _pages → widgets → features → entities → shared
```

- `app/` (Next.js routing) is routing-only: `page.tsx` files re-export from `src/_pages/<route>/index.tsx`. `_app`/`_pages` are underscore-prefixed to avoid Next's reserved `app`/`pages` names.
- `_pages/<route>/index.tsx` is an async server component that does `auth()` + data loading (entity calls), then renders a presentational `ui/*-page.tsx`.
- `features/<group>/<slice>/` = one user action, with `api/` (`*.server.ts` Server Actions), `model/` (zod schemas, pure logic), `ui/`, and an `index.ts` public API. Features are grouped by entity (e.g. `features/vocab-item/{add-vocab-manual,upload-vocab-file,...}`).
- `entities/<name>/` holds the domain types (`model/types.ts`) and Drizzle data access (`api/*.server.ts`), exported via `index.ts`.
- `shared/api` = DB client + schema (`db/schema.ts`); `shared/ui` = shadcn primitives; `shared/testing` = PGlite helpers.
- Import other slices only through their `index.ts` (e.g. `@/entities/vocab-item`), using the `@/_app|_pages|widgets|features|entities|shared/*` aliases.
- Steiger exemptions are deliberate (see `steiger.config.ts`): `features/**/*.server.ts` may import `auth()` from `@/_app/api-routes/auth` and sibling features; `_pages/**/index.tsx` may too. Don't add new cross-layer imports beyond these.
- `@/shared/testing` (PGlite) must only be imported from test files — `middleware.ts` runs on the Edge runtime and transitively imports `@/shared/api`, so Node-only deps must not be reachable from that barrel.

## Conventions

**Server Actions** (`*.server.ts`, `"use server"`) follow one shape and all authorize themselves:
1. `const session = await auth(); if (!session?.user) return { ok: false, error: "You must be signed in." }`
2. validate input with the slice's zod schema via `safeParse`, return `{ ok: false, error: issues[0].message }`
3. verify ownership (`getFolderById(folderId, session.user.id, db)`; for item-level ops load the item, then its folder)
4. mutate, `touchFolder`, `safeRevalidatePath(...)`, return `{ ok: true }`; catch-all returns a generic error.

Results are discriminated unions `{ ok: true, ... } | { ok: false; error: string }`, never thrown. A `"use server"` file may only export async functions (and types) — keep constants in `model/`.

**DB injection for tests:** every entity function and Server Action takes a trailing `db` parameter defaulting to the production client (`dbInstance: Db = defaultDb`). Tests pass a PGlite db from `createTestDb()` and mock auth with `vi.mock("@/_app/api-routes/auth", () => ({ auth: vi.fn() }))`. Tests are colocated (`*.test.ts(x)`).

**Optional text fields:** `NewVocabItem` fields are `string | null | undefined` — `undefined` = leave unchanged on update, `null` = clear. Forms send `""`, actions convert (`value || undefined` on create, `value || null` on edit).

**Migrations:** `createTestDb()` runs the SQL in `./drizzle`, so after any change to `src/shared/api/db/schema.ts` you must run `pnpm exec drizzle-kit generate --name <name>` and commit the migration, or tests won't see the schema change. (The README mentions `drizzle-kit push` for provisioning a dev DB; `pnpm exec drizzle-kit migrate` applies the committed migrations.)

**`safeRevalidatePath`** (`shared/lib`) wraps `revalidatePath` so Server Actions can be called as plain functions in tests — use it instead of `revalidatePath`.

**AI calls** use `generateText` + `Output.object({ schema })` from `ai` with a plain model string through AI Gateway, a `timeout`, and a `try/catch` fallback so a failure never breaks the user flow (see `features/quiz-attempt/grade-sentence-answer`). Tests mock the `ai` module (`Output: { object: (c) => c }`).

**File import** (`features/vocab-item/upload-vocab-file`): parses CSV/XLSX client-side with `xlsx`, matching headers case/space/underscore-insensitively (`normalizeHeader`), then sends rows to a Server Action that re-validates with zod.

**Other:** jsdom is missing some DOM APIs Radix needs — shims live in `vitest.setup.ts`. Design specs and plans live in `docs/superpowers/{specs,plans}/`.
