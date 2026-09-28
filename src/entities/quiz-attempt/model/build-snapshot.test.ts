import { buildQuestionsSnapshot } from "./build-snapshot";
import type { QuestionLike } from "./types";

const sentenceQuestion: QuestionLike = { id: "q-c", questionType: "sentence", word: "Bird", meaning: "x", choices: null };
const mcqA: QuestionLike = {
  id: "q-a",
  questionType: "meaning",
  word: "Dog",
  meaning: "A dog",
  choices: [
    { id: "x", word: "X", meaning: "x" },
    { id: "y", word: "Y", meaning: "y" },
    { id: "z", word: "Z", meaning: "z" },
    { id: "w", word: "W", meaning: "w" },
  ],
};
const mcqB: QuestionLike = { id: "q-b", questionType: "word", word: "Cat", meaning: "A cat", choices: [{ id: "x", word: "X", meaning: "x" }] };

describe("buildQuestionsSnapshot", () => {
  it("keeps the input order when shuffleQuestions is false", () => {
    const snapshot = buildQuestionsSnapshot(
      [mcqA, mcqB, sentenceQuestion],
      { shuffleQuestions: false, shuffleAnswers: false },
      () => 0
    );
    expect(snapshot.map((item) => item.questionId)).toEqual(["q-a", "q-b", "q-c"]);
  });

  it("shuffles the question order when shuffleQuestions is true", () => {
    // 3 items, random always 0: Fisher-Yates gives [b, c, a] (see shared/lib/shuffle.test.ts for the trace pattern).
    const snapshot = buildQuestionsSnapshot(
      [mcqA, mcqB, sentenceQuestion],
      { shuffleQuestions: true, shuffleAnswers: false },
      () => 0
    );
    expect(snapshot.map((item) => item.questionId)).toEqual(["q-b", "q-c", "q-a"]);
  });

  it("sets choiceOrder to null for a sentence question regardless of shuffleAnswers", () => {
    const snapshot = buildQuestionsSnapshot([sentenceQuestion], { shuffleQuestions: false, shuffleAnswers: true }, () => 0);
    expect(snapshot[0].choiceOrder).toBeNull();
  });

  it("keeps the question's own choice order when shuffleAnswers is false", () => {
    const snapshot = buildQuestionsSnapshot([mcqA], { shuffleQuestions: false, shuffleAnswers: false }, () => 0);
    expect(snapshot[0].choiceOrder).toEqual(["x", "y", "z", "w"]);
  });

  it("shuffles the choice order when shuffleAnswers is true", () => {
    // 4 choices, random always 0: Fisher-Yates gives [y, z, w, x].
    const snapshot = buildQuestionsSnapshot([mcqA], { shuffleQuestions: false, shuffleAnswers: true }, () => 0);
    expect(snapshot[0].choiceOrder).toEqual(["y", "z", "w", "x"]);
  });
});
