import { CreateQuizDialog } from "@/features/create-quiz";
import { QuizListToolbar } from "@/features/filter-quiz";
import { QuizGrid } from "@/widgets/quiz-grid";
import type { QuizWithMeta } from "@/entities/quiz";

interface QuizListPageProps {
  quizzes: QuizWithMeta[];
  folders: { id: string; name: string }[];
  hasFilter: boolean;
}

export function QuizListPage({ quizzes, folders, hasFilter }: QuizListPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Quiz</h1>
        {folders.length > 0 && <CreateQuizDialog folders={folders} />}
      </div>
      <QuizListToolbar folders={folders} />
      <QuizGrid quizzes={quizzes} hasFilter={hasFilter} />
    </div>
  );
}
