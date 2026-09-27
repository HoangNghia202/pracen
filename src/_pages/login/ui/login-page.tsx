import { LoginForm } from "@/features/auth-by-credentials";
import { GoogleSignInButton } from "@/features/auth-by-google";

const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    "That email is already registered with a password. Sign in with your password instead.",
};

export function LoginPage({ error }: { error?: string }) {
  const message = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      {message && <p className="text-destructive text-xs">{message}</p>}
      <LoginForm />
      <GoogleSignInButton />
      <a href="/register" className="text-muted-foreground text-sm underline">
        Need an account? Register
      </a>
    </div>
  );
}
