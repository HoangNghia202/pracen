import { ListChecks } from "@phosphor-icons/react/dist/ssr";
import { CreateQuizDialog } from "@/features/quiz/create-quiz";
import { QuizListToolbar } from "@/features/quiz/filter-quiz";
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-teal-light text-brand-teal">
            <ListChecks weight="fill" className="size-5" />
          </span>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Quiz</h1>
        </div>
        {folders.length > 0 && <CreateQuizDialog folders={folders} />}
      </div>
      <QuizListToolbar folders={folders} />
      <QuizGrid quizzes={quizzes} hasFilter={hasFilter} />
    </div>
  );
}
