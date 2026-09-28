import { notFound } from "next/navigation";
import { auth } from "@/_app/api-routes/auth";
import { getQuizById } from "@/entities/quiz";
import { getAttemptById, listAnswersByAttempt, type AttemptAnswer } from "@/entities/quiz-attempt";
import { getQuestionById } from "@/entities/quiz-question";
import AttemptResultPage, { type ResolvedAttemptAnswer } from "@/_pages/attempt-result";

// For `meaning`/`word` answers, `userAnswer` (and the question's own
// `vocabItemId`) are choice ids, not display text — look up the matching
// choice's label so the result page can show human-readable text instead of
// a raw UUID. `sentence` answers are already raw text with no single correct
// answer to resolve.
async function resolveAnswer(answer: AttemptAnswer, questionsSnapshot: { questionId: string }[]): Promise<ResolvedAttemptAnswer> {
  if (answer.questionType === "sentence") {
    return { ...answer, userAnswerLabel: answer.userAnswer, correctAnswerLabel: null };
  }

  const snapshotItem = questionsSnapshot[answer.questionIndex];
  const question = snapshotItem ? await getQuestionById(snapshotItem.questionId) : null;
  const choices = question?.choices ?? [];

  const labelFor = (choiceId: string) => {
    const choice = choices.find((candidate) => candidate.id === choiceId);
    if (!choice) return choiceId;
    return answer.questionType === "meaning" ? choice.meaning : choice.word;
  };

  return {
    ...answer,
    userAnswerLabel: labelFor(answer.userAnswer),
    correctAnswerLabel: question ? labelFor(question.vocabItemId) : null,
  };
}

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
  const resolvedAnswers = await Promise.all(answers.map((answer) => resolveAnswer(answer, attempt.questionsSnapshot)));

  return (
    <AttemptResultPage
      quizId={quiz.id}
      quizName={quiz.name}
      score={attempt.score}
      totalQuestions={attempt.totalQuestions}
      answers={resolvedAnswers}
    />
  );
}
