import { NavLinks } from "./nav-links";

export function DesktopSidebar() {
  return (
    <aside className="hidden shrink-0 lg:flex lg:w-60 lg:flex-col lg:border-r">
      <NavLinks className="p-4" />
    </aside>
  );
}
