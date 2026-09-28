import { redirect } from "next/navigation";
import { auth } from "@/_app/api-routes/auth";
import { getQuizById } from "@/entities/quiz";
import { getInProgressAttempt, resolveQuestionView } from "@/entities/quiz-attempt";
import { getQuestionById } from "@/entities/quiz-question";
import QuizAttemptPage from "@/_pages/quiz-attempt";

export default async function Page({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params;
  const session = await auth();
  const quiz = await getQuizById(quizId, session!.user.id);
  if (!quiz) {
    redirect("/quiz");
  }

  const attempt = await getInProgressAttempt(quizId, session!.user.id);
  if (!attempt) {
    redirect(`/quiz/${quizId}`);
  }

  const snapshotItem = attempt.questionsSnapshot[attempt.currentIndex];
  if (!snapshotItem) {
    redirect(`/quiz/${quizId}`);
  }
  const question = await getQuestionById(snapshotItem.questionId);
  if (!question) {
    redirect(`/quiz/${quizId}`);
  }

  const resolved = resolveQuestionView(question, snapshotItem, {
    questionIndex: attempt.currentIndex,
    totalQuestions: attempt.totalQuestions,
  });

  return <QuizAttemptPage attemptId={attempt.id} quizId={quiz.id} quizName={quiz.name} question={resolved} />;
}
