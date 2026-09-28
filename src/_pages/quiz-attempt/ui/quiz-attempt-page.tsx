import { QuizPlayer } from "@/widgets/quiz-player";
import type { ResolvedQuestion } from "@/entities/quiz-attempt";

interface QuizAttemptPageProps {
  attemptId: string;
  quizId: string;
  quizName: string;
  question: ResolvedQuestion;
}

export function QuizAttemptPage({ attemptId, quizId, quizName, question }: QuizAttemptPageProps) {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <h1 className="text-xl font-semibold tracking-tight">{quizName}</h1>
      <QuizPlayer
        attemptId={attemptId}
        quizId={quizId}
        questionIndex={question.questionIndex}
        totalQuestions={question.totalQuestions}
        questionType={question.questionType}
        word={question.word}
        meaning={question.meaning}
        choices={question.choices}
      />
    </div>
  );
}
