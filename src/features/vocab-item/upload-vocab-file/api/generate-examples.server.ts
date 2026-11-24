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
