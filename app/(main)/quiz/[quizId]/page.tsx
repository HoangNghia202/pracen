import { notFound } from "next/navigation";
import { auth } from "@/_app/api-routes/auth";
import { getQuizById } from "@/entities/quiz";
import { getFolderById } from "@/entities/folder";
import { listQuestionsByQuiz } from "@/entities/quiz-question";
import QuizOverviewPage from "@/_pages/quiz-overview";

export default async function Page({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params;
  const session = await auth();
  const quiz = await getQuizById(quizId, session!.user.id);
  if (!quiz) {
    notFound();
  }
  const [folder, questions] = await Promise.all([
    getFolderById(quiz.folderId, session!.user.id),
    listQuestionsByQuiz(quiz.id),
  ]);
  return (
    <QuizOverviewPage quiz={quiz} folderName={folder?.name ?? "Unknown folder"} questionCount={questions.length} />
  );
}
