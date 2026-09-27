import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { NavLinks } from "./nav-links";

vi.mock("next/navigation", () => ({ usePathname: () => "/library" }));

it("renders all three nav items", () => {
  render(<NavLinks />);
  expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Library" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Quiz" })).toBeInTheDocument();
});

it("marks the current route's link as active", () => {
  render(<NavLinks />);
  expect(screen.getByRole("link", { name: "Library" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
});
