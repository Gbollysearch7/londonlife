import { expect, test, type Page } from "@playwright/test";

/**
 * Spec ch. 33: the first twenty minutes, played by a fresh account against a real database.
 * Runs with LL_TIME_SCALE=60 (development only), so one game minute takes one real second.
 */

async function start(page: Page, label: string) {
  await page.getByRole("button", { name: /^(Home|Here)$/ }).click();
  await page.getByRole("button", { name: `Start: ${label}` }).click();
  await expect(page.getByTestId("countdown")).toBeVisible();
  await expect(page.getByTestId("countdown")).toBeHidden({ timeout: 30_000 });
}

async function travel(page: Page, destination: string, mode: "Walk" | "Bus") {
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(`^${mode} to ${destination}`) }).click();
  await expect(page.getByTestId("location")).toContainText("On the way");
  await expect(page.getByTestId("location")).toHaveText(destination, { timeout: 30_000 });
}

test("a low-income newcomer completes the opening route and it all persists", async ({ page }) => {
  const email = `e2e${Date.now()}@example.test`;
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct horse");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).last().click();

  // Creation: exactly two traits; origin assigned once
  await page.waitForURL("**/create");
  await page.getByLabel("Name").fill("Tester");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: /Foodie/ }).click();
  await page.getByRole("button", { name: /Tidy/ }).click();
  await expect(page.getByRole("button", { name: /Active/ })).toBeDisabled();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: /Founder/ }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Begin my London life" }).click();
  await expect(page.getByText("YOUR STARTING CIRCUMSTANCES")).toBeVisible({ timeout: 30_000 });
  const origin = await page.getByRole("heading", { level: 1 }).textContent();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(origin!);
  await page.getByRole("link", { name: "Enter London" }).click();
  await page.waitForURL("**/play");
  await expect(page.getByTestId("location")).toHaveText("Home");

  // Care: cook from groceries, eat as a separate action, wash
  await start(page, "Cook beans on toast");
  await start(page, "Eat beans on toast");
  await start(page, "Shower");
  await expect(page.getByRole("button", { name: /^1 star —/ })).toBeVisible();

  // Travel and the first local
  await travel(page, "The Common Room", "Bus");
  await start(page, "Chat with Bev");
  const before = await page.getByTestId("wallet").textContent();
  await start(page, "Help Bev set up community lunch");
  const after = await page.getByTestId("wallet").textContent();
  const pounds = (s: string | null) => Number(s!.replace(/[£,]/g, ""));
  expect(pounds(after) - pounds(before)).toBeCloseTo(20, 2);
  await page.getByRole("button", { name: "Here", exact: true }).click();
  await expect(page.getByText("Already completed — this one pays once.")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  // Food Hall: buy a meal and learn from Nia
  await travel(page, "Common Table Food Hall", "Bus");
  await start(page, "Plate of the day");
  await start(page, "Watch Nia's cooking demo");
  await travel(page, "Home", "Walk");

  // Furnish: buy, place, and it saves
  await page.getByRole("button", { name: "Buy", exact: true }).click();
  await page.getByRole("button", { name: "Comfort", exact: true }).click();
  await page.locator("li", { hasText: "Armchair" }).getByRole("button", { name: /^Buy/ }).click();
  await page.locator("li", { hasText: "Armchair" }).getByRole("button", { name: "Place" }).click();
  await page.getByRole("button", { name: "Place here" }).click();
  await expect(page.getByText("Armchair placed.")).toBeVisible();

  // Missions: claim every completed one, then the bonus
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: /^Phone/ }).click();
  await page.getByRole("button", { name: /Missions/ }).click();
  const claims = page.getByRole("button", { name: "Claim", exact: true });
  while ((await claims.count()) > 0 && (await claims.first().isEnabled())) {
    await claims.first().click();
    await page.waitForTimeout(400);
  }
  await expect(page.getByText("Claimed").first()).toBeVisible();

  // Persistence: reload and find the same life
  const wallet = await page.getByTestId("wallet").textContent();
  await page.reload();
  await expect(page.getByTestId("location")).toHaveText("Home");
  await expect(page.getByTestId("wallet")).toHaveText(wallet!);
  await page.getByRole("button", { name: "Buy", exact: true }).click();
  await page.getByRole("tab", { name: /Your items/ }).click();
  await expect(page.locator("li", { hasText: "Armchair" })).toContainText("In your home");
});
