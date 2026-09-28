"use server";

import { createQuizSchema } from "../model/schema";
import { getFolderById } from "@/entities/folder";
import { listVocabItemsByFolder } from "@/entities/vocab-item";
import { createQuiz, deleteQuiz } from "@/entities/quiz";
import { buildQuizQuestions, createQuizQuestions } from "@/entities/quiz-question";
import { auth } from "@/_app/api-routes/auth";
import { db as defaultDb } from "@/shared/api";
import { safeRevalidatePath } from "@/shared/lib/safe-revalidate-path";

export type CreateQuizResult = { ok: true; id: string } | { ok: false; error: string };

type Db = Parameters<typeof getFolderById>[2];

export async function createQuizAction(input: unknown, dbInstance: Db = defaultDb): Promise<CreateQuizResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = createQuizSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  try {
    const folder = await getFolderById(data.folderId, session.user.id, dbInstance);
    if (!folder) {
      return { ok: false, error: "Folder not found" };
    }

    const folderItems = await listVocabItemsByFolder(data.folderId, dbInstance);
    const folderItemIds = new Set(folderItems.map((item) => item.id));
    if (!data.vocabItemIds.every((id) => folderItemIds.has(id))) {
      return { ok: false, error: "One or more selected words no longer belong to this folder" };
    }

    const needsChoices = data.questionTypes.includes("meaning") || data.questionTypes.includes("word");
    if (needsChoices && folderItems.length < 2) {
      return { ok: false, error: "Add at least 2 words to this folder to use meaning or word questions" };
    }

    const selectedItems = folderItems.filter((item) => data.vocabItemIds.includes(item.id));

    const quiz = await createQuiz(
      {
        folderId: data.folderId,
        userId: session.user.id,
        name: data.name,
        questionTypes: data.questionTypes,
        vocabItemIds: data.vocabItemIds,
        shuffleQuestions: data.shuffleQuestions,
        shuffleAnswers: data.shuffleAnswers,
      },
      dbInstance
    );

    // The production DB client (drizzle-orm/neon-http) doesn't support real
    // transactions, so instead of wrapping this in `dbInstance.transaction`,
    // a failure creating the questions is compensated for by deleting the
    // just-created quiz row. This avoids leaving a permanently orphaned,
    // question-less quiz behind (this plan ships no delete feature, so such
    // a row would be unrecoverable by the user).
    try {
      const questions = buildQuizQuestions({
        selectedItems,
        questionTypes: data.questionTypes,
        distractorPool: folderItems,
      });
      await createQuizQuestions(quiz.id, questions, dbInstance);
    } catch (err) {
      // Best-effort cleanup; don't let a cleanup failure mask the original error.
      await deleteQuiz(quiz.id, dbInstance).catch(() => {});
      throw err;
    }

    safeRevalidatePath("/quiz");
    return { ok: true, id: quiz.id };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
