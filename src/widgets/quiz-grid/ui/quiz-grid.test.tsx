import { render, screen } from "@testing-library/react";
import { QuizGrid } from "./quiz-grid";

const quiz = {
  id: "q1",
  folderId: "f1",
  userId: "u1",
  name: "Animal Quiz",
  questionTypes: ["meaning", "word"],
  vocabItemIds: ["v1", "v2"],
  shuffleQuestions: false,
  shuffleAnswers: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  folderName: "Animals",
  questionCount: 4,
} satisfies import("@/entities/quiz").QuizWithMeta;

it("renders a card per quiz with its folder, question count, and type badges", () => {
  render(<QuizGrid quizzes={[quiz]} hasFilter={false} />);
  expect(screen.getByRole("link", { name: /Animal Quiz/ })).toHaveAttribute("href", "/quiz/q1");
  expect(screen.getByText(/Animals/)).toBeInTheDocument();
  expect(screen.getByText(/4 questions/)).toBeInTheDocument();
  expect(screen.getByText("Meaning")).toBeInTheDocument();
  expect(screen.getByText("Word")).toBeInTheDocument();
});

it("shows a 'no quizzes yet' empty state with no active filter", () => {
  render(<QuizGrid quizzes={[]} hasFilter={false} />);
  expect(screen.getByText("No quizzes yet")).toBeInTheDocument();
});

it("shows a distinct 'no matches' empty state when a filter is active", () => {
  render(<QuizGrid quizzes={[]} hasFilter={true} />);
  expect(screen.getByText("No quizzes match your search")).toBeInTheDocument();
});
