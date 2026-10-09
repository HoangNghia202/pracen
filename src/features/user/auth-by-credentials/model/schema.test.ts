import { registerSchema, loginSchema } from "./schema";

it("rejects a password shorter than 8 characters", () => {
  const result = registerSchema.safeParse({ name: "A", email: "a@example.com", password: "short" });
  expect(result.success).toBe(false);
});

it("normalizes email to lowercase and trims whitespace", () => {
  const result = loginSchema.parse({ email: "  A@Example.com  ", password: "x" });
  expect(result.email).toBe("a@example.com");
});
