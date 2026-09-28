import { generateText, Output } from "ai";
import { z } from "zod";

const gradingSchema = z.object({
  isCorrect: z.boolean(),
  feedback: z.string(),
});

export interface GradeSentenceResult {
  isCorrect: boolean;
  feedback: string;
}

const FALLBACK_FEEDBACK =
  "We couldn't automatically grade this sentence. Please double-check it uses the word correctly.";

export async function gradeSentenceAnswer(word: string, meaning: string, sentence: string): Promise<GradeSentenceResult> {
  try {
    const model = process.env.AI_GATEWAY_MODEL || "google/gemini-2.5-flash";
    const { output } = await generateText({
      model,
      output: Output.object({ schema: gradingSchema }),
      prompt: `You are grading an English vocabulary exercise. The word is "${word}" (meaning: "${meaning}"). The student wrote this sentence: "${sentence}". Does the sentence use the word correctly, with correct grammar and a meaning consistent with the definition above? Reply with isCorrect and a short, encouraging one-sentence feedback explaining why.`,
    });
    return output;
  } catch {
    return { isCorrect: false, feedback: FALLBACK_FEEDBACK };
  }
}
