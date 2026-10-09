"use server";

import { deleteFolder } from "@/entities/folder";
import { auth } from "@/_app/api-routes/auth";
import { db as defaultDb } from "@/shared/api";
import { safeRevalidatePath } from "@/shared/lib/safe-revalidate-path";

export type DeleteFolderResult = { ok: true } | { ok: false; error: string };

type Db = Parameters<typeof deleteFolder>[1];

export async function deleteFolderAction(
  folderId: string,
  dbInstance: Db = defaultDb
): Promise<DeleteFolderResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "You must be signed in." };
  }

  try {
    const deleted = await deleteFolder({ id: folderId, userId: session.user.id }, dbInstance);
    if (!deleted) {
      return { ok: false, error: "Folder not found" };
    }
    safeRevalidatePath("/library");
    return { ok: true };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
