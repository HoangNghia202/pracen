import { parseVocabFile } from "./parse-vocab-file";
import { buildVocabTemplate } from "./vocab-template";

describe("buildVocabTemplate", () => {
  it("produces a workbook the importer accepts", () => {
    const { valid, invalid } = parseVocabFile(buildVocabTemplate());

    expect(invalid).toEqual([]);
    expect(valid.map((row) => row.word)).toEqual(["run", "book"]);
    expect(valid.every((row) => row.type && row.meaning)).toBe(true);
  });
});
