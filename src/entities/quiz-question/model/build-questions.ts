import { shuffle } from "@/shared/lib/shuffle";
import type { NewQuizQuestion, QuestionChoice, QuestionType } from "./types";

interface VocabItemLike {
  id: string;
  word: string;
  meaning: string;
}

const QUESTION_TYPE_ORDER: QuestionType[] = ["meaning", "word", "sentence"];

export function buildQuizQuestions(
  input: {
    selectedItems: VocabItemLike[];
    questionTypes: QuestionType[];
    distractorPool: VocabItemLike[];
  },
  random: () => number = Math.random
): NewQuizQuestion[] {
  const orderedTypes = QUESTION_TYPE_ORDER.filter((type) => input.questionTypes.includes(type));
  const questions: NewQuizQuestion[] = [];
  let orderIndex = 0;

  for (const item of input.selectedItems) {
    for (const type of orderedTypes) {
      if (type === "sentence") {
        questions.push({
          orderIndex: orderIndex++,
          questionType: "sentence",
          vocabItemId: item.id,
          word: item.word,
          meaning: item.meaning,
          choices: null,
        });
        continue;
      }

      const distractors = shuffle(
        input.distractorPool.filter((candidate) => candidate.id !== item.id),
        random
      ).slice(0, 3);
      const choices: QuestionChoice[] = shuffle(
        [item, ...distractors].map((candidate) => ({
          id: candidate.id,
          word: candidate.word,
          meaning: candidate.meaning,
        })),
        random
      );

      questions.push({
        orderIndex: orderIndex++,
        questionType: type,
        vocabItemId: item.id,
        word: item.word,
        meaning: item.meaning,
        choices,
      });
    }
  }

  return questions;
}
