import Link from "next/link";
import {
  Books,
  ListChecks,
  CheckCircle,
  FolderSimple,
  ArrowRight,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/shared/ui/button";
import { formatDate } from "@/shared/lib/format-date";
import { CreateFolderDialog } from "@/features/folder/create-folder";
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
  {
    label: "Folders",
    value: stats.folderCount,
    icon: FolderSimple,
    badge: "bg-brand-amber-light text-brand-amber-dark",
  },
  {
    label: "Words",
    value: stats.wordCount,
    icon: Books,
    badge: "bg-brand-teal-light text-brand-teal",
  },
  {
    label: "Quizzes",
    value: stats.quizCount,
    icon: ListChecks,
    badge: "bg-brand-coral-light text-brand-coral",
  },
  {
    label: "Completed",
    value: stats.completedAttemptCount,
    icon: CheckCircle,
    badge: "bg-brand-olive-light text-brand-olive-dark",
  },
];

export function HomePage({ stats, inProgressAttempts, recentAttempts }: HomePageProps) {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">A snapshot of your vocabulary practice.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {STAT_ITEMS(stats).map(({ label, value, icon: Icon, badge }) => (
          <div
            key={label}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-brand-sm transition-all hover:-translate-y-0.5 hover:shadow-brand"
          >
            <span className={`flex size-10 items-center justify-center rounded-xl ${badge}`}>
              <Icon weight="fill" className="size-5" />
            </span>
            <p className="font-heading text-3xl font-semibold text-foreground">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {inProgressAttempts.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-medium text-foreground">Continue studying</h2>
          <div className="flex flex-col gap-2">
            {inProgressAttempts.map((attempt) => {
              const progress = Math.round(((attempt.currentIndex + 1) / attempt.totalQuestions) * 100);
              return (
                <Link
                  key={attempt.id}
                  href={`/quiz/${attempt.quizId}/attempt`}
                  className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-brand-sm transition-all hover:-translate-y-0.5 hover:shadow-brand"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-amber-light text-brand-amber-dark">
                    <Sparkle weight="fill" className="size-5" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-foreground">{attempt.quizName}</span>
                    <span className="mt-1.5 block h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-brand-amber"
                        style={{ width: `${progress}%` }}
                      />
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {attempt.currentIndex + 1}/{attempt.totalQuestions}
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-medium text-foreground">Recent activity</h2>
        {recentAttempts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
            No quiz attempts yet.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {recentAttempts.map((attempt) => {
              const ratio = attempt.totalQuestions > 0 ? (attempt.score ?? 0) / attempt.totalQuestions : 0;
              return (
                <Link
                  key={attempt.id}
                  href={`/quiz/${attempt.quizId}/attempt/${attempt.id}`}
                  className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-brand-sm transition-all hover:-translate-y-0.5 hover:shadow-brand"
                >
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                      ratio >= 0.7
                        ? "bg-success/15 text-success"
                        : "bg-brand-coral-light text-brand-coral"
                    }`}
                  >
                    <CheckCircle weight="fill" className="size-5" />
                  </span>
                  <span className="flex-1 text-sm font-medium text-foreground">{attempt.quizName}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {attempt.finishedAt ? formatDate(attempt.finishedAt) : "In progress"}
                  </span>
                  <span className="shrink-0 font-mono text-xs font-medium text-foreground">
                    {attempt.score ?? 0}/{attempt.totalQuestions}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-brand-cream-deep/50 p-5">
        <h2 className="font-heading text-lg font-medium text-foreground">Quick actions</h2>
        <div className="flex flex-wrap gap-2">
          <CreateFolderDialog />
          <Button variant="outline" asChild>
            <Link href="/quiz">Browse quizzes</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
