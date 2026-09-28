export type QuestionType = "meaning" | "word" | "sentence";

export interface QuestionChoice {
  id: string;
  word: string;
  meaning: string;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  orderIndex: number;
  questionType: QuestionType;
  vocabItemId: string;
  word: string;
  meaning: string;
  choices: QuestionChoice[] | null;
  createdAt: Date;
}

export interface NewQuizQuestion {
  orderIndex: number;
  questionType: QuestionType;
  vocabItemId: string;
  word: string;
  meaning: string;
  choices: QuestionChoice[] | null;
}
