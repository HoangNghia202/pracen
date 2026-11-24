import { vi } from "vitest";
import { generateText } from "ai";
import { auth } from "@/_app/api-routes/auth";
import { generateVocabExamplesAction } from "./generate-examples.server";

vi.mock("@/_app/api-routes/auth", () => ({ auth: vi.fn() }));
vi.mock("ai", () => ({
  generateText: vi.fn(),
  Output: { object: (config: unknown) => config },
}));

function rows(n: number) {
  return Array.from({ length: n }, (_, i) => ({ word: `w${i}`, type: "noun", meaning: `m${i}` }));
}

// Echo back an example for each word listed in the prompt, in order.
function echoExamples() {
  vi.mocked(generateText).mockImplementation((async ({ prompt }: { prompt: string }) => {
    const words = [...prompt.matchAll(/word: "([^"]+)"/g)].map((m) => m[1]);
    return { output: { examples: words.map((word) => ({ word, example: `Example for ${word}.` })) } };
  }) as never);
}

describe("generateVocabExamplesAction", () => {
  beforeEach(() => {
    vi.mocked(generateText).mockReset();
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
  });

  it("returns one example per row, in order, using word type and meaning in the prompt", async () => {
    echoExamples();

    const result = await generateVocabExamplesAction([{ word: "run", type: "verb", meaning: "move fast" }]);

    expect(result).toEqual({ ok: true, examples: ["Example for run."] });
    const call = vi.mocked(generateText).mock.calls[0][0] as { prompt: string; timeout: number };
    expect(call.prompt).toContain('type: "verb"');
    expect(call.prompt).toContain('meaning: "move fast"');
    expect(call.timeout).toBe(30_000);
  });

  it("splits rows into chunks of 25 and keeps results aligned", async () => {
    echoExamples();

    const result = await generateVocabExamplesAction(rows(30));

    expect(generateText).toHaveBeenCalledTimes(2);
    expect(result.ok && result.examples).toEqual(rows(30).map((r) => `Example for ${r.word}.`));
  });

  it("returns null for every row of a chunk that fails, without affecting other chunks", async () => {
    vi.mocked(generateText)
      .mockRejectedValueOnce(new Error("gateway down"))
      .mockImplementationOnce((async ({ prompt }: { prompt: string }) => {
        const words = [...prompt.matchAll(/word: "([^"]+)"/g)].map((m) => m[1]);
        return { output: { examples: words.map((word) => ({ word, example: `Ex ${word}` })) } };
      }) as never);

    const result = await generateVocabExamplesAction(rows(26));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.examples.slice(0, 25)).toEqual(Array(25).fill(null));
    expect(result.examples[25]).toBe("Ex w25");
  });

  it("returns null when the model's word doesn't match or the example is blank", async () => {
    vi.mocked(generateText).mockResolvedValue({
      output: {
        examples: [
          { word: "something else", example: "Wrong word." },
          { word: "W1", example: "   " },
        ],
      },
    } as never);

    const result = await generateVocabExamplesAction(rows(3));

    expect(result).toEqual({ ok: true, examples: [null, null, null] });
  });

  it("refuses when signed out", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await generateVocabExamplesAction(rows(1));

    expect(result).toEqual({ ok: false, error: "You must be signed in." });
    expect(generateText).not.toHaveBeenCalled();
  });

  it("rejects more than 100 rows", async () => {
    const result = await generateVocabExamplesAction(rows(101));

    expect(result).toEqual({ ok: false, error: "Too many rows to import at once (max 100)" });
    expect(generateText).not.toHaveBeenCalled();
  });
});
