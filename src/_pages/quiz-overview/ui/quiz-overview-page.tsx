import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/shared/ui/badge";
import type { Quiz } from "@/entities/quiz";

const QUESTION_TYPE_LABEL: Record<string, string> = {
  meaning: "Meaning",
  word: "Word",
  sentence: "Sentence",
};

interface QuizOverviewPageProps {
  quiz: Quiz;
  folderName: string;
  questionCount: number;
}

export function QuizOverviewPage({ quiz, folderName, questionCount }: QuizOverviewPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/quiz" className="text-muted-foreground flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" />
        Back to Quiz
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{quiz.name}</h1>
        <p className="text-muted-foreground font-mono text-xs">
          From{" "}
          <Link href={`/library/${quiz.folderId}`} className="underline">
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
      </div>
    </div>
  );
}
