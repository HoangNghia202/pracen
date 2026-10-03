"use client";

import { useState } from "react";
import { List } from "@phosphor-icons/react";
import { Button } from "@/shared/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/shared/ui/sheet";
import { NavLinks } from "./nav-links";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
          <List weight="regular" className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 bg-sidebar">
        <div className="flex items-center gap-2 p-4 pb-0">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-amber text-sm font-bold text-brand-ink">
            V
          </span>
          <span className="font-heading text-base font-semibold text-foreground">Vocab</span>
        </div>
        <NavLinks className="p-4" onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
