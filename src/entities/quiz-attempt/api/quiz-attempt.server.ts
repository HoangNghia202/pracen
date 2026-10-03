import { db as defaultDb, quizAttempts, attemptAnswers, quizzes, schema } from "@/shared/api";
import { and, asc, count, desc, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { AttemptAnswer, AttemptWithQuizName, QuestionSnapshotItem, QuizAttempt } from "../model/types";

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

function selectAttemptWithQuizName(db: Db) {
  return db
    .select({
      id: quizAttempts.id,
      quizId: quizAttempts.quizId,
      quizName: quizzes.name,
      status: quizAttempts.status,
      currentIndex: quizAttempts.currentIndex,
      totalQuestions: quizAttempts.totalQuestions,
      score: quizAttempts.score,
      startedAt: quizAttempts.startedAt,
      finishedAt: quizAttempts.finishedAt,
    })
    .from(quizAttempts)
    .innerJoin(quizzes, eq(quizzes.id, quizAttempts.quizId));
}

export async function listInProgressAttempts(userId: string, db: Db = defaultDb): Promise<AttemptWithQuizName[]> {
  return selectAttemptWithQuizName(db)
    .where(and(eq(quizAttempts.userId, userId), eq(quizAttempts.status, "in_progress")))
    .orderBy(desc(quizAttempts.startedAt));
}

export async function listRecentCompletedAttempts(
  userId: string,
  limit: number,
  db: Db = defaultDb
): Promise<AttemptWithQuizName[]> {
  return selectAttemptWithQuizName(db)
    .where(and(eq(quizAttempts.userId, userId), eq(quizAttempts.status, "completed")))
    .orderBy(desc(quizAttempts.finishedAt))
    .limit(limit);
}

export async function getCompletedAttemptCount(userId: string, db: Db = defaultDb): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(quizAttempts)
    .where(and(eq(quizAttempts.userId, userId), eq(quizAttempts.status, "completed")));
  return rows[0]?.value ?? 0;
}
