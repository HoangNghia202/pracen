import { createTestDb } from "@/shared/testing";
import { vi } from "vitest";
import { auth } from "@/_app/api-routes/auth";
import { createUser } from "@/entities/user";
import { createFolder } from "@/entities/folder";
import { createVocabItem } from "@/entities/vocab-item";
import { listQuestionsByQuiz } from "@/entities/quiz-question";
import { createQuizAction } from "./create-quiz.server";

vi.mock("@/_app/api-routes/auth", () => ({ auth: vi.fn() }));

async function setup(db: Awaited<ReturnType<typeof createTestDb>>) {
  const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
  const folder = await createFolder({ userId: user.id, name: "Animals" }, db);
  const dog = await createVocabItem({ folderId: folder.id, word: "Dog", meaning: "A dog" }, db);
  const cat = await createVocabItem({ folderId: folder.id, word: "Cat", meaning: "A cat" }, db);
  vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);
  return { userId: user.id, folderId: folder.id, dog, cat };
}

describe("createQuizAction", () => {
  it("creates a quiz and its questions for a valid meaning+word request", async () => {
    const db = await createTestDb();
    const { folderId, dog, cat } = await setup(db);

    const result = await createQuizAction(
      {
        folderId,
        name: "Animal Quiz",
        vocabItemIds: [dog.id, cat.id],
        questionTypes: ["meaning", "word"],
        shuffleQuestions: false,
        shuffleAnswers: false,
      },
      db
    );

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error("expected ok");
    const questions = await listQuestionsByQuiz(result.id, db);
    expect(questions).toHaveLength(4); // 2 words x 2 types
    expect(questions.every((q) => q.choices?.length === 2)).toBe(true);
  });

  it("allows a sentence-only quiz even with just one word in the folder", async () => {
    const db = await createTestDb();
    const user = await createUser({ email: "solo@example.com", passwordHash: "hash" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);
    const folder = await createFolder({ userId: user.id, name: "Solo" }, db);
    const word = await createVocabItem({ folderId: folder.id, word: "Dog", meaning: "A dog" }, db);

    const result = await createQuizAction(
      {
        folderId: folder.id,
        name: "Solo Quiz",
        vocabItemIds: [word.id],
        questionTypes: ["sentence"],
        shuffleQuestions: false,
        shuffleAnswers: false,
      },
      db
    );

    expect(result).toMatchObject({ ok: true });
  });

  it("rejects meaning/word question types when the folder has fewer than 2 words", async () => {
    const db = await createTestDb();
    const user = await createUser({ email: "solo@example.com", passwordHash: "hash" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);
    const folder = await createFolder({ userId: user.id, name: "Solo" }, db);
    const word = await createVocabItem({ folderId: folder.id, word: "Dog", meaning: "A dog" }, db);

    const result = await createQuizAction(
      {
        folderId: folder.id,
        name: "Solo Quiz",
        vocabItemIds: [word.id],
        questionTypes: ["meaning"],
        shuffleQuestions: false,
        shuffleAnswers: false,
      },
      db
    );

    expect(result).toMatchObject({ ok: false });
  });

  it("rejects a folder the requester doesn't own", async () => {
    const db = await createTestDb();
    const { dog } = await setup(db);
    const intruder = await createUser({ email: "intruder@example.com", passwordHash: "hash" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: intruder.id } } as never);

    const result = await createQuizAction(
      {
        folderId: "does-not-belong-to-intruder",
        name: "Hijack",
        vocabItemIds: [dog.id],
        questionTypes: ["sentence"],
        shuffleQuestions: false,
        shuffleAnswers: false,
      },
      db
    );

    expect(result).toMatchObject({ ok: false });
  });

  it("rejects a vocabItemId that doesn't belong to the target folder", async () => {
    const db = await createTestDb();
    const { userId, folderId } = await setup(db);
    const otherFolder = await createFolder({ userId, name: "Other" }, db);
    const foreignWord = await createVocabItem({ folderId: otherFolder.id, word: "Foreign", meaning: "x" }, db);

    const result = await createQuizAction(
      {
        folderId,
        name: "Tampered",
        vocabItemIds: [foreignWord.id],
        questionTypes: ["sentence"],
        shuffleQuestions: false,
        shuffleAnswers: false,
      },
      db
    );

    expect(result).toMatchObject({ ok: false });
  });

  it("rejects the call when there is no session", async () => {
    const db = await createTestDb();
    vi.mocked(auth).mockResolvedValue(null);

    const result = await createQuizAction(
      {
        folderId: "f1",
        name: "Quiz",
        vocabItemIds: ["v1"],
        questionTypes: ["sentence"],
        shuffleQuestions: false,
        shuffleAnswers: false,
      },
      db
    );

    expect(result).toMatchObject({ ok: false });
  });

  it("allows meaning questions when selecting 1 word from a folder with 3 words (checks folder total, not selection size)", async () => {
    const db = await createTestDb();
    const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);
    const folder = await createFolder({ userId: user.id, name: "Animals" }, db);
    const dog = await createVocabItem({ folderId: folder.id, word: "Dog", meaning: "A dog" }, db);
    const cat = await createVocabItem({ folderId: folder.id, word: "Cat", meaning: "A cat" }, db);
    const bird = await createVocabItem({ folderId: folder.id, word: "Bird", meaning: "A bird" }, db);

    const result = await createQuizAction(
      {
        folderId: folder.id,
        name: "Single Word Quiz",
        vocabItemIds: [dog.id],
        questionTypes: ["meaning"],
        shuffleQuestions: false,
        shuffleAnswers: false,
      },
      db
    );

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error("expected ok");
    const questions = await listQuestionsByQuiz(result.id, db);
    expect(questions).toHaveLength(1); // 1 word x 1 type
  });
});
