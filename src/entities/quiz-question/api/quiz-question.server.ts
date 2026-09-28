import { db as defaultDb, quizQuestions, schema } from "@/shared/api";
import { asc, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { NewQuizQuestion, QuizQuestion } from "../model/types";

type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export async function createQuizQuestions(
  quizId: string,
  questions: NewQuizQuestion[],
  db: Db = defaultDb
): Promise<QuizQuestion[]> {
  if (questions.length === 0) return [];
  return db
    .insert(quizQuestions)
    .values(questions.map((question) => ({ quizId, ...question })))
    .returning();
}

export async function listQuestionsByQuiz(quizId: string, db: Db = defaultDb): Promise<QuizQuestion[]> {
  return db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(asc(quizQuestions.orderIndex));
}

export async function getQuestionById(id: string, db: Db = defaultDb): Promise<QuizQuestion | null> {
  const rows = await db.select().from(quizQuestions).where(eq(quizQuestions.id, id));
  return rows[0] ?? null;
}
