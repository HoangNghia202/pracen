import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { QuizListToolbar } from "./quiz-list-toolbar";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/quiz",
  useSearchParams: () => new URLSearchParams(),
}));

it("debounces search input before updating the URL", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<QuizListToolbar folders={[{ id: "f1", name: "Animals" }]} />);

  await user.type(screen.getByPlaceholderText("Search quizzes"), "animal");
  expect(replace).not.toHaveBeenCalled();

  vi.advanceTimersByTime(300);
  expect(replace).toHaveBeenCalledWith("/quiz?q=animal");
  vi.useRealTimers();
});

it("filters by folder immediately on selection", async () => {
  const user = userEvent.setup();
  render(<QuizListToolbar folders={[{ id: "f1", name: "Animals" }]} />);

  await user.click(screen.getByRole("combobox"));
  await user.click(screen.getByRole("option", { name: "Animals" }));

  expect(replace).toHaveBeenCalledWith("/quiz?folderId=f1");
});
