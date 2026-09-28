# Quiz Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship quiz *creation, listing, and overview* — a user picks a folder (or starts from one), chooses a word subset, one or more question types (meaning/word/sentence), and shuffle settings, and a quiz with its generated questions (MCQ distractors included) is created immediately and reachable from a searchable/filterable Quiz grid. Actually *taking* a quiz — the player, AI-graded sentence answers, attempts, pause/resume, and history — is deliberately out of scope here and ships in the follow-up plan `2026-09-28-quiz-attempts.md`; this plan's quiz-overview page shows quiz metadata only, with no Start/Continue button yet.

**Architecture:** Continues the Feature-Sliced Design layout and Smart/Dumb split established by the auth and library plans (`_app → _pages → widgets → features → entities → shared`, enforced by Steiger). `app/*/page.tsx` files are async Server Components that call `auth()` and query through `entities/*` directly, then hand plain props to a presentational component re-exported as `_pages/*`'s default export. Mutations are Server Actions in `features/*/api/*.server.ts`, following the `{ ok: true; ... } | { ok: false; error: string }` return-type convention and the trailing `db` parameter default already used throughout. Per this codebase's Steiger config, **entities never import other entities** in production code — any composition across `folder`/`vocab-item`/`quiz`/`quiz-question` happens in the calling `features/*` or `app/*/page.tsx` layer, exactly like `add-vocab-manual` composes `entities/folder` + `entities/vocab-item` itself today.

A key data-modeling decision carried through every task below: **`quizQuestion` rows denormalize the target word's `word`/`meaning` (and, for MCQ types, each choice's `word`/`meaning`) directly onto the row at creation time**, instead of only storing a `vocabItemId` and joining `vocabItem` live. `vocabItemId` is kept as a plain, non-`FK` text column — informational only. This is required by the spec's own words: a quiz's question set is immutable once created, and deleting a vocab item (already a shipped Library feature) must keep working even for words that are already baked into a quiz — a live `FK` with `onDelete: cascade` would silently delete quiz questions out from under a quiz when their source word is deleted, and `onDelete: restrict` (the Postgres default with no clause) would block word deletion entirely once it's used in any quiz. Denormalizing sidesteps both failure modes and keeps the quiz's content in its exact original form, no live join required to render it.

**Tech Stack:** Next.js 15 (App Router) + TypeScript, Drizzle ORM + Postgres (Neon prod / PGlite tests, already wired), Zod, shadcn/ui (`checkbox`, `switch` added in this plan), `@phosphor-icons/react`, `sonner`. No new runtime dependency. Per the design-system doc's own §5 note about mobile `Drawer` variants for multi-field dialogs: **not introduced**, matching the Library plan's precedent (`add-vocab-manual`/`upload-vocab-file` both ship as plain `Dialog` on every viewport) — the create-quiz dialog follows the same, already-established convention rather than the spec's aspirational `Drawer` suggestion.

**Spec:**
- `docs/superpowers/specs/2026-09-27-vocab-learning-app-design.md` (§3 `quizzes`/`quiz_questions` data model, §4.3 Quiz flows — creation/listing/overview portions only, §5, §6)
- `docs/superpowers/specs/2026-09-27-vocab-learning-app-design-system.md` (card grid classes §6, dialog/badge/empty-state conventions §6, icons §4)

## Global Constraints

- `quiz`: `id`, `folderId` (FK → `folder.id`, cascade delete), `userId` (FK → `user.id`, cascade delete), `name`, `questionTypes` (`text[]`, values from `"meaning" | "word" | "sentence"`), `vocabItemIds` (`text[]`, informational record of what was selected — not used for any live join after creation), `shuffleQuestions` (`boolean`), `shuffleAnswers` (`boolean`), `createdAt`, `updatedAt`.
- `quizQuestion`: `id`, `quizId` (FK → `quiz.id`, cascade delete), `orderIndex`, `questionType`, `vocabItemId` (plain `text`, **no FK**), `word`, `meaning` (both denormalized from the source `vocabItem` at creation time), `choices` (`jsonb`, an array of `{ id, word, meaning }` for `meaning`/`word` types, `null` for `sentence`), `createdAt`.
- Question generation order is fixed at creation and never changes: for each selected word (in the order `vocabItemIds` lists them), for each selected question type in the **canonical order `meaning`, `word`, `sentence`** (regardless of the order the user checked them in the UI), emit one question.
- MCQ choices (`meaning`/`word` types only): the correct word plus up to 3 distractors drawn from **every word in the source folder** (not just the selected subset), in a randomized order fixed at creation. If the folder has fewer than 4 words total, the question simply gets fewer choices — never a crash, never fabricated distractors.
- Creating a quiz with `meaning` or `word` selected among its question types requires the source folder to have **at least 2** vocab items total (so at least one distractor exists) — rejected server-side with a clear error otherwise. `sentence`-only quizzes have no such requirement (a folder with exactly 1 word can still generate a sentence-only quiz).
- "Create quiz" is reachable two ways: from a folder's detail page (folder pre-selected, per the Library plan's Task 7 note that this button was deliberately left out of that plan), and from the Quiz module itself (folder chosen first, from a dropdown of the user's folders).
- Quiz list: grid of cards (name, source folder name, question count, question-type badges), searchable by quiz name and filterable by source folder, both server-driven via `searchParams` (no client fetch library), matching the Library grid's existing pattern.
- Quiz overview (this plan's version): quiz name, source folder link, question count, question-type badges. No Start/Continue button, no attempt history — those are added by the next plan without otherwise changing this page's shape.
- Every quiz read and mutation is scoped to the requesting session's `userId` — no query ever trusts a client-supplied owner id.
- No quiz **editing** or **deletion** feature in this plan (the spec treats a quiz's question set as immutable once created and never asks for deletion) — out of scope, same as the Library plan explicitly left "Create quiz" out of its own scope.
- `recent_activity` is explicitly out of scope for this plan (and the next) — confirmed with the user; the not-yet-built Dashboard plan adds it later, across all modules at once.
- FSD path aliases and the one-directional Steiger import rule are unchanged. Server-only DB code lives in `*.server.ts`.

## Review Focus

- **Cross-user quiz access** — a signed-in user must never read, list, or open another user's quiz by guessing/crafting a `quizId` (direct navigation to `/quiz/<other-user's-quizId>`) — must come back as "not found," never leak data. (Tasks 3, 5, 8)
- **Selecting `meaning`/`word` question types on a folder with fewer than 2 words** — rejected server-side with a clear error, never a crash and never a silently-generated 1-choice "MCQ" that has no real distractor. (Tasks 4, 5)
- **Tampered/stale `vocabItemIds`** (a client sends a word id that doesn't belong to the target folder — stale dialog state after the folder's words changed, or a crafted request) — the create-quiz Server Action must reject it, never silently build a quiz question for a word from a different folder. (Task 5)
- **Quiz search/filter with no matches** — "No quizzes match your search" (a filter is active) is a distinct empty-state message from "No quizzes yet" (the user truly has none), matching the Library grid's existing convention — the two must not be conflated. (Task 7)
- **A folder with zero vocab items** — the create-quiz dialog must not offer a way to submit an empty, broken quiz (no words selected is already blocked by `vocabItemIds.min(1)`, but the dialog's own "no words yet" empty state must be visible and the submit button must stay disabled, never silently POST an empty selection). (Tasks 5, 6)

---

### Task 1: Drizzle schema for quizzes and quiz questions

**Files:**
- Modify: `src/shared/api/db/schema.ts`
- Modify: `src/shared/api/db/index.ts`
- Create: a new migration under `./drizzle` (generated, not hand-written)

**Interfaces:**
- Produces: `quizzes`, `quizQuestions` Drizzle table definitions, exported from `@/shared/api`, and a generated SQL migration that `createTestDb` (PGlite) picks up automatically.

- [ ] **Step 1: Add the two tables to the schema**

```ts
// src/shared/api/db/schema.ts
// Update the pg-core import at the top of the file to add `boolean` and `jsonb`:
import { pgTable, text, timestamp, integer, primaryKey, boolean, jsonb } from "drizzle-orm/pg-core";

// ...append below the existing `vocabItems` export...

export const quizzes = pgTable("quiz", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  folderId: text("folderId")
    .notNull()
    .references(() => folders.id, { onDelete: "cascade" }),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  questionTypes: text("questionTypes")
    .array()
    .notNull()
    .$type<("meaning" | "word" | "sentence")[]>(),
  vocabItemIds: text("vocabItemIds").array().notNull(),
  shuffleQuestions: boolean("shuffleQuestions").notNull().default(false),
  shuffleAnswers: boolean("shuffleAnswers").notNull().default(false),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});

export const quizQuestions = pgTable("quizQuestion", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  quizId: text("quizId")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  orderIndex: integer("orderIndex").notNull(),
  questionType: text("questionType").notNull().$type<"meaning" | "word" | "sentence">(),
  // Plain reference, deliberately not an FK — see the plan header's note on
  // denormalization. Deleting the source vocab item must never cascade-delete
  // or block-delete a question that already used it.
  vocabItemId: text("vocabItemId").notNull(),
  word: text("word").notNull(),
  meaning: text("meaning").notNull(),
  choices: jsonb("choices").$type<{ id: string; word: string; meaning: string }[] | null>(),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
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
} from "./schema";
```

- [ ] **Step 3: Generate the migration**

Run: `npx drizzle-kit generate --name quiz-setup`
Expected: a new file appears under `./drizzle` (e.g. `drizzle/0002_quiz-setup.sql`) containing `CREATE TABLE "quiz"` and `CREATE TABLE "quizQuestion"`, each with the FKs described above (note `quizQuestion` has only one FK, on `quizId` — `vocabItemId` is a plain column with no constraint).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Drizzle schema for quizzes and quiz questions"
```

---

### Task 2: `shared/lib/shuffle` — reusable Fisher-Yates shuffle

**Files:**
- Create: `src/shared/lib/shuffle.ts`
- Create: `src/shared/lib/shuffle.test.ts`

**Interfaces:**
- Produces: `shuffle<T>(items: T[], random?: () => number): T[]` from `@/shared/lib/shuffle`, consumed by Task 3's MCQ distractor selection (and by the follow-up quiz-attempts plan's per-attempt presentation shuffle).

- [ ] **Step 1: Write the failing tests**

```ts
// src/shared/lib/shuffle.test.ts
import { shuffle } from "./shuffle";

it("returns a new array containing exactly the same elements", () => {
  const input = [1, 2, 3, 4, 5];
  const result = shuffle(input);
  expect(result).not.toBe(input);
  expect(result.slice().sort()).toEqual(input.slice().sort());
});

it("does not mutate the input array", () => {
  const input = [1, 2, 3];
  shuffle(input);
  expect(input).toEqual([1, 2, 3]);
});

it("returns an empty array unchanged", () => {
  expect(shuffle([])).toEqual([]);
});

it("is deterministic given an injected random function that always returns 0", () => {
  // Fisher-Yates from the end: with random() === 0, each step swaps the
  // current element with index 0. Tracing [1,2,3,4]: swap(3,0)->[4,2,3,1],
  // swap(2,0)->[3,2,4,1], swap(1,0)->[2,3,4,1].
  expect(shuffle([1, 2, 3, 4], () => 0)).toEqual([2, 3, 4, 1]);
});

it("keeps the original order when random always returns just under 1", () => {
  // floor(0.999999 * (i+1)) === i for every i in range, so every swap is a no-op.
  expect(shuffle([1, 2, 3, 4], () => 0.999999)).toEqual([1, 2, 3, 4]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/shared/lib/shuffle.test.ts`
Expected: FAIL with "Cannot find module './shuffle'"

- [ ] **Step 3: Implement**

```ts
// src/shared/lib/shuffle.ts
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/shared/lib/shuffle.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add reusable Fisher-Yates shuffle utility"
```

---

### Task 3: `entities/quiz` — types and ownership-scoped queries

**Files:**
- Create: `src/entities/quiz/model/types.ts`
- Create: `src/entities/quiz/api/quiz.server.ts`
- Create: `src/entities/quiz/api/quiz.server.test.ts`
- Create: `src/entities/quiz/index.ts`

**Interfaces:**
- Consumes: `quizzes`, `quizQuestions`, `folders`, `schema` from `@/shared/api` (Task 1); `createTestDb` from `@/shared/testing`; `createUser` from `@/entities/user`, `createFolder` from `@/entities/folder` (test fixtures only).
- Produces: `QuestionType`, `Quiz`, `QuizWithMeta` types; `createQuiz(input, db?)`, `listQuizzesByUser(userId, options, db?)`, `getQuizById(id, userId, db?)`. Consumed by Tasks 4, 5, 7, 8.

- [ ] **Step 1: Write the failing tests**

```ts
// src/entities/quiz/api/quiz.server.test.ts
import { createTestDb } from "@/shared/testing";
import { createUser } from "@/entities/user";
import { createFolder } from "@/entities/folder";
import { quizQuestions, folders } from "@/shared/api";
import { eq } from "drizzle-orm";
import { createQuiz, listQuizzesByUser, getQuizById } from "./quiz.server";

async function makeFolder(db: Awaited<ReturnType<typeof createTestDb>>, email = "owner@example.com") {
  const user = await createUser({ email, passwordHash: "hash" }, db);
  const folder = await createFolder({ userId: user.id, name: "Animals" }, db);
  return { userId: user.id, folderId: folder.id };
}

const baseInput = {
  name: "Animal Quiz",
  questionTypes: ["meaning"] as const,
  vocabItemIds: ["v1"],
  shuffleQuestions: false,
  shuffleAnswers: false,
};

describe("quiz entity", () => {
  it("creates a quiz and finds it by id, scoped to its owner", async () => {
    const db = await createTestDb();
    const { userId, folderId } = await makeFolder(db);
    const other = await createUser({ email: "other@example.com", passwordHash: "hash" }, db);

    const quiz = await createQuiz({ ...baseInput, folderId, userId, questionTypes: [...baseInput.questionTypes] }, db);

    const found = await getQuizById(quiz.id, userId, db);
    expect(found).toMatchObject({ name: "Animal Quiz", folderId, userId });

    expect(await getQuizById(quiz.id, other.id, db)).toBeNull();
  });

  it("lists only the requesting user's quizzes, with folder name and question count", async () => {
    const db = await createTestDb();
    const { userId, folderId } = await makeFolder(db);
    const other = await createUser({ email: "other@example.com", passwordHash: "hash" }, db);
    const otherFolder = await createFolder({ userId: other.id, name: "Other" }, db);

    const quiz = await createQuiz(
      { ...baseInput, folderId, userId, questionTypes: [...baseInput.questionTypes] },
      db
    );
    await db.insert(quizQuestions).values([
      {
        quizId: quiz.id,
        orderIndex: 0,
        questionType: "meaning",
        vocabItemId: "v1",
        word: "Dog",
        meaning: "A domesticated canine",
        choices: null,
      },
      {
        quizId: quiz.id,
        orderIndex: 1,
        questionType: "word",
        vocabItemId: "v1",
        word: "Dog",
        meaning: "A domesticated canine",
        choices: null,
      },
    ]);
    await createQuiz(
      {
        ...baseInput,
        folderId: otherFolder.id,
        userId: other.id,
        name: "Someone else's quiz",
        questionTypes: ["word"],
      },
      db
    );

    const list = await listQuizzesByUser(userId, {}, db);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: quiz.id, name: "Animal Quiz", folderName: "Animals", questionCount: 2 });
  });

  it("filters by name search and by folder", async () => {
    const db = await createTestDb();
    const { userId, folderId } = await makeFolder(db);
    const secondFolder = await createFolder({ userId, name: "Colors" }, db);

    await createQuiz({ ...baseInput, folderId, userId, name: "Animal Quiz", questionTypes: ["meaning"] }, db);
    await createQuiz(
      { ...baseInput, folderId: secondFolder.id, userId, name: "Color Quiz", questionTypes: ["word"] },
      db
    );

    expect((await listQuizzesByUser(userId, { search: "animal" }, db)).map((q) => q.name)).toEqual(["Animal Quiz"]);
    expect((await listQuizzesByUser(userId, { folderId: secondFolder.id }, db)).map((q) => q.name)).toEqual([
      "Color Quiz",
    ]);
  });

  it("cascades quiz deletion when the parent folder is deleted", async () => {
    const db = await createTestDb();
    const { userId, folderId } = await makeFolder(db);
    const quiz = await createQuiz(
      { ...baseInput, folderId, userId, questionTypes: [...baseInput.questionTypes] },
      db
    );

    await db.delete(folders).where(eq(folders.id, folderId));

    expect(await getQuizById(quiz.id, userId, db)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/entities/quiz -t "quiz entity"`
Expected: FAIL with "Cannot find module './quiz.server'"

- [ ] **Step 3: Implement the types**

```ts
// src/entities/quiz/model/types.ts
export type QuestionType = "meaning" | "word" | "sentence";

export interface Quiz {
  id: string;
  folderId: string;
  userId: string;
  name: string;
  questionTypes: QuestionType[];
  vocabItemIds: string[];
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuizWithMeta extends Quiz {
  folderName: string;
  questionCount: number;
}

export type QuizSort = "recently-created";
```

- [ ] **Step 4: Implement the queries**

```ts
// src/entities/quiz/api/quiz.server.ts
import { db as defaultDb, quizzes, quizQuestions, folders, schema } from "@/shared/api";
import { and, count, desc, eq, ilike } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Quiz, QuestionType, QuizWithMeta } from "../model/types";

type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export async function createQuiz(
  input: {
    folderId: string;
    userId: string;
    name: string;
    questionTypes: QuestionType[];
    vocabItemIds: string[];
    shuffleQuestions: boolean;
    shuffleAnswers: boolean;
  },
  db: Db = defaultDb
): Promise<Quiz> {
  const rows = await db.insert(quizzes).values(input).returning();
  return rows[0];
}

export async function listQuizzesByUser(
  userId: string,
  options: { search?: string; folderId?: string } = {},
  db: Db = defaultDb
): Promise<QuizWithMeta[]> {
  const { search, folderId } = options;

  const conditions = [eq(quizzes.userId, userId)];
  if (search && search.trim().length > 0) {
    conditions.push(ilike(quizzes.name, `%${search.trim()}%`));
  }
  if (folderId) {
    conditions.push(eq(quizzes.folderId, folderId));
  }

  return db
    .select({
      id: quizzes.id,
      folderId: quizzes.folderId,
      userId: quizzes.userId,
      name: quizzes.name,
      questionTypes: quizzes.questionTypes,
      vocabItemIds: quizzes.vocabItemIds,
      shuffleQuestions: quizzes.shuffleQuestions,
      shuffleAnswers: quizzes.shuffleAnswers,
      createdAt: quizzes.createdAt,
      updatedAt: quizzes.updatedAt,
      folderName: folders.name,
      questionCount: count(quizQuestions.id),
    })
    .from(quizzes)
    .innerJoin(folders, eq(folders.id, quizzes.folderId))
    .leftJoin(quizQuestions, eq(quizQuestions.quizId, quizzes.id))
    .where(and(...conditions))
    .groupBy(quizzes.id, folders.name)
    .orderBy(desc(quizzes.createdAt));
}

export async function getQuizById(id: string, userId: string, db: Db = defaultDb): Promise<Quiz | null> {
  const rows = await db
    .select()
    .from(quizzes)
    .where(and(eq(quizzes.id, id), eq(quizzes.userId, userId)));
  return rows[0] ?? null;
}
```

- [ ] **Step 5: Barrel export**

```ts
// src/entities/quiz/index.ts
export { createQuiz, listQuizzesByUser, getQuizById } from "./api/quiz.server";
export type { Quiz, QuizWithMeta, QuestionType, QuizSort } from "./model/types";
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/entities/quiz -t "quiz entity"`
Expected: PASS (4 tests)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add quiz entity with ownership-scoped queries"
```

---

### Task 4: `entities/quiz-question` — MCQ generation and queries

**Files:**
- Create: `src/entities/quiz-question/model/types.ts`
- Create: `src/entities/quiz-question/model/build-questions.ts`
- Create: `src/entities/quiz-question/model/build-questions.test.ts`
- Create: `src/entities/quiz-question/api/quiz-question.server.ts`
- Create: `src/entities/quiz-question/api/quiz-question.server.test.ts`
- Create: `src/entities/quiz-question/index.ts`

**Interfaces:**
- Consumes: `shuffle` from `@/shared/lib/shuffle` (Task 2); `quizQuestions`, `schema` from `@/shared/api` (Task 1); `createUser`/`createFolder`/`createQuiz` (test fixtures only, cross-entity imports are allowed in test files per this repo's Steiger config).
- Produces: `QuestionType`, `QuestionChoice`, `QuizQuestion`, `NewQuizQuestion` types; `buildQuizQuestions(input, random?)` (pure); `createQuizQuestions(quizId, questions, db?)`, `listQuestionsByQuiz(quizId, db?)`, `getQuestionById(id, db?)`. Consumed by Tasks 5, 8, and by the follow-up quiz-attempts plan.

- [ ] **Step 1: Write the failing tests for `buildQuizQuestions` (pure logic)**

```ts
// src/entities/quiz-question/model/build-questions.test.ts
import { buildQuizQuestions } from "./build-questions";

const dog = { id: "1", word: "Dog", meaning: "A domesticated canine" };
const cat = { id: "2", word: "Cat", meaning: "A domesticated feline" };
const bird = { id: "3", word: "Bird", meaning: "A feathered animal" };
const fish = { id: "4", word: "Fish", meaning: "An aquatic animal" };

describe("buildQuizQuestions", () => {
  it("generates one question per word per selected type, word-then-canonical-type order", () => {
    const questions = buildQuizQuestions({
      selectedItems: [dog, cat],
      questionTypes: ["word", "meaning"], // input order deliberately reversed from canonical
      distractorPool: [dog, cat, bird, fish],
    });

    expect(questions).toHaveLength(4);
    expect(questions.map((q) => [q.word, q.questionType])).toEqual([
      ["Dog", "meaning"],
      ["Dog", "word"],
      ["Cat", "meaning"],
      ["Cat", "word"],
    ]);
    expect(questions.map((q) => q.orderIndex)).toEqual([0, 1, 2, 3]);
  });

  it("gives a sentence question no choices", () => {
    const [question] = buildQuizQuestions({
      selectedItems: [dog],
      questionTypes: ["sentence"],
      distractorPool: [dog],
    });
    expect(question.choices).toBeNull();
    expect(question.word).toBe("Dog");
    expect(question.meaning).toBe("A domesticated canine");
  });

  it("gives a meaning/word question exactly 4 unique choices including the correct one, when the pool allows it", () => {
    const [question] = buildQuizQuestions({
      selectedItems: [dog],
      questionTypes: ["meaning"],
      distractorPool: [dog, cat, bird, fish],
    });
    expect(question.choices).toHaveLength(4);
    expect(question.choices!.map((c) => c.id)).toContain(dog.id);
    expect(new Set(question.choices!.map((c) => c.id)).size).toBe(4);
  });

  it("falls back to fewer choices when the distractor pool is smaller than 4", () => {
    const [question] = buildQuizQuestions({
      selectedItems: [dog],
      questionTypes: ["word"],
      distractorPool: [dog, cat],
    });
    expect(question.choices).toHaveLength(2);
    expect(question.choices!.map((c) => c.id).sort()).toEqual([cat.id, dog.id].sort());
  });

  it("produces a single-choice question when the folder has only the target word", () => {
    const [question] = buildQuizQuestions({
      selectedItems: [dog],
      questionTypes: ["meaning"],
      distractorPool: [dog],
    });
    expect(question.choices).toHaveLength(1);
    expect(question.choices![0].id).toBe(dog.id);
  });

  it("is deterministic given an injected random function", () => {
    const args = {
      selectedItems: [dog],
      questionTypes: ["meaning"] as const,
      distractorPool: [dog, cat, bird, fish],
    };
    expect(buildQuizQuestions({ ...args, questionTypes: [...args.questionTypes] }, () => 0)).toEqual(
      buildQuizQuestions({ ...args, questionTypes: [...args.questionTypes] }, () => 0)
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/entities/quiz-question/model/build-questions.test.ts`
Expected: FAIL with "Cannot find module './build-questions'"

- [ ] **Step 3: Implement the types**

```ts
// src/entities/quiz-question/model/types.ts
export type QuestionType = "meaning" | "word" | "sentence";

export interface QuestionChoice {
  id: string;
  word: string;
  meaning: string;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  orderIndex: number;
  questionType: QuestionType;
  vocabItemId: string;
  word: string;
  meaning: string;
  choices: QuestionChoice[] | null;
  createdAt: Date;
}

export interface NewQuizQuestion {
  orderIndex: number;
  questionType: QuestionType;
  vocabItemId: string;
  word: string;
  meaning: string;
  choices: QuestionChoice[] | null;
}
```

- [ ] **Step 4: Implement `buildQuizQuestions`**

```ts
// src/entities/quiz-question/model/build-questions.ts
import { shuffle } from "@/shared/lib/shuffle";
import type { NewQuizQuestion, QuestionChoice, QuestionType } from "./types";

interface VocabItemLike {
  id: string;
  word: string;
  meaning: string;
}

const QUESTION_TYPE_ORDER: QuestionType[] = ["meaning", "word", "sentence"];

export function buildQuizQuestions(
  input: {
    selectedItems: VocabItemLike[];
    questionTypes: QuestionType[];
    distractorPool: VocabItemLike[];
  },
  random: () => number = Math.random
): NewQuizQuestion[] {
  const orderedTypes = QUESTION_TYPE_ORDER.filter((type) => input.questionTypes.includes(type));
  const questions: NewQuizQuestion[] = [];
  let orderIndex = 0;

  for (const item of input.selectedItems) {
    for (const type of orderedTypes) {
      if (type === "sentence") {
        questions.push({
          orderIndex: orderIndex++,
          questionType: "sentence",
          vocabItemId: item.id,
          word: item.word,
          meaning: item.meaning,
          choices: null,
        });
        continue;
      }

      const distractors = shuffle(
        input.distractorPool.filter((candidate) => candidate.id !== item.id),
        random
      ).slice(0, 3);
      const choices: QuestionChoice[] = shuffle(
        [item, ...distractors].map((candidate) => ({
          id: candidate.id,
          word: candidate.word,
          meaning: candidate.meaning,
        })),
        random
      );

      questions.push({
        orderIndex: orderIndex++,
        questionType: type,
        vocabItemId: item.id,
        word: item.word,
        meaning: item.meaning,
        choices,
      });
    }
  }

  return questions;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/entities/quiz-question/model/build-questions.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Write the failing tests for the DB queries**

```ts
// src/entities/quiz-question/api/quiz-question.server.test.ts
import { createTestDb } from "@/shared/testing";
import { createUser } from "@/entities/user";
import { createFolder } from "@/entities/folder";
import { createQuiz } from "@/entities/quiz";
import { quizzes } from "@/shared/api";
import { eq } from "drizzle-orm";
import { createQuizQuestions, listQuestionsByQuiz, getQuestionById } from "./quiz-question.server";

async function makeQuiz(db: Awaited<ReturnType<typeof createTestDb>>) {
  const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
  const folder = await createFolder({ userId: user.id, name: "Animals" }, db);
  const quiz = await createQuiz(
    {
      folderId: folder.id,
      userId: user.id,
      name: "Animal Quiz",
      questionTypes: ["meaning"],
      vocabItemIds: ["v1"],
      shuffleQuestions: false,
      shuffleAnswers: false,
    },
    db
  );
  return quiz.id;
}

describe("quiz question entity", () => {
  it("bulk-creates questions and lists them back in orderIndex order", async () => {
    const db = await createTestDb();
    const quizId = await makeQuiz(db);

    await createQuizQuestions(
      quizId,
      [
        { orderIndex: 1, questionType: "meaning", vocabItemId: "v2", word: "Cat", meaning: "A cat", choices: null },
        { orderIndex: 0, questionType: "meaning", vocabItemId: "v1", word: "Dog", meaning: "A dog", choices: null },
      ],
      db
    );

    const list = await listQuestionsByQuiz(quizId, db);
    expect(list.map((q) => q.word)).toEqual(["Dog", "Cat"]);
  });

  it("returns an empty array for zero questions", async () => {
    const db = await createTestDb();
    const quizId = await makeQuiz(db);
    expect(await createQuizQuestions(quizId, [], db)).toEqual([]);
  });

  it("stores and returns MCQ choices as structured data", async () => {
    const db = await createTestDb();
    const quizId = await makeQuiz(db);
    const choices = [
      { id: "v1", word: "Dog", meaning: "A dog" },
      { id: "v2", word: "Cat", meaning: "A cat" },
    ];
    const [created] = await createQuizQuestions(
      quizId,
      [{ orderIndex: 0, questionType: "meaning", vocabItemId: "v1", word: "Dog", meaning: "A dog", choices }],
      db
    );

    expect((await getQuestionById(created.id, db))?.choices).toEqual(choices);
  });

  it("cascades question deletion when the parent quiz is deleted", async () => {
    const db = await createTestDb();
    const quizId = await makeQuiz(db);
    const [created] = await createQuizQuestions(
      quizId,
      [{ orderIndex: 0, questionType: "sentence", vocabItemId: "v1", word: "Dog", meaning: "A dog", choices: null }],
      db
    );

    await db.delete(quizzes).where(eq(quizzes.id, quizId));

    expect(await getQuestionById(created.id, db)).toBeNull();
  });
});
```

- [ ] **Step 7: Run the tests to verify they fail**

Run: `npx vitest run src/entities/quiz-question/api/quiz-question.server.test.ts`
Expected: FAIL with "Cannot find module './quiz-question.server'"

- [ ] **Step 8: Implement the queries**

```ts
// src/entities/quiz-question/api/quiz-question.server.ts
import { db as defaultDb, quizQuestions, schema } from "@/shared/api";
import { asc, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { NewQuizQuestion, QuizQuestion } from "../model/types";

type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export async function createQuizQuestions(
  quizId: string,
  questions: NewQuizQuestion[],
  db: Db = defaultDb
): Promise<QuizQuestion[]> {
  if (questions.length === 0) return [];
  return db
    .insert(quizQuestions)
    .values(questions.map((question) => ({ quizId, ...question })))
    .returning();
}

export async function listQuestionsByQuiz(quizId: string, db: Db = defaultDb): Promise<QuizQuestion[]> {
  return db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(asc(quizQuestions.orderIndex));
}

export async function getQuestionById(id: string, db: Db = defaultDb): Promise<QuizQuestion | null> {
  const rows = await db.select().from(quizQuestions).where(eq(quizQuestions.id, id));
  return rows[0] ?? null;
}
```

- [ ] **Step 9: Barrel export**

```ts
// src/entities/quiz-question/index.ts
export { buildQuizQuestions } from "./model/build-questions";
export { createQuizQuestions, listQuestionsByQuiz, getQuestionById } from "./api/quiz-question.server";
export type { QuestionType, QuestionChoice, QuizQuestion, NewQuizQuestion } from "./model/types";
```

- [ ] **Step 10: Run the tests to verify they pass**

Run: `npx vitest run src/entities/quiz-question`
Expected: PASS (10 tests total)

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: add quiz-question entity with MCQ distractor generation"
```

---

### Task 5: `features/create-quiz` — validation and Server Action

**Files:**
- Create: `src/features/create-quiz/model/schema.ts`
- Create: `src/features/create-quiz/model/schema.test.ts`
- Create: `src/features/create-quiz/api/create-quiz.server.ts`
- Create: `src/features/create-quiz/api/create-quiz.server.test.ts`
- Create: `src/features/create-quiz/api/get-folder-words.server.ts`
- Create: `src/features/create-quiz/api/get-folder-words.server.test.ts`

**Interfaces:**
- Consumes: `getFolderById` from `@/entities/folder`; `listVocabItemsByFolder` from `@/entities/vocab-item`; `createQuiz` from `@/entities/quiz` (Task 3); `buildQuizQuestions`, `createQuizQuestions` from `@/entities/quiz-question` (Task 4); `auth` from `@/_app/api-routes/auth`.
- Produces: `createQuizSchema`, `CreateQuizInput`; `createQuizAction(input, db?)` returning `{ ok: true; id: string } | { ok: false; error: string }`; `getFolderWordsAction(folderId, db?)` returning `{ ok: true; items: VocabItem[] } | { ok: false; error: string }`. Consumed by Task 6's `CreateQuizDialog`.

- [ ] **Step 1: Write the failing schema tests**

```ts
// src/features/create-quiz/model/schema.test.ts
import { createQuizSchema } from "./schema";

const valid = {
  folderId: "f1",
  name: "Animal Quiz",
  vocabItemIds: ["v1", "v2"],
  questionTypes: ["meaning"],
  shuffleQuestions: false,
  shuffleAnswers: false,
};

it("accepts valid input", () => {
  expect(createQuizSchema.safeParse(valid).success).toBe(true);
});

it("rejects a missing folder id", () => {
  expect(createQuizSchema.safeParse({ ...valid, folderId: "" }).success).toBe(false);
});

it("rejects an empty or whitespace-only name", () => {
  expect(createQuizSchema.safeParse({ ...valid, name: "   " }).success).toBe(false);
});

it("rejects zero selected words", () => {
  expect(createQuizSchema.safeParse({ ...valid, vocabItemIds: [] }).success).toBe(false);
});

it("rejects zero selected question types", () => {
  expect(createQuizSchema.safeParse({ ...valid, questionTypes: [] }).success).toBe(false);
});

it("rejects an unknown question type", () => {
  expect(createQuizSchema.safeParse({ ...valid, questionTypes: ["essay"] }).success).toBe(false);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/create-quiz/model/schema.test.ts`
Expected: FAIL with "Cannot find module './schema'"

- [ ] **Step 3: Implement the schema**

```ts
// src/features/create-quiz/model/schema.ts
import { z } from "zod";

export const questionTypeSchema = z.enum(["meaning", "word", "sentence"]);

export const createQuizSchema = z.object({
  folderId: z.string().trim().min(1, "Choose a folder"),
  name: z.string().trim().min(1, "Quiz name is required").max(100, "Quiz name is too long"),
  vocabItemIds: z.array(z.string()).min(1, "Select at least one word"),
  questionTypes: z.array(questionTypeSchema).min(1, "Select at least one question type"),
  shuffleQuestions: z.boolean(),
  shuffleAnswers: z.boolean(),
});
export type CreateQuizInput = z.infer<typeof createQuizSchema>;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/create-quiz/model/schema.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Write the failing tests for `createQuizAction`**

```ts
// src/features/create-quiz/api/create-quiz.server.test.ts
import { createTestDb } from "@/shared/testing";
import { vi } from "vitest";
import { auth } from "@/_app/api-routes/auth";
import { createUser } from "@/entities/user";
import { createFolder } from "@/entities/folder";
import { createVocabItem } from "@/entities/vocab-item";
import { listQuestionsByQuiz } from "@/entities/quiz-question";
import { createQuizAction } from "./create-quiz.server";

vi.mock("@/_app/api-routes/auth", () => ({ auth: vi.fn() }));

async function setup(db: Awaited<ReturnType<typeof createTestDb>>) {
  const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
  const folder = await createFolder({ userId: user.id, name: "Animals" }, db);
  const dog = await createVocabItem({ folderId: folder.id, word: "Dog", meaning: "A dog" }, db);
  const cat = await createVocabItem({ folderId: folder.id, word: "Cat", meaning: "A cat" }, db);
  vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);
  return { userId: user.id, folderId: folder.id, dog, cat };
}

describe("createQuizAction", () => {
  it("creates a quiz and its questions for a valid meaning+word request", async () => {
    const db = await createTestDb();
    const { folderId, dog, cat } = await setup(db);

    const result = await createQuizAction(
      {
        folderId,
        name: "Animal Quiz",
        vocabItemIds: [dog.id, cat.id],
        questionTypes: ["meaning", "word"],
        shuffleQuestions: false,
        shuffleAnswers: false,
      },
      db
    );

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error("expected ok");
    const questions = await listQuestionsByQuiz(result.id, db);
    expect(questions).toHaveLength(4); // 2 words x 2 types
    expect(questions.every((q) => q.choices?.length === 2)).toBe(true);
  });

  it("allows a sentence-only quiz even with just one word in the folder", async () => {
    const db = await createTestDb();
    const user = await createUser({ email: "solo@example.com", passwordHash: "hash" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);
    const folder = await createFolder({ userId: user.id, name: "Solo" }, db);
    const word = await createVocabItem({ folderId: folder.id, word: "Dog", meaning: "A dog" }, db);

    const result = await createQuizAction(
      {
        folderId: folder.id,
        name: "Solo Quiz",
        vocabItemIds: [word.id],
        questionTypes: ["sentence"],
        shuffleQuestions: false,
        shuffleAnswers: false,
      },
      db
    );

    expect(result).toMatchObject({ ok: true });
  });

  it("rejects meaning/word question types when the folder has fewer than 2 words", async () => {
    const db = await createTestDb();
    const user = await createUser({ email: "solo@example.com", passwordHash: "hash" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);
    const folder = await createFolder({ userId: user.id, name: "Solo" }, db);
    const word = await createVocabItem({ folderId: folder.id, word: "Dog", meaning: "A dog" }, db);

    const result = await createQuizAction(
      {
        folderId: folder.id,
        name: "Solo Quiz",
        vocabItemIds: [word.id],
        questionTypes: ["meaning"],
        shuffleQuestions: false,
        shuffleAnswers: false,
      },
      db
    );

    expect(result).toMatchObject({ ok: false });
  });

  it("rejects a folder the requester doesn't own", async () => {
    const db = await createTestDb();
    const { dog } = await setup(db);
    const intruder = await createUser({ email: "intruder@example.com", passwordHash: "hash" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: intruder.id } } as never);

    const result = await createQuizAction(
      {
        folderId: "does-not-belong-to-intruder",
        name: "Hijack",
        vocabItemIds: [dog.id],
        questionTypes: ["sentence"],
        shuffleQuestions: false,
        shuffleAnswers: false,
      },
      db
    );

    expect(result).toMatchObject({ ok: false });
  });

  it("rejects a vocabItemId that doesn't belong to the target folder", async () => {
    const db = await createTestDb();
    const { userId, folderId } = await setup(db);
    const otherFolder = await createFolder({ userId, name: "Other" }, db);
    const foreignWord = await createVocabItem({ folderId: otherFolder.id, word: "Foreign", meaning: "x" }, db);

    const result = await createQuizAction(
      {
        folderId,
        name: "Tampered",
        vocabItemIds: [foreignWord.id],
        questionTypes: ["sentence"],
        shuffleQuestions: false,
        shuffleAnswers: false,
      },
      db
    );

    expect(result).toMatchObject({ ok: false });
  });

  it("rejects the call when there is no session", async () => {
    const db = await createTestDb();
    vi.mocked(auth).mockResolvedValue(null);

    const result = await createQuizAction(
      {
        folderId: "f1",
        name: "Quiz",
        vocabItemIds: ["v1"],
        questionTypes: ["sentence"],
        shuffleQuestions: false,
        shuffleAnswers: false,
      },
      db
    );

    expect(result).toMatchObject({ ok: false });
  });
});
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `npx vitest run src/features/create-quiz/api/create-quiz.server.test.ts`
Expected: FAIL with "Cannot find module './create-quiz.server'"

- [ ] **Step 7: Implement `createQuizAction`**

```ts
// src/features/create-quiz/api/create-quiz.server.ts
"use server";

import { createQuizSchema } from "../model/schema";
import { getFolderById } from "@/entities/folder";
import { listVocabItemsByFolder } from "@/entities/vocab-item";
import { createQuiz } from "@/entities/quiz";
import { buildQuizQuestions, createQuizQuestions } from "@/entities/quiz-question";
import { auth } from "@/_app/api-routes/auth";
import { db as defaultDb } from "@/shared/api";
import { safeRevalidatePath } from "@/shared/lib/safe-revalidate-path";

export type CreateQuizResult = { ok: true; id: string } | { ok: false; error: string };

type Db = Parameters<typeof getFolderById>[2];

export async function createQuizAction(input: unknown, dbInstance: Db = defaultDb): Promise<CreateQuizResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = createQuizSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  try {
    const folder = await getFolderById(data.folderId, session.user.id, dbInstance);
    if (!folder) {
      return { ok: false, error: "Folder not found" };
    }

    const folderItems = await listVocabItemsByFolder(data.folderId, dbInstance);
    const folderItemIds = new Set(folderItems.map((item) => item.id));
    if (!data.vocabItemIds.every((id) => folderItemIds.has(id))) {
      return { ok: false, error: "One or more selected words no longer belong to this folder" };
    }

    const needsChoices = data.questionTypes.includes("meaning") || data.questionTypes.includes("word");
    if (needsChoices && folderItems.length < 2) {
      return { ok: false, error: "Add at least 2 words to this folder to use meaning or word questions" };
    }

    const selectedItems = folderItems.filter((item) => data.vocabItemIds.includes(item.id));

    const quiz = await createQuiz(
      {
        folderId: data.folderId,
        userId: session.user.id,
        name: data.name,
        questionTypes: data.questionTypes,
        vocabItemIds: data.vocabItemIds,
        shuffleQuestions: data.shuffleQuestions,
        shuffleAnswers: data.shuffleAnswers,
      },
      dbInstance
    );

    const questions = buildQuizQuestions({
      selectedItems,
      questionTypes: data.questionTypes,
      distractorPool: folderItems,
    });
    await createQuizQuestions(quiz.id, questions, dbInstance);

    safeRevalidatePath("/quiz");
    return { ok: true, id: quiz.id };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/features/create-quiz/api/create-quiz.server.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 9: Write the failing tests for `getFolderWordsAction`**

```ts
// src/features/create-quiz/api/get-folder-words.server.test.ts
import { createTestDb } from "@/shared/testing";
import { vi } from "vitest";
import { auth } from "@/_app/api-routes/auth";
import { createUser } from "@/entities/user";
import { createFolder } from "@/entities/folder";
import { createVocabItem } from "@/entities/vocab-item";
import { getFolderWordsAction } from "./get-folder-words.server";

vi.mock("@/_app/api-routes/auth", () => ({ auth: vi.fn() }));

describe("getFolderWordsAction", () => {
  it("returns the folder's words for its owner", async () => {
    const db = await createTestDb();
    const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
    const folder = await createFolder({ userId: user.id, name: "Animals" }, db);
    await createVocabItem({ folderId: folder.id, word: "Dog", meaning: "A dog" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);

    const result = await getFolderWordsAction(folder.id, db);
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.items.map((i) => i.word)).toEqual(["Dog"]);
  });

  it("rejects a folder the requester doesn't own", async () => {
    const db = await createTestDb();
    const owner = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
    const folder = await createFolder({ userId: owner.id, name: "Animals" }, db);
    const intruder = await createUser({ email: "intruder@example.com", passwordHash: "hash" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: intruder.id } } as never);

    expect(await getFolderWordsAction(folder.id, db)).toMatchObject({ ok: false });
  });

  it("rejects the call when there is no session", async () => {
    const db = await createTestDb();
    vi.mocked(auth).mockResolvedValue(null);
    expect(await getFolderWordsAction("f1", db)).toMatchObject({ ok: false });
  });
});
```

- [ ] **Step 10: Run the tests to verify they fail, then implement**

Run: `npx vitest run src/features/create-quiz/api/get-folder-words.server.test.ts`
Expected: FAIL with "Cannot find module './get-folder-words.server'"

```ts
// src/features/create-quiz/api/get-folder-words.server.ts
"use server";

import { getFolderById } from "@/entities/folder";
import { listVocabItemsByFolder, type VocabItem } from "@/entities/vocab-item";
import { auth } from "@/_app/api-routes/auth";
import { db as defaultDb } from "@/shared/api";

export type GetFolderWordsResult = { ok: true; items: VocabItem[] } | { ok: false; error: string };

type Db = Parameters<typeof getFolderById>[2];

export async function getFolderWordsAction(
  folderId: string,
  dbInstance: Db = defaultDb
): Promise<GetFolderWordsResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "You must be signed in." };
  }

  const folder = await getFolderById(folderId, session.user.id, dbInstance);
  if (!folder) {
    return { ok: false, error: "Folder not found" };
  }

  const items = await listVocabItemsByFolder(folderId, dbInstance);
  return { ok: true, items };
}
```

- [ ] **Step 11: Run the tests to verify they pass**

Run: `npx vitest run src/features/create-quiz/api/get-folder-words.server.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: add create-quiz validation and Server Actions"
```

---

### Task 6: `CreateQuizDialog` UI, wired into folder-detail

**Files:**
- Create: `src/features/create-quiz/ui/create-quiz-dialog.tsx`
- Create: `src/features/create-quiz/ui/create-quiz-dialog.test.tsx`
- Create: `src/features/create-quiz/index.ts`
- Modify: `src/_pages/folder-detail/ui/folder-detail-page.tsx`

**Interfaces:**
- Consumes: `getFolderWordsAction`, `createQuizAction` (Task 5); `VocabItem` type from `@/entities/vocab-item`.
- Produces: `CreateQuizDialog` from `@/features/create-quiz`, taking `{ folders: { id: string; name: string }[]; initialFolderId?: string }` — used both from the folder-detail page (this task, `initialFolderId` set, folder picker hidden) and from the Quiz list page (Task 7, no `initialFolderId`, folder picker shown).

- [ ] **Step 1: Add the shadcn `checkbox` and `switch` primitives**

```bash
npx shadcn@latest add checkbox switch
```

- [ ] **Step 2: Add jsdom polyfills Radix's `Select` needs for interaction tests**

No existing test in this repo opens a Radix `Select` and clicks an option (the current `folder-list-toolbar.test.tsx` only exercises the debounced text input). Radix's `Select` calls `hasPointerCapture`/`releasePointerCapture`/`scrollIntoView` internally when it opens and when an item is highlighted — none of which jsdom implements — so the very first test that opens one and clicks an option (this task's dialog test, and Task 7's `quiz-list-toolbar` test) needs these stubbed globally first, or it throws `TypeError: ... is not a function` inside Radix's own code, not the component under test.

```ts
// vitest.setup.ts
import "@testing-library/jest-dom/vitest";

// `neon()` in src/shared/api/db/client.ts validates its connection string
// synchronously at module load, even though no test ever queries through the
// production client (every test injects a PGlite test db explicitly via the
// `db` parameter). Without this, merely importing a module that references
// the production `db` client as a default-parameter fallback crashes.
process.env.DATABASE_URL ??= "postgres://user:pass@localhost:5432/placeholder";

// jsdom implements neither of these, but Radix's `Select` calls them
// internally when it opens and when an item is highlighted/selected.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};
```

- [ ] **Step 3: Write the failing dialog test**

```tsx
// src/features/create-quiz/ui/create-quiz-dialog.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { CreateQuizDialog } from "./create-quiz-dialog";
import { getFolderWordsAction } from "../api/get-folder-words.server";
import { createQuizAction } from "../api/create-quiz.server";

vi.mock("../api/get-folder-words.server", () => ({ getFolderWordsAction: vi.fn() }));
vi.mock("../api/create-quiz.server", () => ({ createQuizAction: vi.fn() }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const words = [
  { id: "v1", folderId: "f1", word: "Dog", meaning: "A domesticated canine", example: null, partOfSpeech: null, createdAt: new Date() },
  { id: "v2", folderId: "f1", word: "Cat", meaning: "A domesticated feline", example: null, partOfSpeech: null, createdAt: new Date() },
];

beforeEach(() => {
  vi.mocked(getFolderWordsAction).mockResolvedValue({ ok: true, items: words });
});

it("hides the folder picker and preloads words when initialFolderId is given", async () => {
  render(<CreateQuizDialog folders={[{ id: "f1", name: "Animals" }]} initialFolderId="f1" />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Create quiz" }));

  expect(screen.queryByLabelText("Folder")).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByText("Dog — A domesticated canine")).toBeInTheDocument());
});

it("shows a folder picker and loads words after a folder is chosen, when no initialFolderId is given", async () => {
  const user = userEvent.setup();
  render(<CreateQuizDialog folders={[{ id: "f1", name: "Animals" }]} />);
  await user.click(screen.getByRole("button", { name: "Create quiz" }));

  expect(screen.getByLabelText("Folder")).toBeInTheDocument();
  expect(getFolderWordsAction).not.toHaveBeenCalled();

  await user.click(screen.getByLabelText("Folder"));
  await user.click(screen.getByRole("option", { name: "Animals" }));

  await waitFor(() => expect(getFolderWordsAction).toHaveBeenCalledWith("f1"));
});

it("disables submit until a name, at least one word, and at least one question type are set, then submits the expected payload", async () => {
  const user = userEvent.setup();
  vi.mocked(createQuizAction).mockResolvedValue({ ok: true, id: "quiz-1" });
  render(<CreateQuizDialog folders={[{ id: "f1", name: "Animals" }]} initialFolderId="f1" />);
  await user.click(screen.getByRole("button", { name: "Create quiz" }));
  await waitFor(() => expect(screen.getByText("Dog — A domesticated canine")).toBeInTheDocument());

  expect(screen.getAllByRole("button", { name: "Create quiz" })[1]).toBeDisabled();

  await user.type(screen.getByLabelText("Quiz name"), "Animal Quiz");
  await user.click(screen.getByRole("checkbox", { name: "Meaning" }));

  await waitFor(() => expect(screen.getAllByRole("button", { name: "Create quiz" })[1]).not.toBeDisabled());
  await user.click(screen.getAllByRole("button", { name: "Create quiz" })[1]);

  await waitFor(() =>
    expect(createQuizAction).toHaveBeenCalledWith({
      folderId: "f1",
      name: "Animal Quiz",
      vocabItemIds: ["v1", "v2"],
      questionTypes: ["meaning"],
      shuffleQuestions: false,
      shuffleAnswers: false,
    })
  );
  expect(push).toHaveBeenCalledWith("/quiz/quiz-1");
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run src/features/create-quiz/ui/create-quiz-dialog.test.tsx`
Expected: FAIL with "Cannot find module './create-quiz-dialog'"

- [ ] **Step 5: Implement `CreateQuizDialog`**

```tsx
// src/features/create-quiz/ui/create-quiz-dialog.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "@phosphor-icons/react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Checkbox } from "@/shared/ui/checkbox";
import { Switch } from "@/shared/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/ui/dialog";
import { getFolderWordsAction } from "../api/get-folder-words.server";
import { createQuizAction } from "../api/create-quiz.server";
import type { VocabItem } from "@/entities/vocab-item";

type QuestionType = "meaning" | "word" | "sentence";

const QUESTION_TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: "meaning", label: "Meaning" },
  { value: "word", label: "Word" },
  { value: "sentence", label: "Sentence" },
];

interface CreateQuizDialogProps {
  folders: { id: string; name: string }[];
  initialFolderId?: string;
}

export function CreateQuizDialog({ folders, initialFolderId }: CreateQuizDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [folderId, setFolderId] = useState(initialFolderId ?? "");
  const [name, setName] = useState("");
  const [words, setWords] = useState<VocabItem[]>([]);
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());
  const [questionTypes, setQuestionTypes] = useState<Set<QuestionType>>(new Set());
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleAnswers, setShuffleAnswers] = useState(false);
  const [isLoadingWords, setIsLoadingWords] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !folderId) return;
    setIsLoadingWords(true);
    setError(null);
    getFolderWordsAction(folderId)
      .then((result) => {
        if (!result.ok) {
          setError(result.error);
          setWords([]);
          return;
        }
        setWords(result.items);
        setSelectedWordIds(new Set(result.items.map((item) => item.id)));
      })
      .finally(() => setIsLoadingWords(false));
  }, [open, folderId]);

  function toggleWord(id: string) {
    setSelectedWordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllWords() {
    setSelectedWordIds((prev) => (prev.size === words.length ? new Set() : new Set(words.map((w) => w.id))));
  }

  function toggleQuestionType(type: QuestionType) {
    setQuestionTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function resetForm() {
    setName("");
    setWords([]);
    setSelectedWordIds(new Set());
    setQuestionTypes(new Set());
    setShuffleQuestions(false);
    setShuffleAnswers(false);
    setError(null);
    if (!initialFolderId) setFolderId("");
  }

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await createQuizAction({
        folderId,
        name,
        vocabItemIds: [...selectedWordIds],
        questionTypes: [...questionTypes],
        shuffleQuestions,
        shuffleAnswers,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      resetForm();
      router.push(`/quiz/${result.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const canSubmit =
    folderId.length > 0 && name.trim().length > 0 && selectedWordIds.size > 0 && questionTypes.size > 0 && !isSubmitting;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Create quiz
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create quiz</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
          {!initialFolderId && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="folder">Folder</Label>
              <Select value={folderId} onValueChange={setFolderId}>
                <SelectTrigger id="folder">
                  <SelectValue placeholder="Choose a folder" />
                </SelectTrigger>
                <SelectContent>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="quiz-name">Quiz name</Label>
            <Input id="quiz-name" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
          </div>

          {folderId && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>Words</Label>
                {words.length > 0 && (
                  <button type="button" className="text-muted-foreground text-xs underline" onClick={toggleAllWords}>
                    {selectedWordIds.size === words.length ? "Deselect all" : "Select all"}
                  </button>
                )}
              </div>
              {isLoadingWords && <p className="text-muted-foreground text-xs">Loading words...</p>}
              {!isLoadingWords && words.length === 0 && (
                <p className="text-muted-foreground text-xs">This folder has no words yet.</p>
              )}
              <div className="flex max-h-40 flex-col gap-2 overflow-y-auto rounded-md border p-2">
                {words.map((word) => (
                  <label key={word.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={selectedWordIds.has(word.id)} onCheckedChange={() => toggleWord(word.id)} />
                    {word.word} — {word.meaning}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label>Question types</Label>
            <div className="flex flex-col gap-2">
              {QUESTION_TYPE_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={questionTypes.has(option.value)}
                    onCheckedChange={() => toggleQuestionType(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="shuffle-questions">Shuffle question order</Label>
            <Switch id="shuffle-questions" checked={shuffleQuestions} onCheckedChange={setShuffleQuestions} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="shuffle-answers">Shuffle answer choices</Label>
            <Switch id="shuffle-answers" checked={shuffleAnswers} onCheckedChange={setShuffleAnswers} />
          </div>

          {error && <p className="text-destructive text-xs">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting ? "Creating..." : "Create quiz"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

Note on Step 3's test: the dialog trigger and the submit button are both labeled "Create quiz" once the dialog is open (matching the design system's "one primary action" convention rather than inventing a different submit label) — the tests above disambiguate with `screen.getAllByRole(...)[1]` (submit is the second match, after the trigger) or by scoping to `screen.getByRole("dialog")`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/features/create-quiz/ui/create-quiz-dialog.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 7: Barrel export**

```ts
// src/features/create-quiz/index.ts
export { CreateQuizDialog } from "./ui/create-quiz-dialog";
```

- [ ] **Step 8: Wire into the folder-detail page**

```tsx
// src/_pages/folder-detail/ui/folder-detail-page.tsx
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { RenameFolderDialog } from "@/features/rename-folder";
import { DeleteFolderButton } from "@/features/delete-folder";
import { AddVocabDialog } from "@/features/add-vocab-manual";
import { UploadVocabDialog } from "@/features/upload-vocab-file";
import { CreateQuizDialog } from "@/features/create-quiz";
import { VocabTable } from "@/widgets/vocab-table";
import type { Folder } from "@/entities/folder";
import type { VocabItem } from "@/entities/vocab-item";

interface FolderDetailPageProps {
  folder: Folder;
  items: VocabItem[];
}

export function FolderDetailPage({ folder, items }: FolderDetailPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/library" className="text-muted-foreground flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" />
        Back to Library
      </Link>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{folder.name}</h1>
        <div className="flex items-center gap-1">
          <RenameFolderDialog folderId={folder.id} currentName={folder.name} />
          <DeleteFolderButton folderId={folder.id} folderName={folder.name} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <AddVocabDialog folderId={folder.id} />
        <UploadVocabDialog folderId={folder.id} />
        <CreateQuizDialog folders={[{ id: folder.id, name: folder.name }]} initialFolderId={folder.id} />
      </div>
      <VocabTable items={items} />
    </div>
  );
}
```

- [ ] **Step 9: Run the full check and commit**

Run: `npm test && npm run lint:fsd && npx tsc --noEmit`
Expected: all tests pass, no Steiger violations, no type errors.

```bash
git add -A
git commit -m "feat: add CreateQuizDialog and wire it into folder-detail"
```

---

### Task 7: Quiz list — grid, search/filter, and the route (replacing the placeholder)

**Files:**
- Create: `src/widgets/quiz-grid/ui/quiz-grid.tsx`
- Create: `src/widgets/quiz-grid/ui/quiz-grid.test.tsx`
- Create: `src/widgets/quiz-grid/index.ts`
- Create: `src/features/filter-quiz/model/use-quiz-list-params.ts`
- Create: `src/features/filter-quiz/ui/quiz-list-toolbar.tsx`
- Create: `src/features/filter-quiz/ui/quiz-list-toolbar.test.tsx`
- Create: `src/features/filter-quiz/index.ts`
- Create: `src/_pages/quiz-list/ui/quiz-list-page.tsx`
- Create: `src/_pages/quiz-list/index.tsx`
- Modify: `app/(main)/quiz/page.tsx`
- Delete: `src/_pages/quiz-placeholder/ui/quiz-placeholder-page.tsx`
- Delete: `src/_pages/quiz-placeholder/index.tsx`

**Interfaces:**
- Consumes: `listQuizzesByUser`, `QuizWithMeta` from `@/entities/quiz` (Task 3); `listFoldersByUser` from `@/entities/folder`; `CreateQuizDialog` from `@/features/create-quiz` (Task 6).
- Produces: `QuizGrid` from `@/widgets/quiz-grid`; `QuizListToolbar` from `@/features/filter-quiz`; the `/quiz` route now renders the real Quiz list instead of the placeholder.

- [ ] **Step 1: Write the failing `QuizGrid` test**

```tsx
// src/widgets/quiz-grid/ui/quiz-grid.test.tsx
import { render, screen } from "@testing-library/react";
import { QuizGrid } from "./quiz-grid";

const quiz = {
  id: "q1",
  folderId: "f1",
  userId: "u1",
  name: "Animal Quiz",
  questionTypes: ["meaning", "word"] as const,
  vocabItemIds: ["v1", "v2"],
  shuffleQuestions: false,
  shuffleAnswers: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  folderName: "Animals",
  questionCount: 4,
};

it("renders a card per quiz with its folder, question count, and type badges", () => {
  render(<QuizGrid quizzes={[quiz]} hasFilter={false} />);
  expect(screen.getByRole("link", { name: /Animal Quiz/ })).toHaveAttribute("href", "/quiz/q1");
  expect(screen.getByText(/Animals/)).toBeInTheDocument();
  expect(screen.getByText(/4 questions/)).toBeInTheDocument();
  expect(screen.getByText("Meaning")).toBeInTheDocument();
  expect(screen.getByText("Word")).toBeInTheDocument();
});

it("shows a 'no quizzes yet' empty state with no active filter", () => {
  render(<QuizGrid quizzes={[]} hasFilter={false} />);
  expect(screen.getByText("No quizzes yet")).toBeInTheDocument();
});

it("shows a distinct 'no matches' empty state when a filter is active", () => {
  render(<QuizGrid quizzes={[]} hasFilter={true} />);
  expect(screen.getByText("No quizzes match your search")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run it to verify it fails, then implement `QuizGrid`**

Run: `npx vitest run src/widgets/quiz-grid`
Expected: FAIL with "Cannot find module './quiz-grid'"

```tsx
// src/widgets/quiz-grid/ui/quiz-grid.tsx
import Link from "next/link";
import { ListChecks } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/shared/ui/badge";
import type { QuizWithMeta } from "@/entities/quiz";

interface QuizGridProps {
  quizzes: QuizWithMeta[];
  hasFilter: boolean;
}

const QUESTION_TYPE_LABEL: Record<string, string> = {
  meaning: "Meaning",
  word: "Word",
  sentence: "Sentence",
};

export function QuizGrid({ quizzes, hasFilter }: QuizGridProps) {
  if (quizzes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
        <ListChecks className="text-muted-foreground size-8" />
        <p className="text-sm">{hasFilter ? "No quizzes match your search" : "No quizzes yet"}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {quizzes.map((quiz) => (
        <Link
          key={quiz.id}
          href={`/quiz/${quiz.id}`}
          className="hover:border-primary/40 flex flex-col gap-2 rounded-lg border p-4 transition-colors"
        >
          <p className="text-lg font-medium">{quiz.name}</p>
          <p className="text-muted-foreground font-mono text-xs">
            {quiz.folderName} · {quiz.questionCount} {quiz.questionCount === 1 ? "question" : "questions"}
          </p>
          <div className="flex flex-wrap gap-1">
            {quiz.questionTypes.map((type) => (
              <Badge key={type} variant="secondary">
                {QUESTION_TYPE_LABEL[type]}
              </Badge>
            ))}
          </div>
        </Link>
      ))}
    </div>
  );
}
```

```ts
// src/widgets/quiz-grid/index.ts
export { QuizGrid } from "./ui/quiz-grid";
```

Run again: expect PASS (3 tests).

- [ ] **Step 3: Write the failing toolbar test**

```tsx
// src/features/filter-quiz/ui/quiz-list-toolbar.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { QuizListToolbar } from "./quiz-list-toolbar";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/quiz",
  useSearchParams: () => new URLSearchParams(),
}));

it("debounces search input before updating the URL", async () => {
  vi.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<QuizListToolbar folders={[{ id: "f1", name: "Animals" }]} />);

  await user.type(screen.getByPlaceholderText("Search quizzes"), "animal");
  expect(replace).not.toHaveBeenCalled();

  vi.advanceTimersByTime(300);
  expect(replace).toHaveBeenCalledWith("/quiz?q=animal");
  vi.useRealTimers();
});

it("filters by folder immediately on selection", async () => {
  const user = userEvent.setup();
  render(<QuizListToolbar folders={[{ id: "f1", name: "Animals" }]} />);

  await user.click(screen.getByRole("combobox"));
  await user.click(screen.getByRole("option", { name: "Animals" }));

  expect(replace).toHaveBeenCalledWith("/quiz?folderId=f1");
});
```

- [ ] **Step 4: Run it to verify it fails, then implement**

Run: `npx vitest run src/features/filter-quiz`
Expected: FAIL with "Cannot find module './quiz-list-toolbar'"

```ts
// src/features/filter-quiz/model/use-quiz-list-params.ts
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function useQuizListParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const folderId = searchParams.get("folderId") ?? "";

  useEffect(() => {
    const timeout = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (search) params.set("q", search);
      else params.delete("q");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function setFolderId(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("folderId", next);
    else params.delete("folderId");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return { search, setSearch, folderId, setFolderId };
}
```

```tsx
// src/features/filter-quiz/ui/quiz-list-toolbar.tsx
"use client";

import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { useQuizListParams } from "../model/use-quiz-list-params";

interface QuizListToolbarProps {
  folders: { id: string; name: string }[];
}

export function QuizListToolbar({ folders }: QuizListToolbarProps) {
  const { search, setSearch, folderId, setFolderId } = useQuizListParams();

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <Input
        placeholder="Search quizzes"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="sm:max-w-xs"
      />
      <Select value={folderId || "all"} onValueChange={(value) => setFolderId(value === "all" ? "" : value)}>
        <SelectTrigger className="sm:w-52">
          <SelectValue placeholder="All folders" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All folders</SelectItem>
          {folders.map((folder) => (
            <SelectItem key={folder.id} value={folder.id}>
              {folder.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

```ts
// src/features/filter-quiz/index.ts
export { QuizListToolbar } from "./ui/quiz-list-toolbar";
```

Run again: expect PASS (2 tests).

- [ ] **Step 5: `QuizListPage` and the route, replacing the placeholder**

```tsx
// src/_pages/quiz-list/ui/quiz-list-page.tsx
import { CreateQuizDialog } from "@/features/create-quiz";
import { QuizListToolbar } from "@/features/filter-quiz";
import { QuizGrid } from "@/widgets/quiz-grid";
import type { QuizWithMeta } from "@/entities/quiz";

interface QuizListPageProps {
  quizzes: QuizWithMeta[];
  folders: { id: string; name: string }[];
  hasFilter: boolean;
}

export function QuizListPage({ quizzes, folders, hasFilter }: QuizListPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Quiz</h1>
        {folders.length > 0 && <CreateQuizDialog folders={folders} />}
      </div>
      <QuizListToolbar folders={folders} />
      <QuizGrid quizzes={quizzes} hasFilter={hasFilter} />
    </div>
  );
}
```

```ts
// src/_pages/quiz-list/index.tsx
export { QuizListPage as default } from "./ui/quiz-list-page";
```

```tsx
// app/(main)/quiz/page.tsx
import { auth } from "@/_app/api-routes/auth";
import { listQuizzesByUser } from "@/entities/quiz";
import { listFoldersByUser } from "@/entities/folder";
import QuizListPage from "@/_pages/quiz-list";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; folderId?: string }>;
}) {
  const { q, folderId } = await searchParams;
  const session = await auth();
  const [quizzes, folders] = await Promise.all([
    listQuizzesByUser(session!.user.id, { search: q, folderId }),
    listFoldersByUser(session!.user.id, {}),
  ]);
  return (
    <QuizListPage
      quizzes={quizzes}
      folders={folders.map((f) => ({ id: f.id, name: f.name }))}
      hasFilter={Boolean(q) || Boolean(folderId)}
    />
  );
}
```

- [ ] **Step 6: Delete the now-superseded placeholder slice**

Delete `src/_pages/quiz-placeholder/ui/quiz-placeholder-page.tsx` and `src/_pages/quiz-placeholder/index.tsx`.

- [ ] **Step 7: Run the full check and commit**

Run: `npm test && npm run lint:fsd && npx tsc --noEmit`
Expected: all tests pass, no Steiger violations, no type errors.

```bash
git add -A
git commit -m "feat: add Quiz list page with search/filter, replacing the placeholder"
```

---

### Task 8: Quiz overview page (metadata only) and its route

**Files:**
- Create: `src/_pages/quiz-overview/ui/quiz-overview-page.tsx`
- Create: `src/_pages/quiz-overview/index.tsx`
- Create: `app/(main)/quiz/[quizId]/page.tsx`

**Interfaces:**
- Consumes: `getQuizById` from `@/entities/quiz`; `getFolderById` from `@/entities/folder`; `listQuestionsByQuiz` from `@/entities/quiz-question`.
- Produces: `/quiz/[quizId]` route, `QuizOverviewPage` — the follow-up quiz-attempts plan modifies this same page to add the Start/Continue button and attempt history, without changing its existing shape.

- [ ] **Step 1: Implement `QuizOverviewPage`**

```tsx
// src/_pages/quiz-overview/ui/quiz-overview-page.tsx
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/shared/ui/badge";
import type { Quiz } from "@/entities/quiz";

const QUESTION_TYPE_LABEL: Record<string, string> = {
  meaning: "Meaning",
  word: "Word",
  sentence: "Sentence",
};

interface QuizOverviewPageProps {
  quiz: Quiz;
  folderName: string;
  questionCount: number;
}

export function QuizOverviewPage({ quiz, folderName, questionCount }: QuizOverviewPageProps) {
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
    </div>
  );
}
```

```ts
// src/_pages/quiz-overview/index.tsx
export { QuizOverviewPage as default } from "./ui/quiz-overview-page";
```

- [ ] **Step 2: Add the route**

```tsx
// app/(main)/quiz/[quizId]/page.tsx
import { notFound } from "next/navigation";
import { auth } from "@/_app/api-routes/auth";
import { getQuizById } from "@/entities/quiz";
import { getFolderById } from "@/entities/folder";
import { listQuestionsByQuiz } from "@/entities/quiz-question";
import QuizOverviewPage from "@/_pages/quiz-overview";

export default async function Page({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params;
  const session = await auth();
  const quiz = await getQuizById(quizId, session!.user.id);
  if (!quiz) {
    notFound();
  }
  const [folder, questions] = await Promise.all([
    getFolderById(quiz.folderId, session!.user.id),
    listQuestionsByQuiz(quiz.id),
  ]);
  return (
    <QuizOverviewPage quiz={quiz} folderName={folder?.name ?? "Unknown folder"} questionCount={questions.length} />
  );
}
```

- [ ] **Step 3: Run the full check and commit**

Run: `npm test && npm run lint:fsd && npx tsc --noEmit && npm run build`
Expected: all tests pass, no Steiger violations, no type errors, build succeeds.

```bash
git add -A
git commit -m "feat: add quiz overview page and route"
```

---

### Task 9: End-to-end smoke test for quiz setup

**Files:**
- Create: `e2e/quiz-setup.spec.ts`

**Interfaces:**
- Consumes: nothing new — exercises the full stack through the browser, following the same pattern as `e2e/library.spec.ts`.

- [ ] **Step 1: Write the test**

```ts
// e2e/quiz-setup.spec.ts
import { test, expect } from "@playwright/test";

test.describe("quiz setup", () => {
  test("creates a folder with words, creates a quiz from it, and views the overview", async ({ page }) => {
    const email = `quiz-setup-test-${Date.now()}@example.com`;

    await page.goto("/register");
    await page.getByLabel("Name").fill("Quiz Setup Test");
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
    await expect(dialog.getByText("Dog — A domesticated canine")).toBeVisible();
    await dialog.getByRole("checkbox", { name: "Meaning" }).click();
    await dialog.getByRole("button", { name: "Create quiz" }).click();

    await expect(page).toHaveURL(/\/quiz\/[^/]+$/);
    await expect(page.getByRole("heading", { name: "Animal Quiz" })).toBeVisible();
    await expect(page.getByText("2 questions")).toBeVisible();
    await expect(page.getByText("Meaning", { exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Back to Quiz" }).click();
    await expect(page).toHaveURL(/\/quiz$/);
    await expect(page.getByRole("link", { name: /Animal Quiz/ })).toBeVisible();
  });

  test("redirects an unauthenticated visitor away from a quiz-overview route", async ({ page }) => {
    await page.goto("/quiz/does-not-exist");
    await expect(page).toHaveURL(/\/login$/);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npm run e2e -- e2e/quiz-setup.spec.ts`
Expected: PASS (2 tests). Needs a real `DATABASE_URL` — see README setup.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test: add Playwright e2e smoke test for quiz setup"
```
