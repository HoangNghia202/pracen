import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { confirm, ConfirmDialog } from "./confirm-dialog";

it("resolves true when the confirm button is clicked", async () => {
  render(<ConfirmDialog />);
  const user = userEvent.setup();

  const result = confirm({ title: "Delete this?" });
  await user.click(await screen.findByRole("button", { name: "Confirm" }));

  expect(await result).toBe(true);
});

it("resolves false when the cancel button is clicked", async () => {
  render(<ConfirmDialog />);
  const user = userEvent.setup();

  const result = confirm({ title: "Delete this?" });
  await user.click(await screen.findByRole("button", { name: "Cancel" }));

  expect(await result).toBe(false);
});

it("resolves false when dismissed without clicking either button", async () => {
  render(<ConfirmDialog />);
  const user = userEvent.setup();

  const result = confirm({ title: "Delete this?" });
  await screen.findByRole("alertdialog");
  await user.keyboard("{Escape}");

  expect(await result).toBe(false);
});

it("renders the given title and description", async () => {
  render(<ConfirmDialog />);
  confirm({ title: "Delete this folder?", description: "This cannot be undone." });

  expect(await screen.findByText("Delete this folder?")).toBeInTheDocument();
  expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
});

it("renders custom confirm/cancel text and confirm button variant", async () => {
  render(<ConfirmDialog />);
  confirm({ title: "Leave this quiz?", confirmText: "Leave", cancelText: "Stay", confirmVariant: "destructive" });

  const confirmButton = await screen.findByRole("button", { name: "Leave" });
  expect(confirmButton).toHaveAttribute("data-variant", "destructive");
  expect(screen.getByRole("button", { name: "Stay" })).toBeInTheDocument();
});
