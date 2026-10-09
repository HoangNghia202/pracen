import { z } from "zod";

export const submitAnswerSchema = z.object({
  questionIndex: z.number().int().min(0),
  userAnswer: z.string().trim().min(1, "Answer is required"),
});
export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;
