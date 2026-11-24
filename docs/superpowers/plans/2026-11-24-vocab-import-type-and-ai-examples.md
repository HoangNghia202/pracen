# Vocab Import: Required "Type" Column + AI Examples — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a nullable `type` property to vocab items, require a "Type" column in file import, and generate AI example sentences (editable in the preview) for imported words that lack one.

**Architecture:** New nullable `type` DB column flows through the `vocab-item` entity, manual add/edit features, and vocab table. The upload feature's parser/schema require `type` and cap rows at 100. A new server action `generateVocabExamplesAction` chunks rows (25/chunk) into parallel `generateText` + `Output.object` calls via AI Gateway; the upload dialog calls it after parsing and shows editable example inputs before import.

**Tech Stack:** Next.js 15 (server actions), React 19, Drizzle ORM + drizzle-kit (Postgres; PGlite in tests), zod 3, `ai` SDK v7 (AI Gateway), xlsx, Vitest + Testing Library, pnpm.

**Spec:** `docs/superpowers/specs/2026-11-24-vocab-import-type-and-ai-examples-design.md`

## Global Constraints

- `type` DB column: `text("type")`, nullable. Existing `partOfSpeech` column is untouched.
- `type` validation: trimmed, max 50 chars. Required (min 1, message `"Type is required"`) **only** in file import; optional in manual add/edit.
- Import row cap: **100** (`MAX_IMPORT_ROWS = 100`), message `"Too many rows to import at once (max 100)"`.
- AI: model `process.env.AI_GATEWAY_MODEL || "google/gemini-2.5-flash"`, chunk size **25**, timeout **30_000 ms**, `Promise.allSettled` across chunks.
- AI failure never blocks import; failed rows get empty, editable examples.
- Files with `"use server"` may only export async functions (and types). Put constants in non-server modules.
- Follow FSD layering (run `pnpm lint:fsd`). Tests run with `pnpm test <path>`.

## File Map

| File | Change |
|---|---|
| `src/shared/api/db/schema.ts` | add `type` column |
| `drizzle/0004_vocab-item-type.sql` + `drizzle/meta/*` | generated migration |
| `src/entities/vocab-item/model/types.ts` | `type` on `VocabItem` / `NewVocabItem` |
| `src/entities/vocab-item/api/vocab-item.server.ts` (+ test) | persist `type` |
| `src/widgets/vocab-table/ui/vocab-table.tsx` (+ test) | "Type" column |
| `src/features/quiz/create-quiz/ui/create-quiz-dialog.test.tsx` | fixtures get `type: null` |
| `src/features/vocab-item/add-vocab-manual/{model/schema.ts,api/add-vocab.server.ts,ui/add-vocab-dialog.tsx}` (+ api test) | optional Type |
| `src/features/vocab-item/edit-vocab-item/{model/schema.ts,api/edit-vocab-item.server.ts,ui/edit-vocab-item-dialog.tsx}` (+ api test) | optional Type |
| `src/features/vocab-item/upload-vocab-file/model/parse-vocab-file.ts` (+ test) | required Type |
| `src/features/vocab-item/upload-vocab-file/model/schema.ts` | `type` required, `MAX_IMPORT_ROWS` |
| `src/features/vocab-item/upload-vocab-file/api/import-vocab.server.test.ts` | type + cap tests |
| `src/features/vocab-item/upload-vocab-file/api/generate-examples.server.ts` (+ test) | **new** AI action |
| `src/features/vocab-item/upload-vocab-file/ui/upload-vocab-dialog.tsx` (+ test) | AI preview flow |

---

### Task 1: `type` column in DB and vocab-item entity

**Files:**
- Modify: `src/shared/api/db/schema.ts` (vocabItems table, ~line 73)
- Create (generated): `drizzle/0004_vocab-item-type.sql`, `drizzle/meta/0004_snapshot.json`, `drizzle/meta/_journal.json` entry
- Modify: `src/entities/vocab-item/model/types.ts`
- Modify: `src/entities/vocab-item/api/vocab-item.server.ts`
- Test: `src/entities/vocab-item/api/vocab-item.server.test.ts`
- Modify fixtures: `src/widgets/vocab-table/ui/vocab-table.test.tsx`, `src/features/quiz/create-quiz/ui/create-quiz-dialog.test.tsx`

**Interfaces:**
- Produces: `VocabItem.type: string | null`; `NewVocabItem.type?: string | null`. `createVocabItem`, `createVocabItems` store `type ?? null`; `updateVocabItem` sets `type` only when `!== undefined`.

- [ ] **Step 1: Write the failing test** — append inside the `describe("vocab item entity", ...)` block of `vocab-item.server.test.ts`:

```ts
  it("persists type on create, bulk create, and update", async () => {
    const db = await createTestDb();
    const folderId = await makeFolder(db);

    const single = await createVocabItem({ folderId, word: "Run", meaning: "Move fast", type: "verb" }, db);
    expect(single.type).toBe("verb");

    const [bulk, untyped] = await createVocabItems(
      folderId,
      [
        { word: "Dog", meaning: "A domesticated canine", type: "noun" },
        { word: "Cat", meaning: "A domesticated feline" },
      ],
      db
    );
    expect(bulk.type).toBe("noun");
    expect(untyped.type).toBeNull();

    const updated = await updateVocabItem({ id: single.id, type: "phrasal verb" }, db);
    expect(updated?.type).toBe("phrasal verb");

    const unchanged = await updateVocabItem({ id: single.id, meaning: "Move quickly" }, db);
    expect(unchanged?.type).toBe("phrasal verb");

    const cleared = await updateVocabItem({ id: single.id, type: null }, db);
    expect(cleared?.type).toBeNull();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/entities/vocab-item/api/vocab-item.server.test.ts`
Expected: FAIL — `single.type` is `undefined` (column doesn't exist).

- [ ] **Step 3: Add the column** — in `src/shared/api/db/schema.ts`, inside `vocabItems`, after `partOfSpeech`:

```ts
  partOfSpeech: text("partOfSpeech"),
  type: text("type"),
```

- [ ] **Step 4: Generate the migration**

Run: `pnpm exec drizzle-kit generate --name vocab-item-type`
Expected: creates `drizzle/0004_vocab-item-type.sql` containing exactly:

```sql
ALTER TABLE "vocabItem" ADD COLUMN "type" text;
```

plus `drizzle/meta/0004_snapshot.json` and a new `_journal.json` entry. (`generate` does not connect to the DB. If it complains that `DATABASE_URL` is missing, run `DATABASE_URL=postgres://x pnpm exec drizzle-kit generate --name vocab-item-type`.) If the SQL contains anything beyond that one `ALTER TABLE`, stop and investigate — the schema and snapshots have drifted.

- [ ] **Step 5: Update entity types** — replace `src/entities/vocab-item/model/types.ts` with:

```ts
export interface VocabItem {
  id: string;
  folderId: string;
  word: string;
  meaning: string;
  example: string | null;
  partOfSpeech: string | null;
  type: string | null;
  createdAt: Date;
}

export interface NewVocabItem {
  word: string;
  meaning: string;
  // `string | null` (not just `string | undefined`) so an update can
  // explicitly clear a previously-set value to NULL — `undefined` means
  // "leave unchanged" (see `updateVocabItem`'s `!== undefined` guards),
  // while `null` means "the caller wants this field empty".
  example?: string | null;
  partOfSpeech?: string | null;
  type?: string | null;
}
```

- [ ] **Step 6: Persist `type` in the entity API** — in `vocab-item.server.ts`:

In `createVocabItem` `.values({...})`, after `partOfSpeech`:
```ts
      partOfSpeech: input.partOfSpeech ?? null,
      type: input.type ?? null,
```
In `createVocabItems` `items.map(...)`, after `partOfSpeech`:
```ts
        partOfSpeech: item.partOfSpeech ?? null,
        type: item.type ?? null,
```
In `updateVocabItem` `.set({...})`, after the `partOfSpeech` spread:
```ts
      ...(input.partOfSpeech !== undefined ? { partOfSpeech: input.partOfSpeech } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
```

- [ ] **Step 7: Fix `VocabItem` fixtures** — add `type: null,` after `partOfSpeech: null,` in:
  - `src/widgets/vocab-table/ui/vocab-table.test.tsx` (the `item` const)
  - `src/features/quiz/create-quiz/ui/create-quiz-dialog.test.tsx` (4 inline objects, lines ~14, 15, 90, 93), e.g.
    `{ id: "v1", folderId: "f1", word: "Dog", meaning: "A domesticated canine", example: null, partOfSpeech: null, type: null, createdAt: new Date() },`

- [ ] **Step 8: Run tests and typecheck**

Run: `pnpm test src/entities/vocab-item src/widgets/vocab-table src/features/quiz/create-quiz && pnpm exec tsc --noEmit`
Expected: tests PASS. `tsc` must report no errors outside `src/features/vocab-item/upload-vocab-file/` (none expected yet). If tsc flags any other object literal typed as `VocabItem` missing `type`, add `type: null` to it.

- [ ] **Step 9: Commit**

```bash
git add src/shared/api/db/schema.ts drizzle src/entities/vocab-item src/widgets/vocab-table/ui/vocab-table.test.tsx src/features/quiz/create-quiz/ui/create-quiz-dialog.test.tsx
git commit -m "feat(vocab-item): add nullable type column"
```

---

### Task 2: Optional Type in manual add/edit and vocab table

**Files:**
- Modify: `src/features/vocab-item/add-vocab-manual/model/schema.ts`, `api/add-vocab.server.ts`, `ui/add-vocab-dialog.tsx`
- Modify: `src/features/vocab-item/edit-vocab-item/model/schema.ts`, `api/edit-vocab-item.server.ts`, `ui/edit-vocab-item-dialog.tsx`
- Modify: `src/widgets/vocab-table/ui/vocab-table.tsx`
- Test: `src/features/vocab-item/add-vocab-manual/api/add-vocab.server.test.ts`, `src/features/vocab-item/edit-vocab-item/api/edit-vocab-item.server.test.ts`, `src/widgets/vocab-table/ui/vocab-table.test.tsx`

**Interfaces:**
- Consumes: `NewVocabItem.type`, `VocabItem.type` (Task 1).
- Produces: add/edit action inputs accept optional `type: string` (empty → not set / cleared).

- [ ] **Step 1: Write failing tests**

Append inside `describe("addVocabManualAction", ...)` in `add-vocab.server.test.ts`:
```ts
  it("saves an optional type", async () => {
    const db = await createTestDb();
    const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
    const folder = await createFolder({ userId: user.id, name: "Animals" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);

    await addVocabManualAction(folder.id, { word: "Dog", meaning: "A canine", type: "noun" }, db);
    await addVocabManualAction(folder.id, { word: "Cat", meaning: "A feline", type: "" }, db);

    const items = await listVocabItemsByFolder(folder.id, db);
    expect(Object.fromEntries(items.map((i) => [i.word, i.type]))).toEqual({ Dog: "noun", Cat: null });
  });
```

Append inside `describe("editVocabItemAction", ...)` in `edit-vocab-item.server.test.ts`:
```ts
  it("sets and clears type", async () => {
    const db = await createTestDb();
    const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
    const folder = await createFolder({ userId: user.id, name: "Animals" }, db);
    const item = await createVocabItem({ folderId: folder.id, word: "Dog", meaning: "..." }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);

    await editVocabItemAction(item.id, { word: "Dog", meaning: "...", type: "noun" }, db);
    expect((await getVocabItemById(item.id, db))?.type).toBe("noun");

    await editVocabItemAction(item.id, { word: "Dog", meaning: "...", type: "" }, db);
    expect((await getVocabItemById(item.id, db))?.type).toBeNull();
  });
```

Append to `vocab-table.test.tsx`:
```ts
it("shows the type column value", () => {
  render(<VocabTable items={[{ ...item, type: "noun" }]} />);
  expect(screen.getByRole("columnheader", { name: "Type" })).toBeInTheDocument();
  expect(screen.getByText("noun")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/vocab-item/add-vocab-manual src/features/vocab-item/edit-vocab-item src/widgets/vocab-table`
Expected: 3 new tests FAIL (type stays `null`/`undefined`, no "Type" header).

- [ ] **Step 3: Schemas** — in both `add-vocab-manual/model/schema.ts` and `edit-vocab-item/model/schema.ts`, add after `partOfSpeech`:
```ts
  type: z.string().trim().max(50).optional().or(z.literal("")),
```

- [ ] **Step 4: Actions**
In `add-vocab.server.ts` `createVocabItem({...})`, after `partOfSpeech`:
```ts
        type: parsed.data.type || undefined,
```
In `edit-vocab-item.server.ts` `updateVocabItem({...})`, after `partOfSpeech`:
```ts
        type: parsed.data.type || null,
```

- [ ] **Step 5: Dialog inputs**
In `add-vocab-dialog.tsx`: add to `input`:
```ts
      type: String(formData.get("type") ?? ""),
```
and insert before the Example field block:
```tsx
          <div className="flex flex-col gap-2">
            <Label htmlFor="type">Type (optional)</Label>
            <Input id="type" name="type" placeholder="noun, verb, idiom..." />
          </div>
```
In `edit-vocab-item-dialog.tsx`: add the same `type` line to `input`, and insert before the Example field block:
```tsx
          <div className="flex flex-col gap-2">
            <Label htmlFor="type">Type (optional)</Label>
            <Input id="type" name="type" defaultValue={item.type ?? ""} />
          </div>
```

- [ ] **Step 6: Vocab table** — in `vocab-table.tsx`, add header after `<TableHead>Word</TableHead>`:
```tsx
            <TableHead>Type</TableHead>
```
and cell after the word cell:
```tsx
              <TableCell className="text-muted-foreground">{item.type ?? "—"}</TableCell>
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm test src/features/vocab-item/add-vocab-manual src/features/vocab-item/edit-vocab-item src/widgets/vocab-table`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/vocab-item/add-vocab-manual src/features/vocab-item/edit-vocab-item src/widgets/vocab-table
git commit -m "feat(vocab-item): optional type in manual add/edit and vocab table"
```

---

### Task 3: Require Type in file parsing and import; cap at 100 rows

**Files:**
- Modify: `src/features/vocab-item/upload-vocab-file/model/parse-vocab-file.ts`
- Modify: `src/features/vocab-item/upload-vocab-file/model/schema.ts`
- Test: `src/features/vocab-item/upload-vocab-file/model/parse-vocab-file.test.ts`, `src/features/vocab-item/upload-vocab-file/api/import-vocab.server.test.ts`

**Interfaces:**
- Consumes: `NewVocabItem.type` (Task 1).
- Produces:
  - `ParsedVocabRow = { word: string; type: string; meaning: string; example?: string; partOfSpeech?: string }`
  - `export const MAX_IMPORT_ROWS = 100` from `model/schema.ts`
  - `importVocabRowSchema` includes `type: z.string().trim().min(1, "Type is required").max(50)`

- [ ] **Step 1: Rewrite parser tests** — replace the full contents of `parse-vocab-file.test.ts` with:

```ts
import * as XLSX from "xlsx";
import { parseVocabFile } from "./parse-vocab-file";

function bufferFromRows(rows: (string | number)[][]): ArrayBuffer {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}

describe("parseVocabFile", () => {
  it("parses valid rows using header names, case-insensitively", () => {
    const buffer = bufferFromRows([
      ["Word", "Type", "Meaning", "Example", "Part of Speech"],
      ["Dog", "noun", "A domesticated canine", "The dog barks.", "noun"],
    ]);

    const { valid, invalid } = parseVocabFile(buffer);

    expect(invalid).toEqual([]);
    expect(valid).toEqual([
      {
        word: "Dog",
        type: "noun",
        meaning: "A domesticated canine",
        example: "The dog barks.",
        partOfSpeech: "noun",
      },
    ]);
  });

  it("treats example and part of speech as optional", () => {
    const buffer = bufferFromRows([
      ["word", "type", "meaning"],
      ["Cat", "noun", "A domesticated feline"],
    ]);

    const { valid, invalid } = parseVocabFile(buffer);

    expect(invalid).toEqual([]);
    expect(valid).toEqual([{ word: "Cat", type: "noun", meaning: "A domesticated feline" }]);
  });

  it("accepts any user-defined type text", () => {
    const buffer = bufferFromRows([
      ["word", "type", "meaning"],
      ["give up", "phrasal verb", "Stop trying"],
    ]);

    expect(parseVocabFile(buffer).valid).toEqual([
      { word: "give up", type: "phrasal verb", meaning: "Stop trying" },
    ]);
  });

  it("reports rows missing a required word, type, or meaning, without dropping valid rows around them", () => {
    const buffer = bufferFromRows([
      ["word", "type", "meaning"],
      ["Dog", "noun", "A domesticated canine"],
      ["", "noun", "Missing word"],
      ["Bird", "", "Missing type"],
      ["Cat", "noun", ""],
    ]);

    const { valid, invalid } = parseVocabFile(buffer);

    expect(valid).toEqual([{ word: "Dog", type: "noun", meaning: "A domesticated canine" }]);
    expect(invalid).toEqual([
      { row: 3, reason: "Word is required" },
      { row: 4, reason: "Type is required" },
      { row: 5, reason: "Meaning is required" },
    ]);
  });

  it("marks every row invalid when the Type column is absent", () => {
    const buffer = bufferFromRows([
      ["word", "meaning"],
      ["Dog", "A domesticated canine"],
    ]);

    expect(parseVocabFile(buffer)).toEqual({
      valid: [],
      invalid: [{ row: 2, reason: "Type is required" }],
    });
  });

  it("ignores extra unrecognized columns instead of erroring on them", () => {
    const buffer = bufferFromRows([
      ["Word", "Type", "Meaning", "Notes", "Id"],
      ["Dog", "noun", "A domesticated canine", "irrelevant", "42"],
    ]);

    const { valid, invalid } = parseVocabFile(buffer);

    expect(invalid).toEqual([]);
    expect(valid).toEqual([{ word: "Dog", type: "noun", meaning: "A domesticated canine" }]);
  });

  it("returns no valid or invalid rows for a header-only or empty file", () => {
    const buffer = bufferFromRows([["word", "type", "meaning"]]);
    expect(parseVocabFile(buffer)).toEqual({ valid: [], invalid: [] });
    expect(parseVocabFile(bufferFromRows([]))).toEqual({ valid: [], invalid: [] });
  });
});
```

- [ ] **Step 2: Update import action tests** — in `import-vocab.server.test.ts`:

Add `type: "noun"` to every row object that currently has a non-empty word (Dog/Cat rows in the "bulk-inserts", "refuses to import into another user's folder", and "rejects rows with an empty word" tests). The `{ word: "", meaning: "Missing a word" }` row also gets `type: "noun"` so it still fails only because of the empty word. Then append inside the `describe`:

```ts
  it("persists the type of each imported row", async () => {
    const db = await createTestDb();
    const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
    const folder = await createFolder({ userId: user.id, name: "Animals" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);

    await importVocabAction(
      folder.id,
      [{ word: "Run", type: "verb", meaning: "Move fast", example: "I run every day." }],
      db
    );

    const [item] = await listVocabItemsByFolder(folder.id, db);
    expect(item).toMatchObject({ word: "Run", type: "verb", example: "I run every day." });
  });

  it("rejects rows without a type", async () => {
    const db = await createTestDb();
    const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
    const folder = await createFolder({ userId: user.id, name: "Animals" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);

    const result = await importVocabAction(
      folder.id,
      [{ word: "Dog", type: "", meaning: "A canine" }],
      db
    );

    expect(result).toEqual({ ok: false, error: "Type is required" });
  });

  it("rejects more than 100 rows", async () => {
    const db = await createTestDb();
    const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
    const folder = await createFolder({ userId: user.id, name: "Animals" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);

    const rows = Array.from({ length: 101 }, (_, i) => ({ word: `w${i}`, type: "noun", meaning: "m" }));
    const result = await importVocabAction(folder.id, rows, db);

    expect(result).toEqual({ ok: false, error: "Too many rows to import at once (max 100)" });
    expect(await listVocabItemsByFolder(folder.id, db)).toEqual([]);
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test src/features/vocab-item/upload-vocab-file/model src/features/vocab-item/upload-vocab-file/api/import-vocab.server.test.ts`
Expected: FAIL — parser output lacks `type`, missing type isn't reported, 101 rows accepted.

- [ ] **Step 4: Update schema** — replace `model/schema.ts` with:

```ts
import { z } from "zod";

export const MAX_IMPORT_ROWS = 100;

export const importVocabRowSchema = z.object({
  word: z.string().trim().min(1, "Word is required").max(200),
  type: z.string().trim().min(1, "Type is required").max(50),
  meaning: z.string().trim().min(1, "Meaning is required").max(500),
  example: z.string().trim().max(500).optional().or(z.literal("")),
  partOfSpeech: z.string().trim().max(50).optional().or(z.literal("")),
});

export const importVocabRowsSchema = z
  .array(importVocabRowSchema)
  .min(1, "No valid rows to import")
  .max(MAX_IMPORT_ROWS, `Too many rows to import at once (max ${MAX_IMPORT_ROWS})`);

export type ImportVocabRowInput = z.infer<typeof importVocabRowSchema>;
```

- [ ] **Step 5: Update parser** — in `parse-vocab-file.ts`:

Change the interface:
```ts
export interface ParsedVocabRow {
  word: string;
  type: string;
  meaning: string;
  example?: string;
  partOfSpeech?: string;
}
```
Replace the body of `rows.forEach` from `const word = ...` through the `valid.push(...)` call with:
```ts
    const word = normalized.word ?? "";
    const type = normalized.type ?? "";
    const meaning = normalized.meaning ?? "";
    const sheetRow = index + 2; // +1 for the header row, +1 for 1-based row numbers

    if (!word) {
      invalid.push({ row: sheetRow, reason: "Word is required" });
      return;
    }
    if (!type) {
      invalid.push({ row: sheetRow, reason: "Type is required" });
      return;
    }
    if (!meaning) {
      invalid.push({ row: sheetRow, reason: "Meaning is required" });
      return;
    }

    const example = normalized.example;
    const partOfSpeech = normalized.partofspeech;
    valid.push({
      word,
      type,
      meaning,
      ...(example ? { example } : {}),
      ...(partOfSpeech ? { partOfSpeech } : {}),
    });
```

`import-vocab.server.ts` needs no change: it already passes `parsed.data` (now including `type`) to `createVocabItems`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm test src/features/vocab-item/upload-vocab-file`
Expected: PASS (the existing dialog test still passes; it only checks the corrupt-file error).

- [ ] **Step 7: Commit**

```bash
git add src/features/vocab-item/upload-vocab-file/model src/features/vocab-item/upload-vocab-file/api/import-vocab.server.test.ts
git commit -m "feat(upload-vocab-file): require Type column and cap import at 100 rows"
```

---

### Task 4: `generateVocabExamplesAction` server action

**Files:**
- Create: `src/features/vocab-item/upload-vocab-file/api/generate-examples.server.ts`
- Test: `src/features/vocab-item/upload-vocab-file/api/generate-examples.server.test.ts`

**Interfaces:**
- Consumes: `importVocabRowSchema`, `MAX_IMPORT_ROWS` from `../model/schema` (Task 3); `auth` from `@/_app/api-routes/auth`.
- Produces:
  ```ts
  export type ExampleRequestRow = { word: string; type: string; meaning: string };
  export type GenerateExamplesResult =
    | { ok: true; examples: (string | null)[] }   // examples[i] ↔ rows[i]
    | { ok: false; error: string };
  export async function generateVocabExamplesAction(rows: ExampleRequestRow[]): Promise<GenerateExamplesResult>;
  ```

- [ ] **Step 1: Write the failing test** — create `generate-examples.server.test.ts`:

```ts
import { vi } from "vitest";
import { generateText } from "ai";
import { auth } from "@/_app/api-routes/auth";
import { generateVocabExamplesAction } from "./generate-examples.server";

vi.mock("@/_app/api-routes/auth", () => ({ auth: vi.fn() }));
vi.mock("ai", () => ({
  generateText: vi.fn(),
  Output: { object: (config: unknown) => config },
}));

function rows(n: number) {
  return Array.from({ length: n }, (_, i) => ({ word: `w${i}`, type: "noun", meaning: `m${i}` }));
}

// Echo back an example for each word listed in the prompt, in order.
function echoExamples() {
  vi.mocked(generateText).mockImplementation((async ({ prompt }: { prompt: string }) => {
    const words = [...prompt.matchAll(/word: "([^"]+)"/g)].map((m) => m[1]);
    return { output: { examples: words.map((word) => ({ word, example: `Example for ${word}.` })) } };
  }) as never);
}

describe("generateVocabExamplesAction", () => {
  beforeEach(() => {
    vi.mocked(generateText).mockReset();
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
  });

  it("returns one example per row, in order, using word type and meaning in the prompt", async () => {
    echoExamples();

    const result = await generateVocabExamplesAction([{ word: "run", type: "verb", meaning: "move fast" }]);

    expect(result).toEqual({ ok: true, examples: ["Example for run."] });
    const call = vi.mocked(generateText).mock.calls[0][0] as { prompt: string; timeout: number };
    expect(call.prompt).toContain('type: "verb"');
    expect(call.prompt).toContain('meaning: "move fast"');
    expect(call.timeout).toBe(30_000);
  });

  it("splits rows into chunks of 25 and keeps results aligned", async () => {
    echoExamples();

    const result = await generateVocabExamplesAction(rows(30));

    expect(generateText).toHaveBeenCalledTimes(2);
    expect(result.ok && result.examples).toEqual(rows(30).map((r) => `Example for ${r.word}.`));
  });

  it("returns null for every row of a chunk that fails, without affecting other chunks", async () => {
    vi.mocked(generateText)
      .mockRejectedValueOnce(new Error("gateway down"))
      .mockImplementationOnce((async ({ prompt }: { prompt: string }) => {
        const words = [...prompt.matchAll(/word: "([^"]+)"/g)].map((m) => m[1]);
        return { output: { examples: words.map((word) => ({ word, example: `Ex ${word}` })) } };
      }) as never);

    const result = await generateVocabExamplesAction(rows(26));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.examples.slice(0, 25)).toEqual(Array(25).fill(null));
    expect(result.examples[25]).toBe("Ex w25");
  });

  it("returns null when the model's word doesn't match or the example is blank", async () => {
    vi.mocked(generateText).mockResolvedValue({
      output: {
        examples: [
          { word: "something else", example: "Wrong word." },
          { word: "W1", example: "   " },
        ],
      },
    } as never);

    const result = await generateVocabExamplesAction(rows(3));

    expect(result).toEqual({ ok: true, examples: [null, null, null] });
  });

  it("refuses when signed out", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await generateVocabExamplesAction(rows(1));

    expect(result).toEqual({ ok: false, error: "You must be signed in." });
    expect(generateText).not.toHaveBeenCalled();
  });

  it("rejects more than 100 rows", async () => {
    const result = await generateVocabExamplesAction(rows(101));

    expect(result).toEqual({ ok: false, error: "Too many rows to import at once (max 100)" });
    expect(generateText).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/features/vocab-item/upload-vocab-file/api/generate-examples.server.test.ts`
Expected: FAIL — cannot resolve `./generate-examples.server`.

- [ ] **Step 3: Implement** — create `generate-examples.server.ts`:

```ts
"use server";

import { generateText, Output } from "ai";
import { z } from "zod";
import { auth } from "@/_app/api-routes/auth";
import { MAX_IMPORT_ROWS, importVocabRowSchema } from "../model/schema";

export type ExampleRequestRow = { word: string; type: string; meaning: string };

export type GenerateExamplesResult =
  | { ok: true; examples: (string | null)[] }
  | { ok: false; error: string };

const requestSchema = z
  .array(importVocabRowSchema.pick({ word: true, type: true, meaning: true }))
  .min(1, "No rows to generate examples for")
  .max(MAX_IMPORT_ROWS, `Too many rows to import at once (max ${MAX_IMPORT_ROWS})`);

const outputSchema = z.object({
  examples: z.array(z.object({ word: z.string(), example: z.string() })),
});

const CHUNK_SIZE = 25;
const GENERATE_TEXT_TIMEOUT_MS = 30_000;

function buildPrompt(rows: ExampleRequestRow[]): string {
  const items = rows
    .map((row, i) => `${i + 1}. word: "${row.word}" | type: "${row.type}" | meaning: "${row.meaning}"`)
    .join("\n");
  return [
    "You are helping an English learner build vocabulary flashcards.",
    "For each item below, write ONE natural, concise English example sentence (at most 20 words)",
    "that uses the word as the given type (e.g. noun, verb, phrasal verb) and with the given meaning.",
    'Return exactly one entry per item, in the same order, copying "word" exactly from the input.',
    "",
    items,
  ].join("\n");
}

async function generateChunk(rows: ExampleRequestRow[]): Promise<(string | null)[]> {
  const model = process.env.AI_GATEWAY_MODEL || "google/gemini-2.5-flash";
  const { output } = await generateText({
    model,
    output: Output.object({ schema: outputSchema }),
    prompt: buildPrompt(rows),
    timeout: GENERATE_TEXT_TIMEOUT_MS,
  });

  return rows.map((row, i) => {
    const entry = output.examples[i];
    if (!entry) return null;
    if (entry.word.trim().toLowerCase() !== row.word.trim().toLowerCase()) return null;
    const example = entry.example.trim();
    return example || null;
  });
}

export async function generateVocabExamplesAction(
  rows: ExampleRequestRow[]
): Promise<GenerateExamplesResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = requestSchema.safeParse(rows);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const chunks: ExampleRequestRow[][] = [];
  for (let i = 0; i < parsed.data.length; i += CHUNK_SIZE) {
    chunks.push(parsed.data.slice(i, i + CHUNK_SIZE));
  }

  const settled = await Promise.allSettled(chunks.map(generateChunk));
  const examples = settled.flatMap((result, i) =>
    result.status === "fulfilled" ? result.value : chunks[i].map(() => null)
  );

  return { ok: true, examples };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/features/vocab-item/upload-vocab-file/api/generate-examples.server.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/vocab-item/upload-vocab-file/api/generate-examples.server.ts src/features/vocab-item/upload-vocab-file/api/generate-examples.server.test.ts
git commit -m "feat(upload-vocab-file): AI example generation server action"
```

---

### Task 5: Upload dialog — AI preview with editable examples

**Files:**
- Modify: `src/features/vocab-item/upload-vocab-file/ui/upload-vocab-dialog.tsx`
- Test: `src/features/vocab-item/upload-vocab-file/ui/upload-vocab-dialog.test.tsx`

**Interfaces:**
- Consumes: `parseVocabFile`, `ParsedVocabRow`, `ParseVocabFileResult` (Task 3); `MAX_IMPORT_ROWS` (Task 3); `generateVocabExamplesAction` (Task 4); `importVocabAction(folderId, rows: ParsedVocabRow[])` (existing).
- Produces: UI only. Example inputs have `aria-label={`Example for ${row.word}`}`.

- [ ] **Step 1: Write the failing tests** — replace the contents of `upload-vocab-dialog.test.tsx` with:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as XLSX from "xlsx";
import { vi } from "vitest";
import { generateVocabExamplesAction } from "../api/generate-examples.server";
import { importVocabAction } from "../api/import-vocab.server";
import { UploadVocabDialog } from "./upload-vocab-dialog";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../api/generate-examples.server", () => ({ generateVocabExamplesAction: vi.fn() }));
vi.mock("../api/import-vocab.server", () => ({ importVocabAction: vi.fn() }));

function xlsxBuffer(rows: string[][]): ArrayBuffer {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

function corruptXlsxBuffer(): ArrayBuffer {
  const full = xlsxBuffer([
    ["word", "type", "meaning"],
    ["Dog", "noun", "A domesticated canine"],
  ]);
  // A truncated ZIP-structured buffer reliably makes XLSX.read throw
  // ("Unsupported ZIP file"), simulating a corrupt/incomplete upload.
  return full.slice(0, Math.floor(full.byteLength / 2));
}

async function uploadRows(rows: string[][]) {
  render(<UploadVocabDialog folderId="folder-1" />);
  await userEvent.click(screen.getByRole("button", { name: "Import file" }));
  const file = new File([xlsxBuffer(rows)], "words.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  await userEvent.upload(screen.getByLabelText("File"), file);
}

describe("UploadVocabDialog", () => {
  beforeEach(() => {
    vi.mocked(generateVocabExamplesAction).mockReset();
    vi.mocked(importVocabAction).mockReset();
    vi.mocked(importVocabAction).mockResolvedValue({ ok: true, count: 2 });
  });

  it("shows an error instead of crashing when the file cannot be parsed", async () => {
    render(<UploadVocabDialog folderId="folder-1" />);
    await userEvent.click(screen.getByRole("button", { name: "Import file" }));
    const corruptFile = new File([corruptXlsxBuffer()], "corrupt.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await userEvent.upload(screen.getByLabelText("File"), corruptFile);

    expect(
      await screen.findByText(
        "Could not read this file. Please make sure it's a valid CSV or Excel file."
      )
    ).toBeInTheDocument();
  });

  it("generates examples only for rows without one, and imports the edited examples", async () => {
    vi.mocked(generateVocabExamplesAction).mockResolvedValue({ ok: true, examples: ["I run daily."] });

    await uploadRows([
      ["word", "type", "meaning", "example"],
      ["Dog", "noun", "A canine", "The dog barks."],
      ["run", "verb", "Move fast", ""],
    ]);

    // The file change handler is async; wait for its result before asserting on the call.
    const runExample = await screen.findByDisplayValue("I run daily.");
    expect(generateVocabExamplesAction).toHaveBeenCalledWith([
      { word: "run", type: "verb", meaning: "Move fast" },
    ]);
    expect(screen.getByLabelText("Example for Dog")).toHaveValue("The dog barks.");

    await userEvent.clear(runExample);
    await userEvent.type(runExample, "She runs to school.");
    await userEvent.click(screen.getByRole("button", { name: "Import 2 words" }));

    expect(importVocabAction).toHaveBeenCalledWith("folder-1", [
      { word: "Dog", type: "noun", meaning: "A canine", example: "The dog barks." },
      { word: "run", type: "verb", meaning: "Move fast", example: "She runs to school." },
    ]);
  });

  it("still allows import when AI generation fails, and reports how many examples are missing", async () => {
    vi.mocked(generateVocabExamplesAction).mockResolvedValue({ ok: true, examples: [null, "Cats purr."] });

    await uploadRows([
      ["word", "type", "meaning"],
      ["Dog", "noun", "A canine"],
      ["Cat", "noun", "A feline"],
    ]);

    expect(
      await screen.findByText("Couldn't generate examples for 1 word. You can add them manually.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Example for Dog")).toHaveValue("");

    await userEvent.click(screen.getByRole("button", { name: "Import 2 words" }));

    expect(importVocabAction).toHaveBeenCalledWith("folder-1", [
      { word: "Dog", type: "noun", meaning: "A canine" },
      { word: "Cat", type: "noun", meaning: "A feline", example: "Cats purr." },
    ]);
  });

  it("treats a thrown generation error like all examples failing", async () => {
    vi.mocked(generateVocabExamplesAction).mockRejectedValue(new Error("boom"));

    await uploadRows([
      ["word", "type", "meaning"],
      ["Dog", "noun", "A canine"],
      ["Cat", "noun", "A feline"],
    ]);

    expect(
      await screen.findByText("Couldn't generate examples for 2 words. You can add them manually.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import 2 words" })).toBeEnabled();
  });

  it("blocks files with more than 100 valid rows without calling AI", async () => {
    const rows = [["word", "type", "meaning"], ...Array.from({ length: 101 }, (_, i) => [`w${i}`, "noun", "m"])];

    await uploadRows(rows);

    expect(
      await screen.findByText("This file has 101 words. You can import at most 100 at a time.")
    ).toBeInTheDocument();
    expect(generateVocabExamplesAction).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Import 101 words" })).toBeDisabled());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/vocab-item/upload-vocab-file/ui`
Expected: the corrupt-file test PASSES. The 4 new tests FAIL (AI action not called, no example inputs).

- [ ] **Step 3: Implement** — replace `upload-vocab-dialog.tsx` with:

```tsx
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadSimple } from "@phosphor-icons/react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import {
  parseVocabFile,
  type ParsedVocabRow,
  type ParseVocabFileResult,
} from "../model/parse-vocab-file";
import { MAX_IMPORT_ROWS } from "../model/schema";
import { importVocabAction } from "../api/import-vocab.server";
import { generateVocabExamplesAction } from "../api/generate-examples.server";

function pluralizeWords(count: number): string {
  return `${count} word${count === 1 ? "" : "s"}`;
}

export function UploadVocabDialog({ folderId }: { folderId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<ParseVocabFileResult | null>(null);
  const [examples, setExamples] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [missingCount, setMissingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Ignores results from a generation request superseded by a newer file or a closed dialog.
  const generationId = useRef(0);

  const tooMany = (preview?.valid.length ?? 0) > MAX_IMPORT_ROWS;

  function reset() {
    generationId.current += 1;
    setPreview(null);
    setExamples([]);
    setMissingCount(0);
    setIsGenerating(false);
  }

  async function generateMissingExamples(rows: ParsedVocabRow[]) {
    const pending = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => !row.example);
    if (pending.length === 0) return;

    const requestId = ++generationId.current;
    setIsGenerating(true);

    let generated: (string | null)[];
    try {
      const result = await generateVocabExamplesAction(
        pending.map(({ row }) => ({ word: row.word, type: row.type, meaning: row.meaning }))
      );
      generated = result.ok ? result.examples : pending.map(() => null);
    } catch {
      generated = pending.map(() => null);
    }

    if (requestId !== generationId.current) return;
    setExamples((prev) => {
      const next = [...prev];
      pending.forEach(({ index }, k) => {
        const example = generated[k];
        if (example) next[index] = example;
      });
      return next;
    });
    setMissingCount(generated.filter((example) => !example).length);
    setIsGenerating(false);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    reset();

    let parsed: ParseVocabFileResult;
    try {
      parsed = parseVocabFile(await file.arrayBuffer());
    } catch {
      setError("Could not read this file. Please make sure it's a valid CSV or Excel file.");
      return;
    }

    setPreview(parsed);
    setExamples(parsed.valid.map((row) => row.example ?? ""));

    if (parsed.valid.length > MAX_IMPORT_ROWS) {
      setError(
        `This file has ${parsed.valid.length} words. You can import at most ${MAX_IMPORT_ROWS} at a time.`
      );
      return;
    }

    await generateMissingExamples(parsed.valid);
  }

  async function handleConfirm() {
    if (!preview || preview.valid.length === 0) return;
    setError(null);
    setIsSubmitting(true);

    const rows: ParsedVocabRow[] = preview.valid.map((row, index) => {
      const example = examples[index]?.trim();
      return {
        word: row.word,
        type: row.type,
        meaning: row.meaning,
        ...(example ? { example } : {}),
        ...(row.partOfSpeech ? { partOfSpeech: row.partOfSpeech } : {}),
      };
    });

    try {
      const result = await importVocabAction(folderId, rows);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      reset();
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          reset();
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <UploadSimple className="size-4" />
          Import file
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import from CSV or Excel</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="file">File</Label>
            <Input id="file" type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} />
            <p className="text-muted-foreground text-xs">
              Required: Word, Type, Meaning. Optional: Example, Part of speech. Max {MAX_IMPORT_ROWS} rows.
            </p>
          </div>

          {isGenerating && (
            <p className="text-muted-foreground text-sm">Generating examples…</p>
          )}

          {preview && (
            <div className="flex max-h-80 flex-col gap-3 overflow-y-auto">
              {preview.valid.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Word</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Meaning</TableHead>
                      <TableHead>Example</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.valid.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>{row.word}</TableCell>
                        <TableCell>{row.type}</TableCell>
                        <TableCell>{row.meaning}</TableCell>
                        <TableCell className="min-w-64">
                          <Input
                            aria-label={`Example for ${row.word}`}
                            value={examples[index] ?? ""}
                            disabled={isGenerating}
                            onChange={(event) => {
                              const value = event.target.value;
                              setExamples((prev) => {
                                const next = [...prev];
                                next[index] = value;
                                return next;
                              });
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {preview.invalid.length > 0 && (
                <div className="text-destructive text-xs">
                  {preview.invalid.map((row) => (
                    <p key={row.row}>
                      Row {row.row}: {row.reason}
                    </p>
                  ))}
                </div>
              )}
              {preview.valid.length === 0 && preview.invalid.length === 0 && (
                <p className="text-muted-foreground text-sm">No rows found in this file.</p>
              )}
            </div>
          )}

          {missingCount > 0 && (
            <p className="text-muted-foreground text-xs">
              Couldn&apos;t generate examples for {pluralizeWords(missingCount)}. You can add them manually.
            </p>
          )}

          {error && <p className="text-destructive text-xs">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            onClick={handleConfirm}
            disabled={
              !preview || preview.valid.length === 0 || tooMany || isGenerating || isSubmitting
            }
          >
            {isSubmitting
              ? "Importing..."
              : isGenerating
                ? "Generating examples..."
                : `Import ${preview?.valid.length ?? 0} words`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/features/vocab-item/upload-vocab-file/ui`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/vocab-item/upload-vocab-file/ui
git commit -m "feat(upload-vocab-file): AI-generated editable examples in import preview"
```

---

### Task 6: Full verification

- [ ] **Step 1: Run the full unit suite, typecheck, and lints**

Run: `pnpm test && pnpm exec tsc --noEmit && pnpm lint && pnpm lint:fsd`
Expected: all green. Fix any failure in files touched by this plan. Do not change unrelated code.

- [ ] **Step 2: Manual smoke test (requires `DATABASE_URL` and AI Gateway credentials in `.env`)**

```bash
pnpm exec drizzle-kit migrate
pnpm dev
```
In a folder page, click "Import file" and upload a CSV:
```csv
Word,Type,Meaning,Example
dog,noun,a domesticated canine,The dog barks.
run,verb,move fast,
give up,phrasal verb,stop trying,
```
Expected: "Generating examples…" appears, then examples fill in for `run` and `give up` (`dog` keeps its own). Edit one, click "Import 3 words". The vocab table shows a Type column with noun / verb / phrasal verb and the edited example.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A && git commit -m "chore: fix lint/type issues from vocab type + AI examples"
```
(Skip if there is nothing to commit.)
