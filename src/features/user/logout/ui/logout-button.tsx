"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/shared/ui/button";

export function LogoutButton() {
  return (
    <Button variant="ghost" onClick={() => signOut({ redirectTo: "/login" })}>
      Log out
    </Button>
  );
}
