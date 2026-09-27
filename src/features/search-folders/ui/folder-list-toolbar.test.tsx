import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { FolderListToolbar } from "./folder-list-toolbar";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/library",
  useSearchParams: () => new URLSearchParams(),
}));

it("debounces search input before updating the URL", async () => {
  // `shouldAdvanceTime: true` is required alongside `advanceTimers` here: without
  // it, React's scheduler (used by RTL's act()-wrapped userEvent calls) captures
  // a real, unfaked timer reference before this test's fake clock installs,
  // and its callback later runs outside Vitest's mocked-timers tracking —
  // causing userEvent's internal `vi.advanceTimersByTime` call to throw
  // "timers APIs are not mocked" and the test to hang until timeout.
  // `shouldAdvanceTime` keeps the fake clock ticking in step with real time,
  // which avoids that race without affecting the manual `advanceTimersByTime`
  // assertion below (typing "cat" takes well under the 300ms debounce).
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<FolderListToolbar />);

  await user.type(screen.getByPlaceholderText("Search folders"), "cat");
  expect(replace).not.toHaveBeenCalled();

  vi.advanceTimersByTime(300);
  expect(replace).toHaveBeenCalledWith("/library?q=cat");
  vi.useRealTimers();
});
