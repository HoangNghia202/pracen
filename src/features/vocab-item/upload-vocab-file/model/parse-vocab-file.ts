import * as XLSX from "xlsx";

export interface ParsedVocabRow {
  word: string;
  meaning: string;
  example?: string;
  partOfSpeech?: string;
}

export interface InvalidVocabRow {
  row: number;
  reason: string;
}

export interface ParseVocabFileResult {
  valid: ParsedVocabRow[];
  invalid: InvalidVocabRow[];
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

export function parseVocabFile(buffer: ArrayBuffer): ParseVocabFileResult {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const valid: ParsedVocabRow[] = [];
  const invalid: InvalidVocabRow[] = [];

  rows.forEach((rawRow, index) => {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawRow)) {
      normalized[normalizeHeader(key)] = String(value ?? "").trim();
    }

    const word = normalized.word ?? "";
    const meaning = normalized.meaning ?? "";
    const sheetRow = index + 2; // +1 for the header row, +1 for 1-based row numbers

    if (!word) {
      invalid.push({ row: sheetRow, reason: "Word is required" });
      return;
    }
    if (!meaning) {
      invalid.push({ row: sheetRow, reason: "Meaning is required" });
      return;
    }

    const example = normalized.example;
    const partOfSpeech = normalized.partofspeech;
    valid.push({
      word,
      meaning,
      ...(example ? { example } : {}),
      ...(partOfSpeech ? { partOfSpeech } : {}),
    });
  });

  return { valid, invalid };
}
