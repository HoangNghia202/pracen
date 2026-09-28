import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { QuizPlayer } from "./quiz-player";
import { submitAnswerAction } from "@/features/submit-quiz-answer";

vi.mock("@/features/submit-quiz-answer", () => ({ submitAnswerAction: vi.fn() }));
const refresh = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push }) }));

it("submits the selected MCQ choice's id and shows correctness feedback", async () => {
  vi.mocked(submitAnswerAction).mockResolvedValue({ ok: true, isCorrect: true, aiFeedback: null, completed: false, score: null });
  const user = userEvent.setup();
  render(
    <QuizPlayer
      attemptId="a1"
      quizId="q1"
      questionIndex={0}
      totalQuestions={2}
      questionType="meaning"
      word="Dog"
      meaning="A dog"
      choices={[{ id: "v1", word: "Dog", meaning: "A dog" }, { id: "v2", word: "Cat", meaning: "A cat" }]}
    />
  );

  await user.click(screen.getByRole("button", { name: "A dog" }));
  await user.click(screen.getByRole("button", { name: "Submit" }));

  await waitFor(() => expect(submitAnswerAction).toHaveBeenCalledWith("a1", { questionIndex: 0, userAnswer: "v1" }));
  expect(screen.getByText("Correct!")).toBeInTheDocument();
});

it("submits free text and shows AI feedback for a sentence question", async () => {
  vi.mocked(submitAnswerAction).mockResolvedValue({ ok: true, isCorrect: false, aiFeedback: "Try again.", completed: false, score: null });
  const user = userEvent.setup();
  render(
    <QuizPlayer attemptId="a1" quizId="q1" questionIndex={1} totalQuestions={2} questionType="sentence" word="Dog" meaning="A dog" choices={null} />
  );

  await user.type(screen.getByPlaceholderText("Type your sentence..."), "asdf");
  await user.click(screen.getByRole("button", { name: "Submit" }));

  await waitFor(() => expect(screen.getByText("Try again.")).toBeInTheDocument());
});

it("refreshes the page for the next question, or navigates to results when completed", async () => {
  vi.mocked(submitAnswerAction).mockResolvedValue({ ok: true, isCorrect: true, aiFeedback: null, completed: true, score: 2 });
  const user = userEvent.setup();
  render(
    <QuizPlayer attemptId="a1" quizId="q1" questionIndex={1} totalQuestions={2} questionType="meaning" word="Dog" meaning="A dog" choices={[{ id: "v1", word: "Dog", meaning: "A dog" }]} />
  );

  await user.click(screen.getByRole("button", { name: "A dog" }));
  await user.click(screen.getByRole("button", { name: "Submit" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "See results" })).toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "See results" }));

  expect(push).toHaveBeenCalledWith("/quiz/q1/attempt/a1");
});
