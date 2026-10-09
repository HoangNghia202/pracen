import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { DeleteFolderButton } from "./delete-folder-button";
import { deleteFolderAction } from "../api/delete-folder.server";
import { confirm } from "@/shared/ui/confirm-dialog";

vi.mock("../api/delete-folder.server", () => ({ deleteFolderAction: vi.fn() }));
vi.mock("@/shared/ui/confirm-dialog", () => ({ confirm: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

afterEach(() => {
  vi.mocked(confirm).mockReset();
  vi.mocked(deleteFolderAction).mockReset();
});

it("asks for confirmation, warning that deleting a folder also deletes every quiz built from it", async () => {
  vi.mocked(confirm).mockResolvedValue(false);
  const user = userEvent.setup();
  render(<DeleteFolderButton folderId="f1" folderName="Animals" />);

  await user.click(screen.getByRole("button", { name: "Delete folder" }));

  expect(confirm).toHaveBeenCalledWith(
    expect.objectContaining({
      title: 'Delete "Animals"?',
      description: expect.stringContaining("every quiz built from it"),
      confirmVariant: "destructive",
    })
  );
  expect(deleteFolderAction).not.toHaveBeenCalled();
});

it("deletes the folder once the user confirms", async () => {
  vi.mocked(confirm).mockResolvedValue(true);
  vi.mocked(deleteFolderAction).mockResolvedValue({ ok: true });
  const user = userEvent.setup();
  render(<DeleteFolderButton folderId="f1" folderName="Animals" />);

  await user.click(screen.getByRole("button", { name: "Delete folder" }));

  await waitFor(() => expect(deleteFolderAction).toHaveBeenCalledWith("f1"));
});
