import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import Link from "next/link";
import { QuizPlayer } from "./quiz-player";
import { submitAnswerAction } from "@/features/quiz-attempt/submit-quiz-answer";
import { confirm } from "@/shared/ui/confirm-dialog";

vi.mock("@/features/quiz-attempt/submit-quiz-answer", () => ({ submitAnswerAction: vi.fn() }));
vi.mock("@/shared/ui/confirm-dialog", () => ({ confirm: vi.fn() }));
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

it("confirms before leaving the page while the question is unanswered", async () => {
  vi.mocked(confirm).mockResolvedValue(true);
  const user = userEvent.setup();
  render(
    <div>
      <Link href="/library">Library</Link>
      <QuizPlayer attemptId="a1" quizId="q1" questionIndex={0} totalQuestions={2} questionType="meaning" word="Dog" meaning="A dog" choices={[{ id: "v1", word: "Dog", meaning: "A dog" }]} />
    </div>
  );

  await user.click(screen.getByRole("link", { name: "Library" }));

  await waitFor(() => expect(push).toHaveBeenCalledWith("/library"));
});

it("does not confirm before leaving once the question is completed", async () => {
  vi.mocked(submitAnswerAction).mockResolvedValue({ ok: true, isCorrect: true, aiFeedback: null, completed: true, score: 2 });
  const user = userEvent.setup();
  render(
    <div>
      <Link href="/library">Library</Link>
      <QuizPlayer attemptId="a1" quizId="q1" questionIndex={1} totalQuestions={2} questionType="meaning" word="Dog" meaning="A dog" choices={[{ id: "v1", word: "Dog", meaning: "A dog" }]} />
    </div>
  );

  await user.click(screen.getByRole("button", { name: "A dog" }));
  await user.click(screen.getByRole("button", { name: "Submit" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "See results" })).toBeInTheDocument());

  await user.click(screen.getByRole("link", { name: "Library" }));

  expect(confirm).not.toHaveBeenCalled();
});
