import * as XLSX from "xlsx";

export const VOCAB_TEMPLATE_FILENAME = "vocab-import-template.xlsx";

const TEMPLATE_ROWS = [
  ["Word", "Type", "Meaning", "Example", "Part of speech"],
  ["run", "verb", "to move quickly on foot", "", ""],
  ["book", "noun", "a set of printed pages bound together", "I read a good book.", ""],
];

export function buildVocabTemplate(): ArrayBuffer {
  const sheet = XLSX.utils.aoa_to_sheet(TEMPLATE_ROWS);
  sheet["!cols"] = [{ wch: 16 }, { wch: 12 }, { wch: 40 }, { wch: 40 }, { wch: 16 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Vocab");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}

export function downloadVocabTemplate(): void {
  const blob = new Blob([buildVocabTemplate()], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = VOCAB_TEMPLATE_FILENAME;
  link.click();
  URL.revokeObjectURL(url);
}
