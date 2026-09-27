import { test, expect } from "@playwright/test";

test.describe("library", () => {
  test("creates a folder, adds a word manually, renames the folder, then deletes the word and the folder", async ({
    page,
  }) => {
    const email = `library-test-${Date.now()}@example.com`;

    await page.goto("/register");
    await page.getByLabel("Name").fill("Library Test");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("s3cret-password");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("http://localhost:3000/");

    await page.getByRole("link", { name: "Library" }).click();
    await expect(page).toHaveURL(/\/library$/);
    await expect(page.getByText("No folders yet")).toBeVisible();

    await page.getByRole("button", { name: "New folder" }).click();
    await page.getByLabel("Name", { exact: true }).fill("Animals");
    await page.getByRole("button", { name: "Create folder" }).click();
    await expect(page.getByRole("link", { name: /Animals/ })).toBeVisible();

    await page.getByRole("link", { name: /Animals/ }).click();
    await expect(page.getByRole("heading", { name: "Animals" })).toBeVisible();
    await expect(page.getByText("No words yet")).toBeVisible();

    await page.getByRole("button", { name: "Add word" }).click();
    await page.getByLabel("Word", { exact: true }).fill("Dog");
    await page.getByLabel("Meaning", { exact: true }).fill("A domesticated canine");
    await page.getByRole("button", { name: "Add word" }).click();
    await expect(page.getByText("Dog")).toBeVisible();
    await expect(page.getByText("A domesticated canine")).toBeVisible();

    await page.getByRole("button", { name: "Rename folder" }).click();
    await page.getByLabel("Name", { exact: true }).fill("Pets");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: "Pets" })).toBeVisible();

    await page.getByRole("button", { name: "Delete Dog" }).click();
    await expect(page.getByText("No words yet")).toBeVisible();

    await page.getByRole("button", { name: "Delete folder" }).click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/library$/);
    await expect(page.getByText("No folders yet")).toBeVisible();
  });

  test("redirects an unauthenticated visitor away from a folder-detail route", async ({ page }) => {
    await page.goto("/library/does-not-exist");
    await expect(page).toHaveURL(/\/login$/);
  });
});
