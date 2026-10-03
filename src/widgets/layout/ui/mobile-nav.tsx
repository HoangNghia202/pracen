"use client";

import { useState } from "react";
import Image from "next/image";
import { List } from "@phosphor-icons/react";
import { APP_NAME } from "@/shared/config";
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
          <Image src="/pracen-mark.png" alt="" width={32} height={32} className="size-8 rounded-lg" />
          <span className="font-heading text-base font-semibold text-foreground">{APP_NAME}</span>
        </div>
        <NavLinks className="p-4" onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
