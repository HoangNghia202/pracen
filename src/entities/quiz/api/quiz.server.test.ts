import { createTestDb } from "@/shared/testing";
import { createUser } from "@/entities/user";
import { createFolder } from "@/entities/folder";
import { quizQuestions, folders } from "@/shared/api";
import { eq } from "drizzle-orm";
import { createQuiz, listQuizzesByUser, getQuizById } from "./quiz.server";

async function makeFolder(db: Awaited<ReturnType<typeof createTestDb>>, email = "owner@example.com") {
  const user = await createUser({ email, passwordHash: "hash" }, db);
  const folder = await createFolder({ userId: user.id, name: "Animals" }, db);
  return { userId: user.id, folderId: folder.id };
}

const baseInput = {
  name: "Animal Quiz",
  questionTypes: ["meaning"] as const,
  vocabItemIds: ["v1"],
  shuffleQuestions: false,
  shuffleAnswers: false,
};

describe("quiz entity", () => {
  it("creates a quiz and finds it by id, scoped to its owner", async () => {
    const db = await createTestDb();
    const { userId, folderId } = await makeFolder(db);
    const other = await createUser({ email: "other@example.com", passwordHash: "hash" }, db);

    const quiz = await createQuiz({ ...baseInput, folderId, userId, questionTypes: [...baseInput.questionTypes] }, db);

    const found = await getQuizById(quiz.id, userId, db);
    expect(found).toMatchObject({ name: "Animal Quiz", folderId, userId });

    expect(await getQuizById(quiz.id, other.id, db)).toBeNull();
  });

  it("lists only the requesting user's quizzes, with folder name and question count", async () => {
    const db = await createTestDb();
    const { userId, folderId } = await makeFolder(db);
    const other = await createUser({ email: "other@example.com", passwordHash: "hash" }, db);
    const otherFolder = await createFolder({ userId: other.id, name: "Other" }, db);

    const quiz = await createQuiz(
      { ...baseInput, folderId, userId, questionTypes: [...baseInput.questionTypes] },
      db
    );
    await db.insert(quizQuestions).values([
      {
        quizId: quiz.id,
        orderIndex: 0,
        questionType: "meaning",
        vocabItemId: "v1",
        word: "Dog",
        meaning: "A domesticated canine",
        choices: null,
      },
      {
        quizId: quiz.id,
        orderIndex: 1,
        questionType: "word",
        vocabItemId: "v1",
        word: "Dog",
        meaning: "A domesticated canine",
        choices: null,
      },
    ]);
    await createQuiz(
      {
        ...baseInput,
        folderId: otherFolder.id,
        userId: other.id,
        name: "Someone else's quiz",
        questionTypes: ["word"],
      },
      db
    );

    const list = await listQuizzesByUser(userId, {}, db);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: quiz.id, name: "Animal Quiz", folderName: "Animals", questionCount: 2 });
  });

  it("filters by name search and by folder", async () => {
    const db = await createTestDb();
    const { userId, folderId } = await makeFolder(db);
    const secondFolder = await createFolder({ userId, name: "Colors" }, db);

    await createQuiz({ ...baseInput, folderId, userId, name: "Animal Quiz", questionTypes: ["meaning"] }, db);
    await createQuiz(
      { ...baseInput, folderId: secondFolder.id, userId, name: "Color Quiz", questionTypes: ["word"] },
      db
    );

    expect((await listQuizzesByUser(userId, { search: "animal" }, db)).map((q) => q.name)).toEqual(["Animal Quiz"]);
    expect((await listQuizzesByUser(userId, { folderId: secondFolder.id }, db)).map((q) => q.name)).toEqual([
      "Color Quiz",
    ]);
  });

  it("cascades quiz deletion when the parent folder is deleted", async () => {
    const db = await createTestDb();
    const { userId, folderId } = await makeFolder(db);
    const quiz = await createQuiz(
      { ...baseInput, folderId, userId, questionTypes: [...baseInput.questionTypes] },
      db
    );

    await db.delete(folders).where(eq(folders.id, folderId));

    expect(await getQuizById(quiz.id, userId, db)).toBeNull();
  });
});
