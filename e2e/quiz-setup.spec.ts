import { test, expect } from "@playwright/test";

test.describe("quiz setup", () => {
  test("creates a folder with words, creates a quiz from it, and views the overview", async ({ page }) => {
    const email = `quiz-setup-test-${Date.now()}@example.com`;

    await page.goto("/register");
    await page.getByLabel("Name").fill("Quiz Setup Test");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("s3cret-password");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("http://localhost:3000/");

    await page.getByRole("link", { name: "Library" }).click();
    await page.getByRole("button", { name: "New folder" }).click();
    await page.getByLabel("Name", { exact: true }).fill("Animals");
    await page.getByRole("button", { name: "Create folder" }).click();
    await page.getByRole("link", { name: /Animals/ }).click();

    for (const [word, meaning] of [
      ["Dog", "A domesticated canine"],
      ["Cat", "A domesticated feline"],
    ]) {
      await page.getByRole("button", { name: "Add word" }).click();
      await page.getByLabel("Word", { exact: true }).fill(word);
      await page.getByLabel("Meaning", { exact: true }).fill(meaning);
      await page.getByRole("button", { name: "Add word" }).click();
      await expect(page.getByText(word)).toBeVisible();
    }

    await page.getByRole("button", { name: "Create quiz" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Quiz name").fill("Animal Quiz");
    await expect(dialog.getByText("Dog — A domesticated canine")).toBeVisible();
    await dialog.getByRole("checkbox", { name: "Meaning" }).click();
    await dialog.getByRole("button", { name: "Create quiz" }).click();

    await expect(page).toHaveURL(/\/quiz\/[^/]+$/);
    await expect(page.getByRole("heading", { name: "Animal Quiz" })).toBeVisible();
    await expect(page.getByText("2 questions")).toBeVisible();
    await expect(page.getByText("Meaning", { exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Back to Quiz" }).click();
    await expect(page).toHaveURL(/\/quiz$/);
    await expect(page.getByRole("link", { name: /Animal Quiz/ })).toBeVisible();
  });

  test("redirects an unauthenticated visitor away from a quiz-overview route", async ({ page }) => {
    await page.goto("/quiz/does-not-exist");
    await expect(page).toHaveURL(/\/login$/);
  });
});
