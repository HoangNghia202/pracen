"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { startQuizAttemptAction } from "../api/start-quiz-attempt.server";

interface StartQuizButtonProps {
  quizId: string;
  hasInProgressAttempt: boolean;
}

export function StartQuizButton({ quizId, hasInProgressAttempt }: StartQuizButtonProps) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);

  async function handleClick() {
    setIsStarting(true);
    try {
      const result = await startQuizAttemptAction(quizId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(`/quiz/${quizId}/attempt`);
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <Button onClick={handleClick} disabled={isStarting}>
      {isStarting ? "Loading..." : hasInProgressAttempt ? "Continue" : "Start"}
    </Button>
  );
}
