"use server";

import { addVocabManualSchema } from "../model/schema";
import { getFolderById, touchFolder } from "@/entities/folder";
import { createVocabItem } from "@/entities/vocab-item";
import { auth } from "@/_app/api-routes/auth";
import { db as defaultDb } from "@/shared/api";
import { safeRevalidatePath } from "@/shared/lib/safe-revalidate-path";

export type AddVocabManualResult = { ok: true } | { ok: false; error: string };

type Db = Parameters<typeof getFolderById>[2];

export async function addVocabManualAction(
  folderId: string,
  input: unknown,
  dbInstance: Db = defaultDb
): Promise<AddVocabManualResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = addVocabManualSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const folder = await getFolderById(folderId, session.user.id, dbInstance);
    if (!folder) {
      return { ok: false, error: "Folder not found" };
    }

    await createVocabItem(
      {
        folderId,
        word: parsed.data.word,
        meaning: parsed.data.meaning,
        example: parsed.data.example || undefined,
        partOfSpeech: parsed.data.partOfSpeech || undefined,
      },
      dbInstance
    );
    await touchFolder(folderId, dbInstance);
    safeRevalidatePath(`/library/${folderId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
