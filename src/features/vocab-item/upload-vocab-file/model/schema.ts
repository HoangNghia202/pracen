import { z } from "zod";

export const importVocabRowSchema = z.object({
  word: z.string().trim().min(1, "Word is required").max(200),
  meaning: z.string().trim().min(1, "Meaning is required").max(500),
  example: z.string().trim().max(500).optional().or(z.literal("")),
  partOfSpeech: z.string().trim().max(50).optional().or(z.literal("")),
});

export const importVocabRowsSchema = z
  .array(importVocabRowSchema)
  .min(1, "No valid rows to import")
  .max(5000, "Too many rows to import at once");

export type ImportVocabRowInput = z.infer<typeof importVocabRowSchema>;
