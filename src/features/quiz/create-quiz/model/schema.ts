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
