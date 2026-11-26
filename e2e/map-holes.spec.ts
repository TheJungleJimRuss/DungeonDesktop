import { expect, test, type Page } from "@playwright/test";
import { editStoredMap, gridAt, openMap, reopenMap, setStoredView, storedLines, storedMap, type View } from "./map-helpers";

const VIEW: View = { cx: 5, cy: 5, px: 32 }; // the Areas below span squares 0..10: centred on them so they fit the canvas
const grid = (map: Parameters<typeof gridAt>[0]) => gridAt(map, VIEW);
type P = [number, number];
const pts = (p: P[]) => p.map(([x, y]) => ({ x, y }));
const sq = (x: number, y: number, s: number): P[] => [[x, y], [x + s, y], [x + s, y + s], [x, y + s]];
const shape = (id: string, p: P[], area?: { kind: string; holes: P[][] }) => ({
  id, closed: true, points: pts(p), segments: p.map(() => "plain"),
  ...(area ? { area: { kind: area.kind, color: "#3366ff", holes: area.holes.map(pts) } } : {}),
});

/** Makes a Map holding these Lines (written to IndexedDB, then reloaded with the view on them) and selects Shape 1 by clicking its left edge at row `row`. */
async function mapWith(page: Page, name: string, lines: unknown[], row = 5) {
  await openMap(page, name);
  await editStoredMap(page, { lines });
  await setStoredView(page, (await storedMap(page)).id, VIEW);
  const map = await reopenMap(page, name);
  const at = await grid(map);
  await page.mouse.click(...at(0, row));
  await expect(map.getByRole("group", { name: "Edit Shape 1" })).toBeVisible();
  return { map, at: await grid(map) }; // the editor below the canvas can scroll the page: measure again
}

/** Drags a point handle to square (x, y). */
async function drag(page: Page, handle: ReturnType<Page["getByRole"]>, to: readonly [number, number]) {
  const b = (await handle.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(...to, { steps: 8 });
  await page.mouse.up();
}

test("drags a Hole point: the Hole is saved, snapped to the grid", async ({ page }) => {
  const { map, at } = await mapWith(page, "Hole Drag Camp", [shape("room", sq(0, 0, 10), { kind: "Room", holes: [sq(2, 2, 2)] })]);
  await drag(page, map.getByRole("button", { name: "Point 3 of Hole 1 of Room" }), at(5, 6, 0.2));
  await expect.poll(async () => ((await storedLines(page))[0].area as { holes: unknown }).holes).toEqual([pts([[2, 2], [4, 2], [5, 6], [2, 4]])]);
  expect((await storedLines(page))[0].points).toEqual(pts(sq(0, 0, 10)));
});

test("a Hole dragged across the outline becomes a Notch after the dashed preview and Cut notch? Yes", async ({ page }) => {
  const { map, at } = await mapWith(page, "Hole Notch Camp", [shape("room", sq(0, 0, 10), { kind: "Room", holes: [sq(7, 4, 2)] })]);
  await drag(page, map.getByRole("button", { name: "Point 2 of Hole 1 of Room" }), at(12, 4));
  const ask = map.getByRole("group", { name: "Cut notch" });
  await expect(ask).toContainText("Cut notch?");
  await expect(map.getByTestId("notch-preview")).toBeVisible();
  expect((await storedLines(page))[0].points).toEqual(pts(sq(0, 0, 10))); // nothing saved yet
  await ask.getByRole("button", { name: "Yes" }).click();
  await expect.poll(async () => (await storedLines(page))[0].points.length).toBeGreaterThan(4);
  const l = (await storedLines(page))[0];
  expect(l.points).toEqual(expect.arrayContaining(pts([[7, 4], [7, 6], [10, 0], [0, 10]])));
  expect(l.area).not.toHaveProperty("holes");
  await expect(map.getByRole("group", { name: "Edit Shape 1" })).toBeVisible();
});

test("a Hole drag that would split the Area snaps back with a message", async ({ page }) => {
  // A U-shaped hall with a Hole in its left arm: pulling a Hole point past the right arm would cut that arm's top off.
  const hall = shape("u", [[0, 0], [3, 0], [3, 8], [6, 8], [6, 0], [9, 0], [9, 10], [0, 10]], { kind: "Hall", holes: [[[1, 2], [2, 2], [2, 6], [1, 6]]] });
  const { map, at } = await mapWith(page, "Hole Split Camp", [hall], 8);
  const handle = map.getByRole("button", { name: "Point 1 of Hole 1 of Hall" });
  const before = await handle.boundingBox();
  await drag(page, handle, at(10, 4));
  await expect(map.getByRole("status", { name: "Point drag" })).toHaveText("That would split Hall in two");
  await expect(map.getByRole("group", { name: "Cut notch" })).toHaveCount(0);
  expect((await storedLines(page))[0]).toEqual(hall);
  expect(await handle.boundingBox()).toEqual(before);
});

test("with Subtract shape running, a pillar Shape whose edges lie on a Hole's edges can be clicked (Hole edges let clicks through)", async ({ page }) => {
  const { map } = await mapWith(page, "Hole Pillar Camp", [
    shape("room", sq(0, 0, 10), { kind: "Room", holes: [sq(2, 2, 2)] }), shape("pillar", sq(2, 2, 3)),
  ]);
  await map.getByRole("button", { name: "Subtract shape" }).click();
  await expect(map.getByRole("status", { name: "Subtract shape" })).toBeVisible();
  const at = await grid(map); // the status line or editor may have scrolled the page
  await page.mouse.click(...at(3, 2)); // on the top edge shared by Hole 1 and the pillar
  await expect(map.getByRole("status", { name: "Subtract shape" })).toHaveCount(0);
  await expect.poll(async () => ((await storedLines(page))[0].area as { holes: unknown }).holes).toEqual([expect.arrayContaining(pts([[2, 2], [5, 2], [5, 5], [2, 5]]))]);
  expect(await storedLines(page)).toHaveLength(2); // the pillar stays
});
