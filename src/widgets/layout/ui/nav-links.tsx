"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SquaresFour, Books, ListChecks } from "@phosphor-icons/react";
import { cn } from "@/shared/lib/cn";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: SquaresFour },
  { href: "/library", label: "Library", icon: Books },
  { href: "/quiz", label: "Quiz", icon: ListChecks },
] as const;

export function NavLinks({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex flex-col gap-1", className)}>
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all active:translate-y-px",
              isActive
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon weight={isActive ? "fill" : "regular"} className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
