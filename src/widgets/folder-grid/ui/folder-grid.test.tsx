import { render, screen } from "@testing-library/react";
import { FolderGrid } from "./folder-grid";

const folder = {
  id: "f1",
  userId: "u1",
  name: "Animals",
  wordCount: 3,
  createdAt: new Date("2026-09-01T00:00:00Z"),
  updatedAt: new Date("2026-09-27T00:00:00Z"),
};

it("renders a card per folder with its word count and edited date", () => {
  render(<FolderGrid folders={[folder]} hasFilter={false} />);
  expect(screen.getByRole("link", { name: /Animals/ })).toHaveAttribute("href", "/library/f1");
  expect(screen.getByText(/3 words/)).toBeInTheDocument();
  expect(screen.getByText(/Sep 27, 2026/)).toBeInTheDocument();
});

it("shows a 'no folders yet' empty state with no active filter", () => {
  render(<FolderGrid folders={[]} hasFilter={false} />);
  expect(screen.getByText("No folders yet")).toBeInTheDocument();
});

it("shows a distinct 'no matches' empty state when a filter is active", () => {
  render(<FolderGrid folders={[]} hasFilter={true} />);
  expect(screen.getByText("No folders match your search")).toBeInTheDocument();
});
