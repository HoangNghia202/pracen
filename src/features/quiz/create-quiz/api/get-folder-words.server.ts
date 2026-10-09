"use server";

import { getFolderById } from "@/entities/folder";
import { listVocabItemsByFolder, type VocabItem } from "@/entities/vocab-item";
import { auth } from "@/_app/api-routes/auth";
import { db as defaultDb } from "@/shared/api";

export type GetFolderWordsResult = { ok: true; items: VocabItem[] } | { ok: false; error: string };

type Db = Parameters<typeof getFolderById>[2];

export async function getFolderWordsAction(
  folderId: string,
  dbInstance: Db = defaultDb
): Promise<GetFolderWordsResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "You must be signed in." };
  }

  const folder = await getFolderById(folderId, session.user.id, dbInstance);
  if (!folder) {
    return { ok: false, error: "Folder not found" };
  }

  const items = await listVocabItemsByFolder(folderId, dbInstance);
  return { ok: true, items };
}
