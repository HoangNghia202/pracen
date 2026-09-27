"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/shared/ui/button";

export function GoogleSignInButton() {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={() => signIn("google", { callbackUrl: "/" })}
    >
      Continue with Google
    </Button>
  );
}
