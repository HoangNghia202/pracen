"use server";

import { submitAnswerSchema } from "../model/schema";
import { getAttemptById, recordAnswer } from "@/entities/quiz-attempt";
import { getQuestionById } from "@/entities/quiz-question";
import { gradeSentenceAnswer } from "@/features/grade-sentence-answer";
import { auth } from "@/_app/api-routes/auth";
import { db as defaultDb } from "@/shared/api";
import { safeRevalidatePath } from "@/shared/lib/safe-revalidate-path";

export type SubmitAnswerResult =
  | { ok: true; isCorrect: boolean; aiFeedback: string | null; completed: boolean; score: number | null }
  | { ok: false; error: string };

type Db = Parameters<typeof getAttemptById>[2];

export async function submitAnswerAction(
  attemptId: string,
  input: unknown,
  dbInstance: Db = defaultDb
): Promise<SubmitAnswerResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = submitAnswerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const attempt = await getAttemptById(attemptId, session.user.id, dbInstance);
    if (!attempt) {
      return { ok: false, error: "Attempt not found" };
    }
    if (attempt.status !== "in_progress") {
      return { ok: false, error: "This attempt is already finished" };
    }
    if (parsed.data.questionIndex !== attempt.currentIndex) {
      return { ok: false, error: "This question was already answered" };
    }

    const snapshotItem = attempt.questionsSnapshot[attempt.currentIndex];
    const question = await getQuestionById(snapshotItem.questionId, dbInstance);
    if (!question) {
      return { ok: false, error: "Question not found" };
    }

    let isCorrect: boolean;
    let aiFeedback: string | null = null;

    if (question.questionType === "sentence") {
      const graded = await gradeSentenceAnswer(question.word, question.meaning, parsed.data.userAnswer);
      isCorrect = graded.isCorrect;
      aiFeedback = graded.feedback;
    } else {
      isCorrect = parsed.data.userAnswer === question.vocabItemId;
    }

    const updated = await recordAnswer(
      {
        attemptId,
        questionIndex: attempt.currentIndex,
        questionType: question.questionType,
        word: question.word,
        meaning: question.meaning,
        userAnswer: parsed.data.userAnswer,
        isCorrect,
        aiFeedback,
      },
      dbInstance
    );

    safeRevalidatePath(`/quiz/${attempt.quizId}/attempt`);
    return { ok: true, isCorrect, aiFeedback, completed: updated.status === "completed", score: updated.score };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
