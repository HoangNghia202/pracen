# Quiz Attempts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship *taking* a quiz — Start/Continue from the quiz overview page, a one-question-at-a-time player (multiple-choice for `meaning`/`word` questions, free-text for `sentence` questions graded by AI via the Vercel AI Gateway), immediate per-answer persistence so leaving mid-quiz never loses progress, pause/resume back to exactly where the user left off, and a completed-attempt history with a per-question result breakdown. This plan builds directly on `docs/superpowers/plans/2026-09-28-quiz-setup.md`, which must be implemented first — it depends on the `quiz` and `quizQuestion` tables, `entities/quiz`, and `entities/quiz-question` that plan produces.

**Architecture:** Same Feature-Sliced Design layers and Smart/Dumb split as the quiz-setup plan. The one new architectural piece: **`entities/quiz-attempt` never imports `entities/quiz-question` or `entities/quiz`** (Steiger's `fsd/forbidden-imports` rule blocks entity-to-entity imports in production code in this repo) — anywhere `quiz-attempt` needs data shaped like a `QuizQuestion`, it declares its own minimal structural type (e.g. `QuestionLike`) that a real `QuizQuestion` object satisfies by field-shape alone, and the actual cross-entity composition (fetching a question, then handing it to a `quiz-attempt` function) happens in the calling `features/*` Server Action or `app/*/page.tsx`, exactly like the quiz-setup plan's `create-quiz.server.ts` composes `entities/folder` + `entities/vocab-item` + `entities/quiz` + `entities/quiz-question` itself.

**Tech Stack:** Adds one new runtime dependency: the **Vercel AI SDK** (`ai`, current major is v7, requires Node ≥ 22 — already satisfied, `@types/node` is already `^22`) for AI-graded sentence answers, called through the **Vercel AI Gateway** using a plain `"google/gemini-2.5-flash"`-style model string (no `@ai-sdk/gateway` needed for this — a plain provider/model string already routes through the Gateway and reads `AI_GATEWAY_API_KEY` from the environment automatically). Everything else is unchanged: Next.js 15, Drizzle + Postgres/PGlite, Zod, shadcn/ui, `sonner`.

A note on the AI SDK specifically, because its APIs change often: **verify `generateText`'s structured-output shape against `node_modules/ai/docs/` (installed in Task 4, Step 1) before finalizing that step** — as of the version resolved when this plan was written, the SDK's structured-output API is `generateText({ model, output: Output.object({ schema }) , prompt })` (there is no separate `generateObject` function in this major version); the code in Task 4 uses that shape, but a newer installed patch/minor could differ and the bundled docs are the source of truth, not this plan or the assistant's memory.

**Spec:**
- `docs/superpowers/specs/2026-09-27-vocab-learning-app-design.md` (§2 tech stack — sentence grading via Vercel AI Gateway + Gemini Flash, §3 `quiz_attempts`/`attempt_answers` data model, §4.3 Quiz flows — taking a quiz, pause/resume, history — §5, §6)
- `docs/superpowers/plans/2026-09-28-quiz-setup.md` (the `quiz`/`quizQuestion` schema, `entities/quiz`, `entities/quiz-question`, and the quiz-overview page this plan extends)

## Global Constraints

- `quizAttempt`: `id`, `quizId` (FK → `quiz.id`, cascade delete), `userId` (FK → `user.id`, cascade delete), `status` (`"in_progress" | "completed"`, default `"in_progress"`), `questionsSnapshot` (`jsonb`, an array of `{ questionId, choiceOrder }` — the attempt's frozen presentation order and per-question answer-choice order), `currentIndex` (integer, default 0 — index into `questionsSnapshot` of the next unanswered question), `totalQuestions` (integer), `score` (integer, nullable until completed), `startedAt`, `finishedAt` (nullable until completed).
- `attemptAnswer`: `id`, `attemptId` (FK → `quizAttempt.id`, cascade delete), `questionIndex`, `questionType`, `word`, `meaning` (both denormalized from the question at answer time — same rationale as `quizQuestion`'s own denormalization: history must stay accurate even if the source word or quiz is later changed), `userAnswer` (the chosen choice's `vocabItemId` for `meaning`/`word` types, the raw sentence text for `sentence` type), `isCorrect`, `aiFeedback` (nullable, `sentence` type only), `answeredAt`.
- **At most one `in_progress` attempt per `(quiz, user)` pair** — enforced at the application level (checked before creating a new attempt), not a database constraint, consistent with how this codebase has not used database-level constraints for any other invariant so far.
- `questionsSnapshot` is computed exactly once, at Start time, from the quiz's `shuffleQuestions`/`shuffleAnswers` settings, and never recomputed for that attempt — pause/resume always replays the same frozen order via `currentIndex`.
- MCQ correctness (`meaning`/`word` types) is an exact match between the submitted answer and the question's own `vocabItemId`, computed entirely server-side — the client never sends and the server never trusts a pre-computed "is this correct" flag.
- Sentence-type grading calls the Vercel AI Gateway; on **any** failure (network error, missing/invalid API key, malformed model output, timeout) it falls back to `{ isCorrect: false, feedback: "<a fixed apology message>" }` — grading a sentence must never crash the submit flow or block the user from finishing the quiz.
- No quiz editing or deletion in this plan either (unchanged from the quiz-setup plan — the spec treats a quiz's question set as immutable once created).
- `recent_activity` remains out of scope (confirmed with the user in the quiz-setup plan; the not-yet-built Dashboard plan adds it later, across all modules at once).
- FSD path aliases and the one-directional Steiger import rule are unchanged. Server-only DB and AI-Gateway code lives in `*.server.ts`.

## Review Focus

- **Resubmitting an already-answered question** (double-click on Submit, a stale second tab, browser back after answering) — the Server Action must detect `questionIndex !== attempt.currentIndex` and reject it, never double-record an answer or advance `currentIndex`/`score` twice. (Task 6)
- **Submitting to an attempt that's already `completed`** (a stale player tab left open after finishing elsewhere, or navigating back to `/attempt` after the quiz is done) — rejected with a clear error, never silently overwrites completed history. (Task 6)
- **The AI grading call failing** (network error, missing API key, the model returning something that doesn't match the expected schema) — the sentence question must still get answered and the quiz must still be completable; the user sees a clearly-labeled fallback message, never a crash or a stuck submit button. (Task 4)
- **Requesting another user's attempt or attempt-result by id** (crafted `/quiz/<id>/attempt/<other-user's-attemptId>` URL) — comes back as "not found," never another user's answers or score. (Tasks 3, 8, 9)
- **Resuming an in-progress attempt after closing the tab** — the player must land exactly back on the unanswered question at `currentIndex`, with the *same* shuffled question order and the *same* shuffled choice order as when the attempt started, never a freshly re-shuffled or reset state. (Tasks 2, 3, 8)

---

### Task 1: Drizzle schema for quiz attempts and answers

**Files:**
- Modify: `src/shared/api/db/schema.ts`
- Modify: `src/shared/api/db/index.ts`
- Create: a new migration under `./drizzle` (generated, not hand-written)

**Interfaces:**
- Produces: `quizAttempts`, `attemptAnswers` Drizzle table definitions, exported from `@/shared/api`.

- [ ] **Step 1: Add the two tables to the schema**

```ts
// src/shared/api/db/schema.ts
// ...append below the existing `quizQuestions` export...

export const quizAttempts = pgTable("quizAttempt", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  quizId: text("quizId")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().$type<"in_progress" | "completed">().default("in_progress"),
  questionsSnapshot: jsonb("questionsSnapshot")
    .notNull()
    .$type<{ questionId: string; choiceOrder: string[] | null }[]>(),
  currentIndex: integer("currentIndex").notNull().default(0),
  totalQuestions: integer("totalQuestions").notNull(),
  score: integer("score"),
  startedAt: timestamp("startedAt", { mode: "date" }).notNull().defaultNow(),
  finishedAt: timestamp("finishedAt", { mode: "date" }),
});

export const attemptAnswers = pgTable("attemptAnswer", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  attemptId: text("attemptId")
    .notNull()
    .references(() => quizAttempts.id, { onDelete: "cascade" }),
  questionIndex: integer("questionIndex").notNull(),
  questionType: text("questionType").notNull().$type<"meaning" | "word" | "sentence">(),
  word: text("word").notNull(),
  meaning: text("meaning").notNull(),
  userAnswer: text("userAnswer").notNull(),
  isCorrect: boolean("isCorrect").notNull(),
  aiFeedback: text("aiFeedback"),
  answeredAt: timestamp("answeredAt", { mode: "date" }).notNull().defaultNow(),
});
```

- [ ] **Step 2: Export the new tables from the db barrel**

```ts
// src/shared/api/db/index.ts
export { db } from "./client";
export * as schema from "./schema";
export {
  users,
  accounts,
  sessions,
  verificationTokens,
  folders,
  vocabItems,
  quizzes,
  quizQuestions,
  quizAttempts,
  attemptAnswers,
} from "./schema";
```

- [ ] **Step 3: Generate the migration**

Run: `npx drizzle-kit generate --name quiz-attempts`
Expected: a new file appears under `./drizzle` (e.g. `drizzle/0003_quiz-attempts.sql`) with `CREATE TABLE "quizAttempt"` and `CREATE TABLE "attemptAnswer"`, each with the FKs described above.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Drizzle schema for quiz attempts and answers"
```

---

### Task 2: `entities/quiz-attempt` — pure snapshot-building and question-resolution logic

**Files:**
- Create: `src/entities/quiz-attempt/model/types.ts`
- Create: `src/entities/quiz-attempt/model/build-snapshot.ts`
- Create: `src/entities/quiz-attempt/model/build-snapshot.test.ts`
- Create: `src/entities/quiz-attempt/model/resolve-question.ts`
- Create: `src/entities/quiz-attempt/model/resolve-question.test.ts`

**Interfaces:**
- Consumes: `shuffle` from `@/shared/lib/shuffle`.
- Produces: `AttemptStatus`, `QuestionType`, `QuestionChoice`, `QuestionSnapshotItem`, `QuizAttempt`, `AttemptAnswer`, `QuestionLike`, `ResolvedQuestion` types; `buildQuestionsSnapshot(questions, options, random?)`; `resolveQuestionView(question, snapshotItem, position)`. Consumed by Tasks 3, 5, 8.

- [ ] **Step 1: Implement the types**

```ts
// src/entities/quiz-attempt/model/types.ts
export type AttemptStatus = "in_progress" | "completed";
export type QuestionType = "meaning" | "word" | "sentence";

export interface QuestionChoice {
  id: string;
  word: string;
  meaning: string;
}

export interface QuestionSnapshotItem {
  questionId: string;
  choiceOrder: string[] | null;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  status: AttemptStatus;
  questionsSnapshot: QuestionSnapshotItem[];
  currentIndex: number;
  totalQuestions: number;
  score: number | null;
  startedAt: Date;
  finishedAt: Date | null;
}

export interface AttemptAnswer {
  id: string;
  attemptId: string;
  questionIndex: number;
  questionType: QuestionType;
  word: string;
  meaning: string;
  userAnswer: string;
  isCorrect: boolean;
  aiFeedback: string | null;
  answeredAt: Date;
}

// Structural shape only. `entities/quiz-attempt` may not import
// `entities/quiz-question` (entities never import other entities in this
// codebase) — a real `QuizQuestion` object satisfies this interface by
// field-shape alone, and callers in the features/pages layer pass one in
// directly without either entity knowing about the other's module.
export interface QuestionLike {
  id: string;
  questionType: QuestionType;
  word: string;
  meaning: string;
  choices: QuestionChoice[] | null;
}

export interface ResolvedQuestion {
  questionIndex: number;
  totalQuestions: number;
  questionType: QuestionType;
  word: string;
  meaning: string;
  choices: QuestionChoice[] | null;
}
```

- [ ] **Step 2: Write the failing tests for `buildQuestionsSnapshot`**

```ts
// src/entities/quiz-attempt/model/build-snapshot.test.ts
import { buildQuestionsSnapshot } from "./build-snapshot";
import type { QuestionLike } from "./types";

const sentenceQuestion: QuestionLike = { id: "q-c", questionType: "sentence", word: "Bird", meaning: "x", choices: null };
const mcqA: QuestionLike = {
  id: "q-a",
  questionType: "meaning",
  word: "Dog",
  meaning: "A dog",
  choices: [
    { id: "x", word: "X", meaning: "x" },
    { id: "y", word: "Y", meaning: "y" },
    { id: "z", word: "Z", meaning: "z" },
    { id: "w", word: "W", meaning: "w" },
  ],
};
const mcqB: QuestionLike = { id: "q-b", questionType: "word", word: "Cat", meaning: "A cat", choices: [{ id: "x", word: "X", meaning: "x" }] };

describe("buildQuestionsSnapshot", () => {
  it("keeps the input order when shuffleQuestions is false", () => {
    const snapshot = buildQuestionsSnapshot(
      [mcqA, mcqB, sentenceQuestion],
      { shuffleQuestions: false, shuffleAnswers: false },
      () => 0
    );
    expect(snapshot.map((item) => item.questionId)).toEqual(["q-a", "q-b", "q-c"]);
  });

  it("shuffles the question order when shuffleQuestions is true", () => {
    // 3 items, random always 0: Fisher-Yates gives [b, c, a] (see shared/lib/shuffle.test.ts for the trace pattern).
    const snapshot = buildQuestionsSnapshot(
      [mcqA, mcqB, sentenceQuestion],
      { shuffleQuestions: true, shuffleAnswers: false },
      () => 0
    );
    expect(snapshot.map((item) => item.questionId)).toEqual(["q-b", "q-c", "q-a"]);
  });

  it("sets choiceOrder to null for a sentence question regardless of shuffleAnswers", () => {
    const snapshot = buildQuestionsSnapshot([sentenceQuestion], { shuffleQuestions: false, shuffleAnswers: true }, () => 0);
    expect(snapshot[0].choiceOrder).toBeNull();
  });

  it("keeps the question's own choice order when shuffleAnswers is false", () => {
    const snapshot = buildQuestionsSnapshot([mcqA], { shuffleQuestions: false, shuffleAnswers: false }, () => 0);
    expect(snapshot[0].choiceOrder).toEqual(["x", "y", "z", "w"]);
  });

  it("shuffles the choice order when shuffleAnswers is true", () => {
    // 4 choices, random always 0: Fisher-Yates gives [y, z, w, x].
    const snapshot = buildQuestionsSnapshot([mcqA], { shuffleQuestions: false, shuffleAnswers: true }, () => 0);
    expect(snapshot[0].choiceOrder).toEqual(["y", "z", "w", "x"]);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/entities/quiz-attempt/model/build-snapshot.test.ts`
Expected: FAIL with "Cannot find module './build-snapshot'"

- [ ] **Step 4: Implement**

```ts
// src/entities/quiz-attempt/model/build-snapshot.ts
import { shuffle } from "@/shared/lib/shuffle";
import type { QuestionLike, QuestionSnapshotItem } from "./types";

export function buildQuestionsSnapshot(
  questions: QuestionLike[],
  options: { shuffleQuestions: boolean; shuffleAnswers: boolean },
  random: () => number = Math.random
): QuestionSnapshotItem[] {
  const ordered = options.shuffleQuestions ? shuffle(questions, random) : questions;

  return ordered.map((question) => {
    if (!question.choices) {
      return { questionId: question.id, choiceOrder: null };
    }
    const ids = question.choices.map((choice) => choice.id);
    return {
      questionId: question.id,
      choiceOrder: options.shuffleAnswers ? shuffle(ids, random) : ids,
    };
  });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/entities/quiz-attempt/model/build-snapshot.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Write the failing tests for `resolveQuestionView`**

```ts
// src/entities/quiz-attempt/model/resolve-question.test.ts
import { resolveQuestionView } from "./resolve-question";
import type { QuestionLike } from "./types";

const mcq: QuestionLike = {
  id: "q1",
  questionType: "meaning",
  word: "Dog",
  meaning: "A dog",
  choices: [
    { id: "a", word: "A", meaning: "a" },
    { id: "b", word: "B", meaning: "b" },
  ],
};

describe("resolveQuestionView", () => {
  it("orders choices per the snapshot's choiceOrder", () => {
    const view = resolveQuestionView(mcq, { questionId: "q1", choiceOrder: ["b", "a"] }, { questionIndex: 0, totalQuestions: 2 });
    expect(view.choices?.map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("falls back to the question's own choice order when choiceOrder is null", () => {
    const view = resolveQuestionView(mcq, { questionId: "q1", choiceOrder: null }, { questionIndex: 0, totalQuestions: 2 });
    expect(view.choices?.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("returns null choices for a sentence-type question", () => {
    const sentence: QuestionLike = { id: "q2", questionType: "sentence", word: "Bird", meaning: "x", choices: null };
    const view = resolveQuestionView(sentence, { questionId: "q2", choiceOrder: null }, { questionIndex: 1, totalQuestions: 2 });
    expect(view.choices).toBeNull();
  });

  it("passes through the question's own fields and the given position", () => {
    const view = resolveQuestionView(mcq, { questionId: "q1", choiceOrder: null }, { questionIndex: 3, totalQuestions: 5 });
    expect(view).toMatchObject({
      questionIndex: 3,
      totalQuestions: 5,
      questionType: "meaning",
      word: "Dog",
      meaning: "A dog",
    });
  });
});
```

- [ ] **Step 7: Run the tests to verify they fail, then implement**

Run: `npx vitest run src/entities/quiz-attempt/model/resolve-question.test.ts`
Expected: FAIL with "Cannot find module './resolve-question'"

```ts
// src/entities/quiz-attempt/model/resolve-question.ts
import type { QuestionChoice, QuestionLike, QuestionSnapshotItem, ResolvedQuestion } from "./types";

export function resolveQuestionView(
  question: QuestionLike,
  snapshotItem: QuestionSnapshotItem,
  position: { questionIndex: number; totalQuestions: number }
): ResolvedQuestion {
  let choices: QuestionChoice[] | null = null;
  if (question.choices) {
    const order = snapshotItem.choiceOrder ?? question.choices.map((choice) => choice.id);
    const byId = new Map(question.choices.map((choice) => [choice.id, choice]));
    choices = order.map((id) => byId.get(id)).filter((choice): choice is QuestionChoice => Boolean(choice));
  }

  return {
    questionIndex: position.questionIndex,
    totalQuestions: position.totalQuestions,
    questionType: question.questionType,
    word: question.word,
    meaning: question.meaning,
    choices,
  };
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/entities/quiz-attempt/model/resolve-question.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add quiz-attempt entity's pure snapshot and resolution logic"
```

---

### Task 3: `entities/quiz-attempt` — DB queries

**Files:**
- Create: `src/entities/quiz-attempt/api/quiz-attempt.server.ts`
- Create: `src/entities/quiz-attempt/api/quiz-attempt.server.test.ts`
- Create: `src/entities/quiz-attempt/index.ts`

**Interfaces:**
- Consumes: `quizAttempts`, `attemptAnswers`, `schema` from `@/shared/api` (Task 1); `createUser`/`createFolder`/`createQuiz`/`createQuizQuestions` (test fixtures only).
- Produces: `getInProgressAttempt(quizId, userId, db?)`, `createAttempt(input, db?)`, `getAttemptById(id, userId, db?)`, `listAttemptsByQuiz(quizId, userId, db?)`, `recordAnswer(input, db?)`, `listAnswersByAttempt(attemptId, db?)`. Consumed by Tasks 5, 6, 8, 9, 10.

- [ ] **Step 1: Write the failing tests**

```ts
// src/entities/quiz-attempt/api/quiz-attempt.server.test.ts
import { createTestDb } from "@/shared/testing";
import { createUser } from "@/entities/user";
import { createFolder } from "@/entities/folder";
import { createQuiz } from "@/entities/quiz";
import { createQuizQuestions } from "@/entities/quiz-question";
import {
  getInProgressAttempt,
  createAttempt,
  getAttemptById,
  listAttemptsByQuiz,
  recordAnswer,
  listAnswersByAttempt,
} from "./quiz-attempt.server";

async function makeAttemptReady(db: Awaited<ReturnType<typeof createTestDb>>) {
  const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
  const folder = await createFolder({ userId: user.id, name: "Animals" }, db);
  const quiz = await createQuiz(
    { folderId: folder.id, userId: user.id, name: "Animal Quiz", questionTypes: ["meaning"], vocabItemIds: ["v1", "v2"], shuffleQuestions: false, shuffleAnswers: false },
    db
  );
  const questions = await createQuizQuestions(
    quiz.id,
    [
      { orderIndex: 0, questionType: "meaning", vocabItemId: "v1", word: "Dog", meaning: "A dog", choices: [{ id: "v1", word: "Dog", meaning: "A dog" }, { id: "v2", word: "Cat", meaning: "A cat" }] },
      { orderIndex: 1, questionType: "meaning", vocabItemId: "v2", word: "Cat", meaning: "A cat", choices: [{ id: "v1", word: "Dog", meaning: "A dog" }, { id: "v2", word: "Cat", meaning: "A cat" }] },
    ],
    db
  );
  return { userId: user.id, quizId: quiz.id, questions };
}

describe("quiz attempt entity", () => {
  it("returns null when there is no in-progress attempt, and the attempt once one exists", async () => {
    const db = await createTestDb();
    const { userId, quizId, questions } = await makeAttemptReady(db);
    expect(await getInProgressAttempt(quizId, userId, db)).toBeNull();

    const snapshot = questions.map((q) => ({ questionId: q.id, choiceOrder: q.choices!.map((c) => c.id) }));
    const attempt = await createAttempt({ quizId, userId, questionsSnapshot: snapshot }, db);

    expect(attempt).toMatchObject({ status: "in_progress", currentIndex: 0, totalQuestions: 2, score: null });
    expect(await getInProgressAttempt(quizId, userId, db)).toMatchObject({ id: attempt.id });
  });

  it("scopes getAttemptById to its owner", async () => {
    const db = await createTestDb();
    const { userId, quizId, questions } = await makeAttemptReady(db);
    const other = await createUser({ email: "other@example.com", passwordHash: "hash" }, db);
    const snapshot = questions.map((q) => ({ questionId: q.id, choiceOrder: null }));
    const attempt = await createAttempt({ quizId, userId, questionsSnapshot: snapshot }, db);

    expect(await getAttemptById(attempt.id, userId, db)).toMatchObject({ id: attempt.id });
    expect(await getAttemptById(attempt.id, other.id, db)).toBeNull();
  });

  it("records an answer, advances currentIndex, and stays in_progress before the last question", async () => {
    const db = await createTestDb();
    const { userId, quizId, questions } = await makeAttemptReady(db);
    const snapshot = questions.map((q) => ({ questionId: q.id, choiceOrder: null }));
    const attempt = await createAttempt({ quizId, userId, questionsSnapshot: snapshot }, db);

    const updated = await recordAnswer(
      { attemptId: attempt.id, questionIndex: 0, questionType: "meaning", word: "Dog", meaning: "A dog", userAnswer: "v1", isCorrect: true },
      db
    );

    expect(updated).toMatchObject({ status: "in_progress", currentIndex: 1, score: null });
  });

  it("completes the attempt and computes the score after the last question", async () => {
    const db = await createTestDb();
    const { userId, quizId, questions } = await makeAttemptReady(db);
    const snapshot = questions.map((q) => ({ questionId: q.id, choiceOrder: null }));
    const attempt = await createAttempt({ quizId, userId, questionsSnapshot: snapshot }, db);

    await recordAnswer({ attemptId: attempt.id, questionIndex: 0, questionType: "meaning", word: "Dog", meaning: "A dog", userAnswer: "v1", isCorrect: true }, db);
    const final = await recordAnswer(
      { attemptId: attempt.id, questionIndex: 1, questionType: "meaning", word: "Cat", meaning: "A cat", userAnswer: "v1", isCorrect: false },
      db
    );

    expect(final).toMatchObject({ status: "completed", currentIndex: 2, score: 1 });
    expect(final.finishedAt).not.toBeNull();
  });

  it("lists only completed attempts for the requesting user, most recent first", async () => {
    const db = await createTestDb();
    const { userId, quizId, questions } = await makeAttemptReady(db);
    const snapshot = questions.map((q) => ({ questionId: q.id, choiceOrder: null }));
    const first = await createAttempt({ quizId, userId, questionsSnapshot: snapshot }, db);
    await recordAnswer({ attemptId: first.id, questionIndex: 0, questionType: "meaning", word: "Dog", meaning: "A dog", userAnswer: "v1", isCorrect: true }, db);
    await recordAnswer({ attemptId: first.id, questionIndex: 1, questionType: "meaning", word: "Cat", meaning: "A cat", userAnswer: "v2", isCorrect: true }, db);

    const other = await createUser({ email: "other@example.com", passwordHash: "hash" }, db);
    const otherFolder = await createFolder({ userId: other.id, name: "Other" }, db);
    const otherQuiz = await createQuiz({ folderId: otherFolder.id, userId: other.id, name: "Other Quiz", questionTypes: ["sentence"], vocabItemIds: ["x"], shuffleQuestions: false, shuffleAnswers: false }, db);

    const list = await listAttemptsByQuiz(quizId, userId, db);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: first.id, status: "completed" });
    expect(await listAttemptsByQuiz(otherQuiz.id, other.id, db)).toEqual([]);
  });

  it("lists answers for an attempt ordered by questionIndex", async () => {
    const db = await createTestDb();
    const { userId, quizId, questions } = await makeAttemptReady(db);
    const snapshot = questions.map((q) => ({ questionId: q.id, choiceOrder: null }));
    const attempt = await createAttempt({ quizId, userId, questionsSnapshot: snapshot }, db);
    await recordAnswer({ attemptId: attempt.id, questionIndex: 0, questionType: "meaning", word: "Dog", meaning: "A dog", userAnswer: "v1", isCorrect: true }, db);
    await recordAnswer({ attemptId: attempt.id, questionIndex: 1, questionType: "meaning", word: "Cat", meaning: "A cat", userAnswer: "v2", isCorrect: true }, db);

    const answers = await listAnswersByAttempt(attempt.id, db);
    expect(answers.map((a) => a.word)).toEqual(["Dog", "Cat"]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/entities/quiz-attempt/api/quiz-attempt.server.test.ts`
Expected: FAIL with "Cannot find module './quiz-attempt.server'"

- [ ] **Step 3: Implement the queries**

```ts
// src/entities/quiz-attempt/api/quiz-attempt.server.ts
import { db as defaultDb, quizAttempts, attemptAnswers, schema } from "@/shared/api";
import { and, asc, desc, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { AttemptAnswer, QuestionSnapshotItem, QuizAttempt } from "../model/types";

type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export async function getInProgressAttempt(quizId: string, userId: string, db: Db = defaultDb): Promise<QuizAttempt | null> {
  const rows = await db
    .select()
    .from(quizAttempts)
    .where(and(eq(quizAttempts.quizId, quizId), eq(quizAttempts.userId, userId), eq(quizAttempts.status, "in_progress")));
  return rows[0] ?? null;
}

export async function createAttempt(
  input: { quizId: string; userId: string; questionsSnapshot: QuestionSnapshotItem[] },
  db: Db = defaultDb
): Promise<QuizAttempt> {
  const rows = await db
    .insert(quizAttempts)
    .values({
      quizId: input.quizId,
      userId: input.userId,
      questionsSnapshot: input.questionsSnapshot,
      totalQuestions: input.questionsSnapshot.length,
    })
    .returning();
  return rows[0];
}

export async function getAttemptById(id: string, userId: string, db: Db = defaultDb): Promise<QuizAttempt | null> {
  const rows = await db
    .select()
    .from(quizAttempts)
    .where(and(eq(quizAttempts.id, id), eq(quizAttempts.userId, userId)));
  return rows[0] ?? null;
}

export async function listAttemptsByQuiz(quizId: string, userId: string, db: Db = defaultDb): Promise<QuizAttempt[]> {
  return db
    .select()
    .from(quizAttempts)
    .where(and(eq(quizAttempts.quizId, quizId), eq(quizAttempts.userId, userId), eq(quizAttempts.status, "completed")))
    .orderBy(desc(quizAttempts.finishedAt));
}

export async function recordAnswer(
  input: {
    attemptId: string;
    questionIndex: number;
    questionType: AttemptAnswer["questionType"];
    word: string;
    meaning: string;
    userAnswer: string;
    isCorrect: boolean;
    aiFeedback?: string | null;
  },
  db: Db = defaultDb
): Promise<QuizAttempt> {
  await db.insert(attemptAnswers).values({
    attemptId: input.attemptId,
    questionIndex: input.questionIndex,
    questionType: input.questionType,
    word: input.word,
    meaning: input.meaning,
    userAnswer: input.userAnswer,
    isCorrect: input.isCorrect,
    aiFeedback: input.aiFeedback ?? null,
  });

  const [attempt] = await db.select().from(quizAttempts).where(eq(quizAttempts.id, input.attemptId));
  const nextIndex = attempt.currentIndex + 1;
  const isDone = nextIndex >= attempt.totalQuestions;

  let score: number | null = null;
  if (isDone) {
    const answers = await db.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, input.attemptId));
    score = answers.filter((answer) => answer.isCorrect).length;
  }

  const rows = await db
    .update(quizAttempts)
    .set({
      currentIndex: nextIndex,
      ...(isDone ? { status: "completed" as const, finishedAt: new Date(), score } : {}),
    })
    .where(eq(quizAttempts.id, input.attemptId))
    .returning();
  return rows[0];
}

export async function listAnswersByAttempt(attemptId: string, db: Db = defaultDb): Promise<AttemptAnswer[]> {
  return db.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, attemptId)).orderBy(asc(attemptAnswers.questionIndex));
}
```

- [ ] **Step 4: Barrel export**

```ts
// src/entities/quiz-attempt/index.ts
export { buildQuestionsSnapshot } from "./model/build-snapshot";
export { resolveQuestionView } from "./model/resolve-question";
export {
  getInProgressAttempt,
  createAttempt,
  getAttemptById,
  listAttemptsByQuiz,
  recordAnswer,
  listAnswersByAttempt,
} from "./api/quiz-attempt.server";
export type {
  AttemptStatus,
  QuestionType,
  QuestionChoice,
  QuestionSnapshotItem,
  QuizAttempt,
  AttemptAnswer,
  QuestionLike,
  ResolvedQuestion,
} from "./model/types";
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/entities/quiz-attempt`
Expected: PASS (15 tests total across Tasks 2-3)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add quiz-attempt entity's DB queries"
```

---

### Task 4: AI Gateway setup and `features/grade-sentence-answer`

**Files:**
- Modify: `package.json` (add `ai`)
- Modify: `.env.example`
- Modify: `README.md`
- Create: `src/features/grade-sentence-answer/api/grade-sentence-answer.server.ts`
- Create: `src/features/grade-sentence-answer/api/grade-sentence-answer.server.test.ts`
- Create: `src/features/grade-sentence-answer/index.ts`

**Interfaces:**
- Produces: `gradeSentenceAnswer(word, meaning, sentence): Promise<{ isCorrect: boolean; feedback: string }>` from `@/features/grade-sentence-answer`. Consumed by Task 6's `submit-quiz-answer`.

- [ ] **Step 1: Install the AI SDK**

```bash
npm install ai
```

Before writing Step 5's implementation, read `node_modules/ai/docs/` (search for "Output" and "generateText" — the structured-output guide is the relevant one) to confirm the exact call shape for the version that actually got installed. Adjust Step 5's code only if the bundled docs disagree with what's written here.

- [ ] **Step 2: Document the new environment variables**

```
# .env.example — append
AI_GATEWAY_API_KEY=
AI_GATEWAY_MODEL=google/gemini-2.5-flash
```

Add a row to the setup table in `README.md`:

```markdown
| `AI_GATEWAY_API_KEY` | Create one with `vercel ai-gateway api-keys create` (or via the Vercel dashboard's AI Gateway tab). Optional: sentence-type quiz questions grade with a graceful fallback message if this is unset or the call fails — every other feature works without it. |
```

Also note under the same table: `AI_GATEWAY_MODEL` defaults to `google/gemini-2.5-flash` if unset; run `curl -s https://ai-gateway.vercel.sh/v1/models | jq -r '.data[].id'` to see what's currently available before changing it, since Gateway models are added and retired over time.

- [ ] **Step 3: Write the failing tests**

```ts
// src/features/grade-sentence-answer/api/grade-sentence-answer.server.test.ts
import { vi } from "vitest";
import { generateText } from "ai";
import { gradeSentenceAnswer } from "./grade-sentence-answer.server";

vi.mock("ai", () => ({
  generateText: vi.fn(),
  Output: { object: (config: unknown) => config },
}));

describe("gradeSentenceAnswer", () => {
  it("returns the model's grading result on success", async () => {
    vi.mocked(generateText).mockResolvedValue({
      output: { isCorrect: true, feedback: "Great use of the word!" },
    } as never);

    const result = await gradeSentenceAnswer("Dog", "A domesticated canine", "I walked my dog this morning.");

    expect(result).toEqual({ isCorrect: true, feedback: "Great use of the word!" });
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: expect.stringContaining("Dog") })
    );
  });

  it("falls back to a manual-review message when the AI call fails", async () => {
    vi.mocked(generateText).mockRejectedValue(new Error("network error"));

    const result = await gradeSentenceAnswer("Dog", "A domesticated canine", "asdkjasd");

    expect(result.isCorrect).toBe(false);
    expect(result.feedback).toMatch(/couldn't automatically grade/i);
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run src/features/grade-sentence-answer`
Expected: FAIL with "Cannot find module './grade-sentence-answer.server'"

- [ ] **Step 5: Implement**

```ts
// src/features/grade-sentence-answer/api/grade-sentence-answer.server.ts
import { generateText, Output } from "ai";
import { z } from "zod";

const gradingSchema = z.object({
  isCorrect: z.boolean(),
  feedback: z.string(),
});

export interface GradeSentenceResult {
  isCorrect: boolean;
  feedback: string;
}

const FALLBACK_FEEDBACK =
  "We couldn't automatically grade this sentence. Please double-check it uses the word correctly.";

export async function gradeSentenceAnswer(word: string, meaning: string, sentence: string): Promise<GradeSentenceResult> {
  try {
    const model = process.env.AI_GATEWAY_MODEL || "google/gemini-2.5-flash";
    const { output } = await generateText({
      model,
      output: Output.object({ schema: gradingSchema }),
      prompt: `You are grading an English vocabulary exercise. The word is "${word}" (meaning: "${meaning}"). The student wrote this sentence: "${sentence}". Does the sentence use the word correctly, with correct grammar and a meaning consistent with the definition above? Reply with isCorrect and a short, encouraging one-sentence feedback explaining why.`,
    });
    return output;
  } catch {
    return { isCorrect: false, feedback: FALLBACK_FEEDBACK };
  }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/features/grade-sentence-answer`
Expected: PASS (2 tests)

- [ ] **Step 7: Barrel export**

```ts
// src/features/grade-sentence-answer/index.ts
export { gradeSentenceAnswer } from "./api/grade-sentence-answer.server";
export type { GradeSentenceResult } from "./api/grade-sentence-answer.server";
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add AI Gateway sentence grading with graceful fallback"
```

---

### Task 5: `features/start-quiz-attempt` — start/resume

**Files:**
- Create: `src/features/start-quiz-attempt/api/start-quiz-attempt.server.ts`
- Create: `src/features/start-quiz-attempt/api/start-quiz-attempt.server.test.ts`
- Create: `src/features/start-quiz-attempt/ui/start-quiz-button.tsx`
- Create: `src/features/start-quiz-attempt/index.ts`

**Interfaces:**
- Consumes: `getQuizById` from `@/entities/quiz`; `listQuestionsByQuiz` from `@/entities/quiz-question`; `getInProgressAttempt`, `createAttempt`, `buildQuestionsSnapshot` from `@/entities/quiz-attempt`.
- Produces: `startQuizAttemptAction(quizId, db?)` returning `{ ok: true; attemptId: string } | { ok: false; error: string }`; `StartQuizButton` component. Consumed by Task 10.

- [ ] **Step 1: Write the failing tests**

```ts
// src/features/start-quiz-attempt/api/start-quiz-attempt.server.test.ts
import { createTestDb } from "@/shared/testing";
import { vi } from "vitest";
import { auth } from "@/_app/api-routes/auth";
import { createUser } from "@/entities/user";
import { createFolder } from "@/entities/folder";
import { createQuiz } from "@/entities/quiz";
import { createQuizQuestions } from "@/entities/quiz-question";
import { getInProgressAttempt } from "@/entities/quiz-attempt";
import { startQuizAttemptAction } from "./start-quiz-attempt.server";

vi.mock("@/_app/api-routes/auth", () => ({ auth: vi.fn() }));

async function setup(db: Awaited<ReturnType<typeof createTestDb>>) {
  const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
  const folder = await createFolder({ userId: user.id, name: "Animals" }, db);
  const quiz = await createQuiz(
    { folderId: folder.id, userId: user.id, name: "Animal Quiz", questionTypes: ["meaning"], vocabItemIds: ["v1"], shuffleQuestions: false, shuffleAnswers: false },
    db
  );
  await createQuizQuestions(quiz.id, [{ orderIndex: 0, questionType: "meaning", vocabItemId: "v1", word: "Dog", meaning: "A dog", choices: null }], db);
  vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);
  return { userId: user.id, quizId: quiz.id };
}

describe("startQuizAttemptAction", () => {
  it("creates a new in-progress attempt when none exists", async () => {
    const db = await createTestDb();
    const { quizId, userId } = await setup(db);

    const result = await startQuizAttemptAction(quizId, db);

    expect(result).toMatchObject({ ok: true });
    const attempt = await getInProgressAttempt(quizId, userId, db);
    expect(attempt).not.toBeNull();
    expect(result.ok && result.attemptId).toBe(attempt!.id);
  });

  it("returns the existing in-progress attempt instead of creating a second one", async () => {
    const db = await createTestDb();
    const { quizId } = await setup(db);

    const first = await startQuizAttemptAction(quizId, db);
    const second = await startQuizAttemptAction(quizId, db);

    expect(first.ok && second.ok && first.attemptId).toBe(second.ok && second.attemptId);
  });

  it("rejects a quiz the requester doesn't own", async () => {
    const db = await createTestDb();
    const { quizId } = await setup(db);
    const intruder = await createUser({ email: "intruder@example.com", passwordHash: "hash" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: intruder.id } } as never);

    expect(await startQuizAttemptAction(quizId, db)).toMatchObject({ ok: false });
  });

  it("rejects the call when there is no session", async () => {
    const db = await createTestDb();
    vi.mocked(auth).mockResolvedValue(null);
    expect(await startQuizAttemptAction("q1", db)).toMatchObject({ ok: false });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/start-quiz-attempt/api/start-quiz-attempt.server.test.ts`
Expected: FAIL with "Cannot find module './start-quiz-attempt.server'"

- [ ] **Step 3: Implement the Server Action**

```ts
// src/features/start-quiz-attempt/api/start-quiz-attempt.server.ts
"use server";

import { getQuizById } from "@/entities/quiz";
import { listQuestionsByQuiz } from "@/entities/quiz-question";
import { getInProgressAttempt, createAttempt, buildQuestionsSnapshot } from "@/entities/quiz-attempt";
import { auth } from "@/_app/api-routes/auth";
import { db as defaultDb } from "@/shared/api";

export type StartQuizAttemptResult = { ok: true; attemptId: string } | { ok: false; error: string };

type Db = Parameters<typeof getQuizById>[2];

export async function startQuizAttemptAction(quizId: string, dbInstance: Db = defaultDb): Promise<StartQuizAttemptResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "You must be signed in." };
  }

  try {
    const quiz = await getQuizById(quizId, session.user.id, dbInstance);
    if (!quiz) {
      return { ok: false, error: "Quiz not found" };
    }

    const existing = await getInProgressAttempt(quizId, session.user.id, dbInstance);
    if (existing) {
      return { ok: true, attemptId: existing.id };
    }

    const questions = await listQuestionsByQuiz(quizId, dbInstance);
    const snapshot = buildQuestionsSnapshot(questions, {
      shuffleQuestions: quiz.shuffleQuestions,
      shuffleAnswers: quiz.shuffleAnswers,
    });
    const attempt = await createAttempt({ quizId, userId: session.user.id, questionsSnapshot: snapshot }, dbInstance);
    return { ok: true, attemptId: attempt.id };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/start-quiz-attempt/api/start-quiz-attempt.server.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Implement `StartQuizButton`**

```tsx
// src/features/start-quiz-attempt/ui/start-quiz-button.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { startQuizAttemptAction } from "../api/start-quiz-attempt.server";

interface StartQuizButtonProps {
  quizId: string;
  hasInProgressAttempt: boolean;
}

export function StartQuizButton({ quizId, hasInProgressAttempt }: StartQuizButtonProps) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);

  async function handleClick() {
    setIsStarting(true);
    try {
      const result = await startQuizAttemptAction(quizId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(`/quiz/${quizId}/attempt`);
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <Button onClick={handleClick} disabled={isStarting}>
      {isStarting ? "Loading..." : hasInProgressAttempt ? "Continue" : "Start"}
    </Button>
  );
}
```

- [ ] **Step 6: Barrel export**

```ts
// src/features/start-quiz-attempt/index.ts
export { startQuizAttemptAction } from "./api/start-quiz-attempt.server";
export { StartQuizButton } from "./ui/start-quiz-button";
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add start/resume quiz attempt Server Action and button"
```

---

### Task 6: `features/submit-quiz-answer`

**Files:**
- Create: `src/features/submit-quiz-answer/model/schema.ts`
- Create: `src/features/submit-quiz-answer/api/submit-quiz-answer.server.ts`
- Create: `src/features/submit-quiz-answer/api/submit-quiz-answer.server.test.ts`
- Create: `src/features/submit-quiz-answer/index.ts`

**Interfaces:**
- Consumes: `getAttemptById`, `recordAnswer` from `@/entities/quiz-attempt`; `getQuestionById` from `@/entities/quiz-question`; `gradeSentenceAnswer` from `@/features/grade-sentence-answer` (Task 4).
- Produces: `submitAnswerAction(attemptId, input, db?)` returning `{ ok: true; isCorrect: boolean; aiFeedback: string | null; completed: boolean; score: number | null } | { ok: false; error: string }`. Consumed by Task 7's `QuizPlayer`.

- [ ] **Step 1: Implement the schema**

```ts
// src/features/submit-quiz-answer/model/schema.ts
import { z } from "zod";

export const submitAnswerSchema = z.object({
  questionIndex: z.number().int().min(0),
  userAnswer: z.string().trim().min(1, "Answer is required"),
});
export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;
```

- [ ] **Step 2: Write the failing tests**

```ts
// src/features/submit-quiz-answer/api/submit-quiz-answer.server.test.ts
import { createTestDb } from "@/shared/testing";
import { vi } from "vitest";
import { auth } from "@/_app/api-routes/auth";
import { createUser } from "@/entities/user";
import { createFolder } from "@/entities/folder";
import { createQuiz } from "@/entities/quiz";
import { createQuizQuestions } from "@/entities/quiz-question";
import { createAttempt } from "@/entities/quiz-attempt";
import { gradeSentenceAnswer } from "@/features/grade-sentence-answer";
import { submitAnswerAction } from "./submit-quiz-answer.server";

vi.mock("@/_app/api-routes/auth", () => ({ auth: vi.fn() }));
vi.mock("@/features/grade-sentence-answer", () => ({ gradeSentenceAnswer: vi.fn() }));

async function setup(db: Awaited<ReturnType<typeof createTestDb>>) {
  const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
  const folder = await createFolder({ userId: user.id, name: "Animals" }, db);
  const quiz = await createQuiz(
    { folderId: folder.id, userId: user.id, name: "Animal Quiz", questionTypes: ["meaning", "sentence"], vocabItemIds: ["v1"], shuffleQuestions: false, shuffleAnswers: false },
    db
  );
  const questions = await createQuizQuestions(
    quiz.id,
    [
      {
        orderIndex: 0,
        questionType: "meaning",
        vocabItemId: "v1",
        word: "Dog",
        meaning: "A dog",
        choices: [
          { id: "v1", word: "Dog", meaning: "A dog" },
          { id: "v2", word: "Cat", meaning: "A cat" },
        ],
      },
      { orderIndex: 1, questionType: "sentence", vocabItemId: "v1", word: "Dog", meaning: "A dog", choices: null },
    ],
    db
  );
  const attempt = await createAttempt(
    { quizId: quiz.id, userId: user.id, questionsSnapshot: questions.map((q) => ({ questionId: q.id, choiceOrder: q.choices?.map((c) => c.id) ?? null })) },
    db
  );
  vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);
  return { userId: user.id, attemptId: attempt.id };
}

describe("submitAnswerAction", () => {
  it("grades an MCQ answer correct when it matches the target word", async () => {
    const db = await createTestDb();
    const { attemptId } = await setup(db);

    const result = await submitAnswerAction(attemptId, { questionIndex: 0, userAnswer: "v1" }, db);

    expect(result).toMatchObject({ ok: true, isCorrect: true, aiFeedback: null, completed: false });
  });

  it("grades an MCQ answer incorrect when it doesn't match", async () => {
    const db = await createTestDb();
    const { attemptId } = await setup(db);

    const result = await submitAnswerAction(attemptId, { questionIndex: 0, userAnswer: "v2" }, db);

    expect(result).toMatchObject({ ok: true, isCorrect: false });
  });

  it("grades a sentence answer via the AI feature and surfaces its feedback", async () => {
    const db = await createTestDb();
    const { attemptId } = await setup(db);
    vi.mocked(gradeSentenceAnswer).mockResolvedValue({ isCorrect: true, feedback: "Nicely done." });
    await submitAnswerAction(attemptId, { questionIndex: 0, userAnswer: "v1" }, db); // consume question 0 first

    const result = await submitAnswerAction(attemptId, { questionIndex: 1, userAnswer: "I walked my dog." }, db);

    expect(result).toMatchObject({ ok: true, isCorrect: true, aiFeedback: "Nicely done.", completed: true, score: 2 });
  });

  it("rejects resubmitting an already-answered question", async () => {
    const db = await createTestDb();
    const { attemptId } = await setup(db);
    await submitAnswerAction(attemptId, { questionIndex: 0, userAnswer: "v1" }, db);

    const result = await submitAnswerAction(attemptId, { questionIndex: 0, userAnswer: "v1" }, db);

    expect(result).toMatchObject({ ok: false });
  });

  it("rejects submitting to an already-completed attempt", async () => {
    const db = await createTestDb();
    const { attemptId } = await setup(db);
    vi.mocked(gradeSentenceAnswer).mockResolvedValue({ isCorrect: true, feedback: "Nicely done." });
    await submitAnswerAction(attemptId, { questionIndex: 0, userAnswer: "v1" }, db);
    await submitAnswerAction(attemptId, { questionIndex: 1, userAnswer: "I walked my dog." }, db);

    const result = await submitAnswerAction(attemptId, { questionIndex: 2, userAnswer: "anything" }, db);

    expect(result).toMatchObject({ ok: false });
  });

  it("rejects an attempt that doesn't belong to the requester", async () => {
    const db = await createTestDb();
    const { attemptId } = await setup(db);
    const intruder = await createUser({ email: "intruder@example.com", passwordHash: "hash" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: intruder.id } } as never);

    expect(await submitAnswerAction(attemptId, { questionIndex: 0, userAnswer: "v1" }, db)).toMatchObject({ ok: false });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/features/submit-quiz-answer`
Expected: FAIL with "Cannot find module './submit-quiz-answer.server'"

- [ ] **Step 4: Implement**

```ts
// src/features/submit-quiz-answer/api/submit-quiz-answer.server.ts
"use server";

import { submitAnswerSchema } from "../model/schema";
import { getAttemptById, recordAnswer } from "@/entities/quiz-attempt";
import { getQuestionById } from "@/entities/quiz-question";
import { gradeSentenceAnswer } from "@/features/grade-sentence-answer";
import { auth } from "@/_app/api-routes/auth";
import { db as defaultDb } from "@/shared/api";
import { safeRevalidatePath } from "@/shared/lib/safe-revalidate-path";

export type SubmitAnswerResult =
  | { ok: true; isCorrect: boolean; aiFeedback: string | null; completed: boolean; score: number | null }
  | { ok: false; error: string };

type Db = Parameters<typeof getAttemptById>[2];

export async function submitAnswerAction(
  attemptId: string,
  input: unknown,
  dbInstance: Db = defaultDb
): Promise<SubmitAnswerResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = submitAnswerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const attempt = await getAttemptById(attemptId, session.user.id, dbInstance);
    if (!attempt) {
      return { ok: false, error: "Attempt not found" };
    }
    if (attempt.status !== "in_progress") {
      return { ok: false, error: "This attempt is already finished" };
    }
    if (parsed.data.questionIndex !== attempt.currentIndex) {
      return { ok: false, error: "This question was already answered" };
    }

    const snapshotItem = attempt.questionsSnapshot[attempt.currentIndex];
    const question = await getQuestionById(snapshotItem.questionId, dbInstance);
    if (!question) {
      return { ok: false, error: "Question not found" };
    }

    let isCorrect: boolean;
    let aiFeedback: string | null = null;

    if (question.questionType === "sentence") {
      const graded = await gradeSentenceAnswer(question.word, question.meaning, parsed.data.userAnswer);
      isCorrect = graded.isCorrect;
      aiFeedback = graded.feedback;
    } else {
      isCorrect = parsed.data.userAnswer === question.vocabItemId;
    }

    const updated = await recordAnswer(
      {
        attemptId,
        questionIndex: attempt.currentIndex,
        questionType: question.questionType,
        word: question.word,
        meaning: question.meaning,
        userAnswer: parsed.data.userAnswer,
        isCorrect,
        aiFeedback,
      },
      dbInstance
    );

    safeRevalidatePath(`/quiz/${attempt.quizId}/attempt`);
    return { ok: true, isCorrect, aiFeedback, completed: updated.status === "completed", score: updated.score };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/features/submit-quiz-answer`
Expected: PASS (6 tests)

- [ ] **Step 6: Barrel export**

```ts
// src/features/submit-quiz-answer/index.ts
export { submitAnswerAction } from "./api/submit-quiz-answer.server";
export type { SubmitAnswerResult } from "./api/submit-quiz-answer.server";
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add submit-quiz-answer Server Action with AI grading and idempotency guards"
```

---

### Task 7: `widgets/quiz-player`

**Files:**
- Create: `src/widgets/quiz-player/ui/quiz-player.tsx`
- Create: `src/widgets/quiz-player/ui/quiz-player.test.tsx`
- Create: `src/widgets/quiz-player/index.ts`

**Interfaces:**
- Consumes: `submitAnswerAction` from `@/features/submit-quiz-answer` (Task 6); `QuestionType` type from `@/entities/quiz-attempt`.
- Produces: `QuizPlayer` from `@/widgets/quiz-player`. Consumed by Task 8's `_pages/quiz-attempt`.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/widgets/quiz-player/ui/quiz-player.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { QuizPlayer } from "./quiz-player";
import { submitAnswerAction } from "@/features/submit-quiz-answer";

vi.mock("@/features/submit-quiz-answer", () => ({ submitAnswerAction: vi.fn() }));
const refresh = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push }) }));

it("submits the selected MCQ choice's id and shows correctness feedback", async () => {
  vi.mocked(submitAnswerAction).mockResolvedValue({ ok: true, isCorrect: true, aiFeedback: null, completed: false, score: null });
  const user = userEvent.setup();
  render(
    <QuizPlayer
      attemptId="a1"
      quizId="q1"
      questionIndex={0}
      totalQuestions={2}
      questionType="meaning"
      word="Dog"
      meaning="A dog"
      choices={[{ id: "v1", word: "Dog", meaning: "A dog" }, { id: "v2", word: "Cat", meaning: "A cat" }]}
    />
  );

  await user.click(screen.getByRole("button", { name: "A dog" }));
  await user.click(screen.getByRole("button", { name: "Submit" }));

  await waitFor(() => expect(submitAnswerAction).toHaveBeenCalledWith("a1", { questionIndex: 0, userAnswer: "v1" }));
  expect(screen.getByText("Correct!")).toBeInTheDocument();
});

it("submits free text and shows AI feedback for a sentence question", async () => {
  vi.mocked(submitAnswerAction).mockResolvedValue({ ok: true, isCorrect: false, aiFeedback: "Try again.", completed: false, score: null });
  const user = userEvent.setup();
  render(
    <QuizPlayer attemptId="a1" quizId="q1" questionIndex={1} totalQuestions={2} questionType="sentence" word="Dog" meaning="A dog" choices={null} />
  );

  await user.type(screen.getByPlaceholderText("Type your sentence..."), "asdf");
  await user.click(screen.getByRole("button", { name: "Submit" }));

  await waitFor(() => expect(screen.getByText("Try again.")).toBeInTheDocument());
});

it("refreshes the page for the next question, or navigates to results when completed", async () => {
  vi.mocked(submitAnswerAction).mockResolvedValue({ ok: true, isCorrect: true, aiFeedback: null, completed: true, score: 2 });
  const user = userEvent.setup();
  render(
    <QuizPlayer attemptId="a1" quizId="q1" questionIndex={1} totalQuestions={2} questionType="meaning" word="Dog" meaning="A dog" choices={[{ id: "v1", word: "Dog", meaning: "A dog" }]} />
  );

  await user.click(screen.getByRole("button", { name: "A dog" }));
  await user.click(screen.getByRole("button", { name: "Submit" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "See results" })).toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "See results" }));

  expect(push).toHaveBeenCalledWith("/quiz/q1/attempt/a1");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/widgets/quiz-player`
Expected: FAIL with "Cannot find module './quiz-player'"

- [ ] **Step 3: Implement**

```tsx
// src/widgets/quiz-player/ui/quiz-player.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { submitAnswerAction } from "@/features/submit-quiz-answer";
import type { QuestionType } from "@/entities/quiz-attempt";

interface QuestionChoice {
  id: string;
  word: string;
  meaning: string;
}

interface QuizPlayerProps {
  attemptId: string;
  quizId: string;
  questionIndex: number;
  totalQuestions: number;
  questionType: QuestionType;
  word: string;
  meaning: string;
  choices: QuestionChoice[] | null;
}

export function QuizPlayer({
  attemptId,
  quizId,
  questionIndex,
  totalQuestions,
  questionType,
  word,
  meaning,
  choices,
}: QuizPlayerProps) {
  const router = useRouter();
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [sentence, setSentence] = useState("");
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; aiFeedback: string | null } | null>(null);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const answer = questionType === "sentence" ? sentence : (selectedChoiceId ?? "");

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await submitAnswerAction(attemptId, { questionIndex, userAnswer: answer });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setFeedback({ isCorrect: result.isCorrect, aiFeedback: result.aiFeedback });
      setCompleted(result.completed);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleNext() {
    if (completed) {
      router.push(`/quiz/${quizId}/attempt/${attemptId}`);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Question {questionIndex + 1} of {totalQuestions}
      </p>

      {questionType === "sentence" ? (
        <>
          <p className="text-lg font-medium">Write a sentence using &ldquo;{word}&rdquo;</p>
          <p className="text-muted-foreground text-sm">{meaning}</p>
          <Input
            value={sentence}
            onChange={(event) => setSentence(event.target.value)}
            disabled={Boolean(feedback)}
            placeholder="Type your sentence..."
          />
        </>
      ) : (
        <>
          <p className="text-lg font-medium">
            {questionType === "meaning" ? `What does "${word}" mean?` : `Which word means "${meaning}"?`}
          </p>
          <div className="flex flex-col gap-2">
            {choices?.map((choice) => (
              <Button
                key={choice.id}
                type="button"
                variant={selectedChoiceId === choice.id ? "default" : "outline"}
                disabled={Boolean(feedback)}
                onClick={() => setSelectedChoiceId(choice.id)}
                className="justify-start"
              >
                {questionType === "meaning" ? choice.meaning : choice.word}
              </Button>
            ))}
          </div>
        </>
      )}

      {error && <p className="text-destructive text-xs">{error}</p>}

      {feedback ? (
        <div className="flex flex-col gap-2">
          <p className={feedback.isCorrect ? "text-sm font-medium text-green-600" : "text-destructive text-sm font-medium"}>
            {feedback.isCorrect ? "Correct!" : "Not quite."}
          </p>
          {feedback.aiFeedback && <p className="text-muted-foreground text-sm">{feedback.aiFeedback}</p>}
          <Button onClick={handleNext}>{completed ? "See results" : "Next question"}</Button>
        </div>
      ) : (
        <Button onClick={handleSubmit} disabled={!answer.trim() || isSubmitting}>
          {isSubmitting ? "Checking..." : "Submit"}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/widgets/quiz-player`
Expected: PASS (3 tests)

- [ ] **Step 5: Barrel export and commit**

```ts
// src/widgets/quiz-player/index.ts
export { QuizPlayer } from "./ui/quiz-player";
```

```bash
git add -A
git commit -m "feat: add QuizPlayer widget"
```

---

### Task 8: `/quiz/[quizId]/attempt` — the player page

**Files:**
- Create: `src/_pages/quiz-attempt/ui/quiz-attempt-page.tsx`
- Create: `src/_pages/quiz-attempt/index.tsx`
- Create: `app/(main)/quiz/[quizId]/attempt/page.tsx`

**Interfaces:**
- Consumes: `getQuizById` from `@/entities/quiz`; `getInProgressAttempt`, `resolveQuestionView` from `@/entities/quiz-attempt`; `getQuestionById` from `@/entities/quiz-question`; `QuizPlayer` from `@/widgets/quiz-player` (Task 7).
- Produces: `/quiz/[quizId]/attempt` route.

- [ ] **Step 1: Implement `QuizAttemptPage`**

```tsx
// src/_pages/quiz-attempt/ui/quiz-attempt-page.tsx
import { QuizPlayer } from "@/widgets/quiz-player";
import type { ResolvedQuestion } from "@/entities/quiz-attempt";

interface QuizAttemptPageProps {
  attemptId: string;
  quizId: string;
  quizName: string;
  question: ResolvedQuestion;
}

export function QuizAttemptPage({ attemptId, quizId, quizName, question }: QuizAttemptPageProps) {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <h1 className="text-xl font-semibold tracking-tight">{quizName}</h1>
      <QuizPlayer
        attemptId={attemptId}
        quizId={quizId}
        questionIndex={question.questionIndex}
        totalQuestions={question.totalQuestions}
        questionType={question.questionType}
        word={question.word}
        meaning={question.meaning}
        choices={question.choices}
      />
    </div>
  );
}
```

```ts
// src/_pages/quiz-attempt/index.tsx
export { QuizAttemptPage as default } from "./ui/quiz-attempt-page";
```

- [ ] **Step 2: Add the route**

```tsx
// app/(main)/quiz/[quizId]/attempt/page.tsx
import { redirect } from "next/navigation";
import { auth } from "@/_app/api-routes/auth";
import { getQuizById } from "@/entities/quiz";
import { getInProgressAttempt, resolveQuestionView } from "@/entities/quiz-attempt";
import { getQuestionById } from "@/entities/quiz-question";
import QuizAttemptPage from "@/_pages/quiz-attempt";

export default async function Page({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params;
  const session = await auth();
  const quiz = await getQuizById(quizId, session!.user.id);
  if (!quiz) {
    redirect("/quiz");
  }

  const attempt = await getInProgressAttempt(quizId, session!.user.id);
  if (!attempt) {
    redirect(`/quiz/${quizId}`);
  }

  const snapshotItem = attempt.questionsSnapshot[attempt.currentIndex];
  const question = await getQuestionById(snapshotItem.questionId);
  if (!question) {
    redirect(`/quiz/${quizId}`);
  }

  const resolved = resolveQuestionView(question, snapshotItem, {
    questionIndex: attempt.currentIndex,
    totalQuestions: attempt.totalQuestions,
  });

  return <QuizAttemptPage attemptId={attempt.id} quizId={quiz.id} quizName={quiz.name} question={resolved} />;
}
```

- [ ] **Step 3: Run the full check and commit**

Run: `npm test && npm run lint:fsd && npx tsc --noEmit`
Expected: all tests pass, no Steiger violations, no type errors.

```bash
git add -A
git commit -m "feat: add the quiz player page and route"
```

---

### Task 9: Attempt history widget and result page

**Files:**
- Create: `src/widgets/attempt-history/ui/attempt-history.tsx`
- Create: `src/widgets/attempt-history/ui/attempt-history.test.tsx`
- Create: `src/widgets/attempt-history/index.ts`
- Create: `src/_pages/attempt-result/ui/attempt-result-page.tsx`
- Create: `src/_pages/attempt-result/index.tsx`
- Create: `app/(main)/quiz/[quizId]/attempt/[attemptId]/page.tsx`

**Interfaces:**
- Consumes: `formatDate` from `@/shared/lib/format-date`; `QuizAttempt`, `AttemptAnswer` types from `@/entities/quiz-attempt`; `getQuizById` from `@/entities/quiz`; `getAttemptById`, `listAnswersByAttempt` from `@/entities/quiz-attempt`.
- Produces: `AttemptHistory` from `@/widgets/attempt-history` (consumed by Task 10); `/quiz/[quizId]/attempt/[attemptId]` route.

- [ ] **Step 1: Write the failing `AttemptHistory` test**

```tsx
// src/widgets/attempt-history/ui/attempt-history.test.tsx
import { render, screen } from "@testing-library/react";
import { AttemptHistory } from "./attempt-history";

const attempt = {
  id: "a1",
  quizId: "q1",
  userId: "u1",
  status: "completed" as const,
  questionsSnapshot: [],
  currentIndex: 2,
  totalQuestions: 2,
  score: 1,
  startedAt: new Date("2026-09-27T00:00:00Z"),
  finishedAt: new Date("2026-09-27T00:05:00Z"),
};

it("renders a row per completed attempt linking to its result page", () => {
  render(<AttemptHistory quizId="q1" attempts={[attempt]} />);
  expect(screen.getByRole("link", { name: /1\/2/ })).toHaveAttribute("href", "/quiz/q1/attempt/a1");
});

it("shows an empty message with no attempts", () => {
  render(<AttemptHistory quizId="q1" attempts={[]} />);
  expect(screen.getByText("No attempts yet.")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run it to verify it fails, then implement**

Run: `npx vitest run src/widgets/attempt-history`
Expected: FAIL with "Cannot find module './attempt-history'"

```tsx
// src/widgets/attempt-history/ui/attempt-history.tsx
import Link from "next/link";
import { formatDate } from "@/shared/lib/format-date";
import type { QuizAttempt } from "@/entities/quiz-attempt";

interface AttemptHistoryProps {
  quizId: string;
  attempts: QuizAttempt[];
}

export function AttemptHistory({ quizId, attempts }: AttemptHistoryProps) {
  if (attempts.length === 0) {
    return <p className="text-muted-foreground text-sm">No attempts yet.</p>;
  }

  return (
    <div className="divide-y rounded-lg border">
      {attempts.map((attempt) => (
        <Link
          key={attempt.id}
          href={`/quiz/${quizId}/attempt/${attempt.id}`}
          className="hover:bg-muted flex items-center justify-between px-4 py-3 text-sm transition-colors"
        >
          <span>{attempt.finishedAt ? formatDate(attempt.finishedAt) : "—"}</span>
          <span className="font-mono text-xs">
            {attempt.score ?? 0}/{attempt.totalQuestions}
          </span>
        </Link>
      ))}
    </div>
  );
}
```

```ts
// src/widgets/attempt-history/index.ts
export { AttemptHistory } from "./ui/attempt-history";
```

Run again: expect PASS (2 tests).

- [ ] **Step 3: Implement `AttemptResultPage`**

```tsx
// src/_pages/attempt-result/ui/attempt-result-page.tsx
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/shared/ui/badge";
import type { AttemptAnswer } from "@/entities/quiz-attempt";

interface AttemptResultPageProps {
  quizId: string;
  quizName: string;
  score: number | null;
  totalQuestions: number;
  answers: AttemptAnswer[];
}

export function AttemptResultPage({ quizId, quizName, score, totalQuestions, answers }: AttemptResultPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <Link href={`/quiz/${quizId}`} className="text-muted-foreground flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" />
        Back to {quizName}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Results</h1>
        <p className="text-muted-foreground font-mono text-sm">
          {score ?? 0}/{totalQuestions} correct
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {answers.map((answer) => (
          <div key={answer.id} className="flex flex-col gap-1 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">{answer.word}</p>
              <Badge variant={answer.isCorrect ? "secondary" : "destructive"}>
                {answer.isCorrect ? "Correct" : "Incorrect"}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">Meaning: {answer.meaning}</p>
            <p className="text-sm">Your answer: {answer.userAnswer}</p>
            {answer.aiFeedback && <p className="text-muted-foreground text-sm">{answer.aiFeedback}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
```

```ts
// src/_pages/attempt-result/index.tsx
export { AttemptResultPage as default } from "./ui/attempt-result-page";
```

- [ ] **Step 4: Add the route**

```tsx
// app/(main)/quiz/[quizId]/attempt/[attemptId]/page.tsx
import { notFound } from "next/navigation";
import { auth } from "@/_app/api-routes/auth";
import { getQuizById } from "@/entities/quiz";
import { getAttemptById, listAnswersByAttempt } from "@/entities/quiz-attempt";
import AttemptResultPage from "@/_pages/attempt-result";

export default async function Page({ params }: { params: Promise<{ quizId: string; attemptId: string }> }) {
  const { quizId, attemptId } = await params;
  const session = await auth();
  const quiz = await getQuizById(quizId, session!.user.id);
  if (!quiz) {
    notFound();
  }
  const attempt = await getAttemptById(attemptId, session!.user.id);
  if (!attempt || attempt.quizId !== quizId) {
    notFound();
  }
  const answers = await listAnswersByAttempt(attempt.id);
  return <AttemptResultPage quizId={quiz.id} quizName={quiz.name} score={attempt.score} totalQuestions={attempt.totalQuestions} answers={answers} />;
}
```

- [ ] **Step 5: Run the full check and commit**

Run: `npm test && npm run lint:fsd && npx tsc --noEmit`
Expected: all tests pass, no Steiger violations, no type errors.

```bash
git add -A
git commit -m "feat: add attempt history widget and the attempt result page"
```

---

### Task 10: Wire Start/Continue and history into the quiz overview page

**Files:**
- Modify: `src/_pages/quiz-overview/ui/quiz-overview-page.tsx`
- Modify: `app/(main)/quiz/[quizId]/page.tsx`

**Interfaces:**
- Consumes: `StartQuizButton` from `@/features/start-quiz-attempt` (Task 5); `AttemptHistory` from `@/widgets/attempt-history` (Task 9); `getInProgressAttempt`, `listAttemptsByQuiz` from `@/entities/quiz-attempt`.
- Produces: the same `QuizOverviewPage` component from the quiz-setup plan, now with a Start/Continue action and attempt history — its existing props (`quiz`, `folderName`, `questionCount`) are unchanged, two new props are added.

- [ ] **Step 1: Modify `QuizOverviewPage`**

```tsx
// src/_pages/quiz-overview/ui/quiz-overview-page.tsx
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/shared/ui/badge";
import { StartQuizButton } from "@/features/start-quiz-attempt";
import { AttemptHistory } from "@/widgets/attempt-history";
import type { Quiz } from "@/entities/quiz";
import type { QuizAttempt } from "@/entities/quiz-attempt";

const QUESTION_TYPE_LABEL: Record<string, string> = {
  meaning: "Meaning",
  word: "Word",
  sentence: "Sentence",
};

interface QuizOverviewPageProps {
  quiz: Quiz;
  folderName: string;
  questionCount: number;
  inProgressAttempt: QuizAttempt | null;
  completedAttempts: QuizAttempt[];
}

export function QuizOverviewPage({
  quiz,
  folderName,
  questionCount,
  inProgressAttempt,
  completedAttempts,
}: QuizOverviewPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/quiz" className="text-muted-foreground flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" />
        Back to Quiz
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{quiz.name}</h1>
        <p className="text-muted-foreground font-mono text-xs">
          From{" "}
          <Link href={`/library/${quiz.folderId}`} className="underline">
            {folderName}
          </Link>{" "}
          · {questionCount} {questionCount === 1 ? "question" : "questions"}
        </p>
        <div className="flex flex-wrap gap-1">
          {quiz.questionTypes.map((type) => (
            <Badge key={type} variant="secondary">
              {QUESTION_TYPE_LABEL[type]}
            </Badge>
          ))}
        </div>
      </div>
      <StartQuizButton quizId={quiz.id} hasInProgressAttempt={Boolean(inProgressAttempt)} />
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Attempt history</h2>
        <AttemptHistory quizId={quiz.id} attempts={completedAttempts} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Modify the route to load and pass attempt data**

```tsx
// app/(main)/quiz/[quizId]/page.tsx
import { notFound } from "next/navigation";
import { auth } from "@/_app/api-routes/auth";
import { getQuizById } from "@/entities/quiz";
import { getFolderById } from "@/entities/folder";
import { listQuestionsByQuiz } from "@/entities/quiz-question";
import { getInProgressAttempt, listAttemptsByQuiz } from "@/entities/quiz-attempt";
import QuizOverviewPage from "@/_pages/quiz-overview";

export default async function Page({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params;
  const session = await auth();
  const quiz = await getQuizById(quizId, session!.user.id);
  if (!quiz) {
    notFound();
  }
  const [folder, questions, inProgressAttempt, completedAttempts] = await Promise.all([
    getFolderById(quiz.folderId, session!.user.id),
    listQuestionsByQuiz(quiz.id),
    getInProgressAttempt(quiz.id, session!.user.id),
    listAttemptsByQuiz(quiz.id, session!.user.id),
  ]);
  return (
    <QuizOverviewPage
      quiz={quiz}
      folderName={folder?.name ?? "Unknown folder"}
      questionCount={questions.length}
      inProgressAttempt={inProgressAttempt}
      completedAttempts={completedAttempts}
    />
  );
}
```

- [ ] **Step 3: Run the full check and commit**

Run: `npm test && npm run lint:fsd && npx tsc --noEmit && npm run build`
Expected: all tests pass, no Steiger violations, no type errors, build succeeds.

```bash
git add -A
git commit -m "feat: wire Start/Continue and attempt history into the quiz overview page"
```

---

### Task 11: End-to-end smoke test for taking a quiz

**Files:**
- Create: `e2e/quiz-attempt.spec.ts`

**Interfaces:**
- Consumes: nothing new — exercises the full stack through the browser. Uses only `meaning`-type questions so the test never depends on a live AI Gateway call (no `AI_GATEWAY_API_KEY` needed to run it).

- [ ] **Step 1: Write the test**

```ts
// e2e/quiz-attempt.spec.ts
import { test, expect } from "@playwright/test";

test.describe("quiz attempt", () => {
  test("creates a quiz, takes it, and views the graded result", async ({ page }) => {
    const email = `quiz-attempt-test-${Date.now()}@example.com`;

    await page.goto("/register");
    await page.getByLabel("Name").fill("Quiz Attempt Test");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("s3cret-password");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("http://localhost:3000/");

    await page.getByRole("link", { name: "Library" }).click();
    await page.getByRole("button", { name: "New folder" }).click();
    await page.getByLabel("Name", { exact: true }).fill("Animals");
    await page.getByRole("button", { name: "Create folder" }).click();
    await page.getByRole("link", { name: /Animals/ }).click();

    for (const [word, meaning] of [
      ["Dog", "A domesticated canine"],
      ["Cat", "A domesticated feline"],
    ]) {
      await page.getByRole("button", { name: "Add word" }).click();
      await page.getByLabel("Word", { exact: true }).fill(word);
      await page.getByLabel("Meaning", { exact: true }).fill(meaning);
      await page.getByRole("button", { name: "Add word" }).click();
      await expect(page.getByText(word)).toBeVisible();
    }

    await page.getByRole("button", { name: "Create quiz" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Quiz name").fill("Animal Quiz");
    await dialog.getByRole("checkbox", { name: "Meaning" }).click();
    await dialog.getByRole("button", { name: "Create quiz" }).click();

    await expect(page).toHaveURL(/\/quiz\/[^/]+$/);
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page).toHaveURL(/\/attempt$/);

    for (let i = 1; i <= 2; i++) {
      await expect(page.getByText(`Question ${i} of 2`)).toBeVisible();
      const promptText = await page.locator("p.text-lg").innerText();
      const correctMeaning = promptText.includes("Dog") ? "A domesticated canine" : "A domesticated feline";
      await page.getByRole("button", { name: correctMeaning }).click();
      await page.getByRole("button", { name: "Submit" }).click();
      await expect(page.getByText("Correct!")).toBeVisible();
      if (i < 2) {
        await page.getByRole("button", { name: "Next question" }).click();
      } else {
        await page.getByRole("button", { name: "See results" }).click();
      }
    }

    await expect(page).toHaveURL(/\/attempt\/[^/]+$/);
    await expect(page.getByText("2/2 correct")).toBeVisible();

    await page.getByRole("link", { name: "Back to Animal Quiz" }).click();
    await expect(page).toHaveURL(/\/quiz\/[^/]+$/);
    await expect(page.getByRole("link", { name: /2\/2/ })).toBeVisible();
  });

  test("redirects an unauthenticated visitor away from a quiz-attempt route", async ({ page }) => {
    await page.goto("/quiz/does-not-exist/attempt");
    await expect(page).toHaveURL(/\/login$/);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npm run e2e -- e2e/quiz-attempt.spec.ts`
Expected: PASS (2 tests). Needs a real `DATABASE_URL` — see README setup. Does not need `AI_GATEWAY_API_KEY` since this test only exercises `meaning`-type questions.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test: add Playwright e2e smoke test for taking a quiz"
```
