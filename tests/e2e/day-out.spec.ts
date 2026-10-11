import { expect, test } from "@playwright/test";

/**
 * Milestone 2 route that works at any hour: a story ending, savings, a taxi across the city,
 * an always-open venue activity, the 3D map, and persistence after reload.
 */
test("a day out: story, savings, taxi to the river and it persists", async ({ page }) => {
  const email = `day${Date.now()}@example.test`;
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct horse");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).last().click();
  await page.waitForURL("**/create");
  await page.getByLabel("Name").fill("Rio");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: /Creative/ }).click();
  await page.getByRole("button", { name: /Sociable/ }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: /Music Mastery/ }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Begin my London life" }).click();
  await page.getByRole("link", { name: "Enter London" }).click({ timeout: 30_000 });
  await page.waitForURL("**/play");
  await expect(page.getByTestId("location")).toHaveText("Home");

  const phone = async (app: RegExp) => {
    await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: /^Phone/ }).click();
    await page.getByRole("button", { name: app }).first().click();
  };

  // A story: start it and reach an ending from home.
  await phone(/^Stories/);
  await page.locator("li", { hasText: "Lost on the Night Bus" }).getByRole("button", { name: "Start" }).click();
  await expect(page.getByText(/last bus home/)).toBeVisible();
  await page.getByRole("button", { name: /Hand it to the driver/ }).click();
  await expect(page.getByText(/Doing the right thing/).first()).toBeVisible();
  await expect(page.locator("li", { hasText: "Lost on the Night Bus" }).getByText(/✓/)).toBeVisible();

  // Savings: move £10 across and see it in the bank.
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: /^Bank/ }).first().click();
  await page.getByLabel("Save amount in pounds").fill("10");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Savings £10.00", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  // Taxi to the South Bank via the map sheet.
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await page.getByRole("button", { name: /^Taxi to South Bank Promenade/ }).click();
  await expect(page.getByTestId("location")).toContainText("On the way");
  await expect(page.getByTestId("location")).toHaveText("South Bank Promenade", { timeout: 60_000 });

  // An always-open riverside activity.
  await page.getByRole("button", { name: "Here", exact: true }).click();
  await page.getByRole("button", { name: "Start: Stroll along the river" }).click();
  await expect(page.getByTestId("countdown")).toBeVisible();
  await expect(page.getByTestId("countdown")).toBeHidden({ timeout: 30_000 });

  // Persistence.
  const wallet = await page.getByTestId("wallet").textContent();
  await page.reload();
  await expect(page.getByTestId("location")).toHaveText("South Bank Promenade");
  await expect(page.getByTestId("wallet")).toHaveText(wallet!);
});
