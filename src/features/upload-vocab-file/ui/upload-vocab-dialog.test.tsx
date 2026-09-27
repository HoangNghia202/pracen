import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as XLSX from "xlsx";
import { vi } from "vitest";
import { UploadVocabDialog } from "./upload-vocab-dialog";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

function corruptXlsxBuffer(): ArrayBuffer {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["word", "meaning"],
    ["Dog", "A domesticated canine"],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  const full = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  // A truncated ZIP-structured buffer reliably makes XLSX.read throw
  // ("Unsupported ZIP file"), simulating a corrupt/incomplete upload.
  return full.slice(0, Math.floor(full.byteLength / 2));
}

describe("UploadVocabDialog", () => {
  it("shows an error instead of crashing when the file cannot be parsed", async () => {
    render(<UploadVocabDialog folderId="folder-1" />);

    await userEvent.click(screen.getByRole("button", { name: "Import file" }));

    const corruptFile = new File([corruptXlsxBuffer()], "corrupt.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await userEvent.upload(screen.getByLabelText("File"), corruptFile);

    expect(
      await screen.findByText(
        "Could not read this file. Please make sure it's a valid CSV or Excel file."
      )
    ).toBeInTheDocument();
  });
});
