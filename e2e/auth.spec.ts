import { test, expect } from "@playwright/test";

test.describe("authentication", () => {
  test("redirects an unauthenticated visitor from a protected route to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("registers, signs in, and logs out", async ({ page }) => {
    const email = `test-${Date.now()}@example.com`;

    await page.goto("/register");
    await page.getByLabel("Name").fill("Test User");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("s3cret-password");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL("http://localhost:3000/");

    await page.getByRole("button", { name: "TU" }).click();
    await expect(page.getByText(email, { exact: false })).toBeVisible();
    await page.getByRole("menuitem", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
