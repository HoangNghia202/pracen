# Vocab Learning App — Design Spec

Date: 2026-09-27
Status: Approved by user, pending implementation plan

## 1. Overview

A Quizlet-like English vocabulary learning web app for personal / small-group use
(a handful of users, not a public multi-tenant product). Users organize vocabulary
into folders, import words in bulk or add them manually, listen to pronunciation,
build quizzes from folders, take quizzes, and review their attempt history.

Four modules:
1. **Auth** — email/password + Google sign in/up/out.
2. **Library** — folders of vocabulary, file import, manual add, search/sort.
3. **Quiz** — quiz creation, grid listing, search/filter, taking quizzes, attempt
   history and pause/resume.
4. **Dashboard** — quick view of recently accessed/edited folders and quizzes.

## 2. Tech Stack

- **Framework**: Next.js 15 (App Router) + TypeScript, deployed on Vercel.
- **UI**: shadcn/ui + Tailwind, sidebar layout (Dashboard / Library / Quiz), header
  with logo (left) and user menu (right). Minimal, low-distraction visual design —
  neutral shadcn theme, generous whitespace, no unnecessary color/ornamentation.
- **Auth**: Auth.js (NextAuth v5) — Credentials provider (bcrypt-hashed password) +
  Google OAuth provider. Database session strategy via Drizzle adapter.
- **Database**: Postgres provisioned through the Vercel Marketplace (e.g. Neon),
  free tier is sufficient at this scale. **Drizzle ORM**.
- **Pronunciation audio**: browser `SpeechSynthesis` (Web Speech API) — free,
  client-side, no audio storage/generation infra needed. (Future upgrade path:
  server-side TTS + Vercel Blob cache if cross-browser voice consistency is
  needed later — out of scope for now.)
- **Sentence grading**: Vercel AI Gateway + Gemini Flash (free tier at this scale)
  to check whether a user-written sentence correctly and grammatically uses the
  target word.
- **File import parsing**: `xlsx` (or equivalent) library to parse uploaded
  CSV/Excel client-side, with a preview step before committing rows to the DB.

## 3. Data Model (Drizzle / Postgres)

```
users            (id, email, passwordHash?, name, image, provider)

folders          (id, userId, name, createdAt, updatedAt)

vocab_items      (id, folderId, word, meaning, example?, partOfSpeech?, createdAt)

quizzes          (id, folderId, userId, name,
                   questionTypes[] {meaning, word, sentence},
                   vocabItemIds[]        -- subset or all words from the folder
                   shuffleQuestions bool,
                   shuffleAnswers bool,
                   createdAt, updatedAt)

quiz_questions   (id, quizId, orderIndex, questionType, vocabItemId,
                   choiceVocabItemIds[]  -- correct + distractors, MCQ types only;
                                         -- generated ONCE at quiz-creation time
                                         -- and fixed thereafter)

quiz_attempts    (id, quizId, userId, status {in_progress, completed},
                   questionsSnapshot jsonb,  -- presentation order for this attempt
                                             -- (post shuffle, if enabled), fixed at
                                             -- Start time so pause/resume is stable
                   currentIndex,
                   startedAt, finishedAt?, score?, totalQuestions)

attempt_answers (id, attemptId, questionIndex, vocabItemId, questionType,
                   userAnswer, isCorrect, aiFeedback?, answeredAt)

recent_activity  (id, userId, entityType {folder, quiz}, entityId,
                   action {viewed, created, edited, attempted}, occurredAt)
```

Key decisions baked into this schema:

- **Question content is fixed at quiz-creation time**, not regenerated per attempt.
  `quiz_questions` (including MCQ distractors) is generated once when the quiz is
  created and never changes unless the quiz itself is edited.
- **`shuffleQuestions` / `shuffleAnswers`** are quiz-level toggles set at creation
  time. They only affect *presentation order* for a given attempt (computed once
  at Start time into `questionsSnapshot`), not the underlying question content.
- MCQ distractors are picked at creation time from other words in the quiz's own
  word pool; if the quiz has fewer than 4 words, additional distractors are pulled
  from the rest of the source folder.
- **Pause/resume**: at most one `in_progress` attempt per quiz per user. Every
  answer is persisted to `attempt_answers` as soon as it's submitted, so leaving
  mid-quiz loses no progress. `questionsSnapshot` + `currentIndex` let a resumed
  attempt render exactly where the user left off.
- Attempt history is fully self-contained (`questionsSnapshot` + `attempt_answers`),
  so it stays accurate even if the quiz or its source vocab is edited later.

## 4. Module Flows

### 4.1 Auth
- Register/login via email+password (bcrypt hash, Zod-validated) or Google OAuth.
- Session persisted in DB via Auth.js + Drizzle adapter.
- Logout clears session, redirects to `/login`.
- Middleware guards every route except `/login` and `/register`.

### 4.2 Library
- Folder list: grid, sortable by "recently created" / "recently edited", search by
  folder name (debounced).
- Create folder via dialog (name only).
- Inside a folder: list of vocab items (word, meaning, 🔊 pronounce button using
  `SpeechSynthesis`).
- Add vocabulary via **CSV/Excel upload** (parsed client-side, previewed before
  saving) **or manual single-word form** (word, meaning, optional example /
  part of speech).
- Edit/delete vocab items; edit/delete folders.
- **"Create quiz" button inside a folder** opens the quiz-creation dialog
  (see 4.3) — on success the quiz appears in the Quiz module.

### 4.3 Quiz
- Quiz creation (from a folder's "Create quiz" button, or from the Quiz module by
  picking a folder first): choose word subset (default: all), choose one or more
  question types (meaning / word / sentence), toggle `shuffleQuestions` /
  `shuffleAnswers`, submit — this generates `quiz_questions` immediately.
- Quiz list: grid of cards (name, source folder, question count, most recent
  score/attempt). Search by quiz name, filter by source folder.
- Quiz overview (on card click):
  - Has an `in_progress` attempt → **"Continue"** button (resumes at
    `currentIndex`) + list of completed attempts below.
  - No `in_progress` attempt, has history → attempt history list + **"Start new
    attempt"**.
  - No attempts at all → **"Start"**.
  - Clicking a history row opens attempt detail: each question, correct answer,
    user's answer, correct/incorrect, AI feedback (for sentence-type questions).
- Taking a quiz: sequential question flow driven by `questionsSnapshot`; each
  answer is saved immediately (`attempt_answers`); leaving mid-quiz keeps status
  `in_progress` for later resume.
- Finishing all questions computes `score`, sets `finishedAt`, marks `completed`.

### 4.4 Dashboard
- Recently accessed/edited folders and quizzes, sourced from `recent_activity`.
- Quick actions: new folder, new quiz.

## 5. Frontend Architecture — Feature-Sliced Design + Smart/Dumb

Following the official FSD Next.js App Router guide
(https://feature-sliced.design/docs/guides/tech/with-nextjs): the `app`/`pages`
FSD layers are renamed to `_app`/`_pages` to avoid colliding with Next's reserved
`app/` directory, and every file under Next's `app/` is a thin re-export.

```
app/                                   # Next.js routing only — no logic
  (auth)/login/page.tsx                → export { default } from '@/_pages/login'
  (auth)/register/page.tsx
  (main)/layout.tsx                    # composes widgets/layout + providers
  (main)/dashboard/page.tsx            → from '@/_pages/dashboard'
  (main)/library/page.tsx              → from '@/_pages/library'
  (main)/library/[folderId]/page.tsx   → from '@/_pages/folder-detail'
  (main)/quiz/page.tsx                 → from '@/_pages/quiz-list'
  (main)/quiz/[quizId]/page.tsx        → from '@/_pages/quiz-overview'
  (main)/quiz/[quizId]/attempt/page.tsx              → from '@/_pages/quiz-attempt'
  (main)/quiz/[quizId]/attempt/[attemptId]/page.tsx  → from '@/_pages/attempt-result'
  api/auth/[...nextauth]/route.ts      → from '@/_app/api-routes/auth'
middleware.ts                          # must stay at project root (Next.js requirement)

src/
  _app/            # providers (Theme/Session/Toast), api-routes handlers
  _pages/          # one slice per route (see mapping above)
  widgets/         # layout (Sidebar+Header), folder-grid, vocab-table, quiz-grid,
                   #   quiz-player, attempt-history, recent-activity
  features/        # auth-by-credentials, auth-by-google, create-folder,
                   #   rename-folder, delete-folder, upload-vocab-file,
                   #   add-vocab-manual, play-word-audio, create-quiz,
                   #   search-folders, filter-quiz, submit-quiz-answer,
                   #   resume-quiz-attempt
  entities/        # user, folder, vocab-item, quiz, quiz-attempt
  shared/          # ui (shadcn primitives), lib (utils/hooks), api (db client,
                   #   gemini client — server-only code split via *.server.ts),
                   #   config
```

**Smart / Dumb boundary**
- **Dumb (presentational)**: every `ui/` segment across entities/features/widgets.
  Props in, JSX out — no data fetching, no direct Server Action calls. Reusable
  and independently testable.
- **Smart (container)**: `_pages/*` are Server Components that fetch through
  `entities/*/api` and pass plain props down to widgets. Within `features/*`, the
  `model/` segment (client state — e.g. `QuizPlayer`'s current-question reducer)
  calls `features/*/api` (Server Actions) and feeds results into the dumb `ui/`.

**Data & mutations**
- Server Components + `searchParams`-driven filtering for list pages (no client
  fetch library needed).
- Server Actions (`"use server"`) for all mutations (folder/vocab/quiz CRUD,
  answer submission), validated with Zod schemas shared between client and server.

**Next.js-specific conventions**
- Server-only code (Drizzle queries, Gemini calls) lives in `*.server.ts` files so
  Client Components can't accidentally import server-only modules.
- `middleware.ts` / `instrumentation.ts` stay at the project root, outside `src/`.
- Path aliases: `@/_app/*`, `@/_pages/*`, `@/widgets/*`, `@/features/*`,
  `@/entities/*`, `@/shared/*`.
- **Steiger** (FSD's official linter) enforces the one-directional layer import
  rule: `_app → _pages → widgets → features → entities → shared`.

## 6. Out of Scope (for this spec)

- Public multi-tenant scaling concerns (rate limiting, billing, abuse protection).
- Server-side TTS generation/caching (Web Speech API covers the current need).
- Quiz editing after creation (adding/removing words from an existing quiz) —
  not specified by the user; current design treats a quiz's question set as
  immutable once created. Can be revisited if requested.
- Real-time collaboration/sharing of folders or quizzes between users.
