import { db as defaultDb, quizAttempts, attemptAnswers, schema } from "@/shared/api";
import { and, asc, desc, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { AttemptAnswer, QuestionSnapshotItem, QuizAttempt } from "../model/types";

type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export async function getInProgressAttempt(quizId: string, userId: string, db: Db = defaultDb): Promise<QuizAttempt | null> {
  const rows = await db
    .select()
    .from(quizAttempts)
    .where(and(eq(quizAttempts.quizId, quizId), eq(quizAttempts.userId, userId), eq(quizAttempts.status, "in_progress")));
  return rows[0] ?? null;
}

export async function createAttempt(
  input: { quizId: string; userId: string; questionsSnapshot: QuestionSnapshotItem[] },
  db: Db = defaultDb
): Promise<QuizAttempt> {
  const rows = await db
    .insert(quizAttempts)
    .values({
      quizId: input.quizId,
      userId: input.userId,
      questionsSnapshot: input.questionsSnapshot,
      totalQuestions: input.questionsSnapshot.length,
    })
    .returning();
  return rows[0];
}

export async function getAttemptById(id: string, userId: string, db: Db = defaultDb): Promise<QuizAttempt | null> {
  const rows = await db
    .select()
    .from(quizAttempts)
    .where(and(eq(quizAttempts.id, id), eq(quizAttempts.userId, userId)));
  return rows[0] ?? null;
}

export async function listAttemptsByQuiz(quizId: string, userId: string, db: Db = defaultDb): Promise<QuizAttempt[]> {
  return db
    .select()
    .from(quizAttempts)
    .where(and(eq(quizAttempts.quizId, quizId), eq(quizAttempts.userId, userId), eq(quizAttempts.status, "completed")))
    .orderBy(desc(quizAttempts.finishedAt));
}

export async function recordAnswer(
  input: {
    attemptId: string;
    questionIndex: number;
    questionType: AttemptAnswer["questionType"];
    word: string;
    meaning: string;
    userAnswer: string;
    isCorrect: boolean;
    aiFeedback?: string | null;
  },
  db: Db = defaultDb
): Promise<QuizAttempt> {
  await db.insert(attemptAnswers).values({
    attemptId: input.attemptId,
    questionIndex: input.questionIndex,
    questionType: input.questionType,
    word: input.word,
    meaning: input.meaning,
    userAnswer: input.userAnswer,
    isCorrect: input.isCorrect,
    aiFeedback: input.aiFeedback ?? null,
  });

  const [attempt] = await db.select().from(quizAttempts).where(eq(quizAttempts.id, input.attemptId));
  const nextIndex = attempt.currentIndex + 1;
  const isDone = nextIndex >= attempt.totalQuestions;

  let score: number | null = null;
  if (isDone) {
    const answers = await db.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, input.attemptId));
    score = answers.filter((answer) => answer.isCorrect).length;
  }

  const rows = await db
    .update(quizAttempts)
    .set({
      currentIndex: nextIndex,
      ...(isDone ? { status: "completed" as const, finishedAt: new Date(), score } : {}),
    })
    .where(eq(quizAttempts.id, input.attemptId))
    .returning();
  return rows[0];
}

export async function listAnswersByAttempt(attemptId: string, db: Db = defaultDb): Promise<AttemptAnswer[]> {
  return db.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, attemptId)).orderBy(asc(attemptAnswers.questionIndex));
}
