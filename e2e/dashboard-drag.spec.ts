import { expect, test, type Page } from "@playwright/test";

const raw = async (page: Page, name: string) => (await page.getByRole("region", { name, exact: true }).boundingBox())!;
/** A panel's box relative to the top-left of the grid, so the customize toolbar appearing or going doesn't matter. */
const rel = async (page: Page, name: string) => {
  const [b, g] = [await raw(page, name), (await page.locator(".dashboard-grid").boundingBox())!];
  return { x: b.x - g.x, y: b.y - g.y, width: b.width, height: b.height };
};
const box = raw;

/** Polls until the panel's box stops changing (the grid animates for a moment), then returns it. */
async function settled(page: Page, name: string) {
  let prev = await box(page, name);
  await expect.poll(async () => {
    const now = await box(page, name);
    const same = now.x === prev.x && now.y === prev.y && now.width === prev.width && now.height === prev.height;
    prev = now;
    return same;
  }, { intervals: [150] }).toBe(true);
  return prev;
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

async function openDashboard(page: Page, name: string) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "New campaign name" }).fill(name);
  await page.getByRole("button", { name: "Create campaign" }).click();
  await page.getByRole("listitem", { name }).getByRole("button", { name: "Open" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

test("panels stay where dropped (gaps allowed), push others down, resize in fine steps and keep their place after a reload", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await openDashboard(page, "Grid Camp");
  await page.getByRole("button", { name: "Customize Dashboard" }).click();

  // Default: Session summary on the left, Player card over Pinned notes on the right.
  const summary0 = await settled(page, "Session summary");
  const card0 = await settled(page, "Player card");
  const pinned0 = await settled(page, "Pinned notes");
  expect(pinned0.x).toBeGreaterThan(summary0.x + summary0.width / 2);

  // Drag Pinned notes by its title bar 250 px down into empty space: it stays there, nothing floats up.
  const head = page.getByRole("region", { name: "Pinned notes", exact: true }).locator(".panel-head");
  const h = (await head.boundingBox())!;
  await drag(page, { x: h.x + 40, y: h.y + h.height / 2 }, { x: h.x + 40, y: h.y + h.height / 2 + 250 });
  await expect.poll(async () => (await box(page, "Pinned notes")).y).toBeGreaterThan(pinned0.y + 200);
  const dropped = await settled(page, "Pinned notes");
  expect(Math.abs(dropped.y - (pinned0.y + 250))).toBeLessThan(24);
  expect(dropped.y - (card0.y + card0.height)).toBeGreaterThan(100); // a gap remains under Player card
  expect(Math.abs((await box(page, "Player card")).y - card0.y)).toBeLessThan(4);

  // Drag Pinned notes onto the top-left of Session summary: Session summary is pushed down below it.
  const h2 = (await head.boundingBox())!;
  await drag(page, { x: h2.x + 40, y: h2.y + h2.height / 2 }, { x: h2.x + 40 + (summary0.x - dropped.x), y: h2.y + h2.height / 2 + (summary0.y - dropped.y) }); // left edges line up, so only Session summary is hit
  await expect.poll(async () => (await box(page, "Pinned notes")).x).toBeLessThan(summary0.x + 20);
  await expect.poll(async () => (await box(page, "Session summary")).y - (await box(page, "Pinned notes")).y).toBeGreaterThan(200);

  // Resize Player card from its bottom-right corner by an odd amount: the width lands off the old 12-column steps.
  const grid = (await page.locator(".dashboard-grid").boundingBox())!;
  const col = grid.width / 120;
  await Promise.all(["Session summary", "Pinned notes"].map((n) => settled(page, n)));
  const card1 = await settled(page, "Player card");
  const handle = page.getByRole("region", { name: "Player card", exact: true }).locator("xpath=..").locator(".react-resizable-handle");
  const r = (await handle.boundingBox())!;
  await drag(page, { x: r.x + r.width / 2, y: r.y + r.height / 2 }, { x: r.x + r.width / 2 - 137, y: r.y + r.height / 2 + 150 });
  await expect.poll(async () => (await box(page, "Player card")).height).toBeGreaterThan(card1.height + 80);
  const card2 = await settled(page, "Player card");
  expect(card2.width).toBeLessThan(card1.width - 100);
  const cols = Math.round((card2.width + 8) / col); // 8 px = the padding that makes the visual gap
  expect(cols % 10).not.toBe(0);

  // Done, reload: every panel is exactly where it was left, gaps included.
  const names = ["Session summary", "Player card", "Pinned notes"];
  await Promise.all(names.map((n) => settled(page, n)));
  const before = await Promise.all(names.map((n) => rel(page, n)));
  await page.getByRole("button", { name: "Done" }).click();
  await page.reload();
  await page.getByRole("listitem", { name: "Grid Camp" }).getByRole("button", { name: "Open" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  for (const [i, n] of names.entries()) {
    await expect.poll(async () => {
      const b = await rel(page, n);
      return Math.max(Math.abs(b.x - before[i].x), Math.abs(b.y - before[i].y), Math.abs(b.width - before[i].width), Math.abs(b.height - before[i].height));
    }).toBeLessThan(4);
  }
});

test("a panel pushed out of the way moves back once the dragged panel no longer covers it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1400 });
  await openDashboard(page, "Return Camp");
  await page.getByRole("button", { name: "Customize Dashboard" }).click();
  const pinned0 = await settled(page, "Pinned notes");
  const card0 = await settled(page, "Player card");

  // Drag Player card down onto Pinned notes and hold: Pinned notes is pushed down.
  const h = (await page.getByRole("region", { name: "Player card", exact: true }).locator(".panel-head").boundingBox())!;
  const start = { x: h.x + 40, y: h.y + h.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x, start.y + card0.height + 40, { steps: 12 });
  await expect.poll(async () => (await box(page, "Pinned notes")).y).toBeGreaterThan(pinned0.y + 100);

  // Keep going, well below everything, then drop: Pinned notes is back where it started.
  await page.mouse.move(start.x, start.y + 900, { steps: 12 });
  await expect.poll(async () => Math.abs((await box(page, "Pinned notes")).y - pinned0.y)).toBeLessThan(4);
  await page.mouse.up();
  const card1 = await settled(page, "Player card");
  expect(card1.y).toBeGreaterThan(card0.y + 800);
  expect(Math.abs((await settled(page, "Pinned notes")).y - pinned0.y)).toBeLessThan(4);
});
