import { expect, test } from "@playwright/test";

test("a spell found in global search opens as a card and can be sent to the Pop-out Window", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "New campaign name" }).fill("Search Camp");
  await page.getByRole("button", { name: "Create campaign" }).click();
  await page.getByRole("listitem", { name: "Search Camp" }).getByRole("button", { name: "Open" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "Global search" });
  await dialog.getByRole("searchbox", { name: "Search" }).fill("fireball");
  await dialog.getByRole("list", { name: "Spells" }).getByRole("button", { name: /^Fireball/ }).click();
  await expect(page.getByRole("article", { name: "Fireball spell" })).toContainText("150 feet");

  const [pop] = await Promise.all([page.context().waitForEvent("page"), page.getByRole("button", { name: "Pop out Stat Blocks" }).click()]);
  await pop.waitForLoadState();
  await expect(pop.getByRole("article", { name: "Fireball spell" })).toContainText("Evocation");
});
