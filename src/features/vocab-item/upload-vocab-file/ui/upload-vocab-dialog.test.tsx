import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as XLSX from "xlsx";
import { vi } from "vitest";
import { generateVocabExamplesAction } from "../api/generate-examples.server";
import { importVocabAction } from "../api/import-vocab.server";
import { UploadVocabDialog } from "./upload-vocab-dialog";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../api/generate-examples.server", () => ({ generateVocabExamplesAction: vi.fn() }));
vi.mock("../api/import-vocab.server", () => ({ importVocabAction: vi.fn() }));

function xlsxBuffer(rows: string[][]): ArrayBuffer {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

function corruptXlsxBuffer(): ArrayBuffer {
  const full = xlsxBuffer([
    ["word", "type", "meaning"],
    ["Dog", "noun", "A domesticated canine"],
  ]);
  // A truncated ZIP-structured buffer reliably makes XLSX.read throw
  // ("Unsupported ZIP file"), simulating a corrupt/incomplete upload.
  return full.slice(0, Math.floor(full.byteLength / 2));
}

async function uploadRows(rows: string[][]) {
  render(<UploadVocabDialog folderId="folder-1" />);
  await userEvent.click(screen.getByRole("button", { name: "Import file" }));
  const file = new File([xlsxBuffer(rows)], "words.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  await userEvent.upload(screen.getByLabelText("File"), file);
}

describe("UploadVocabDialog", () => {
  beforeEach(() => {
    vi.mocked(generateVocabExamplesAction).mockReset();
    vi.mocked(importVocabAction).mockReset();
    vi.mocked(importVocabAction).mockResolvedValue({ ok: true, count: 2 });
  });

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

  it("generates examples only for rows without one, and imports the edited examples", async () => {
    vi.mocked(generateVocabExamplesAction).mockResolvedValue({ ok: true, examples: ["I run daily."] });

    await uploadRows([
      ["word", "type", "meaning", "example"],
      ["Dog", "noun", "A canine", "The dog barks."],
      ["run", "verb", "Move fast", ""],
    ]);

    // The file change handler is async; wait for its result before asserting on the call.
    const runExample = await screen.findByDisplayValue("I run daily.");
    expect(generateVocabExamplesAction).toHaveBeenCalledWith([
      { word: "run", type: "verb", meaning: "Move fast" },
    ]);
    expect(screen.getByLabelText("Example for Dog")).toHaveValue("The dog barks.");

    await userEvent.clear(runExample);
    await userEvent.type(runExample, "She runs to school.");
    await userEvent.click(screen.getByRole("button", { name: "Import 2 words" }));

    expect(importVocabAction).toHaveBeenCalledWith("folder-1", [
      { word: "Dog", type: "noun", meaning: "A canine", example: "The dog barks." },
      { word: "run", type: "verb", meaning: "Move fast", example: "She runs to school." },
    ]);
  });

  it("still allows import when AI generation fails, and reports how many examples are missing", async () => {
    vi.mocked(generateVocabExamplesAction).mockResolvedValue({ ok: true, examples: [null, "Cats purr."] });

    await uploadRows([
      ["word", "type", "meaning"],
      ["Dog", "noun", "A canine"],
      ["Cat", "noun", "A feline"],
    ]);

    expect(
      await screen.findByText("Couldn't generate examples for 1 word. You can add them manually.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Example for Dog")).toHaveValue("");

    await userEvent.click(screen.getByRole("button", { name: "Import 2 words" }));

    expect(importVocabAction).toHaveBeenCalledWith("folder-1", [
      { word: "Dog", type: "noun", meaning: "A canine" },
      { word: "Cat", type: "noun", meaning: "A feline", example: "Cats purr." },
    ]);
  });

  it("treats a thrown generation error like all examples failing", async () => {
    vi.mocked(generateVocabExamplesAction).mockRejectedValue(new Error("boom"));

    await uploadRows([
      ["word", "type", "meaning"],
      ["Dog", "noun", "A canine"],
      ["Cat", "noun", "A feline"],
    ]);

    expect(
      await screen.findByText("Couldn't generate examples for 2 words. You can add them manually.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import 2 words" })).toBeEnabled();
  });

  it("blocks files with more than 100 valid rows without calling AI", async () => {
    const rows = [["word", "type", "meaning"], ...Array.from({ length: 101 }, (_, i) => [`w${i}`, "noun", "m"])];

    await uploadRows(rows);

    expect(
      await screen.findByText("This file has 101 words. You can import at most 100 at a time.")
    ).toBeInTheDocument();
    expect(generateVocabExamplesAction).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Import 101 words" })).toBeDisabled());
  });
});
