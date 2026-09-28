// e2e/quiz-attempt.spec.ts
import { test, expect } from "@playwright/test";

test.describe("quiz attempt", () => {
  test("creates a quiz, takes it, and views the graded result", async ({ page }) => {
    const email = `quiz-attempt-test-${Date.now()}@example.com`;

    await page.goto("/register");
    await page.getByLabel("Name").fill("Quiz Attempt Test");
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
    await dialog.getByRole("checkbox", { name: "Meaning" }).click();
    await dialog.getByRole("button", { name: "Create quiz" }).click();

    await expect(page).toHaveURL(/\/quiz\/[^/]+$/);
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page).toHaveURL(/\/attempt$/);

    for (let i = 1; i <= 2; i++) {
      await expect(page.getByText(`Question ${i} of 2`)).toBeVisible();
      const promptText = await page.locator("p.text-lg").innerText();
      const correctMeaning = promptText.includes("Dog") ? "A domesticated canine" : "A domesticated feline";
      await page.getByRole("button", { name: correctMeaning }).click();
      await page.getByRole("button", { name: "Submit" }).click();
      await expect(page.getByText("Correct!")).toBeVisible();

      if (i < 2) {
        await page.getByRole("button", { name: "Next question" }).click();
      } else {
        await page.getByRole("button", { name: "See results" }).click();
      }
    }

    await expect(page).toHaveURL(/\/attempt\/[^/]+$/);
    await expect(page.getByText("2/2 correct")).toBeVisible();

    await page.getByRole("link", { name: "Back to Animal Quiz" }).click();
    await expect(page).toHaveURL(/\/quiz\/[^/]+$/);
    await expect(page.getByRole("link", { name: /2\/2/ })).toBeVisible();
  });

  test("redirects an unauthenticated visitor away from a quiz-attempt route", async ({ page }) => {
    await page.goto("/quiz/does-not-exist/attempt");
    await expect(page).toHaveURL(/\/login$/);
  });
});
