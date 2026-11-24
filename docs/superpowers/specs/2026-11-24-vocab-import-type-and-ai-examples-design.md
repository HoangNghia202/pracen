# Vocab Import: Required "Type" Column + AI-Generated Examples — Design

**Date:** 2026-11-24
**Scope:** `src/features/vocab-item/upload-vocab-file/` plus the vocab-item entity, DB schema, manual add/edit features, and vocab table widget.

## Goals

1. File import requires at least three columns: **Word**, **Type**, **Meaning**. "Type" is free text defined by the user (e.g. noun, verb, phrasal verb) — no fixed list.
2. During import, AI generates an example sentence for each word that uses the word correctly for its Type and Meaning. The user reviews and can edit these examples in the preview before importing.
3. The vocab item model (FE) and DB gain a new `type` property.

## Non-goals

- Replacing or migrating the existing `partOfSpeech` column (it stays as-is, optional).
- Per-row "regenerate" button, streaming generation, or AI examples outside file import.

## 1. Data & Model

- **DB** (`src/shared/api/db/schema.ts`): add `type: text("type")` (nullable) to `vocabItems`. Generate migration `drizzle/0004_*.sql` via drizzle-kit. Existing rows get `NULL`.
- **Entity** (`src/entities/vocab-item`):
  - `VocabItem.type: string | null`; create/update input types accept `type?: string | null`.
  - `createVocabItem`, `createVocabItems`, `updateVocabItem` persist `type` (`?? null` on create; only when defined on update — same pattern as `partOfSpeech`).
- **Manual add / edit** (`features/vocab-item/add-vocab-manual`, `edit-vocab-item`): add optional "Type (optional)" input; zod `type: z.string().trim().max(50).optional().or(z.literal(""))`; empty string → `undefined` (add) / `null` (edit).
- **Vocab table widget**: add a "Type" column showing `item.type ?? "—"`.

## 2. File Parsing & Import Validation

- `parse-vocab-file.ts`:
  - `ParsedVocabRow` gains required `type: string`.
  - Header normalized to `type` is read. Validation order per row: Word → Type → Meaning; missing Type yields invalid row with reason `"Type is required"`.
  - `example` and `partOfSpeech` remain optional.
- `model/schema.ts` (`importVocabRowSchema`): add `type: z.string().trim().min(1, "Type is required").max(50)`. `importVocabRowsSchema` max becomes **100** (`"Too many rows to import at once (max 100)"`).
- `import-vocab.server.ts`: unchanged logic; passes `type` through to `createVocabItems`.

## 3. AI Example Generation

New server action `src/features/vocab-item/upload-vocab-file/api/generate-examples.server.ts` (`"use server"`):

```ts
generateVocabExamplesAction(
  rows: { word: string; type: string; meaning: string }[]
): Promise<{ ok: true; examples: (string | null)[] } | { ok: false; error: string }>
```

- Requires an authenticated session; validates input with zod (1–100 rows; word/type/meaning same limits as import schema).
- Splits rows into chunks of **25**; runs chunks concurrently with `Promise.allSettled`.
- Each chunk: `generateText({ model: process.env.AI_GATEWAY_MODEL || "google/gemini-2.5-flash", output: Output.object({ schema: z.object({ examples: z.array(z.object({ word: z.string(), example: z.string() })) }) }), timeout: 30_000, prompt })`.
- Prompt: for each item, write one natural, concise English sentence that uses the word **as the given type** and **with the given meaning**; return one entry per input word in the same order.
- Mapping: results are matched back to input rows by index within the chunk; an entry is accepted only if its `word` matches the input word (case-insensitive, trimmed) and `example` is non-empty — otherwise `null`. A rejected chunk yields `null` for all its rows.
- `examples[i]` corresponds to `rows[i]`.

## 4. Upload Dialog Flow (`ui/upload-vocab-dialog.tsx`)

1. User selects file → `parseVocabFile`.
2. If there are valid rows, collect rows **without** an `example` and call `generateVocabExamplesAction` for them. Show "Generating examples…" state; Import button disabled meanwhile. Rows that already have an example keep it (no AI call).
3. Preview table columns: **Word | Type | Meaning | Example**. Example cell is an editable `<Input>` bound to dialog state (per-row).
4. Import sends the current (edited) rows to `importVocabAction`. Empty example → omitted.
5. Hint text: "Required: Word, Type, Meaning. Optional: Example, Part of speech. Max 100 rows."
6. If parsed valid rows exceed 100, show an error and disable Import (no AI call).

## 5. Error Handling

- Partial AI failure: affected rows have empty (still editable) examples; show muted note "Couldn't generate examples for N words. You can add them manually."
- Whole action failure (`ok: false` or thrown): same as above with N = all requested rows; preview still usable.
- AI failure never blocks the import.
- Invalid rows (missing Word/Type/Meaning) are listed as today.

## 6. Testing (vitest)

- `parse-vocab-file.test.ts`: reads `Type`; missing Type → invalid with `"Type is required"`.
- `import-vocab.server.test.ts`: `type` persisted; >100 rows rejected.
- `generate-examples.server.test.ts` (mock `ai` and `auth`): chunking (e.g. 30 rows → 2 calls), index-aligned results, word mismatch → `null`, one chunk rejected → `null`s for that chunk only, unauthenticated → `ok: false`.
- `upload-vocab-dialog.test.tsx` (mock actions): generated examples appear in inputs; existing file examples are not sent to AI; edited example is sent to `importVocabAction`; AI failure shows note and Import still works.
- Entity / add / edit tests updated for `type` where fixtures construct `VocabItem`.
