import Link from "next/link";
import { CheckCircle, XCircle } from "@phosphor-icons/react/dist/ssr";
import { formatDate } from "@/shared/lib/format-date";
import type { QuizAttempt } from "@/entities/quiz-attempt";

interface AttemptHistoryProps {
  quizId: string;
  attempts: QuizAttempt[];
}

export function AttemptHistory({ quizId, attempts }: AttemptHistoryProps) {
  if (attempts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
        No attempts yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {attempts.map((attempt) => {
        const ratio = attempt.totalQuestions > 0 ? (attempt.score ?? 0) / attempt.totalQuestions : 0;
        const passed = ratio >= 0.7;
        return (
          <Link
            key={attempt.id}
            href={`/quiz/${quizId}/attempt/${attempt.id}`}
            className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-brand-sm transition-all hover:-translate-y-0.5 hover:shadow-brand"
          >
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
                passed ? "bg-success/15 text-success" : "bg-brand-coral-light text-brand-coral"
              }`}
            >
              {passed ? <CheckCircle weight="fill" className="size-5" /> : <XCircle weight="fill" className="size-5" />}
            </span>
            <span className="flex-1 text-sm text-foreground">
              {attempt.finishedAt ? formatDate(attempt.finishedAt) : "In progress"}
            </span>
            <span className="font-mono text-xs font-medium text-foreground">
              {attempt.score ?? 0}/{attempt.totalQuestions}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
