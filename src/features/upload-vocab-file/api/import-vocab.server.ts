"use server";

import { getFolderById, touchFolder } from "@/entities/folder";
import { createVocabItems } from "@/entities/vocab-item";
import { auth } from "@/_app/api-routes/auth";
import { db as defaultDb } from "@/shared/api";
import { safeRevalidatePath } from "@/shared/lib/safe-revalidate-path";
import { importVocabRowsSchema } from "../model/schema";
import type { ParsedVocabRow } from "../model/parse-vocab-file";

export type ImportVocabResult = { ok: true; count: number } | { ok: false; error: string };

type Db = Parameters<typeof getFolderById>[2];

export async function importVocabAction(
  folderId: string,
  rows: ParsedVocabRow[],
  dbInstance: Db = defaultDb
): Promise<ImportVocabResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = importVocabRowsSchema.safeParse(rows);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const folder = await getFolderById(folderId, session.user.id, dbInstance);
    if (!folder) {
      return { ok: false, error: "Folder not found" };
    }

    const created = await createVocabItems(folderId, parsed.data, dbInstance);
    await touchFolder(folderId, dbInstance);
    safeRevalidatePath(`/library/${folderId}`);
    return { ok: true, count: created.length };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
