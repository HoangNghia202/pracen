"use server";

import { createQuizSchema } from "../model/schema";
import { getFolderById } from "@/entities/folder";
import { listVocabItemsByFolder } from "@/entities/vocab-item";
import { createQuiz } from "@/entities/quiz";
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

    // Wrapped in a transaction so a failure creating the questions can never
    // leave a permanently orphaned, question-less quiz row behind (this plan
    // ships no delete feature, so such a row would be unrecoverable by the
    // user). NOTE: this only provides real atomicity against a
    // transaction-capable driver (e.g. the PGlite driver used in tests). The
    // production client in src/shared/api/db/client.ts uses
    // drizzle-orm/neon-http, whose `.transaction()` unconditionally throws
    // "No transactions support in neon-http driver" — see
    // node_modules/drizzle-orm/neon-http/session.ts. Flagged as a concern in
    // the fix report; needs a follow-up decision (e.g. moving the production
    // client to a transaction-capable Neon driver) before this can be relied
    // on outside tests.
    const quiz = await dbInstance.transaction(async (tx) => {
      const createdQuiz = await createQuiz(
        {
          folderId: data.folderId,
          userId: session.user.id,
          name: data.name,
          questionTypes: data.questionTypes,
          vocabItemIds: data.vocabItemIds,
          shuffleQuestions: data.shuffleQuestions,
          shuffleAnswers: data.shuffleAnswers,
        },
        tx
      );

      const questions = buildQuizQuestions({
        selectedItems,
        questionTypes: data.questionTypes,
        distractorPool: folderItems,
      });
      await createQuizQuestions(createdQuiz.id, questions, tx);

      return createdQuiz;
    });

    safeRevalidatePath("/quiz");
    return { ok: true, id: quiz.id };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
