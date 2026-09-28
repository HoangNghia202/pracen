import { buildQuizQuestions } from "./build-questions";

const dog = { id: "1", word: "Dog", meaning: "A domesticated canine" };
const cat = { id: "2", word: "Cat", meaning: "A domesticated feline" };
const bird = { id: "3", word: "Bird", meaning: "A feathered animal" };
const fish = { id: "4", word: "Fish", meaning: "An aquatic animal" };

describe("buildQuizQuestions", () => {
  it("generates one question per word per selected type, word-then-canonical-type order", () => {
    const questions = buildQuizQuestions({
      selectedItems: [dog, cat],
      questionTypes: ["word", "meaning"], // input order deliberately reversed from canonical
      distractorPool: [dog, cat, bird, fish],
    });

    expect(questions).toHaveLength(4);
    expect(questions.map((q) => [q.word, q.questionType])).toEqual([
      ["Dog", "meaning"],
      ["Dog", "word"],
      ["Cat", "meaning"],
      ["Cat", "word"],
    ]);
    expect(questions.map((q) => q.orderIndex)).toEqual([0, 1, 2, 3]);
  });

  it("gives a sentence question no choices", () => {
    const [question] = buildQuizQuestions({
      selectedItems: [dog],
      questionTypes: ["sentence"],
      distractorPool: [dog],
    });
    expect(question.choices).toBeNull();
    expect(question.word).toBe("Dog");
    expect(question.meaning).toBe("A domesticated canine");
  });

  it("gives a meaning/word question exactly 4 unique choices including the correct one, when the pool allows it", () => {
    const [question] = buildQuizQuestions({
      selectedItems: [dog],
      questionTypes: ["meaning"],
      distractorPool: [dog, cat, bird, fish],
    });
    expect(question.choices).toHaveLength(4);
    expect(question.choices!.map((c) => c.id)).toContain(dog.id);
    expect(new Set(question.choices!.map((c) => c.id)).size).toBe(4);
  });

  it("falls back to fewer choices when the distractor pool is smaller than 4", () => {
    const [question] = buildQuizQuestions({
      selectedItems: [dog],
      questionTypes: ["word"],
      distractorPool: [dog, cat],
    });
    expect(question.choices).toHaveLength(2);
    expect(question.choices!.map((c) => c.id).sort()).toEqual([cat.id, dog.id].sort());
  });

  it("produces a single-choice question when the folder has only the target word", () => {
    const [question] = buildQuizQuestions({
      selectedItems: [dog],
      questionTypes: ["meaning"],
      distractorPool: [dog],
    });
    expect(question.choices).toHaveLength(1);
    expect(question.choices![0].id).toBe(dog.id);
  });

  it("is deterministic given an injected random function", () => {
    const args = {
      selectedItems: [dog],
      questionTypes: ["meaning"] as const,
      distractorPool: [dog, cat, bird, fish],
    };
    expect(buildQuizQuestions({ ...args, questionTypes: [...args.questionTypes] }, () => 0)).toEqual(
      buildQuizQuestions({ ...args, questionTypes: [...args.questionTypes] }, () => 0)
    );
  });
});
