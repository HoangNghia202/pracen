import { Sparkle } from "@phosphor-icons/react/dist/ssr";
import { LoginForm } from "@/features/auth-by-credentials";
import { GoogleSignInButton } from "@/features/auth-by-google";

const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    "That email is already registered with a password. Sign in with your password instead.",
};

export function LoginPage({ error }: { error?: string }) {
  const message = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-amber text-brand-ink shadow-brand">
          <Sparkle weight="fill" className="size-6" />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Welcome back</h1>
          <p className="text-sm text-muted-foreground">Sign in to continue your vocabulary practice.</p>
        </div>
      </div>

      <div className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-6 shadow-brand-lg">
        {message && (
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">{message}</p>
        )}
        <LoginForm />
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <GoogleSignInButton />
      </div>

      <a href="/register" className="text-center text-sm text-muted-foreground underline underline-offset-2">
        Need an account? Register
      </a>
    </div>
  );
}
