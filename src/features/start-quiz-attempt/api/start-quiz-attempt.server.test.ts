import { createTestDb } from "@/shared/testing";
import { vi } from "vitest";
import { auth } from "@/_app/api-routes/auth";
import { createUser } from "@/entities/user";
import { createFolder } from "@/entities/folder";
import { createQuiz } from "@/entities/quiz";
import { createQuizQuestions } from "@/entities/quiz-question";
import { getInProgressAttempt } from "@/entities/quiz-attempt";
import { startQuizAttemptAction } from "./start-quiz-attempt.server";

vi.mock("@/_app/api-routes/auth", () => ({ auth: vi.fn() }));

async function setup(db: Awaited<ReturnType<typeof createTestDb>>) {
  const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
  const folder = await createFolder({ userId: user.id, name: "Animals" }, db);
  const quiz = await createQuiz(
    { folderId: folder.id, userId: user.id, name: "Animal Quiz", questionTypes: ["meaning"], vocabItemIds: ["v1"], shuffleQuestions: false, shuffleAnswers: false },
    db
  );
  await createQuizQuestions(quiz.id, [{ orderIndex: 0, questionType: "meaning", vocabItemId: "v1", word: "Dog", meaning: "A dog", choices: null }], db);
  vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);
  return { userId: user.id, quizId: quiz.id };
}

describe("startQuizAttemptAction", () => {
  it("creates a new in-progress attempt when none exists", async () => {
    const db = await createTestDb();
    const { quizId, userId } = await setup(db);

    const result = await startQuizAttemptAction(quizId, db);

    expect(result).toMatchObject({ ok: true });
    const attempt = await getInProgressAttempt(quizId, userId, db);
    expect(attempt).not.toBeNull();
    expect(result.ok && result.attemptId).toBe(attempt!.id);
  });

  it("returns the existing in-progress attempt instead of creating a second one", async () => {
    const db = await createTestDb();
    const { quizId } = await setup(db);

    const first = await startQuizAttemptAction(quizId, db);
    const second = await startQuizAttemptAction(quizId, db);

    expect(first.ok && second.ok && first.attemptId).toBe(second.ok && second.attemptId);
  });

  it("rejects a quiz the requester doesn't own", async () => {
    const db = await createTestDb();
    const { quizId } = await setup(db);
    const intruder = await createUser({ email: "intruder@example.com", passwordHash: "hash" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: intruder.id } } as never);

    expect(await startQuizAttemptAction(quizId, db)).toMatchObject({ ok: false });
  });

  it("rejects the call when there is no session", async () => {
    const db = await createTestDb();
    vi.mocked(auth).mockResolvedValue(null);
    expect(await startQuizAttemptAction("q1", db)).toMatchObject({ ok: false });
  });
});
