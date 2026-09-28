# Vocab

A personal vocabulary learning app. This is the Auth module slice: email/password
registration and login, Google OAuth, session handling, route protection, and
logout, on Next.js 15 (App Router).

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment variables**

   Copy `.env.example` to `.env.local` and fill in:

   | Variable | Where to get it |
   | --- | --- |
   | `DATABASE_URL` | A Postgres connection string. A free [Neon](https://neon.tech) database works — create a project and copy its connection string (the pooled/HTTP-compatible one, since this project uses the Neon HTTP driver). |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Create an OAuth 2.0 Client ID in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (type: Web application). Add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI for local dev. |
   | `AUTH_SECRET` | Generate one with `npx auth secret`. |
   | `AI_GATEWAY_API_KEY` | Create one with `vercel ai-gateway api-keys create` (or via the Vercel dashboard's AI Gateway tab). Optional: sentence-type quiz questions grade with a graceful fallback message if this is unset or the call fails — every other feature works without it. |

   `AI_GATEWAY_MODEL` defaults to `google/gemini-2.5-flash` if unset; run `curl -s https://ai-gateway.vercel.sh/v1/models | jq -r '.data[].id'` to see what's currently available before changing it, since Gateway models are added and retired over time.

   `DATABASE_URL`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, and `AUTH_SECRET` are required — the app fails fast with an actionable error at startup if `DATABASE_URL` is missing (see `src/shared/config/env.ts`), and Auth.js needs the rest to run at all. `AI_GATEWAY_API_KEY` and `AI_GATEWAY_MODEL` are optional, as noted above.

3. **Provision the database schema**

   ```bash
   npx drizzle-kit push
   ```

   This applies the Drizzle schema (`src/shared/api/db/schema.ts`: `user`, `account`, `session`, `verificationToken`, `folder`, `vocabItem`, `quiz`, `quizQuestion`, `quizAttempt`, `attemptAnswer`) to the database in `DATABASE_URL`.

   Re-run this command every time you pull changes that touch `schema.ts` — a
   dev database that's out of sync with the schema causes hard-to-diagnose
   failures (this exact gap caused a real e2e failure during development).

4. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Unauthenticated visitors are redirected to `/login` for any route.

## Testing and linting

```bash
npm test         # Vitest unit/component tests (uses an in-memory PGlite database, no external services needed)
npm run lint:fsd # Steiger — enforces the Feature-Sliced Design layer-import direction
npx tsc --noEmit # TypeScript check
npm run e2e      # Playwright end-to-end smoke test — needs a real DATABASE_URL (see above) and starts the dev server itself
```

## Architecture: Feature-Sliced Design

Application logic lives under `src/`, organized into layers, each of which may
only import from layers to its right:

```
_app → _pages → widgets → features → entities → shared
```

- **`_app`** — app-wide wiring (Auth.js config, middleware logic).
- **`_pages`** — one folder per route, thin and mostly presentational.
- **`widgets`** — composed UI blocks used across pages (e.g. the header).
- **`features`** — user-facing actions (register, login, Google sign-in, logout).
- **`entities`** — domain objects (e.g. `user`) and their data access.
- **`shared`** — reusable, business-logic-free code: UI primitives (`shared/ui`,
  shadcn-generated), the DB client and schema (`shared/api`), config
  (`shared/config`), and other cross-cutting helpers (`shared/lib`).

The `_app`/`_pages` names are prefixed with an underscore because `app` and
`pages` are reserved by Next.js's own routing conventions — the actual
Next.js `app/` directory stays routing-only (layouts, route handlers, thin
re-exports of `_pages` components) and contains no business logic itself.

Steiger (`npm run lint:fsd`) enforces the one-directional import rule above,
so a lower layer can never reach back into a higher one.

One layer-specific rule worth knowing: `@/shared/testing` (PGlite-backed test
database helpers) is kept separate from `@/shared/api` (the production DB
client) because `middleware.ts` runs in the Edge Runtime and transitively
imports `@/shared/api` via `auth()` — if a Node-only test dependency were
reachable from that barrel, the Edge build would fail to compile even though
nothing in it runs at runtime. Only import `@/shared/testing` from test files.
