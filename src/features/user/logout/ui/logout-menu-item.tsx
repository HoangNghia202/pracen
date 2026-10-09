"use client";

import { SignOut } from "@phosphor-icons/react";
import { signOut } from "next-auth/react";
import { DropdownMenuItem } from "@/shared/ui/dropdown-menu";

export function LogoutMenuItem() {
  return (
    <DropdownMenuItem
      variant="destructive"
      onSelect={() => signOut({ callbackUrl: "/login" })}
    >
      <SignOut className="size-4" />
      Log out
    </DropdownMenuItem>
  );
}
