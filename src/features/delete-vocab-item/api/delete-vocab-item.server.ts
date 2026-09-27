"use server";

import { getFolderById, touchFolder } from "@/entities/folder";
import { deleteVocabItem, getVocabItemById } from "@/entities/vocab-item";
import { auth } from "@/_app/api-routes/auth";
import { db as defaultDb } from "@/shared/api";
import { safeRevalidatePath } from "@/shared/lib/safe-revalidate-path";

export type DeleteVocabItemResult = { ok: true } | { ok: false; error: string };

type Db = Parameters<typeof getFolderById>[2];

export async function deleteVocabItemAction(
  itemId: string,
  dbInstance: Db = defaultDb
): Promise<DeleteVocabItemResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "You must be signed in." };
  }

  try {
    const item = await getVocabItemById(itemId, dbInstance);
    if (!item) {
      return { ok: false, error: "Word not found" };
    }
    const folder = await getFolderById(item.folderId, session.user.id, dbInstance);
    if (!folder) {
      return { ok: false, error: "Word not found" };
    }

    await deleteVocabItem(itemId, dbInstance);
    await touchFolder(item.folderId, dbInstance);
    safeRevalidatePath(`/library/${item.folderId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
