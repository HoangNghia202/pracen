import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDatabaseUrl } from "./env";

const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
});

it("returns DATABASE_URL when it is set", () => {
  process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/db";
  expect(getDatabaseUrl()).toBe("postgres://user:pass@localhost:5432/db");
});

it("throws an actionable error when DATABASE_URL is missing", () => {
  delete process.env.DATABASE_URL;
  expect(() => getDatabaseUrl()).toThrow(/DATABASE_URL is not set/);
});
