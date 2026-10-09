import { createQuizSchema } from "./schema";

const valid = {
  folderId: "f1",
  name: "Animal Quiz",
  vocabItemIds: ["v1", "v2"],
  questionTypes: ["meaning"],
  shuffleQuestions: false,
  shuffleAnswers: false,
};

it("accepts valid input", () => {
  expect(createQuizSchema.safeParse(valid).success).toBe(true);
});

it("rejects a missing folder id", () => {
  expect(createQuizSchema.safeParse({ ...valid, folderId: "" }).success).toBe(false);
});

it("rejects an empty or whitespace-only name", () => {
  expect(createQuizSchema.safeParse({ ...valid, name: "   " }).success).toBe(false);
});

it("rejects zero selected words", () => {
  expect(createQuizSchema.safeParse({ ...valid, vocabItemIds: [] }).success).toBe(false);
});

it("rejects zero selected question types", () => {
  expect(createQuizSchema.safeParse({ ...valid, questionTypes: [] }).success).toBe(false);
});

it("rejects an unknown question type", () => {
  expect(createQuizSchema.safeParse({ ...valid, questionTypes: ["essay"] }).success).toBe(false);
});
