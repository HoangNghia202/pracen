import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { GoogleSignInButton } from "./google-sign-in-button";

const signIn = vi.fn();
vi.mock("next-auth/react", () => ({ signIn: (...args: unknown[]) => signIn(...args) }));

it("starts the Google OAuth flow on click", async () => {
  render(<GoogleSignInButton />);
  await userEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
  expect(signIn).toHaveBeenCalledWith("google", { callbackUrl: "/" });
});
