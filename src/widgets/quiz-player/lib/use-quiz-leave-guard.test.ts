import { renderHook, act } from "@testing-library/react";
import { vi } from "vitest";
import { useQuizLeaveGuard } from "./use-quiz-leave-guard";
import { confirm } from "@/shared/ui/confirm-dialog";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/shared/ui/confirm-dialog", () => ({ confirm: vi.fn() }));

function clickLink(href: string) {
  const link = document.createElement("a");
  link.href = href;
  document.body.appendChild(link);
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  link.dispatchEvent(event);
  document.body.removeChild(link);
  return event;
}

afterEach(() => {
  push.mockClear();
  vi.mocked(confirm).mockClear();
});

it("does nothing when inactive: a link click is not intercepted", () => {
  renderHook(() => useQuizLeaveGuard(false));

  const event = clickLink("/library");

  expect(event.defaultPrevented).toBe(false);
  expect(confirm).not.toHaveBeenCalled();
});

it("asks for confirmation when clicking a link to a different route while active", () => {
  vi.mocked(confirm).mockResolvedValue(true);
  renderHook(() => useQuizLeaveGuard(true));

  let event: MouseEvent;
  act(() => {
    event = clickLink("/library");
  });

  expect(event!.defaultPrevented).toBe(true);
  expect(confirm).toHaveBeenCalledWith(
    expect.objectContaining({ title: "Leave this quiz?", confirmText: "Leave", cancelText: "Stay" })
  );
});

it("ignores a click on a link to the current path", () => {
  renderHook(() => useQuizLeaveGuard(true));

  let event: MouseEvent;
  act(() => {
    event = clickLink(window.location.pathname);
  });

  expect(event!.defaultPrevented).toBe(false);
  expect(confirm).not.toHaveBeenCalled();
});

it("navigates to the href once the user confirms leaving", async () => {
  vi.mocked(confirm).mockResolvedValue(true);
  renderHook(() => useQuizLeaveGuard(true));

  await act(async () => {
    clickLink("/quiz");
    await Promise.resolve();
  });

  expect(push).toHaveBeenCalledWith("/quiz");
});

it("does not navigate when the user cancels", async () => {
  vi.mocked(confirm).mockResolvedValue(false);
  renderHook(() => useQuizLeaveGuard(true));

  await act(async () => {
    clickLink("/quiz");
    await Promise.resolve();
  });

  expect(push).not.toHaveBeenCalled();
});

it("marks the beforeunload event as cancelable while active", () => {
  renderHook(() => useQuizLeaveGuard(true));

  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);

  expect(event.defaultPrevented).toBe(true);
});

it("does not touch beforeunload when inactive", () => {
  renderHook(() => useQuizLeaveGuard(false));

  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);

  expect(event.defaultPrevented).toBe(false);
});
