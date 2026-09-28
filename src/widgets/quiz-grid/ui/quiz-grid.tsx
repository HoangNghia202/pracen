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
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
        <ListChecks className="text-muted-foreground size-8" />
        <p className="text-sm">{hasFilter ? "No quizzes match your search" : "No quizzes yet"}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {quizzes.map((quiz) => (
        <Link
          key={quiz.id}
          href={`/quiz/${quiz.id}`}
          className="hover:border-primary/40 flex flex-col gap-2 rounded-lg border p-4 transition-colors"
        >
          <p className="text-lg font-medium">{quiz.name}</p>
          <p className="text-muted-foreground font-mono text-xs">
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
