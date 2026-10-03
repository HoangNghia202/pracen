import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { HomePage } from "./home-page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const baseStats = { folderCount: 0, wordCount: 0, quizCount: 0, completedAttemptCount: 0 };

it("renders the stats overview", () => {
  render(
    <HomePage
      stats={{ folderCount: 2, wordCount: 10, quizCount: 3, completedAttemptCount: 5 }}
      inProgressAttempts={[]}
      recentAttempts={[]}
    />
  );

  expect(screen.getByText("2")).toBeInTheDocument();
  expect(screen.getByText("10")).toBeInTheDocument();
  expect(screen.getByText("3")).toBeInTheDocument();
  expect(screen.getByText("5")).toBeInTheDocument();
});

it("hides the continue-studying section when there are no in-progress attempts", () => {
  render(<HomePage stats={baseStats} inProgressAttempts={[]} recentAttempts={[]} />);
  expect(screen.queryByText("Continue studying")).not.toBeInTheDocument();
});

it("lists in-progress attempts linking straight into the attempt", () => {
  render(
    <HomePage
      stats={baseStats}
      inProgressAttempts={[
        { id: "a1", quizId: "q1", quizName: "Animal Quiz", currentIndex: 1, totalQuestions: 4 },
      ]}
      recentAttempts={[]}
    />
  );

  expect(screen.getByText("Continue studying")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Animal Quiz/ })).toHaveAttribute("href", "/quiz/q1/attempt");
  expect(screen.getByText("2/4")).toBeInTheDocument();
});

it("shows an empty state when there is no recent activity", () => {
  render(<HomePage stats={baseStats} inProgressAttempts={[]} recentAttempts={[]} />);
  expect(screen.getByText("No quiz attempts yet.")).toBeInTheDocument();
});

it("lists recent completed attempts linking to their result page", () => {
  render(
    <HomePage
      stats={baseStats}
      inProgressAttempts={[]}
      recentAttempts={[
        {
          id: "a2",
          quizId: "q2",
          quizName: "Color Quiz",
          score: 3,
          totalQuestions: 4,
          finishedAt: new Date("2026-09-27T00:00:00Z"),
        },
      ]}
    />
  );

  expect(screen.getByRole("link", { name: /Color Quiz/ })).toHaveAttribute("href", "/quiz/q2/attempt/a2");
  expect(screen.getByText("3/4")).toBeInTheDocument();
});

it("renders quick action links to create a folder and browse quizzes", () => {
  render(<HomePage stats={baseStats} inProgressAttempts={[]} recentAttempts={[]} />);
  expect(screen.getByRole("button", { name: /new folder/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /browse quizzes/i })).toHaveAttribute("href", "/quiz");
});
