import { render, screen } from "@testing-library/react";
import { VocabTable } from "./vocab-table";

const item = {
  id: "v1",
  folderId: "f1",
  word: "Dog",
  meaning: "A domesticated canine",
  example: null,
  partOfSpeech: null,
  createdAt: new Date("2026-09-27T00:00:00Z"),
};

it("renders a row per vocab item", () => {
  render(<VocabTable items={[item]} />);
  expect(screen.getByText("Dog")).toBeInTheDocument();
  expect(screen.getByText("A domesticated canine")).toBeInTheDocument();
});

it("shows an empty state with no items", () => {
  render(<VocabTable items={[]} />);
  expect(screen.getByText("No words yet")).toBeInTheDocument();
});
