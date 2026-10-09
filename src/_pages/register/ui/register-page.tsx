import Image from "next/image";
import { RegisterForm } from "@/features/user/auth-by-credentials";
import { GoogleSignInButton } from "@/features/user/auth-by-google";

export function RegisterPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <Image src="/pracen-mark.png" alt="Pracen" width={56} height={56} className="size-14 rounded-2xl shadow-brand" priority />
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Create your account</h1>
          <p className="text-sm text-muted-foreground">Start building your vocabulary today.</p>
        </div>
      </div>

      <div className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-6 shadow-brand-lg">
        <RegisterForm />
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <GoogleSignInButton />
      </div>

      <a href="/login" className="text-center text-sm text-muted-foreground underline underline-offset-2">
        Already have an account? Sign in
      </a>
    </div>
  );
}
