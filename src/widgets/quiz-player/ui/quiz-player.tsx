"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { submitAnswerAction } from "@/features/submit-quiz-answer";
import type { QuestionChoice, QuestionType } from "@/entities/quiz-attempt";

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

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Question {questionIndex + 1} of {totalQuestions}
      </p>

      {questionType === "sentence" ? (
        <>
          <p className="text-lg font-medium">Write a sentence using &ldquo;{word}&rdquo;</p>
          <p className="text-muted-foreground text-sm">{meaning}</p>
          <Input
            value={sentence}
            onChange={(event) => setSentence(event.target.value)}
            disabled={Boolean(feedback)}
            placeholder="Type your sentence..."
          />
        </>
      ) : (
        <>
          <p className="text-lg font-medium">
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
                className="justify-start"
              >
                {questionType === "meaning" ? choice.meaning : choice.word}
              </Button>
            ))}
          </div>
        </>
      )}

      {error && <p className="text-destructive text-xs">{error}</p>}

      {feedback ? (
        <div className="flex flex-col gap-2">
          <p className={feedback.isCorrect ? "text-success text-sm font-medium" : "text-destructive text-sm font-medium"}>
            {feedback.isCorrect ? "Correct!" : "Not quite."}
          </p>
          {feedback.aiFeedback && <p className="text-muted-foreground text-sm">{feedback.aiFeedback}</p>}
          <Button onClick={handleNext}>{completed ? "See results" : "Next question"}</Button>
        </div>
      ) : (
        <Button onClick={handleSubmit} disabled={!answer.trim() || isSubmitting}>
          {isSubmitting ? "Checking..." : "Submit"}
        </Button>
      )}
    </div>
  );
}
