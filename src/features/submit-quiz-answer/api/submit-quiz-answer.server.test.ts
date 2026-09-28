import { createTestDb } from "@/shared/testing";
import { vi } from "vitest";
import { auth } from "@/_app/api-routes/auth";
import { createUser } from "@/entities/user";
import { createFolder } from "@/entities/folder";
import { createQuiz } from "@/entities/quiz";
import { createQuizQuestions } from "@/entities/quiz-question";
import { createAttempt } from "@/entities/quiz-attempt";
import { gradeSentenceAnswer } from "@/features/grade-sentence-answer";
import { submitAnswerAction } from "./submit-quiz-answer.server";

vi.mock("@/_app/api-routes/auth", () => ({ auth: vi.fn() }));
vi.mock("@/features/grade-sentence-answer", () => ({ gradeSentenceAnswer: vi.fn() }));

async function setup(db: Awaited<ReturnType<typeof createTestDb>>) {
  const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
  const folder = await createFolder({ userId: user.id, name: "Animals" }, db);
  const quiz = await createQuiz(
    { folderId: folder.id, userId: user.id, name: "Animal Quiz", questionTypes: ["meaning", "sentence"], vocabItemIds: ["v1"], shuffleQuestions: false, shuffleAnswers: false },
    db
  );
  const questions = await createQuizQuestions(
    quiz.id,
    [
      {
        orderIndex: 0,
        questionType: "meaning",
        vocabItemId: "v1",
        word: "Dog",
        meaning: "A dog",
        choices: [
          { id: "v1", word: "Dog", meaning: "A dog" },
          { id: "v2", word: "Cat", meaning: "A cat" },
        ],
      },
      { orderIndex: 1, questionType: "sentence", vocabItemId: "v1", word: "Dog", meaning: "A dog", choices: null },
    ],
    db
  );
  const attempt = await createAttempt(
    { quizId: quiz.id, userId: user.id, questionsSnapshot: questions.map((q) => ({ questionId: q.id, choiceOrder: q.choices?.map((c) => c.id) ?? null })) },
    db
  );
  vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);
  return { userId: user.id, attemptId: attempt.id };
}

describe("submitAnswerAction", () => {
  it("grades an MCQ answer correct when it matches the target word", async () => {
    const db = await createTestDb();
    const { attemptId } = await setup(db);

    const result = await submitAnswerAction(attemptId, { questionIndex: 0, userAnswer: "v1" }, db);

    expect(result).toMatchObject({ ok: true, isCorrect: true, aiFeedback: null, completed: false });
  });

  it("grades an MCQ answer incorrect when it doesn't match", async () => {
    const db = await createTestDb();
    const { attemptId } = await setup(db);

    const result = await submitAnswerAction(attemptId, { questionIndex: 0, userAnswer: "v2" }, db);

    expect(result).toMatchObject({ ok: true, isCorrect: false });
  });

  it("grades a sentence answer via the AI feature and surfaces its feedback", async () => {
    const db = await createTestDb();
    const { attemptId } = await setup(db);
    vi.mocked(gradeSentenceAnswer).mockResolvedValue({ isCorrect: true, feedback: "Nicely done." });
    await submitAnswerAction(attemptId, { questionIndex: 0, userAnswer: "v1" }, db); // consume question 0 first

    const result = await submitAnswerAction(attemptId, { questionIndex: 1, userAnswer: "I walked my dog." }, db);

    expect(result).toMatchObject({ ok: true, isCorrect: true, aiFeedback: "Nicely done.", completed: true, score: 2 });
  });

  it("rejects resubmitting an already-answered question", async () => {
    const db = await createTestDb();
    const { attemptId } = await setup(db);
    await submitAnswerAction(attemptId, { questionIndex: 0, userAnswer: "v1" }, db);

    const result = await submitAnswerAction(attemptId, { questionIndex: 0, userAnswer: "v1" }, db);

    expect(result).toMatchObject({ ok: false });
  });

  it("rejects submitting to an already-completed attempt", async () => {
    const db = await createTestDb();
    const { attemptId } = await setup(db);
    vi.mocked(gradeSentenceAnswer).mockResolvedValue({ isCorrect: true, feedback: "Nicely done." });
    await submitAnswerAction(attemptId, { questionIndex: 0, userAnswer: "v1" }, db);
    await submitAnswerAction(attemptId, { questionIndex: 1, userAnswer: "I walked my dog." }, db);

    const result = await submitAnswerAction(attemptId, { questionIndex: 2, userAnswer: "anything" }, db);

    expect(result).toMatchObject({ ok: false });
  });

  it("rejects an attempt that doesn't belong to the requester", async () => {
    const db = await createTestDb();
    const { attemptId } = await setup(db);
    const intruder = await createUser({ email: "intruder@example.com", passwordHash: "hash" }, db);
    vi.mocked(auth).mockResolvedValue({ user: { id: intruder.id } } as never);

    expect(await submitAnswerAction(attemptId, { questionIndex: 0, userAnswer: "v1" }, db)).toMatchObject({ ok: false });
  });
});
