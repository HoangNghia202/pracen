import { createTestDb } from "@/shared/testing";
import { createUser } from "@/entities/user";
import { createFolder } from "@/entities/folder";
import { createQuiz } from "@/entities/quiz";
import { quizzes } from "@/shared/api";
import { eq } from "drizzle-orm";
import { createQuizQuestions, listQuestionsByQuiz, getQuestionById } from "./quiz-question.server";

async function makeQuiz(db: Awaited<ReturnType<typeof createTestDb>>) {
  const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
  const folder = await createFolder({ userId: user.id, name: "Animals" }, db);
  const quiz = await createQuiz(
    {
      folderId: folder.id,
      userId: user.id,
      name: "Animal Quiz",
      questionTypes: ["meaning"],
      vocabItemIds: ["v1"],
      shuffleQuestions: false,
      shuffleAnswers: false,
    },
    db
  );
  return quiz.id;
}

describe("quiz question entity", () => {
  it("bulk-creates questions and lists them back in orderIndex order", async () => {
    const db = await createTestDb();
    const quizId = await makeQuiz(db);

    await createQuizQuestions(
      quizId,
      [
        { orderIndex: 1, questionType: "meaning", vocabItemId: "v2", word: "Cat", meaning: "A cat", choices: null },
        { orderIndex: 0, questionType: "meaning", vocabItemId: "v1", word: "Dog", meaning: "A dog", choices: null },
      ],
      db
    );

    const list = await listQuestionsByQuiz(quizId, db);
    expect(list.map((q) => q.word)).toEqual(["Dog", "Cat"]);
  });

  it("returns an empty array for zero questions", async () => {
    const db = await createTestDb();
    const quizId = await makeQuiz(db);
    expect(await createQuizQuestions(quizId, [], db)).toEqual([]);
  });

  it("stores and returns MCQ choices as structured data", async () => {
    const db = await createTestDb();
    const quizId = await makeQuiz(db);
    const choices = [
      { id: "v1", word: "Dog", meaning: "A dog" },
      { id: "v2", word: "Cat", meaning: "A cat" },
    ];
    const [created] = await createQuizQuestions(
      quizId,
      [{ orderIndex: 0, questionType: "meaning", vocabItemId: "v1", word: "Dog", meaning: "A dog", choices }],
      db
    );

    expect((await getQuestionById(created.id, db))?.choices).toEqual(choices);
  });

  it("cascades question deletion when the parent quiz is deleted", async () => {
    const db = await createTestDb();
    const quizId = await makeQuiz(db);
    const [created] = await createQuizQuestions(
      quizId,
      [{ orderIndex: 0, questionType: "sentence", vocabItemId: "v1", word: "Dog", meaning: "A dog", choices: null }],
      db
    );

    await db.delete(quizzes).where(eq(quizzes.id, quizId));

    expect(await getQuestionById(created.id, db)).toBeNull();
  });
});
