import Image from "next/image";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { APP_NAME } from "@/shared/config/app-config";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { LogoutMenuItem } from "@/features/logout";
import { MobileNav } from "./mobile-nav";

interface HeaderProps {
  user: { name: string | null; email: string; image: string | null };
}

function initialsFor(name: string | null, email: string) {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function Header({ user }: HeaderProps) {
  const displayName = user.name ?? user.email;

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4 shadow-brand-sm md:px-6">
      <div className="flex items-center gap-3">
        <MobileNav />
        <div className="flex items-center gap-2">
          <Image src="/pracen-mark.png" alt="" width={32} height={32} className="size-8 rounded-lg" priority />
          <span className="font-heading text-base font-semibold text-foreground">{APP_NAME}</span>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-full p-1 pr-2 transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 outline-none">
          <Avatar className="ring-2 ring-brand-amber-light">
            {user.image && <AvatarImage src={user.image} alt={displayName} />}
            <AvatarFallback className="bg-brand-amber text-sm font-semibold text-white">
              {initialsFor(user.name, user.email)}
            </AvatarFallback>
          </Avatar>
          <CaretDown className="hidden size-3.5 text-muted-foreground sm:block" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="flex items-center gap-3 px-2 py-2">
            <Avatar size="lg">
              {user.image && <AvatarImage src={user.image} alt={displayName} />}
              <AvatarFallback className="bg-brand-amber text-sm font-semibold text-white">
                {initialsFor(user.name, user.email)}
              </AvatarFallback>
            </Avatar>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-foreground">{displayName}</span>
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <LogoutMenuItem />
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
