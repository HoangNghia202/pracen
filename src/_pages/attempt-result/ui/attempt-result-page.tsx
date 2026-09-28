import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/shared/ui/badge";
import type { AttemptAnswer } from "@/entities/quiz-attempt";

// `userAnswer`/the question's own `vocabItemId` are raw ids for `meaning`/`word`
// questions — the route resolves them to human-readable labels (the choice's
// word or meaning text) before handing answers to this presentational
// component. `correctAnswerLabel` is null for `sentence` answers, which are
// AI-graded free text with no single correct answer to display.
export interface ResolvedAttemptAnswer extends AttemptAnswer {
  userAnswerLabel: string;
  correctAnswerLabel: string | null;
}

interface AttemptResultPageProps {
  quizId: string;
  quizName: string;
  score: number | null;
  totalQuestions: number;
  answers: ResolvedAttemptAnswer[];
}

export function AttemptResultPage({ quizId, quizName, score, totalQuestions, answers }: AttemptResultPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <Link href={`/quiz/${quizId}`} className="text-muted-foreground flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" />
        Back to {quizName}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Results</h1>
        <p className="text-muted-foreground font-mono text-sm">
          {score ?? 0}/{totalQuestions} correct
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {answers.map((answer) => (
          <div key={answer.id} className="flex flex-col gap-1 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">{answer.word}</p>
              <Badge variant={answer.isCorrect ? "secondary" : "destructive"}>
                {answer.isCorrect ? "Correct" : "Incorrect"}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">Meaning: {answer.meaning}</p>
            <p className="text-sm">Your answer: {answer.userAnswerLabel}</p>
            {answer.correctAnswerLabel !== null && (
              <p className="text-sm">Correct answer: {answer.correctAnswerLabel}</p>
            )}
            {answer.aiFeedback && <p className="text-muted-foreground text-sm">{answer.aiFeedback}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
