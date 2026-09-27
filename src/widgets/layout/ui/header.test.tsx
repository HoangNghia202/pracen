import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { Header } from "./header";

vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

it("shows the signed-in user's name", () => {
  render(<Header user={{ name: "Jane", email: "jane@example.com" }} />);
  expect(screen.getByText("Jane")).toBeInTheDocument();
});

it("falls back to email when the user has no name", () => {
  render(<Header user={{ name: null, email: "jane@example.com" }} />);
  expect(screen.getByText("jane@example.com")).toBeInTheDocument();
});
