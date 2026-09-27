import { db as defaultDb, vocabItems, schema } from "@/shared/api";
import { asc, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { NewVocabItem, VocabItem } from "../model/types";

type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export async function listVocabItemsByFolder(folderId: string, db: Db = defaultDb): Promise<VocabItem[]> {
  return db
    .select()
    .from(vocabItems)
    .where(eq(vocabItems.folderId, folderId))
    .orderBy(asc(vocabItems.createdAt));
}

export async function createVocabItem(
  input: NewVocabItem & { folderId: string },
  db: Db = defaultDb
): Promise<VocabItem> {
  const rows = await db
    .insert(vocabItems)
    .values({
      folderId: input.folderId,
      word: input.word,
      meaning: input.meaning,
      example: input.example ?? null,
      partOfSpeech: input.partOfSpeech ?? null,
    })
    .returning();
  return rows[0];
}

export async function createVocabItems(
  folderId: string,
  items: NewVocabItem[],
  db: Db = defaultDb
): Promise<VocabItem[]> {
  if (items.length === 0) return [];
  return db
    .insert(vocabItems)
    .values(
      items.map((item) => ({
        folderId,
        word: item.word,
        meaning: item.meaning,
        example: item.example ?? null,
        partOfSpeech: item.partOfSpeech ?? null,
      }))
    )
    .returning();
}

export async function getVocabItemById(id: string, db: Db = defaultDb): Promise<VocabItem | null> {
  const rows = await db.select().from(vocabItems).where(eq(vocabItems.id, id));
  return rows[0] ?? null;
}

export async function updateVocabItem(
  input: { id: string } & Partial<NewVocabItem>,
  db: Db = defaultDb
): Promise<VocabItem | null> {
  const rows = await db
    .update(vocabItems)
    .set({
      ...(input.word !== undefined ? { word: input.word } : {}),
      ...(input.meaning !== undefined ? { meaning: input.meaning } : {}),
      ...(input.example !== undefined ? { example: input.example } : {}),
      ...(input.partOfSpeech !== undefined ? { partOfSpeech: input.partOfSpeech } : {}),
    })
    .where(eq(vocabItems.id, input.id))
    .returning();
  return rows[0] ?? null;
}

export async function deleteVocabItem(id: string, db: Db = defaultDb): Promise<boolean> {
  const rows = await db.delete(vocabItems).where(eq(vocabItems.id, id)).returning();
  return rows.length > 0;
}
