import * as XLSX from "xlsx";
import { parseVocabFile } from "./parse-vocab-file";

function bufferFromRows(rows: (string | number)[][]): ArrayBuffer {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}

describe("parseVocabFile", () => {
  it("parses valid rows using header names, case-insensitively", () => {
    const buffer = bufferFromRows([
      ["Word", "Meaning", "Example", "Part of Speech"],
      ["Dog", "A domesticated canine", "The dog barks.", "noun"],
    ]);

    const { valid, invalid } = parseVocabFile(buffer);

    expect(invalid).toEqual([]);
    expect(valid).toEqual([
      { word: "Dog", meaning: "A domesticated canine", example: "The dog barks.", partOfSpeech: "noun" },
    ]);
  });

  it("treats example and part of speech as optional", () => {
    const buffer = bufferFromRows([
      ["word", "meaning"],
      ["Cat", "A domesticated feline"],
    ]);

    const { valid, invalid } = parseVocabFile(buffer);

    expect(invalid).toEqual([]);
    expect(valid).toEqual([{ word: "Cat", meaning: "A domesticated feline" }]);
  });

  it("reports rows missing a required word or meaning, without dropping valid rows around them", () => {
    const buffer = bufferFromRows([
      ["word", "meaning"],
      ["Dog", "A domesticated canine"],
      ["", "Missing word"],
      ["Cat", ""],
    ]);

    const { valid, invalid } = parseVocabFile(buffer);

    expect(valid).toEqual([{ word: "Dog", meaning: "A domesticated canine" }]);
    expect(invalid).toEqual([
      { row: 3, reason: "Word is required" },
      { row: 4, reason: "Meaning is required" },
    ]);
  });

  it("ignores extra unrecognized columns instead of erroring on them", () => {
    const buffer = bufferFromRows([
      ["Word", "Meaning", "Notes", "Id"],
      ["Dog", "A domesticated canine", "irrelevant", "42"],
    ]);

    const { valid, invalid } = parseVocabFile(buffer);

    expect(invalid).toEqual([]);
    expect(valid).toEqual([{ word: "Dog", meaning: "A domesticated canine" }]);
  });

  it("returns no valid or invalid rows for a header-only or empty file", () => {
    const buffer = bufferFromRows([["word", "meaning"]]);
    expect(parseVocabFile(buffer)).toEqual({ valid: [], invalid: [] });
    expect(parseVocabFile(bufferFromRows([]))).toEqual({ valid: [], invalid: [] });
  });
});
