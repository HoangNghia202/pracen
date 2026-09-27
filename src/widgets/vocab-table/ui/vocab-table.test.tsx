import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { VocabTable } from "./vocab-table";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

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
  expect(screen.getByRole("button", { name: "Pronounce Dog" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Edit Dog" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Delete Dog" })).toBeInTheDocument();
});

it("shows an empty state with no items", () => {
  render(<VocabTable items={[]} />);
  expect(screen.getByText("No words yet")).toBeInTheDocument();
});
