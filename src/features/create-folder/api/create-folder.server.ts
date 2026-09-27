"use server";

import { createFolderSchema } from "../model/schema";
import { createFolder, getFolderById } from "@/entities/folder";
import { auth } from "@/_app/api-routes/auth";
import { db as defaultDb } from "@/shared/api";
import { safeRevalidatePath } from "@/shared/lib/safe-revalidate-path";

export type CreateFolderResult = { ok: true; id: string } | { ok: false; error: string };

type Db = Parameters<typeof getFolderById>[2];

export async function createFolderAction(
  input: unknown,
  dbInstance: Db = defaultDb
): Promise<CreateFolderResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = createFolderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const folder = await createFolder({ userId: session.user.id, name: parsed.data.name }, dbInstance);
    safeRevalidatePath("/library");
    return { ok: true, id: folder.id };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
