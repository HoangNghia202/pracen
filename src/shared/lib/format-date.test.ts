import { formatDate } from "./format-date";

it("formats a date as a short month, day, and year in UTC", () => {
  expect(formatDate(new Date("2026-09-27T00:00:00Z"))).toBe("Sep 27, 2026");
});
