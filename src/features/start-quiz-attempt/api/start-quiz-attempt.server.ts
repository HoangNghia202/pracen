"use server";

import { getQuizById } from "@/entities/quiz";
import { listQuestionsByQuiz } from "@/entities/quiz-question";
import { getInProgressAttempt, createAttempt, buildQuestionsSnapshot } from "@/entities/quiz-attempt";
import { auth } from "@/_app/api-routes/auth";
import { db as defaultDb } from "@/shared/api";

export type StartQuizAttemptResult = { ok: true; attemptId: string } | { ok: false; error: string };

type Db = Parameters<typeof getQuizById>[2];

export async function startQuizAttemptAction(quizId: string, dbInstance: Db = defaultDb): Promise<StartQuizAttemptResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "You must be signed in." };
  }

  try {
    const quiz = await getQuizById(quizId, session.user.id, dbInstance);
    if (!quiz) {
      return { ok: false, error: "Quiz not found" };
    }

    const existing = await getInProgressAttempt(quizId, session.user.id, dbInstance);
    if (existing) {
      return { ok: true, attemptId: existing.id };
    }

    const questions = await listQuestionsByQuiz(quizId, dbInstance);
    const snapshot = buildQuestionsSnapshot(questions, {
      shuffleQuestions: quiz.shuffleQuestions,
      shuffleAnswers: quiz.shuffleAnswers,
    });
    const attempt = await createAttempt({ quizId, userId: session.user.id, questionsSnapshot: snapshot }, dbInstance);
    return { ok: true, attemptId: attempt.id };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
