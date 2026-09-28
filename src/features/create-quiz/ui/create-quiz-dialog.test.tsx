import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { CreateQuizDialog } from "./create-quiz-dialog";
import { getFolderWordsAction } from "../api/get-folder-words.server";
import { createQuizAction } from "../api/create-quiz.server";

vi.mock("../api/get-folder-words.server", () => ({ getFolderWordsAction: vi.fn() }));
vi.mock("../api/create-quiz.server", () => ({ createQuizAction: vi.fn() }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const words = [
  { id: "v1", folderId: "f1", word: "Dog", meaning: "A domesticated canine", example: null, partOfSpeech: null, createdAt: new Date() },
  { id: "v2", folderId: "f1", word: "Cat", meaning: "A domesticated feline", example: null, partOfSpeech: null, createdAt: new Date() },
];

beforeEach(() => {
  vi.mocked(getFolderWordsAction).mockResolvedValue({ ok: true, items: words });
});

it("hides the folder picker and preloads words when initialFolderId is given", async () => {
  render(<CreateQuizDialog folders={[{ id: "f1", name: "Animals" }]} initialFolderId="f1" />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Create quiz" }));

  expect(screen.queryByLabelText("Folder")).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByText("Dog — A domesticated canine")).toBeInTheDocument());
});

it("shows a folder picker and loads words after a folder is chosen, when no initialFolderId is given", async () => {
  const user = userEvent.setup();
  render(<CreateQuizDialog folders={[{ id: "f1", name: "Animals" }]} />);
  await user.click(screen.getByRole("button", { name: "Create quiz" }));

  expect(screen.getByLabelText("Folder")).toBeInTheDocument();
  expect(getFolderWordsAction).not.toHaveBeenCalled();

  await user.click(screen.getByLabelText("Folder"));
  await user.click(screen.getByRole("option", { name: "Animals" }));

  await waitFor(() => expect(getFolderWordsAction).toHaveBeenCalledWith("f1"));
});

it("disables submit until a name, at least one word, and at least one question type are set, then submits the expected payload", async () => {
  const user = userEvent.setup();
  vi.mocked(createQuizAction).mockResolvedValue({ ok: true, id: "quiz-1" });
  render(<CreateQuizDialog folders={[{ id: "f1", name: "Animals" }]} initialFolderId="f1" />);
  await user.click(screen.getByRole("button", { name: "Create quiz" }));
  await waitFor(() => expect(screen.getByText("Dog — A domesticated canine")).toBeInTheDocument());

  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByRole("button", { name: "Create quiz" })).toBeDisabled();

  await user.type(screen.getByLabelText("Quiz name"), "Animal Quiz");
  await user.click(screen.getByRole("checkbox", { name: "Meaning" }));

  await waitFor(() => expect(within(dialog).getByRole("button", { name: "Create quiz" })).not.toBeDisabled());
  await user.click(within(dialog).getByRole("button", { name: "Create quiz" }));

  await waitFor(() =>
    expect(createQuizAction).toHaveBeenCalledWith({
      folderId: "f1",
      name: "Animal Quiz",
      vocabItemIds: ["v1", "v2"],
      questionTypes: ["meaning"],
      shuffleQuestions: false,
      shuffleAnswers: false,
    })
  );
  expect(push).toHaveBeenCalledWith("/quiz/quiz-1");
});

it("shows the empty-folder state and keeps submit disabled when the folder has no words", async () => {
  vi.mocked(getFolderWordsAction).mockResolvedValue({ ok: true, items: [] });
  const user = userEvent.setup();
  render(<CreateQuizDialog folders={[{ id: "f1", name: "Empty" }]} initialFolderId="f1" />);
  await user.click(screen.getByRole("button", { name: "Create quiz" }));

  await waitFor(() => expect(screen.getByText("This folder has no words yet.")).toBeInTheDocument());
  await user.type(screen.getByLabelText("Quiz name"), "Empty Quiz");
  await user.click(screen.getByRole("checkbox", { name: "Meaning" }));

  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByRole("button", { name: "Create quiz" })).toBeDisabled();
});

it("keeps the later-selected folder's words even when the earlier folder's fetch resolves last", async () => {
  const user = userEvent.setup();
  const folderAWords = [
    { id: "a1", folderId: "fA", word: "Alpha", meaning: "First letter", example: null, partOfSpeech: null, createdAt: new Date() },
  ];
  const folderBWords = [
    { id: "b1", folderId: "fB", word: "Beta", meaning: "Second letter", example: null, partOfSpeech: null, createdAt: new Date() },
  ];

  let resolveA!: (value: { ok: true; items: typeof folderAWords }) => void;
  let resolveB!: (value: { ok: true; items: typeof folderBWords }) => void;
  const promiseA = new Promise<{ ok: true; items: typeof folderAWords }>((resolve) => {
    resolveA = resolve;
  });
  const promiseB = new Promise<{ ok: true; items: typeof folderBWords }>((resolve) => {
    resolveB = resolve;
  });

  vi.mocked(getFolderWordsAction).mockImplementation((folderId: string) => {
    if (folderId === "fA") return promiseA;
    if (folderId === "fB") return promiseB;
    return Promise.resolve({ ok: true, items: [] });
  });

  render(
    <CreateQuizDialog
      folders={[
        { id: "fA", name: "Alpha Folder" },
        { id: "fB", name: "Beta Folder" },
      ]}
    />
  );
  await user.click(screen.getByRole("button", { name: "Create quiz" }));

  await user.click(screen.getByLabelText("Folder"));
  await user.click(screen.getByRole("option", { name: "Alpha Folder" }));

  await user.click(screen.getByLabelText("Folder"));
  await user.click(screen.getByRole("option", { name: "Beta Folder" }));

  // Beta was selected last, but Alpha's request resolves first (out of order).
  resolveA({ ok: true, items: folderAWords });
  await Promise.resolve();
  resolveB({ ok: true, items: folderBWords });

  await waitFor(() => expect(screen.getByText("Beta — Second letter")).toBeInTheDocument());
  expect(screen.queryByText("Alpha — First letter")).not.toBeInTheDocument();
});
