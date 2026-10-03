import { NavLinks } from "./nav-links";

export function DesktopSidebar() {
  return (
    <aside className="hidden shrink-0 overflow-y-auto border-r border-border bg-sidebar lg:flex lg:w-60 lg:flex-col">
      <NavLinks className="p-4" />
    </aside>
  );
}
