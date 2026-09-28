export type QuestionType = "meaning" | "word" | "sentence";

export interface Quiz {
  id: string;
  folderId: string;
  userId: string;
  name: string;
  questionTypes: QuestionType[];
  vocabItemIds: string[];
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuizWithMeta extends Quiz {
  folderName: string;
  questionCount: number;
}

export type QuizSort = "recently-created";
