import { resolveRedirect } from "./middleware-logic";

it("sends an unauthenticated visitor on any protected route to /login", () => {
  expect(resolveRedirect("/", false)).toBe("/login");
  expect(resolveRedirect("/library", false)).toBe("/login");
});

it("lets an unauthenticated visitor reach /login and /register", () => {
  expect(resolveRedirect("/login", false)).toBeNull();
  expect(resolveRedirect("/register", false)).toBeNull();
});

it("sends an authenticated visitor away from /login and /register", () => {
  expect(resolveRedirect("/login", true)).toBe("/");
  expect(resolveRedirect("/register", true)).toBe("/");
});

it("lets an authenticated visitor reach protected routes", () => {
  expect(resolveRedirect("/", true)).toBeNull();
});
