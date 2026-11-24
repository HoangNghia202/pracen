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
      ["Word", "Type", "Meaning", "Example", "Part of Speech"],
      ["Dog", "noun", "A domesticated canine", "The dog barks.", "noun"],
    ]);

    const { valid, invalid } = parseVocabFile(buffer);

    expect(invalid).toEqual([]);
    expect(valid).toEqual([
      {
        word: "Dog",
        type: "noun",
        meaning: "A domesticated canine",
        example: "The dog barks.",
        partOfSpeech: "noun",
      },
    ]);
  });

  it("treats example and part of speech as optional", () => {
    const buffer = bufferFromRows([
      ["word", "type", "meaning"],
      ["Cat", "noun", "A domesticated feline"],
    ]);

    const { valid, invalid } = parseVocabFile(buffer);

    expect(invalid).toEqual([]);
    expect(valid).toEqual([{ word: "Cat", type: "noun", meaning: "A domesticated feline" }]);
  });

  it("accepts any user-defined type text", () => {
    const buffer = bufferFromRows([
      ["word", "type", "meaning"],
      ["give up", "phrasal verb", "Stop trying"],
    ]);

    expect(parseVocabFile(buffer).valid).toEqual([
      { word: "give up", type: "phrasal verb", meaning: "Stop trying" },
    ]);
  });

  it("reports rows missing a required word, type, or meaning, without dropping valid rows around them", () => {
    const buffer = bufferFromRows([
      ["word", "type", "meaning"],
      ["Dog", "noun", "A domesticated canine"],
      ["", "noun", "Missing word"],
      ["Bird", "", "Missing type"],
      ["Cat", "noun", ""],
    ]);

    const { valid, invalid } = parseVocabFile(buffer);

    expect(valid).toEqual([{ word: "Dog", type: "noun", meaning: "A domesticated canine" }]);
    expect(invalid).toEqual([
      { row: 3, reason: "Word is required" },
      { row: 4, reason: "Type is required" },
      { row: 5, reason: "Meaning is required" },
    ]);
  });

  it("marks every row invalid when the Type column is absent", () => {
    const buffer = bufferFromRows([
      ["word", "meaning"],
      ["Dog", "A domesticated canine"],
    ]);

    expect(parseVocabFile(buffer)).toEqual({
      valid: [],
      invalid: [{ row: 2, reason: "Type is required" }],
    });
  });

  it("ignores extra unrecognized columns instead of erroring on them", () => {
    const buffer = bufferFromRows([
      ["Word", "Type", "Meaning", "Notes", "Id"],
      ["Dog", "noun", "A domesticated canine", "irrelevant", "42"],
    ]);

    const { valid, invalid } = parseVocabFile(buffer);

    expect(invalid).toEqual([]);
    expect(valid).toEqual([{ word: "Dog", type: "noun", meaning: "A domesticated canine" }]);
  });

  it("returns no valid or invalid rows for a header-only or empty file", () => {
    const buffer = bufferFromRows([["word", "type", "meaning"]]);
    expect(parseVocabFile(buffer)).toEqual({ valid: [], invalid: [] });
    expect(parseVocabFile(bufferFromRows([]))).toEqual({ valid: [], invalid: [] });
  });

  it("marks rows with over-long fields as invalid", () => {
    const buffer = bufferFromRows([
      ["word", "type", "meaning"],
      ["a".repeat(201), "noun", "m"],
      ["dog", "t".repeat(51), "m"],
      ["cat", "noun", "m".repeat(501)],
      ["ok", "noun", "fine"],
    ]);

    const { valid, invalid } = parseVocabFile(buffer);

    expect(valid).toHaveLength(1);
    expect(invalid).toEqual([
      { row: 2, reason: "Word is too long (max 200)" },
      { row: 3, reason: "Type is too long (max 50)" },
      { row: 4, reason: "Meaning is too long (max 500)" },
    ]);
  });
});
