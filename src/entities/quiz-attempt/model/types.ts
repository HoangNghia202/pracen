export type AttemptStatus = "in_progress" | "completed";
export type QuestionType = "meaning" | "word" | "sentence";

export interface QuestionChoice {
  id: string;
  word: string;
  meaning: string;
}

export interface QuestionSnapshotItem {
  questionId: string;
  choiceOrder: string[] | null;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  status: AttemptStatus;
  questionsSnapshot: QuestionSnapshotItem[];
  currentIndex: number;
  totalQuestions: number;
  score: number | null;
  startedAt: Date;
  finishedAt: Date | null;
}

export interface AttemptAnswer {
  id: string;
  attemptId: string;
  questionIndex: number;
  questionType: QuestionType;
  word: string;
  meaning: string;
  userAnswer: string;
  isCorrect: boolean;
  aiFeedback: string | null;
  answeredAt: Date;
}

// Structural shape only. `entities/quiz-attempt` may not import
// `entities/quiz-question` (entities never import other entities in this
// codebase) — a real `QuizQuestion` object satisfies this interface by
// field-shape alone, and callers in the features/pages layer pass one in
// directly without either entity knowing about the other's module.
export interface QuestionLike {
  id: string;
  questionType: QuestionType;
  word: string;
  meaning: string;
  choices: QuestionChoice[] | null;
}

// Joined shape for dashboard queries that span every quiz a user owns,
// rather than one quiz at a time like the rest of this entity's queries.
export interface AttemptWithQuizName {
  id: string;
  quizId: string;
  quizName: string;
  status: AttemptStatus;
  currentIndex: number;
  totalQuestions: number;
  score: number | null;
  startedAt: Date;
  finishedAt: Date | null;
}

export interface ResolvedQuestion {
  questionIndex: number;
  totalQuestions: number;
  questionType: QuestionType;
  word: string;
  meaning: string;
  choices: QuestionChoice[] | null;
}
