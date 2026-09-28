import { notFound } from "next/navigation";
import { auth } from "@/_app/api-routes/auth";
import { getQuizById } from "@/entities/quiz";
import { getAttemptById, listAnswersByAttempt } from "@/entities/quiz-attempt";
import AttemptResultPage from "@/_pages/attempt-result";

export default async function Page({ params }: { params: Promise<{ quizId: string; attemptId: string }> }) {
  const { quizId, attemptId } = await params;
  const session = await auth();
  const quiz = await getQuizById(quizId, session!.user.id);
  if (!quiz) {
    notFound();
  }
  const attempt = await getAttemptById(attemptId, session!.user.id);
  if (!attempt || attempt.quizId !== quizId) {
    notFound();
  }
  const answers = await listAnswersByAttempt(attempt.id);
  return <AttemptResultPage quizId={quiz.id} quizName={quiz.name} score={attempt.score} totalQuestions={attempt.totalQuestions} answers={answers} />;
}
