import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { LoginPage } from "./login-page";

vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

it("shows a clear message for an OAuth/Credentials account collision", () => {
  render(<LoginPage error="OAuthAccountNotLinked" />);
  expect(
    screen.getByText(
      "That email is already registered with a password. Sign in with your password instead."
    )
  ).toBeInTheDocument();
});

it("shows no error banner when there is no error", () => {
  render(<LoginPage />);
  expect(screen.queryByText(/already registered/)).not.toBeInTheDocument();
});
