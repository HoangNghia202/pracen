import Link from "next/link";
import { ListChecks } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/shared/ui/badge";
import type { QuizWithMeta } from "@/entities/quiz";

interface QuizGridProps {
  quizzes: QuizWithMeta[];
  hasFilter: boolean;
}

const QUESTION_TYPE_LABEL: Record<string, string> = {
  meaning: "Meaning",
  word: "Word",
  sentence: "Sentence",
};

export function QuizGrid({ quizzes, hasFilter }: QuizGridProps) {
  if (quizzes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-brand-teal-light text-brand-teal">
          <ListChecks className="size-6" />
        </span>
        <p className="text-sm text-muted-foreground">
          {hasFilter ? "No quizzes match your search" : "No quizzes yet"}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {quizzes.map((quiz) => (
        <Link
          key={quiz.id}
          href={`/quiz/${quiz.id}`}
          className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-brand-sm transition-all hover:-translate-y-0.5 hover:border-brand-teal/60 hover:shadow-brand"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-teal-light text-brand-teal transition-colors group-hover:bg-brand-teal group-hover:text-white">
            <ListChecks weight="fill" className="size-5" />
          </span>
          <p className="font-heading text-base font-medium text-foreground">{quiz.name}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {quiz.folderName} · {quiz.questionCount} {quiz.questionCount === 1 ? "question" : "questions"}
          </p>
          <div className="flex flex-wrap gap-1">
            {quiz.questionTypes.map((type) => (
              <Badge key={type} variant="secondary">
                {QUESTION_TYPE_LABEL[type]}
              </Badge>
            ))}
          </div>
        </Link>
      ))}
    </div>
  );
}
