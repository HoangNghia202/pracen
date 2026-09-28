import { shuffle } from "@/shared/lib/shuffle";
import type { QuestionLike, QuestionSnapshotItem } from "./types";

export function buildQuestionsSnapshot(
  questions: QuestionLike[],
  options: { shuffleQuestions: boolean; shuffleAnswers: boolean },
  random: () => number = Math.random
): QuestionSnapshotItem[] {
  const ordered = options.shuffleQuestions ? shuffle(questions, random) : questions;

  return ordered.map((question) => {
    if (!question.choices) {
      return { questionId: question.id, choiceOrder: null };
    }
    const ids = question.choices.map((choice) => choice.id);
    return {
      questionId: question.id,
      choiceOrder: options.shuffleAnswers ? shuffle(ids, random) : ids,
    };
  });
}
