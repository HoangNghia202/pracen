import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { DeleteFolderButton } from "./delete-folder-button";
import { deleteFolderAction } from "../api/delete-folder.server";

vi.mock("../api/delete-folder.server", () => ({ deleteFolderAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

it("warns that deleting a folder also deletes every quiz built from it", async () => {
  const user = userEvent.setup();
  render(<DeleteFolderButton folderId="f1" folderName="Animals" />);

  await user.click(screen.getByRole("button", { name: "Delete folder" }));

  expect(
    screen.getByText("This permanently deletes the folder, every word inside it, and every quiz built from it.", {
      exact: false,
    })
  ).toBeInTheDocument();
  expect(deleteFolderAction).not.toHaveBeenCalled();
});
