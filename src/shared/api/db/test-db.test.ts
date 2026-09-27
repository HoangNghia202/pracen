import { expect, it } from "vitest";
import { createTestDb } from "./test-db";
import { users } from "./schema";

it("applies the migrations and allows inserting/reading a user", async () => {
  const db = await createTestDb();
  await db.insert(users).values({ email: "a@example.com", passwordHash: "x" });
  const rows = await db.select().from(users);
  expect(rows).toHaveLength(1);
  expect(rows[0].email).toBe("a@example.com");
});
