import { notFound } from "next/navigation";
import { auth } from "@/_app/api-routes/auth";
import { getQuizById } from "@/entities/quiz";
import { getFolderById } from "@/entities/folder";
import { listQuestionsByQuiz } from "@/entities/quiz-question";
import { getInProgressAttempt, listAttemptsByQuiz } from "@/entities/quiz-attempt";
import { QuizOverviewPage } from "./ui/quiz-overview-page";

export default async function Page({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params;
  const session = await auth();
  const quiz = await getQuizById(quizId, session!.user.id);
  if (!quiz) {
    notFound();
  }
  const [folder, questions, inProgressAttempt, completedAttempts] = await Promise.all([
    getFolderById(quiz.folderId, session!.user.id),
    listQuestionsByQuiz(quiz.id),
    getInProgressAttempt(quiz.id, session!.user.id),
    listAttemptsByQuiz(quiz.id, session!.user.id),
  ]);
  return (
    <QuizOverviewPage
      quiz={quiz}
      folderName={folder?.name ?? "Unknown folder"}
      questionCount={questions.length}
      inProgressAttempt={inProgressAttempt}
      completedAttempts={completedAttempts}
    />
  );
}
