import { expect, test, type Page } from "@playwright/test";
import { gridAt } from "./map-helpers";

async function openCombat(page: Page, name: string) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "New campaign name" }).fill(name);
  await page.getByRole("button", { name: "Create campaign" }).click();
  await page.getByRole("listitem", { name }).getByRole("button", { name: "Open" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.getByRole("navigation", { name: "Modes" }).getByRole("button", { name: /Combat/ }).click();
  await page.getByRole("button", { name: /start encounter/i }).click();
}

test("tokens snap to squares on pointer drag", async ({ page }) => {
  await openCombat(page, "Map Camp");
  const map = page.getByRole("region", { name: "Map" });
  await map.getByLabel("Token name").fill("Goblin");
  await map.getByRole("button", { name: "Add token", exact: true }).click();
  const token = map.getByRole("button", { name: "Token Goblin", exact: true });
  await expect(token).toHaveAttribute("data-col", "0");

  // Drag from square (0,0) to the middle of square (3,2), off-centre so snapping has to happen.
  const at = await gridAt(map);
  const from = await token.boundingBox();
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(...at(3.3, 2.4), { steps: 5 });
  await page.mouse.up();
  await expect(token).toHaveAttribute("data-col", "3");
  await expect(token).toHaveAttribute("data-row", "2");

});

test("ruler measures by pointer drag, snapping to square centres and corners, and leaves token dragging alone when off", async ({ page }) => {
  await openCombat(page, "Ruler Camp");
  const map = page.getByRole("region", { name: "Map" });
  const grid = await gridAt(map);
  const at = (col: number, row: number, f = 0.5) => grid(col, row, f);

  await map.getByRole("button", { name: "Ruler" }).click();
  await page.mouse.move(...at(2, 2, 0.3));
  await page.mouse.down();
  await page.mouse.move(...at(5, 4, 0.2), { steps: 8 });
  await page.mouse.move(...at(7, 4, 0.6), { steps: 8 });
  await page.mouse.up();
  await expect(map.getByRole("status", { name: "Measured distance" })).toHaveText("5 squares, 25 ft"); // centre to centre
  await map.getByRole("button", { name: "Clear measurement" }).click();
  await page.mouse.move(...at(2, 2, 0.1)); // near a corner: snaps to it
  await page.mouse.down();
  await page.mouse.move(...at(7, 4, 0.5), { steps: 8 }); // a square's centre
  await page.mouse.up();
  await expect(map.getByRole("status", { name: "Measured distance" })).toHaveText("5.5 squares, 27.5 ft");

  await map.getByRole("button", { name: "Ruler" }).click(); // off: measurement gone, drag moves tokens again
  await expect(map.getByTestId("ruler-line")).toHaveCount(0);
  await map.getByLabel("Token name").fill("Imp");
  await map.getByRole("button", { name: "Add token", exact: true }).click();
  const token = map.getByRole("button", { name: "Token Imp", exact: true });
  const from = await token.boundingBox();
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(...at(3, 1), { steps: 5 });
  await page.mouse.up();
  await expect(token).toHaveAttribute("data-col", "3");
});

test("clicking a linked token highlights the Combatant in the tracker", async ({ page }) => {
  await openCombat(page, "Link Camp");
  await page.getByLabel("Ad-hoc name").fill("Bandit");
  await page.getByLabel("Ad-hoc HP").fill("9");
  await page.getByRole("button", { name: "Add ad-hoc" }).click();
  await page.getByLabel("Ad-hoc name").fill("Cultist");
  await page.getByLabel("Ad-hoc HP").fill("9");
  await page.getByRole("button", { name: "Add ad-hoc" }).click();
  const map = page.getByRole("region", { name: "Map" });
  await map.getByRole("button", { name: "Add tokens for all combatants" }).click();
  await expect(map.getByRole("button", { name: "Token Cultist", exact: true })).toBeVisible();

  await map.getByRole("button", { name: "Token Cultist", exact: true }).click();
  await expect(page.getByRole("listitem", { name: "Cultist" }).getByText("Selected")).toBeVisible();
});
