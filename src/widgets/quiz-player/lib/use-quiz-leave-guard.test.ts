import { renderHook, act } from "@testing-library/react";
import { vi } from "vitest";
import { useQuizLeaveGuard } from "./use-quiz-leave-guard";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

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
});

it("does nothing when inactive: a link click is not intercepted", () => {
  const { result } = renderHook(() => useQuizLeaveGuard(false));

  const event = clickLink("/library");

  expect(event.defaultPrevented).toBe(false);
  expect(result.current.pendingHref).toBeNull();
});

it("intercepts a click on a link to a different route while active", () => {
  const { result } = renderHook(() => useQuizLeaveGuard(true));

  let event: MouseEvent;
  act(() => {
    event = clickLink("/library");
  });

  expect(event!.defaultPrevented).toBe(true);
  expect(result.current.pendingHref).toBe("/library");
});

it("ignores a click on a link to the current path", () => {
  const { result } = renderHook(() => useQuizLeaveGuard(true));

  let event: MouseEvent;
  act(() => {
    event = clickLink(window.location.pathname);
  });

  expect(event!.defaultPrevented).toBe(false);
  expect(result.current.pendingHref).toBeNull();
});

it("navigates to the pending href when confirmLeave is called", () => {
  const { result } = renderHook(() => useQuizLeaveGuard(true));

  act(() => {
    clickLink("/quiz");
  });
  act(() => {
    result.current.confirmLeave();
  });

  expect(push).toHaveBeenCalledWith("/quiz");
  expect(result.current.pendingHref).toBeNull();
});

it("clears the pending href without navigating when cancelLeave is called", () => {
  const { result } = renderHook(() => useQuizLeaveGuard(true));

  act(() => {
    clickLink("/quiz");
  });
  act(() => {
    result.current.cancelLeave();
  });

  expect(push).not.toHaveBeenCalled();
  expect(result.current.pendingHref).toBeNull();
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
