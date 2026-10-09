"use server";

import { renameFolderSchema } from "../model/schema";
import { renameFolder } from "@/entities/folder";
import { auth } from "@/_app/api-routes/auth";
import { db as defaultDb } from "@/shared/api";
import { safeRevalidatePath } from "@/shared/lib/safe-revalidate-path";

export type RenameFolderResult = { ok: true } | { ok: false; error: string };

type Db = Parameters<typeof renameFolder>[1];

export async function renameFolderAction(
  folderId: string,
  input: unknown,
  dbInstance: Db = defaultDb
): Promise<RenameFolderResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = renameFolderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const renamed = await renameFolder(
      { id: folderId, userId: session.user.id, name: parsed.data.name },
      dbInstance
    );
    if (!renamed) {
      return { ok: false, error: "Folder not found" };
    }
    safeRevalidatePath("/library");
    safeRevalidatePath(`/library/${folderId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
