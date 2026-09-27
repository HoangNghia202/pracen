import { addVocabManualSchema } from "./schema";

it("accepts a minimal valid entry", () => {
  expect(addVocabManualSchema.safeParse({ word: "Dog", meaning: "A domesticated canine" }).success).toBe(
    true
  );
});

it("rejects a missing word or meaning", () => {
  expect(addVocabManualSchema.safeParse({ word: "", meaning: "A domesticated canine" }).success).toBe(
    false
  );
  expect(addVocabManualSchema.safeParse({ word: "Dog", meaning: "" }).success).toBe(false);
});
