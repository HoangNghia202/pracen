import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/shared/ui/badge";
import { StartQuizButton } from "@/features/quiz-attempt/start-quiz-attempt";
import { AttemptHistory } from "@/widgets/attempt-history";
import type { Quiz } from "@/entities/quiz";
import type { QuizAttempt } from "@/entities/quiz-attempt";

const QUESTION_TYPE_LABEL: Record<string, string> = {
  meaning: "Meaning",
  word: "Word",
  sentence: "Sentence",
};

interface QuizOverviewPageProps {
  quiz: Quiz;
  folderName: string;
  questionCount: number;
  inProgressAttempt: QuizAttempt | null;
  completedAttempts: QuizAttempt[];
}

export function QuizOverviewPage({
  quiz,
  folderName,
  questionCount,
  inProgressAttempt,
  completedAttempts,
}: QuizOverviewPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/quiz"
        className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Quiz
      </Link>
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-brand-sm">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">{quiz.name}</h1>
        <p className="font-mono text-xs text-muted-foreground">
          From{" "}
          <Link href={`/library/${quiz.folderId}`} className="underline underline-offset-2">
            {folderName}
          </Link>{" "}
          · {questionCount} {questionCount === 1 ? "question" : "questions"}
        </p>
        <div className="flex flex-wrap gap-1">
          {quiz.questionTypes.map((type) => (
            <Badge key={type} variant="secondary">
              {QUESTION_TYPE_LABEL[type]}
            </Badge>
          ))}
        </div>
        <div className="self-start">
          <StartQuizButton quizId={quiz.id} hasInProgressAttempt={Boolean(inProgressAttempt)} />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-medium text-foreground">Attempt history</h2>
        <AttemptHistory quizId={quiz.id} attempts={completedAttempts} />
      </div>
    </div>
  );
}
