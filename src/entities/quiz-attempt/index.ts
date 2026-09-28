export { buildQuestionsSnapshot } from "./model/build-snapshot";
export { resolveQuestionView } from "./model/resolve-question";
export {
  getInProgressAttempt,
  createAttempt,
  getAttemptById,
  listAttemptsByQuiz,
  recordAnswer,
  listAnswersByAttempt,
} from "./api/quiz-attempt.server";
export type {
  AttemptStatus,
  QuestionType,
  QuestionChoice,
  QuestionSnapshotItem,
  QuizAttempt,
  AttemptAnswer,
  QuestionLike,
  ResolvedQuestion,
} from "./model/types";
