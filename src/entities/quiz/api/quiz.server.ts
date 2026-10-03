import { db as defaultDb, quizzes, quizQuestions, folders, schema } from "@/shared/api";
import { and, count, desc, eq, ilike } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Quiz, QuestionType, QuizWithMeta } from "../model/types";

type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export async function createQuiz(
  input: {
    folderId: string;
    userId: string;
    name: string;
    questionTypes: QuestionType[];
    vocabItemIds: string[];
    shuffleQuestions: boolean;
    shuffleAnswers: boolean;
  },
  db: Db = defaultDb
): Promise<Quiz> {
  const rows = await db.insert(quizzes).values(input).returning();
  return rows[0];
}

export async function listQuizzesByUser(
  userId: string,
  options: { search?: string; folderId?: string } = {},
  db: Db = defaultDb
): Promise<QuizWithMeta[]> {
  const { search, folderId } = options;

  const conditions = [eq(quizzes.userId, userId)];
  if (search && search.trim().length > 0) {
    conditions.push(ilike(quizzes.name, `%${search.trim()}%`));
  }
  if (folderId) {
    conditions.push(eq(quizzes.folderId, folderId));
  }

  return db
    .select({
      id: quizzes.id,
      folderId: quizzes.folderId,
      userId: quizzes.userId,
      name: quizzes.name,
      questionTypes: quizzes.questionTypes,
      vocabItemIds: quizzes.vocabItemIds,
      shuffleQuestions: quizzes.shuffleQuestions,
      shuffleAnswers: quizzes.shuffleAnswers,
      createdAt: quizzes.createdAt,
      updatedAt: quizzes.updatedAt,
      folderName: folders.name,
      questionCount: count(quizQuestions.id),
    })
    .from(quizzes)
    .innerJoin(folders, eq(folders.id, quizzes.folderId))
    .leftJoin(quizQuestions, eq(quizQuestions.quizId, quizzes.id))
    .where(and(...conditions))
    .groupBy(quizzes.id, folders.name)
    .orderBy(desc(quizzes.createdAt));
}

export async function getQuizById(id: string, userId: string, db: Db = defaultDb): Promise<Quiz | null> {
  const rows = await db
    .select()
    .from(quizzes)
    .where(and(eq(quizzes.id, id), eq(quizzes.userId, userId)));
  return rows[0] ?? null;
}

// Internal cleanup helper only — not a user-facing "delete quiz" feature.
// Unlike `deleteFolder`, this is not ownership-scoped: it exists solely so
// `createQuizAction` can compensate (remove the just-created quiz row) when
// question creation fails partway through, since the production DB driver
// doesn't support real transactions. Nothing else should call this.
export async function deleteQuiz(id: string, db: Db = defaultDb): Promise<boolean> {
  const rows = await db.delete(quizzes).where(eq(quizzes.id, id)).returning();
  return rows.length > 0;
}

export async function getQuizCountByUser(userId: string, db: Db = defaultDb): Promise<number> {
  const rows = await db.select({ value: count() }).from(quizzes).where(eq(quizzes.userId, userId));
  return rows[0]?.value ?? 0;
}
