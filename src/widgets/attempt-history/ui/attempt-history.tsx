import Link from "next/link";
import { formatDate } from "@/shared/lib/format-date";
import type { QuizAttempt } from "@/entities/quiz-attempt";

interface AttemptHistoryProps {
  quizId: string;
  attempts: QuizAttempt[];
}

export function AttemptHistory({ quizId, attempts }: AttemptHistoryProps) {
  if (attempts.length === 0) {
    return <p className="text-muted-foreground text-sm">No attempts yet.</p>;
  }

  return (
    <div className="divide-y rounded-lg border">
      {attempts.map((attempt) => (
        <Link
          key={attempt.id}
          href={`/quiz/${quizId}/attempt/${attempt.id}`}
          className="hover:bg-muted flex items-center justify-between px-4 py-3 text-sm transition-colors"
        >
          <span>{attempt.finishedAt ? formatDate(attempt.finishedAt) : "—"}</span>
          <span className="font-mono text-xs">
            {attempt.score ?? 0}/{attempt.totalQuestions}
          </span>
        </Link>
      ))}
    </div>
  );
}
