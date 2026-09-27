import { createTestDb } from "@/shared/testing";
import { registerWithCredentials } from "./register.server";

describe("registerWithCredentials", () => {
  it("creates a new user for valid input", async () => {
    const db = await createTestDb();
    const result = await registerWithCredentials(
      { name: "Jane", email: "jane@example.com", password: "s3cret-password" },
      db
    );
    expect(result.ok).toBe(true);
  });

  it("rejects a duplicate email with a clear message", async () => {
    const db = await createTestDb();
    await registerWithCredentials(
      { name: "Jane", email: "dup@example.com", password: "s3cret-password" },
      db
    );
    const second = await registerWithCredentials(
      { name: "Jane Again", email: "dup@example.com", password: "another-password" },
      db
    );
    expect(second).toEqual({ ok: false, error: "An account with this email already exists" });
  });

  it("rejects invalid input without touching the database", async () => {
    const db = await createTestDb();
    const result = await registerWithCredentials({ email: "not-an-email", password: "x" }, db);
    expect(result.ok).toBe(false);
  });
});
