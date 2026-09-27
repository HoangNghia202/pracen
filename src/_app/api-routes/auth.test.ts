import { createTestDb } from "@/shared/api";
import { createUser } from "@/entities/user";
import { hashPassword } from "@/shared/lib/password";
import { authorizeCredentials } from "./auth";

describe("authorizeCredentials", () => {
  it("returns the user for correct credentials", async () => {
    const db = await createTestDb();
    const passwordHash = await hashPassword("s3cret-password");
    await createUser({ email: "sam@example.com", passwordHash }, db);

    const result = await authorizeCredentials(
      { email: "sam@example.com", password: "s3cret-password" },
      db
    );
    expect(result?.email).toBe("sam@example.com");
  });

  it("returns null for a wrong password", async () => {
    const db = await createTestDb();
    const passwordHash = await hashPassword("s3cret-password");
    await createUser({ email: "sam@example.com", passwordHash }, db);

    const result = await authorizeCredentials(
      { email: "sam@example.com", password: "wrong-password" },
      db
    );
    expect(result).toBeNull();
  });

  it("returns null for an email with no account, same as a wrong password", async () => {
    const db = await createTestDb();
    const result = await authorizeCredentials(
      { email: "nobody@example.com", password: "whatever" },
      db
    );
    expect(result).toBeNull();
  });

  it("returns null for malformed input instead of throwing", async () => {
    const db = await createTestDb();
    const result = await authorizeCredentials({ email: "not-an-email" }, db);
    expect(result).toBeNull();
  });
});
