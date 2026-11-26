import { expect, test } from "@playwright/test";
import { editStoredMap, gridAt, openMap, reopenMap, setStoredView, storedMap } from "./map-helpers";

test("Ctrl + wheel zooms smoothly about the pointer: the point under it stays put", async ({ page }) => {
  const map = await openMap(page, "Wheel Camp");
  const at = await gridAt(map);
  await map.getByRole("button", { name: "Marker", exact: true }).click();
  await page.mouse.click(...at(5.3, 3.1));
  await map.getByRole("button", { name: "Select", exact: true }).click();
  const badge = map.getByRole("button", { name: /^Marker Marker 1$/ });
  const centre = async () => { const b = (await badge.boundingBox())!; return [b.x + b.width / 2, b.y + b.height / 2]; };
  const before = await centre();
  const zoomBefore = await map.getByRole("group", { name: "Zoom" }).innerText();

  // The pointer sits on the Marker's placed point, which is at the badge's own centre in the SVG (the label hangs below it).
  const p = at(5.3, 3.1);
  await page.mouse.move(p[0], p[1]);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -120);
  await page.mouse.wheel(0, -120);
  await page.keyboard.up("Control");
  await expect.poll(() => map.getByRole("group", { name: "Zoom" }).innerText()).not.toBe(zoomBefore);
  const after = await centre();
  // The Marker's drawn size is fixed on screen, so its box moves only if the world point under the pointer moved.
  expect(Math.abs(after[0] - before[0])).toBeLessThan(1.5);
  expect(Math.abs(after[1] - before[1])).toBeLessThan(1.5);
});

test("drawing a wall and dragging a Token 1,000,000 squares from the start point land exactly on the grid", async ({ page }) => {
  const name = "Far Camp", FAR = 1_000_000, view = { cx: FAR, cy: FAR, px: 32 };
  const map0 = await openMap(page, name);
  await map0.getByLabel("Token name").fill("Orc");
  await map0.getByRole("button", { name: "Add token", exact: true }).click();
  await expect(map0.getByRole("button", { name: "Token Orc", exact: true })).toBeVisible();
  const { id } = await storedMap(page);
  await editStoredMap(page, { tokenAt: { x: FAR + 3, y: FAR + 1 } });
  await setStoredView(page, id, view);
  const map = await reopenMap(page, name);
  const token = map.getByRole("button", { name: "Token Orc", exact: true });
  await expect(token).toHaveAttribute("data-col", String(FAR + 3));

  // The token is drawn where the pointer maths expects it: its box centre is its square's centre, to the pixel.
  let at = await gridAt(map, view);
  const tb = (await token.boundingBox())!, centre = at(FAR + 3, FAR + 1, 0.5);
  expect(Math.abs(tb.x + tb.width / 2 - centre[0])).toBeLessThan(1);
  expect(Math.abs(tb.y + tb.height / 2 - centre[1])).toBeLessThan(1);

  // A wall: the points are snapped to the shown grid and stored as exact squares, however far out.
  await map.getByRole("button", { name: "Draw", exact: true }).click();
  await page.mouse.click(...at(FAR + 2, FAR + 2, 0.2));
  await page.mouse.click(...at(FAR + 6, FAR + 3, -0.15));
  await page.mouse.dblclick(...at(FAR + 6, FAR + 5, 0.1));
  await expect.poll(async () => (await storedMap(page)).lines.length).toBe(1);
  expect((await storedMap(page)).lines[0].points).toEqual([{ x: FAR + 2, y: FAR + 2 }, { x: FAR + 6, y: FAR + 3 }, { x: FAR + 6, y: FAR + 5 }]);
  at = await gridAt(map, view); // the editor under the canvas may have moved it
  await map.getByRole("button", { name: "Select", exact: true }).click();
  await page.mouse.click(...at(FAR + 4, FAR + 2.5));
  await map.getByRole("button", { name: "Segment 1 of Line 1" }).click();
  await map.getByLabel("Segment 1 type").selectOption("wall");
  await expect.poll(async () => (await storedMap(page)).lines[0].segments).toEqual(["wall", "plain"]);
  // ...and it is drawn on those squares: its ends sit on (2, 2) and (6, 3) to within the stroke.
  at = await gridAt(map, view);
  const wall = (await map.locator(".map-wall").boundingBox())!, a = at(FAR + 2, FAR + 2), b = at(FAR + 6, FAR + 3);
  expect(Math.abs(wall.x - a[0])).toBeLessThan(6);
  expect(Math.abs(wall.x + wall.width - b[0])).toBeLessThan(6);
  expect(Math.abs(wall.y - a[1])).toBeLessThan(6);
  expect(Math.abs(wall.y + wall.height - b[1])).toBeLessThan(6);

  // A Token drag: off-centre in the target square, it snaps to a whole square.
  const from = (await token.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(...at(FAR + 7, FAR + 4, 0.3), { steps: 6 });
  await page.mouse.up();
  await expect(token).toHaveAttribute("data-col", String(FAR + 7));
  await expect.poll(async () => (await storedMap(page)).tokens[0]).toMatchObject({ x: FAR + 7, y: FAR + 4 });
});

test("an animated + step keeps the grid label a round ladder value in every frame", async ({ page }) => {
  const map = await openMap(page, "Ladder Camp");
  await map.getByRole("button", { name: "Zoom out" }).click(); // let the first step settle in; steps below are sampled
  const label = map.getByLabel("Grid scale");
  await expect(label).toBeVisible();
  const round = /^1 square = (5|10|20|50|100|200|500) ft$|^1 square = (1|2|5|10|20|50|100|200|500|1000) mi$/;
  const seen = new Set<string>(), zooms = new Set<string>();
  for (let i = 0; i < 6; i++) {
    // Sample every animation frame while one step runs (zoom text and grid label together).
    const frames = await page.evaluate(async () => {
      const read = () => ({ grid: document.querySelector('[aria-label="Grid scale"]')?.textContent ?? "", zoom: document.querySelector('[aria-label="Zoom"] [aria-live]')?.textContent ?? "" });
      const out: { grid: string; zoom: string }[] = [];
      (document.querySelector('[aria-label="Zoom out"]') as HTMLButtonElement).click();
      const end = performance.now() + 400;
      await new Promise<void>((done) => { const tick = () => { out.push(read()); if (performance.now() < end) requestAnimationFrame(tick); else done(); }; requestAnimationFrame(tick); });
      return out;
    });
    for (const f of frames) { expect(f.grid).toMatch(round); seen.add(f.grid); zooms.add(f.zoom); }
  }
  expect(zooms.size).toBeGreaterThan(8); // many in-between zoom values were sampled: the animation really ran
  expect(seen.size).toBeGreaterThan(1); // and the label stepped through more than one rung
});

test("zoomed out past 1,600 miles the Map still works: the grid draws, the ruler measures, and labels stay readable", async ({ page }) => {
  const name = "Wide Camp", R = 4_000_000; // a region about 3,800 miles across
  await openMap(page, name);
  const { id } = await storedMap(page);
  await editStoredMap(page, { lines: [
    { id: "a", closed: true, segments: ["plain", "plain", "plain", "plain"], points: [{ x: -R, y: -R }, { x: R, y: -R }, { x: R, y: R }, { x: -R, y: R }], area: { kind: "Region", color: "#3498db", name: "Northlands" } },
    { id: "r", closed: false, route: true, segments: ["plain"], points: [{ x: -R / 2, y: R / 2 }, { x: R / 2, y: R / 2 }] },
  ] });
  await setStoredView(page, id, { cx: 0, cy: 0, px: 0.0001 });
  const map = await reopenMap(page, name);
  const height = async (sel: string) => (await map.locator(sel).first().boundingBox())!.height;
  await expect(map.locator(".map-area-label")).toHaveText("Northlands");
  expect(await height(".map-area-label")).toBeGreaterThan(10); // about 13 px text, as at battle scale
  expect(await height(".map-route-label")).toBeGreaterThan(10);
  expect((await map.locator(".grid-line").first().boundingBox())!.height).toBeGreaterThan(100); // the grid is drawn across the canvas

  await map.getByRole("button", { name: "Ruler", exact: true }).click();
  const at = await gridAt(map, { cx: 0, cy: 0, px: 0.0001 });
  await page.mouse.move(...at(-R / 2, 0)); // 200 px left of centre: inside the canvas
  await page.mouse.down();
  await page.mouse.move(...at(R / 2, 0), { steps: 4 });
  expect(await height(".ruler-mark text")).toBeGreaterThan(10);
  await page.mouse.up();
  await expect(map.getByRole("status", { name: "Measured distance" })).toContainText("mi"); // the press reached the canvas, thousands of miles across
});
