import Link from "next/link";
import { ArrowLeft, Trophy } from "@phosphor-icons/react/dist/ssr";
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
  const ratio = totalQuestions > 0 ? (score ?? 0) / totalQuestions : 0;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/quiz/${quizId}`}
        className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to {quizName}
      </Link>

      <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-6 shadow-brand">
        <span
          className={`flex size-14 shrink-0 items-center justify-center rounded-2xl ${
            ratio >= 0.7 ? "bg-success/15 text-success" : "bg-brand-coral-light text-brand-coral"
          }`}
        >
          <Trophy weight="fill" className="size-7" />
        </span>
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Results</h1>
          <p className="font-mono text-sm text-muted-foreground">
            {score ?? 0}/{totalQuestions} correct
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {answers.map((answer) => (
          <div key={answer.id} className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-4 shadow-brand-sm">
            <div className="flex items-center justify-between">
              <p className="font-medium text-foreground">{answer.word}</p>
              <Badge variant={answer.isCorrect ? "secondary" : "destructive"}>
                {answer.isCorrect ? "Correct" : "Incorrect"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Meaning: {answer.meaning}</p>
            <p className="text-sm text-foreground">Your answer: {answer.userAnswerLabel}</p>
            {answer.correctAnswerLabel !== null && (
              <p className="text-sm text-foreground">Correct answer: {answer.correctAnswerLabel}</p>
            )}
            {answer.aiFeedback && <p className="text-sm text-muted-foreground">{answer.aiFeedback}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
