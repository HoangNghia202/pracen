import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, beforeEach } from "vitest";
import { RegisterForm } from "./register-form";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const signIn = vi.fn();
vi.mock("next-auth/react", () => ({ signIn: (...args: unknown[]) => signIn(...args) }));

const registerWithCredentials = vi.fn();
vi.mock("../api/register.server", () => ({
  registerWithCredentials: (...args: unknown[]) => registerWithCredentials(...args),
}));

beforeEach(() => {
  push.mockClear();
  signIn.mockClear();
  registerWithCredentials.mockClear();
});

describe("RegisterForm", () => {
  it("shows the server error when the email is already registered", async () => {
    registerWithCredentials.mockResolvedValueOnce({
      ok: false,
      error: "An account with this email already exists",
    });
    render(<RegisterForm />);

    await userEvent.type(screen.getByLabelText("Name"), "Jane");
    await userEvent.type(screen.getByLabelText("Email"), "dup@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "s3cret-password");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(
      await screen.findByText("An account with this email already exists")
    ).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("signs in and redirects home after a successful registration", async () => {
    registerWithCredentials.mockResolvedValueOnce({ ok: true });
    signIn.mockResolvedValueOnce({ error: undefined });
    render(<RegisterForm />);

    await userEvent.type(screen.getByLabelText("Name"), "Jane");
    await userEvent.type(screen.getByLabelText("Email"), "jane@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "s3cret-password");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(push).toHaveBeenCalledWith("/");
  });
});
