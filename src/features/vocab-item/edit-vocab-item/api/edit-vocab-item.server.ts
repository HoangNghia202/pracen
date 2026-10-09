"use server";

import { editVocabItemSchema } from "../model/schema";
import { getFolderById, touchFolder } from "@/entities/folder";
import { getVocabItemById, updateVocabItem } from "@/entities/vocab-item";
import { auth } from "@/_app/api-routes/auth";
import { db as defaultDb } from "@/shared/api";
import { safeRevalidatePath } from "@/shared/lib/safe-revalidate-path";

export type EditVocabItemResult = { ok: true } | { ok: false; error: string };

type Db = Parameters<typeof getFolderById>[2];

export async function editVocabItemAction(
  itemId: string,
  input: unknown,
  dbInstance: Db = defaultDb
): Promise<EditVocabItemResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = editVocabItemSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
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

    await updateVocabItem(
      {
        id: itemId,
        word: parsed.data.word,
        meaning: parsed.data.meaning,
        example: parsed.data.example || null,
        partOfSpeech: parsed.data.partOfSpeech || null,
      },
      dbInstance
    );
    await touchFolder(item.folderId, dbInstance);
    safeRevalidatePath(`/library/${item.folderId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
