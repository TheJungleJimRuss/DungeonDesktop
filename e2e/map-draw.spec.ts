import { expect, test } from "@playwright/test";
import { gridAt, openMap, storedLines, type View } from "./map-helpers";

const O = { x: 8, y: 7 }; // the old 20 x 20 coordinates, shifted so they fit the canvas
const grid = (map: Parameters<typeof gridAt>[0]) => gridAt(map, { cx: 0, cy: 0, px: 32 } as View, O);
const P = (x: number, y: number) => ({ x: x - O.x, y: y - O.y });

test("draws an open Line (double-click), a closed Shape (first point) and drags a point", async ({ page }) => {
  const map = await openMap(page, "Draw Camp");
  let at = await grid(map);

  await map.getByRole("button", { name: "Draw", exact: true }).click();
  // open Line: (2,2) (6,2) (6,5), finished by a double-click on the last point
  await page.mouse.click(...at(2, 2, 0.2));
  await page.mouse.click(...at(6, 2, -0.15));
  await page.mouse.dblclick(...at(6, 5, 0.1));
  await expect(map.getByRole("button", { name: "Line 1", exact: true })).toBeVisible();
  await expect.poll(async () => (await storedLines(page)).length).toBe(1);
  expect((await storedLines(page))[0]).toMatchObject({ closed: false, points: [P(2, 2), P(6, 2), P(6, 5)], segments: ["plain", "plain"] });

  // finishing goes back to Select; L picks Draw again
  await expect(map.getByRole("button", { name: "Select", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("l");
  // closed Shape: click the first point again. The editor under the canvas may have scrolled the page: measure again.
  at = await grid(map);
  for (const [c, r] of [[10, 10], [15, 10], [15, 14]]) await page.mouse.click(...at(c, r));
  await page.mouse.click(...at(10, 10, 0.1));
  await expect(map.getByRole("button", { name: "Shape 1", exact: true })).toBeVisible();
  await expect.poll(async () => (await storedLines(page)).length).toBe(2);
  expect((await storedLines(page))[1]).toMatchObject({ closed: true, points: [P(10, 10), P(15, 10), P(15, 14)], segments: ["plain", "plain", "plain"] });

  at = await grid(map);
  // Select the Line (click on its first segment), drag its second point to (8,3)
  await map.getByRole("button", { name: "Select", exact: true }).click();
  await page.mouse.click(...at(4, 2));
  await expect(map.getByRole("group", { name: "Edit Line 1" })).toBeVisible();
  const handle = await map.getByRole("button", { name: "Point 2 of Line 1" }).boundingBox();
  await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2);
  await page.mouse.down();
  await page.mouse.move(...at(8, 3, 0.2), { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await storedLines(page))[0].points[1]).toEqual(P(8, 3));

  // a Wall segment persists too
  await map.getByRole("button", { name: "Segment 1 of Line 1" }).click();
  await map.getByLabel("Segment 1 type").selectOption("wall");
  await expect.poll(async () => (await storedLines(page))[0].segments).toEqual(["wall", "plain"]);
  await expect(map.locator(".map-wall")).toHaveCount(1);
});

test("Esc steps back on the Map (cancel the Line, then back to Select) before it leaves for the Dashboard", async ({ page }) => {
  const map = await openMap(page, "Esc Camp");
  const draw = map.getByRole("button", { name: "Draw", exact: true });
  await draw.click();
  await page.keyboard.press("Escape"); // Draw tool, nothing drawn yet: back to Select, still on the Map
  await expect(map.getByRole("button", { name: "Select", exact: true })).toHaveAttribute("aria-pressed", "true");
  await draw.click();
  await page.getByTestId("map-draw").click({ position: { x: 100, y: 100 } });
  await expect(map.getByRole("status", { name: "Drawing" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(map.getByRole("status", { name: "Drawing" })).toHaveCount(0);
  await expect(draw).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(map.getByRole("button", { name: "Select", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(map).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});

test("makes a drawn Line a Route, labels its length, and dragging a point updates the label", async ({ page }) => {
  const map = await openMap(page, "Route Camp");
  const at = await grid(map);

  await map.getByRole("button", { name: "Draw", exact: true }).click();
  await page.mouse.click(...at(2, 2));
  await page.mouse.click(...at(6, 2));
  await page.mouse.dblclick(...at(6, 5)); // 4 + 3 squares x 5 ft
  await map.getByRole("button", { name: "Make route" }).click();
  const route = map.getByRole("button", { name: "Route 1", exact: true });
  await expect(route).toBeVisible();
  await expect(route.locator(".map-route-label")).toHaveText("35 ft");
  await expect.poll(async () => (await storedLines(page)).length).toBe(1);
  expect((await storedLines(page))[0]).toMatchObject({ closed: false, route: true, points: [P(2, 2), P(6, 2), P(6, 5)] });

  await map.getByRole("button", { name: "Select", exact: true }).click();
  await page.mouse.click(...at(4, 2));
  await expect(map.getByRole("group", { name: "Edit Route 1" })).toBeVisible();
  const handle = await map.getByRole("button", { name: "Point 3 of Route 1" }).boundingBox();
  await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2);
  await page.mouse.down();
  await page.mouse.move(...at(6, 8), { steps: 6 }); // 4 + 6 squares
  await expect(route.locator(".map-route-label")).toHaveText("50 ft"); // live, before release
  await page.mouse.up();
  await expect.poll(async () => (await storedLines(page))[0].points[2]).toEqual(P(6, 8));
  await expect(route.locator(".map-route-label")).toHaveText("50 ft");
});

test("drags a selected Area by its fill: the whole Shape moves by whole squares", async ({ page }) => {
  const map = await openMap(page, "Area Drag Camp");
  const at = await grid(map);

  await map.getByRole("button", { name: "Draw", exact: true }).click();
  for (const [c, r] of [[4, 4], [8, 4], [8, 7], [4, 7]]) await page.mouse.click(...at(c, r));
  await page.mouse.click(...at(4, 4));
  await map.getByRole("button", { name: "Select", exact: true }).click();
  await page.mouse.click(...at(8, 5.5)); // on the right edge
  await map.getByRole("button", { name: "Make area" }).click();
  await expect.poll(async () => !!(await storedLines(page))[0].area).toBe(true);

  // The editor below the canvas can scroll the page: measure the canvas again.
  const at2 = await grid(map);
  await page.mouse.move(...at2(6, 5.5));
  await page.mouse.down();
  await page.mouse.move(...at2(9.2, 7.4), { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await storedLines(page))[0].points).toEqual([P(7, 6), P(11, 6), P(11, 9), P(7, 9)]);
  await expect(map.getByRole("group", { name: "Edit Shape 1" })).toBeVisible(); // still selected
});

test("a C-shaped Area puts its name on the shape, not in the empty middle", async ({ page }) => {
  const map = await openMap(page, "Area Label Camp");
  const at = await grid(map);

  await map.getByRole("button", { name: "Draw", exact: true }).click();
  // A C shape: its centroid is in the open gap on the right.
  const pts = [[2, 2], [12, 2], [12, 4], [4, 4], [4, 10], [12, 10], [12, 12], [2, 12]];
  for (const [c, r] of pts) await page.mouse.click(...at(c, r));
  await page.mouse.click(...at(2, 2));
  await map.getByRole("button", { name: "Select", exact: true }).click();
  await page.mouse.click(...at(2, 7)); // on the left edge
  await map.getByRole("button", { name: "Make area" }).click();
  await expect.poll(async () => !!(await storedLines(page))[0].area).toBe(true);

  const label = map.locator(".map-area-label");
  await expect(label).toBeVisible();
  const box = (await label.boundingBox())!;
  const fill = map.locator(".map-area-fill").first();
  const inside = await fill.evaluate((el, p) => {
    const path = el as SVGPathElement, m = path.getScreenCTM()!.inverse();
    const q = new DOMPoint(p.x, p.y).matrixTransform(m);
    return path.isPointInFill(q);
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  expect(inside).toBe(true);
});
