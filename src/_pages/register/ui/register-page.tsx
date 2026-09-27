import { RegisterForm } from "@/features/auth-by-credentials";
import { GoogleSignInButton } from "@/features/auth-by-google";

export function RegisterPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <RegisterForm />
      <GoogleSignInButton />
      <a href="/login" className="text-muted-foreground text-sm underline">
        Already have an account? Sign in
      </a>
    </div>
  );
}
