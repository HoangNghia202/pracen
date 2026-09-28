import type { QuestionChoice, QuestionLike, QuestionSnapshotItem, ResolvedQuestion } from "./types";

export function resolveQuestionView(
  question: QuestionLike,
  snapshotItem: QuestionSnapshotItem,
  position: { questionIndex: number; totalQuestions: number }
): ResolvedQuestion {
  let choices: QuestionChoice[] | null = null;
  if (question.choices) {
    const order = snapshotItem.choiceOrder ?? question.choices.map((choice) => choice.id);
    const byId = new Map(question.choices.map((choice) => [choice.id, choice]));
    choices = order.map((id) => byId.get(id)).filter((choice): choice is QuestionChoice => Boolean(choice));
  }

  return {
    questionIndex: position.questionIndex,
    totalQuestions: position.totalQuestions,
    questionType: question.questionType,
    word: question.word,
    meaning: question.meaning,
    choices,
  };
}
