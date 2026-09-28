import { render, screen } from "@testing-library/react";
import { AttemptHistory } from "./attempt-history";

const attempt = {
  id: "a1",
  quizId: "q1",
  userId: "u1",
  status: "completed" as const,
  questionsSnapshot: [],
  currentIndex: 2,
  totalQuestions: 2,
  score: 1,
  startedAt: new Date("2026-09-27T00:00:00Z"),
  finishedAt: new Date("2026-09-27T00:05:00Z"),
};

it("renders a row per completed attempt linking to its result page", () => {
  render(<AttemptHistory quizId="q1" attempts={[attempt]} />);
  expect(screen.getByRole("link", { name: /1\/2/ })).toHaveAttribute("href", "/quiz/q1/attempt/a1");
});

it("shows an empty message with no attempts", () => {
  render(<AttemptHistory quizId="q1" attempts={[]} />);
  expect(screen.getByText("No attempts yet.")).toBeInTheDocument();
});
