import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { Header } from "./header";

vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

it("shows an avatar fallback instead of the raw name and logout button", () => {
  render(<Header user={{ name: "Jane", email: "jane@example.com", image: null }} />);
  expect(screen.queryByText("Jane")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /log out/i })).not.toBeInTheDocument();
  expect(screen.getByText("JA")).toBeInTheDocument();
});

it("reveals the user's name and email in a dropdown when the avatar is clicked", async () => {
  const user = userEvent.setup();
  render(<Header user={{ name: "Jane", email: "jane@example.com", image: null }} />);

  await user.click(screen.getByRole("button", { name: "JA" }));

  await waitFor(() => expect(screen.getByText("Jane")).toBeInTheDocument());
  expect(screen.getByText("jane@example.com")).toBeInTheDocument();
  expect(screen.getByRole("menuitem", { name: /log out/i })).toBeInTheDocument();
});

it("falls back to the email as the display name when the user has no name", async () => {
  const user = userEvent.setup();
  render(<Header user={{ name: null, email: "jane@example.com", image: null }} />);

  await user.click(screen.getByRole("button", { name: "JA" }));

  await waitFor(() => expect(screen.getAllByText("jane@example.com").length).toBeGreaterThan(0));
});
