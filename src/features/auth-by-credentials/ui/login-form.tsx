"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await signIn("credentials", {
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        redirect: false,
      });

      if (result?.error) {
        // Only "CredentialsSignin" means bad email/password. Any other
        // truthy error (e.g. Auth.js's Configuration/CallbackRouteError from
        // a missing AUTH_SECRET or an unreachable database) is an
        // infrastructure failure, not a credentials problem — don't tell the
        // user their password is wrong when it isn't.
        setError(
          result.error === "CredentialsSignin"
            ? "Invalid email or password"
            : "Something went wrong. Please try again."
        );
        return;
      }

      router.push("/");
    } catch {
      // signIn itself can reject (network failure, etc.), not just resolve
      // with an error — without this catch the button would be stuck on
      // "Signing in..." forever.
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required />
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
