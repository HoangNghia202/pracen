import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { MobileNav } from "./mobile-nav";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

it("opens the nav sheet when the menu button is clicked", async () => {
  render(<MobileNav />);
  expect(screen.queryByRole("link", { name: "Library" })).not.toBeInTheDocument();

  await userEvent.setup().click(screen.getByRole("button", { name: "Open navigation" }));

  expect(screen.getByRole("link", { name: "Library" })).toBeInTheDocument();
});
