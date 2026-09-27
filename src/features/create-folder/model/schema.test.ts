import { createFolderSchema } from "./schema";

it("accepts a valid folder name", () => {
  expect(createFolderSchema.safeParse({ name: "Animals" }).success).toBe(true);
});

it("rejects an empty or whitespace-only folder name", () => {
  expect(createFolderSchema.safeParse({ name: "   " }).success).toBe(false);
});

it("rejects a folder name over 100 characters", () => {
  expect(createFolderSchema.safeParse({ name: "a".repeat(101) }).success).toBe(false);
});
