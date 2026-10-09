import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { LogoutButton } from "./logout-button";

const signOut = vi.fn();
vi.mock("next-auth/react", () => ({ signOut: (...args: unknown[]) => signOut(...args) }));

it("signs out and returns to /login on click", async () => {
  render(<LogoutButton />);
  await userEvent.click(screen.getByRole("button", { name: "Log out" }));
  expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/login" });
});
