import { expect, test, type Page } from "@playwright/test";

async function openMap(page: Page, name: string) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "New campaign name" }).fill(name);
  await page.getByRole("button", { name: "Create campaign" }).click();
  await page.getByRole("listitem", { name }).getByRole("button", { name: "Open" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.keyboard.press("Alt+2");
  const map = page.getByRole("region", { name: "Map" });
  await map.getByRole("button", { name: "New map" }).click();
  await expect(map.getByLabel("Map width")).toBeAttached();
  return map;
}

/** The stored Lines of the campaign's first Map, read straight from IndexedDB. */
const storedLines = (page: Page) => page.evaluate(async () => {
  const dbs = await indexedDB.databases();
  const db = await new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open(dbs[0].name!); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const rows = await new Promise<{ lines: unknown[] }[]>((res, rej) => { const r = db.transaction("maps").objectStore("maps").getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  db.close();
  return rows[0].lines as { closed: boolean; points: { x: number; y: number }[]; segments: string[] }[];
});

test("draws an open Line (double-click), a closed Shape (first point) and drags a point", async ({ page }) => {
  const map = await openMap(page, "Draw Camp");
  const grid = await map.getByRole("group", { name: "Map canvas" }).boundingBox();
  const cell = Math.min(grid!.width, grid!.height) / 20;
  const ox = grid!.x + (grid!.width - cell * 20) / 2, oy = grid!.y + (grid!.height - cell * 20) / 2;
  const at = (col: number, row: number, f = 0) => [ox + cell * (col + f), oy + cell * (row + f)] as const; // f offsets off the corner: snapping must pull it back

  await map.getByRole("button", { name: "Draw", exact: true }).click();
  // open Line: (2,2) (6,2) (6,5), finished by a double-click on the last point
  await page.mouse.click(...at(2, 2, 0.2));
  await page.mouse.click(...at(6, 2, -0.15));
  await page.mouse.dblclick(...at(6, 5, 0.1));
  await expect(map.getByRole("button", { name: "Line 1" })).toBeVisible();
  await expect.poll(async () => (await storedLines(page)).length).toBe(1);
  expect((await storedLines(page))[0]).toMatchObject({ closed: false, points: [{ x: 2, y: 2 }, { x: 6, y: 2 }, { x: 6, y: 5 }], segments: ["plain", "plain"] });

  // closed Shape: click the first point again
  for (const [c, r] of [[10, 10], [15, 10], [15, 14]]) await page.mouse.click(...at(c, r));
  await page.mouse.click(...at(10, 10, 0.1));
  await expect(map.getByRole("button", { name: "Shape 1" })).toBeVisible();
  await expect.poll(async () => (await storedLines(page)).length).toBe(2);
  expect((await storedLines(page))[1]).toMatchObject({ closed: true, points: [{ x: 10, y: 10 }, { x: 15, y: 10 }, { x: 15, y: 14 }], segments: ["plain", "plain", "plain"] });

  // Select the Line (click on its first segment), drag its second point to (8,3)
  await map.getByRole("button", { name: "Select", exact: true }).click();
  await page.mouse.click(...at(4, 2));
  await expect(map.getByRole("group", { name: "Edit Line 1" })).toBeVisible();
  const handle = await map.getByRole("button", { name: "Point 2 of Line 1" }).boundingBox();
  await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2);
  await page.mouse.down();
  await page.mouse.move(...at(8, 3, 0.2), { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await storedLines(page))[0].points[1]).toEqual({ x: 8, y: 3 });

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

test("draws a Route, labels its length, and dragging a point updates the label", async ({ page }) => {
  const map = await openMap(page, "Route Camp");
  const grid = await map.getByRole("group", { name: "Map canvas" }).boundingBox();
  const cell = Math.min(grid!.width, grid!.height) / 20;
  const ox = grid!.x + (grid!.width - cell * 20) / 2, oy = grid!.y + (grid!.height - cell * 20) / 2;
  const at = (col: number, row: number) => [ox + cell * col, oy + cell * row] as const;

  await map.getByRole("button", { name: "Route", exact: true }).click();
  await page.mouse.click(...at(2, 2));
  await page.mouse.click(...at(6, 2));
  await page.mouse.dblclick(...at(6, 5)); // 4 + 3 squares x 5 ft
  const route = map.getByRole("button", { name: "Route 1" });
  await expect(route).toBeVisible();
  await expect(route.locator(".map-route-label")).toHaveText("35 ft");
  await expect.poll(async () => (await storedLines(page)).length).toBe(1);
  expect((await storedLines(page))[0]).toMatchObject({ closed: false, route: true, points: [{ x: 2, y: 2 }, { x: 6, y: 2 }, { x: 6, y: 5 }] });

  await map.getByRole("button", { name: "Select", exact: true }).click();
  await page.mouse.click(...at(4, 2));
  await expect(map.getByRole("group", { name: "Edit Route 1" })).toBeVisible();
  const handle = await map.getByRole("button", { name: "Point 3 of Route 1" }).boundingBox();
  await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2);
  await page.mouse.down();
  await page.mouse.move(...at(6, 8), { steps: 6 }); // 4 + 6 squares
  await expect(route.locator(".map-route-label")).toHaveText("50 ft"); // live, before release
  await page.mouse.up();
  await expect.poll(async () => (await storedLines(page))[0].points[2]).toEqual({ x: 6, y: 8 });
  await expect(route.locator(".map-route-label")).toHaveText("50 ft");
});

test("drags a selected Area by its fill: the whole Shape moves by whole squares", async ({ page }) => {
  const map = await openMap(page, "Area Drag Camp");
  const grid = await map.getByRole("group", { name: "Map canvas" }).boundingBox();
  const cell = Math.min(grid!.width, grid!.height) / 20;
  const ox = grid!.x + (grid!.width - cell * 20) / 2, oy = grid!.y + (grid!.height - cell * 20) / 2;
  const at = (col: number, row: number) => [ox + cell * col, oy + cell * row] as const;

  await map.getByRole("button", { name: "Draw", exact: true }).click();
  for (const [c, r] of [[4, 4], [8, 4], [8, 7], [4, 7]]) await page.mouse.click(...at(c, r));
  await page.mouse.click(...at(4, 4));
  await map.getByRole("button", { name: "Select", exact: true }).click();
  await page.mouse.click(...at(8, 5.5)); // on the right edge
  await map.getByRole("button", { name: "Make area" }).click();
  await expect.poll(async () => !!(await storedLines(page))[0].area).toBe(true);

  // The editor below the canvas can scroll the page: measure the canvas again.
  const g2 = await map.getByRole("group", { name: "Map canvas" }).boundingBox();
  const oy2 = g2!.y + (g2!.height - cell * 20) / 2, at2 = (col: number, row: number) => [ox + cell * col, oy2 + cell * row] as const;
  await page.mouse.move(...at2(6, 5.5));
  await page.mouse.down();
  await page.mouse.move(...at2(9.2, 7.4), { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await storedLines(page))[0].points).toEqual([{ x: 7, y: 6 }, { x: 11, y: 6 }, { x: 11, y: 9 }, { x: 7, y: 9 }]);
  await expect(map.getByRole("group", { name: "Edit Shape 1" })).toBeVisible(); // still selected
});
