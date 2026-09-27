import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, beforeEach } from "vitest";
import { LoginForm } from "./login-form";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const signIn = vi.fn();
vi.mock("next-auth/react", () => ({ signIn: (...args: unknown[]) => signIn(...args) }));

beforeEach(() => {
  push.mockClear();
  signIn.mockClear();
});

describe("LoginForm", () => {
  it("shows one generic error for invalid credentials", async () => {
    signIn.mockResolvedValueOnce({ error: "CredentialsSignin" });
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText("Email"), "jane@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("redirects home on successful sign in", async () => {
    signIn.mockResolvedValueOnce({ error: undefined });
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText("Email"), "jane@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "correct-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(push).toHaveBeenCalledWith("/");
  });

  it("shows a generic error for a non-credentials signIn error (e.g. misconfiguration)", async () => {
    signIn.mockResolvedValueOnce({ error: "Configuration" });
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText("Email"), "jane@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "correct-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText("Something went wrong. Please try again.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Invalid email or password")).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows a generic error and re-enables the button when signIn rejects", async () => {
    signIn.mockRejectedValueOnce(new Error("network down"));
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText("Email"), "jane@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "correct-password");
    const submitButton = screen.getByRole("button", { name: "Sign in" });
    await userEvent.click(submitButton);

    expect(
      await screen.findByText("Something went wrong. Please try again.")
    ).toBeInTheDocument();
    expect(submitButton).not.toBeDisabled();
    expect(submitButton).toHaveTextContent("Sign in");
    expect(push).not.toHaveBeenCalled();
  });
});
