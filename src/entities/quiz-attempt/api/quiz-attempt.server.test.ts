import { createTestDb } from "@/shared/testing";
import { createUser } from "@/entities/user";
import { createFolder } from "@/entities/folder";
import { createQuiz } from "@/entities/quiz";
import { createQuizQuestions } from "@/entities/quiz-question";
import {
  getInProgressAttempt,
  createAttempt,
  getAttemptById,
  listAttemptsByQuiz,
  recordAnswer,
  listAnswersByAttempt,
} from "./quiz-attempt.server";

async function makeAttemptReady(db: Awaited<ReturnType<typeof createTestDb>>) {
  const user = await createUser({ email: "owner@example.com", passwordHash: "hash" }, db);
  const folder = await createFolder({ userId: user.id, name: "Animals" }, db);
  const quiz = await createQuiz(
    { folderId: folder.id, userId: user.id, name: "Animal Quiz", questionTypes: ["meaning"], vocabItemIds: ["v1", "v2"], shuffleQuestions: false, shuffleAnswers: false },
    db
  );
  const questions = await createQuizQuestions(
    quiz.id,
    [
      { orderIndex: 0, questionType: "meaning", vocabItemId: "v1", word: "Dog", meaning: "A dog", choices: [{ id: "v1", word: "Dog", meaning: "A dog" }, { id: "v2", word: "Cat", meaning: "A cat" }] },
      { orderIndex: 1, questionType: "meaning", vocabItemId: "v2", word: "Cat", meaning: "A cat", choices: [{ id: "v1", word: "Dog", meaning: "A dog" }, { id: "v2", word: "Cat", meaning: "A cat" }] },
    ],
    db
  );
  return { userId: user.id, quizId: quiz.id, questions };
}

describe("quiz attempt entity", () => {
  it("returns null when there is no in-progress attempt, and the attempt once one exists", async () => {
    const db = await createTestDb();
    const { userId, quizId, questions } = await makeAttemptReady(db);
    expect(await getInProgressAttempt(quizId, userId, db)).toBeNull();

    const snapshot = questions.map((q) => ({ questionId: q.id, choiceOrder: q.choices!.map((c) => c.id) }));
    const attempt = await createAttempt({ quizId, userId, questionsSnapshot: snapshot }, db);

    expect(attempt).toMatchObject({ status: "in_progress", currentIndex: 0, totalQuestions: 2, score: null });
    expect(await getInProgressAttempt(quizId, userId, db)).toMatchObject({ id: attempt.id });
  });

  it("scopes getAttemptById to its owner", async () => {
    const db = await createTestDb();
    const { userId, quizId, questions } = await makeAttemptReady(db);
    const other = await createUser({ email: "other@example.com", passwordHash: "hash" }, db);
    const snapshot = questions.map((q) => ({ questionId: q.id, choiceOrder: null }));
    const attempt = await createAttempt({ quizId, userId, questionsSnapshot: snapshot }, db);

    expect(await getAttemptById(attempt.id, userId, db)).toMatchObject({ id: attempt.id });
    expect(await getAttemptById(attempt.id, other.id, db)).toBeNull();
  });

  it("records an answer, advances currentIndex, and stays in_progress before the last question", async () => {
    const db = await createTestDb();
    const { userId, quizId, questions } = await makeAttemptReady(db);
    const snapshot = questions.map((q) => ({ questionId: q.id, choiceOrder: null }));
    const attempt = await createAttempt({ quizId, userId, questionsSnapshot: snapshot }, db);

    const updated = await recordAnswer(
      { attemptId: attempt.id, questionIndex: 0, questionType: "meaning", word: "Dog", meaning: "A dog", userAnswer: "v1", isCorrect: true },
      db
    );

    expect(updated).toMatchObject({ status: "in_progress", currentIndex: 1, score: null });
  });

  it("completes the attempt and computes the score after the last question", async () => {
    const db = await createTestDb();
    const { userId, quizId, questions } = await makeAttemptReady(db);
    const snapshot = questions.map((q) => ({ questionId: q.id, choiceOrder: null }));
    const attempt = await createAttempt({ quizId, userId, questionsSnapshot: snapshot }, db);

    await recordAnswer({ attemptId: attempt.id, questionIndex: 0, questionType: "meaning", word: "Dog", meaning: "A dog", userAnswer: "v1", isCorrect: true }, db);
    const final = await recordAnswer(
      { attemptId: attempt.id, questionIndex: 1, questionType: "meaning", word: "Cat", meaning: "A cat", userAnswer: "v1", isCorrect: false },
      db
    );

    expect(final).toMatchObject({ status: "completed", currentIndex: 2, score: 1 });
    expect(final.finishedAt).not.toBeNull();
  });

  it("lists only completed attempts for the requesting user, most recent first", async () => {
    const db = await createTestDb();
    const { userId, quizId, questions } = await makeAttemptReady(db);
    const snapshot = questions.map((q) => ({ questionId: q.id, choiceOrder: null }));
    const first = await createAttempt({ quizId, userId, questionsSnapshot: snapshot }, db);
    await recordAnswer({ attemptId: first.id, questionIndex: 0, questionType: "meaning", word: "Dog", meaning: "A dog", userAnswer: "v1", isCorrect: true }, db);
    await recordAnswer({ attemptId: first.id, questionIndex: 1, questionType: "meaning", word: "Cat", meaning: "A cat", userAnswer: "v2", isCorrect: true }, db);

    const other = await createUser({ email: "other@example.com", passwordHash: "hash" }, db);
    const otherFolder = await createFolder({ userId: other.id, name: "Other" }, db);
    const otherQuiz = await createQuiz({ folderId: otherFolder.id, userId: other.id, name: "Other Quiz", questionTypes: ["sentence"], vocabItemIds: ["x"], shuffleQuestions: false, shuffleAnswers: false }, db);

    const list = await listAttemptsByQuiz(quizId, userId, db);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: first.id, status: "completed" });
    expect(await listAttemptsByQuiz(otherQuiz.id, other.id, db)).toEqual([]);
  });

  it("lists answers for an attempt ordered by questionIndex", async () => {
    const db = await createTestDb();
    const { userId, quizId, questions } = await makeAttemptReady(db);
    const snapshot = questions.map((q) => ({ questionId: q.id, choiceOrder: null }));
    const attempt = await createAttempt({ quizId, userId, questionsSnapshot: snapshot }, db);
    await recordAnswer({ attemptId: attempt.id, questionIndex: 0, questionType: "meaning", word: "Dog", meaning: "A dog", userAnswer: "v1", isCorrect: true }, db);
    await recordAnswer({ attemptId: attempt.id, questionIndex: 1, questionType: "meaning", word: "Cat", meaning: "A cat", userAnswer: "v2", isCorrect: true }, db);

    const answers = await listAnswersByAttempt(attempt.id, db);
    expect(answers.map((a) => a.word)).toEqual(["Dog", "Cat"]);
  });
});
