import { z } from "zod";

export const addVocabManualSchema = z.object({
  word: z.string().trim().min(1, "Word is required").max(200),
  meaning: z.string().trim().min(1, "Meaning is required").max(500),
  example: z.string().trim().max(500).optional().or(z.literal("")),
  partOfSpeech: z.string().trim().max(50).optional().or(z.literal("")),
});
export type AddVocabManualInput = z.infer<typeof addVocabManualSchema>;
