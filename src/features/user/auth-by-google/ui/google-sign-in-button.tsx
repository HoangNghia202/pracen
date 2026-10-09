"use client";

import { GoogleLogo } from "@phosphor-icons/react";
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
      <GoogleLogo weight="bold" className="size-4" />
      Continue with Google
    </Button>
  );
}
