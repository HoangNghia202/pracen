import { db as defaultDb, folders, vocabItems, schema } from "@/shared/api";
import { and, count, desc, eq, ilike, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Folder, FolderSort, FolderWithStats } from "../model/types";

type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export async function listFoldersByUser(
  userId: string,
  options: { search?: string; sort?: FolderSort } = {},
  db: Db = defaultDb
): Promise<FolderWithStats[]> {
  const { search, sort = "recently-edited" } = options;

  const conditions = [eq(folders.userId, userId)];
  if (search && search.trim().length > 0) {
    conditions.push(ilike(folders.name, `%${search.trim()}%`));
  }

  return db
    .select({
      id: folders.id,
      userId: folders.userId,
      name: folders.name,
      createdAt: folders.createdAt,
      updatedAt: folders.updatedAt,
      wordCount: count(vocabItems.id),
    })
    .from(folders)
    .leftJoin(vocabItems, eq(vocabItems.folderId, folders.id))
    .where(and(...conditions))
    .groupBy(folders.id)
    .orderBy(sort === "recently-created" ? desc(folders.createdAt) : desc(folders.updatedAt));
}

export async function getFolderById(
  id: string,
  userId: string,
  db: Db = defaultDb
): Promise<Folder | null> {
  const rows = await db
    .select()
    .from(folders)
    .where(and(eq(folders.id, id), eq(folders.userId, userId)));
  return rows[0] ?? null;
}

export async function createFolder(
  input: { userId: string; name: string },
  db: Db = defaultDb
): Promise<Folder> {
  const rows = await db
    .insert(folders)
    .values({ userId: input.userId, name: input.name })
    .returning();
  return rows[0];
}

export async function renameFolder(
  input: { id: string; userId: string; name: string },
  db: Db = defaultDb
): Promise<Folder | null> {
  const rows = await db
    .update(folders)
    .set({ name: input.name, updatedAt: new Date() })
    .where(and(eq(folders.id, input.id), eq(folders.userId, input.userId)))
    .returning();
  return rows[0] ?? null;
}

export async function deleteFolder(
  input: { id: string; userId: string },
  db: Db = defaultDb
): Promise<boolean> {
  const rows = await db
    .delete(folders)
    .where(and(eq(folders.id, input.id), eq(folders.userId, input.userId)))
    .returning();
  return rows.length > 0;
}

export async function touchFolder(id: string, db: Db = defaultDb): Promise<void> {
  await db
    .update(folders)
    .set({ updatedAt: sql`now()` })
    .where(eq(folders.id, id));
}
