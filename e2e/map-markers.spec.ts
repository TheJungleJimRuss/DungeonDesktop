import { expect, test } from "@playwright/test";
import { gridAt, openMap, storedMarkers, type View } from "./map-helpers";

const O = { x: 6, y: 5 };
const grid = (map: Parameters<typeof gridAt>[0]) => gridAt(map, { cx: 0, cy: 0, px: 32 } as View, O);

test("places a Marker by click and drags it freely: fractional positions are stored", async ({ page }) => {
  const map = await openMap(page, "Marker Camp");
  let at = await grid(map);

  await map.getByRole("button", { name: "Marker", exact: true }).click();
  await page.mouse.click(...at(4.3, 5.7));
  await expect(map.getByRole("button", { name: "Marker Marker 1", exact: true })).toBeVisible();
  await expect.poll(async () => (await storedMarkers(page)).length).toBe(1);
  const placed = (await storedMarkers(page))[0];
  expect(Math.abs(placed.x - (4.3 - O.x))).toBeLessThan(0.05);
  expect(Math.abs(placed.y - (5.7 - O.y))).toBeLessThan(0.05);
  expect(Number.isInteger(placed.x) || Number.isInteger(placed.y)).toBe(false);

  await map.getByLabel("Marker name").fill("Camp");
  await map.getByLabel("Marker note").fill("Bring rope");
  await map.getByLabel("Marker note").blur();
  await expect.poll(async () => (await storedMarkers(page))[0]).toMatchObject({ name: "Camp", note: "Bring rope" });

  await map.getByRole("button", { name: "Select", exact: true }).click();
  at = await grid(map); // the editor under the canvas moves it
  const m = await map.getByRole("button", { name: "Marker Camp", exact: true }).boundingBox();
  await page.mouse.move(m!.x + m!.width / 2, m!.y + m!.height / 2);
  await page.mouse.down();
  await page.mouse.move(...at(12.35, 9.6), { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await storedMarkers(page))[0].x).toBeGreaterThan(12 - O.x);
  const dropped = (await storedMarkers(page))[0];
  expect(Math.abs(dropped.x - (12.35 - O.x))).toBeLessThan(0.1);
  expect(Math.abs(dropped.y - (9.6 - O.y))).toBeLessThan(0.1);
  expect(dropped.x % 1).not.toBe(0);

  at = await grid(map);
  // In the Marker tool a press on a Marker drags it instead of placing another.
  await map.getByRole("button", { name: "Marker", exact: true }).click();
  const m2 = await map.getByRole("button", { name: "Marker Camp", exact: true }).boundingBox();
  await page.mouse.move(m2!.x + m2!.width / 2, m2!.y + m2!.height / 2);
  await page.mouse.down();
  await page.mouse.move(...at(6.5, 3.5), { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await storedMarkers(page))[0].x).toBeLessThan(7 - O.x);
  expect(await storedMarkers(page)).toHaveLength(1);

  await page.keyboard.press("Delete");
  await expect.poll(async () => (await storedMarkers(page)).length).toBe(0);
});

test("dragging the Party token onto a linked Marker sets the party location", async ({ page }) => {
  const map = await openMap(page, "Party Camp");
  // Measured at each use: focusing the Marker editor scrolls the page, which moves the canvas.
  const at = async (col: number, row: number) => (await gridAt(map, { cx: 0, cy: 0, px: 32 }, { x: 3, y: 2 }))(col, row);

  await map.getByRole("button", { name: "Marker", exact: true }).click();
  await page.mouse.click(...(await at(6.5, 4.5)));
  await map.getByLabel("Marker name").fill("Keep");
  await map.getByLabel("Marker location").selectOption({ label: "Create location" });
  await expect(map.getByLabel("Marker location")).not.toHaveValue("");
  await map.getByRole("button", { name: "Select", exact: true }).click();

  await map.getByRole("button", { name: "Add party token" }).click();
  await expect(map.getByRole("button", { name: "Add party token" })).toHaveCount(0);
  const party = map.getByRole("button", { name: "Party token", exact: true });
  await expect(party).toHaveAttribute("data-col", "0");
  const from = await party.boundingBox();
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(...(await at(6.5, 4.5)), { steps: 8 });
  await page.mouse.up();
  await expect(party).toHaveAttribute("data-col", "3");
  await expect(party).toHaveAttribute("data-row", "2");

  const stored = () => page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    const db = await new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open(dbs[0].name!); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const get = (store: string) => new Promise<any[]>((res, rej) => { const r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const [maps, campaigns] = [await get("maps"), await get("campaigns")];
    db.close();
    return { markerLocation: maps[0].markers[0].locationId as string | undefined, party: campaigns[0].partyLocationId as string | undefined };
  });
  await expect.poll(async () => (await stored()).party).toBeTruthy();
  const s = await stored();
  expect(s.party).toBe(s.markerLocation);
});
