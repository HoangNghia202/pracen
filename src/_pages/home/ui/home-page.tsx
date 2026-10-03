import Link from "next/link";
import { Books, ListChecks, CheckCircle, FolderSimple } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/shared/ui/button";
import { formatDate } from "@/shared/lib/format-date";
import { CreateFolderDialog } from "@/features/create-folder";
import type { AttemptWithQuizName } from "@/entities/quiz-attempt";

interface HomePageProps {
  stats: {
    folderCount: number;
    wordCount: number;
    quizCount: number;
    completedAttemptCount: number;
  };
  inProgressAttempts: Pick<AttemptWithQuizName, "id" | "quizId" | "quizName" | "currentIndex" | "totalQuestions">[];
  recentAttempts: Pick<AttemptWithQuizName, "id" | "quizId" | "quizName" | "score" | "totalQuestions" | "finishedAt">[];
}

const STAT_ITEMS = (stats: HomePageProps["stats"]) => [
  { label: "Folders", value: stats.folderCount, icon: FolderSimple },
  { label: "Words", value: stats.wordCount, icon: Books },
  { label: "Quizzes", value: stats.quizCount, icon: ListChecks },
  { label: "Completed attempts", value: stats.completedAttemptCount, icon: CheckCircle },
];

export function HomePage({ stats, inProgressAttempts, recentAttempts }: HomePageProps) {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {STAT_ITEMS(stats).map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex flex-col gap-2 rounded-lg border p-4">
            <Icon className="text-muted-foreground size-5" />
            <p className="text-2xl font-semibold">{value}</p>
            <p className="text-muted-foreground text-xs">{label}</p>
          </div>
        ))}
      </div>

      {inProgressAttempts.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">Continue studying</h2>
          <div className="divide-y rounded-lg border">
            {inProgressAttempts.map((attempt) => (
              <Link
                key={attempt.id}
                href={`/quiz/${attempt.quizId}/attempt`}
                className="hover:bg-muted flex items-center justify-between px-4 py-3 text-sm transition-colors"
              >
                <span>{attempt.quizName}</span>
                <span className="font-mono text-xs">
                  {attempt.currentIndex + 1}/{attempt.totalQuestions}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Recent activity</h2>
        {recentAttempts.length === 0 ? (
          <p className="text-muted-foreground text-sm">No quiz attempts yet.</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {recentAttempts.map((attempt) => (
              <Link
                key={attempt.id}
                href={`/quiz/${attempt.quizId}/attempt/${attempt.id}`}
                className="hover:bg-muted flex items-center justify-between px-4 py-3 text-sm transition-colors"
              >
                <span>{attempt.quizName}</span>
                <span className="text-muted-foreground">{attempt.finishedAt ? formatDate(attempt.finishedAt) : "—"}</span>
                <span className="font-mono text-xs">
                  {attempt.score ?? 0}/{attempt.totalQuestions}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Quick actions</h2>
        <div className="flex gap-2">
          <CreateFolderDialog />
          <Button variant="outline" asChild>
            <Link href="/quiz">Browse quizzes</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
