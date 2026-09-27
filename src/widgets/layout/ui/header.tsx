import { LogoutButton } from "@/features/logout";
import { MobileNav } from "./mobile-nav";

interface HeaderProps {
  user: { name: string | null; email: string };
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b px-4 md:px-6">
      <div className="flex items-center gap-2">
        <MobileNav />
        <span className="font-semibold">Vocab</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground text-sm">{user.name ?? user.email}</span>
        <LogoutButton />
      </div>
    </header>
  );
}
