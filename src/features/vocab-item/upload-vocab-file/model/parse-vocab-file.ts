import * as XLSX from "xlsx";
import {
  MAX_EXAMPLE_LENGTH,
  MAX_MEANING_LENGTH,
  MAX_PART_OF_SPEECH_LENGTH,
  MAX_TYPE_LENGTH,
  MAX_WORD_LENGTH,
} from "./schema";

export interface ParsedVocabRow {
  word: string;
  type: string;
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
    const type = normalized.type ?? "";
    const meaning = normalized.meaning ?? "";
    const sheetRow = index + 2; // +1 for the header row, +1 for 1-based row numbers

    if (!word) {
      invalid.push({ row: sheetRow, reason: "Word is required" });
      return;
    }
    if (!type) {
      invalid.push({ row: sheetRow, reason: "Type is required" });
      return;
    }
    if (!meaning) {
      invalid.push({ row: sheetRow, reason: "Meaning is required" });
      return;
    }

    const example = normalized.example;
    const partOfSpeech = normalized.partofspeech;

    const tooLong = [
      ["Word", word, MAX_WORD_LENGTH],
      ["Type", type, MAX_TYPE_LENGTH],
      ["Meaning", meaning, MAX_MEANING_LENGTH],
      ["Example", example ?? "", MAX_EXAMPLE_LENGTH],
      ["Part of speech", partOfSpeech ?? "", MAX_PART_OF_SPEECH_LENGTH],
    ] as const;
    const exceeded = tooLong.find(([, value, max]) => value.length > max);
    if (exceeded) {
      invalid.push({ row: sheetRow, reason: `${exceeded[0]} is too long (max ${exceeded[2]})` });
      return;
    }

    valid.push({
      word,
      type,
      meaning,
      ...(example ? { example } : {}),
      ...(partOfSpeech ? { partOfSpeech } : {}),
    });
  });

  return { valid, invalid };
}
