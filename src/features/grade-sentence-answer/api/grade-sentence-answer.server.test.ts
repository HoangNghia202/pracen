import { vi } from "vitest";
import { generateText } from "ai";
import { gradeSentenceAnswer } from "./grade-sentence-answer.server";

vi.mock("ai", () => ({
  generateText: vi.fn(),
  Output: { object: (config: unknown) => config },
}));

describe("gradeSentenceAnswer", () => {
  it("returns the model's grading result on success", async () => {
    vi.mocked(generateText).mockResolvedValue({
      output: { isCorrect: true, feedback: "Great use of the word!" },
    } as never);

    const result = await gradeSentenceAnswer("Dog", "A domesticated canine", "I walked my dog this morning.");

    expect(result).toEqual({ isCorrect: true, feedback: "Great use of the word!" });
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: expect.stringContaining("Dog") })
    );
  });

  it("falls back to a manual-review message when the AI call fails", async () => {
    vi.mocked(generateText).mockRejectedValue(new Error("network error"));

    const result = await gradeSentenceAnswer("Dog", "A domesticated canine", "asdkjasd");

    expect(result.isCorrect).toBe(false);
    expect(result.feedback).toMatch(/couldn't automatically grade/i);
  });
});
