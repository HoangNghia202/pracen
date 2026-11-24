import { z } from "zod";

export const MAX_IMPORT_ROWS = 100;
export const MAX_WORD_LENGTH = 200;
export const MAX_TYPE_LENGTH = 50;
export const MAX_MEANING_LENGTH = 500;
export const MAX_EXAMPLE_LENGTH = 500;
export const MAX_PART_OF_SPEECH_LENGTH = 50;

export const importVocabRowSchema = z.object({
  word: z.string().trim().min(1, "Word is required").max(MAX_WORD_LENGTH),
  type: z.string().trim().min(1, "Type is required").max(MAX_TYPE_LENGTH),
  meaning: z.string().trim().min(1, "Meaning is required").max(MAX_MEANING_LENGTH),
  example: z.string().trim().max(MAX_EXAMPLE_LENGTH).optional().or(z.literal("")),
  partOfSpeech: z.string().trim().max(MAX_PART_OF_SPEECH_LENGTH).optional().or(z.literal("")),
});

export const importVocabRowsSchema = z
  .array(importVocabRowSchema)
  .min(1, "No valid rows to import")
  .max(MAX_IMPORT_ROWS, `Too many rows to import at once (max ${MAX_IMPORT_ROWS})`);

export type ImportVocabRowInput = z.infer<typeof importVocabRowSchema>;
