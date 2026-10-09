"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { submitAnswerAction } from "@/features/quiz-attempt/submit-quiz-answer";
import type { QuestionChoice, QuestionType } from "@/entities/quiz-attempt";
import { useQuizLeaveGuard } from "../lib/use-quiz-leave-guard";

interface QuizPlayerProps {
  attemptId: string;
  quizId: string;
  questionIndex: number;
  totalQuestions: number;
  questionType: QuestionType;
  word: string;
  meaning: string;
  choices: QuestionChoice[] | null;
}

export function QuizPlayer({
  attemptId,
  quizId,
  questionIndex,
  totalQuestions,
  questionType,
  word,
  meaning,
  choices,
}: QuizPlayerProps) {
  const router = useRouter();
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [sentence, setSentence] = useState("");
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; aiFeedback: string | null } | null>(null);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  useQuizLeaveGuard(!completed);

  const answer = questionType === "sentence" ? sentence : (selectedChoiceId ?? "");

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await submitAnswerAction(attemptId, { questionIndex, userAnswer: answer });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setFeedback({ isCorrect: result.isCorrect, aiFeedback: result.aiFeedback });
      setCompleted(result.completed);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleNext() {
    if (completed) {
      router.push(`/quiz/${quizId}/attempt/${attemptId}`);
      return;
    }
    router.refresh();
  }

  const progress = Math.round(((questionIndex + 1) / totalQuestions) * 100);

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-brand">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">
            Question {questionIndex + 1} of {totalQuestions}
          </p>
          <p className="font-mono text-xs text-muted-foreground">{progress}%</p>
        </div>
        <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <span className="block h-full rounded-full bg-brand-amber transition-all" style={{ width: `${progress}%` }} />
        </span>
      </div>

      {questionType === "sentence" ? (
        <div className="flex flex-col gap-3">
          <p className="font-heading text-lg font-medium text-foreground">
            Write a sentence using &ldquo;{word}&rdquo;
          </p>
          <p className="text-sm text-muted-foreground">{meaning}</p>
          <Input
            value={sentence}
            onChange={(event) => setSentence(event.target.value)}
            disabled={Boolean(feedback)}
            placeholder="Type your sentence..."
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="font-heading text-lg font-medium text-foreground">
            {questionType === "meaning" ? `What does "${word}" mean?` : `Which word means "${meaning}"?`}
          </p>
          <div className="flex flex-col gap-2">
            {choices?.map((choice) => (
              <Button
                key={choice.id}
                type="button"
                variant={selectedChoiceId === choice.id ? "default" : "outline"}
                disabled={Boolean(feedback)}
                onClick={() => setSelectedChoiceId(choice.id)}
                className="justify-start rounded-xl py-2.5"
              >
                {questionType === "meaning" ? choice.meaning : choice.word}
              </Button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-destructive text-xs">{error}</p>}

      {feedback ? (
        <div className="flex flex-col gap-3">
          <div
            className={
              feedback.isCorrect
                ? "rounded-xl bg-success/10 px-4 py-3 text-sm font-medium text-success"
                : "rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
            }
          >
            {feedback.isCorrect ? "Correct!" : "Not quite."}
            {feedback.aiFeedback && (
              <p className="mt-1 text-sm font-normal text-muted-foreground">{feedback.aiFeedback}</p>
            )}
          </div>
          <Button onClick={handleNext} className="self-start">
            {completed ? "See results" : "Next question"}
          </Button>
        </div>
      ) : (
        <Button onClick={handleSubmit} disabled={!answer.trim() || isSubmitting} className="self-start">
          {isSubmitting ? "Checking..." : "Submit"}
        </Button>
      )}
    </div>
  );
}
