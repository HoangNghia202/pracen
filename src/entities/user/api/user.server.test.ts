import { createTestDb } from "@/shared/api";
import { getUserByEmail, createUser } from "./user.server";

describe("user entity", () => {
  it("creates a user and finds it by email", async () => {
    const db = await createTestDb();
    await createUser({ email: "jane@example.com", name: "Jane", passwordHash: "hash" }, db);
    const found = await getUserByEmail("jane@example.com", db);
    expect(found?.name).toBe("Jane");
  });

  it("returns null when no user matches the email", async () => {
    const db = await createTestDb();
    const found = await getUserByEmail("nobody@example.com", db);
    expect(found).toBeNull();
  });
});
