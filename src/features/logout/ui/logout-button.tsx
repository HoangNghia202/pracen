"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/shared/ui/button";

export function LogoutButton() {
  return (
    <Button variant="ghost" onClick={() => signOut({ callbackUrl: "/login" })}>
      Log out
    </Button>
  );
}
