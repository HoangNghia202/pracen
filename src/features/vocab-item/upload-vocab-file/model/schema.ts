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
