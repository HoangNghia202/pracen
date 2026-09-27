import { hashPassword, verifyPassword } from "./password";

it("hashes a password and verifies it correctly", async () => {
  const hash = await hashPassword("correct horse battery staple");
  expect(hash).not.toBe("correct horse battery staple");
  expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
  expect(await verifyPassword("wrong password", hash)).toBe(false);
});
