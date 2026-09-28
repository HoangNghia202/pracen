import { resolveQuestionView } from "./resolve-question";
import type { QuestionLike } from "./types";

const mcq: QuestionLike = {
  id: "q1",
  questionType: "meaning",
  word: "Dog",
  meaning: "A dog",
  choices: [
    { id: "a", word: "A", meaning: "a" },
    { id: "b", word: "B", meaning: "b" },
  ],
};

describe("resolveQuestionView", () => {
  it("orders choices per the snapshot's choiceOrder", () => {
    const view = resolveQuestionView(mcq, { questionId: "q1", choiceOrder: ["b", "a"] }, { questionIndex: 0, totalQuestions: 2 });
    expect(view.choices?.map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("falls back to the question's own choice order when choiceOrder is null", () => {
    const view = resolveQuestionView(mcq, { questionId: "q1", choiceOrder: null }, { questionIndex: 0, totalQuestions: 2 });
    expect(view.choices?.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("returns null choices for a sentence-type question", () => {
    const sentence: QuestionLike = { id: "q2", questionType: "sentence", word: "Bird", meaning: "x", choices: null };
    const view = resolveQuestionView(sentence, { questionId: "q2", choiceOrder: null }, { questionIndex: 1, totalQuestions: 2 });
    expect(view.choices).toBeNull();
  });

  it("passes through the question's own fields and the given position", () => {
    const view = resolveQuestionView(mcq, { questionId: "q1", choiceOrder: null }, { questionIndex: 3, totalQuestions: 5 });
    expect(view).toMatchObject({
      questionIndex: 3,
      totalQuestions: 5,
      questionType: "meaning",
      word: "Dog",
      meaning: "A dog",
    });
  });
});
