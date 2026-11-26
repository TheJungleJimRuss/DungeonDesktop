import { expect, type Locator, type Page } from "@playwright/test";

/** Opens a new campaign, goes to Plan mode and makes a Map. The Map opens at battle scale (32 px per square) centred on (0, 0). */
export async function openMap(page: Page, name: string) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "New campaign name" }).fill(name);
  await page.getByRole("button", { name: "Create campaign" }).click();
  await page.getByRole("listitem", { name }).getByRole("button", { name: "Open" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.keyboard.press("Alt+2");
  const map = page.getByRole("region", { name: "Map" });
  await map.getByRole("button", { name: "New map" }).click();
  await expect(map.getByRole("group", { name: "Map canvas" })).toBeVisible();
  return map;
}

export interface View { cx: number; cy: number; px: number }
export const BATTLE: View = { cx: 0, cy: 0, px: 32 };

/** `origin` is the stored point shown at the canvas centre: the canvas is only about 27 x 19 squares at battle scale, so a test that draws
 *  in the old 20 x 20 coordinates passes origin {x: 8, y: 7} and reads stored points back with `stored(x, y)`. */
/** Measures the canvas now and returns a function from a point in squares to screen pixels (the canvas has no letterboxing: the view
 *  centre is the canvas centre and one square is `px` pixels). `f` offsets the point, to test snapping. Measure again after the page scrolls. */
export async function gridAt(map: Locator, view: View = BATTLE, origin = { x: 0, y: 0 }) {
  const box = await map.getByRole("group", { name: "Map canvas" }).boundingBox();
  return (col: number, row: number, f = 0) => [box!.x + box!.width / 2 + (col - origin.x + f - view.cx) * view.px, box!.y + box!.height / 2 + (row - origin.y + f - view.cy) * view.px] as const;
}

/** The first Map record in the app's IndexedDB. */
export const storedMap = (page: Page) => page.evaluate(async () => {
  const dbs = await indexedDB.databases();
  const db = await new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open(dbs[0].name!); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const rows = await new Promise<any[]>((res, rej) => { const r = db.transaction("maps").objectStore("maps").getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  db.close();
  return rows[0] as { id: string; lines: { closed: boolean; points: { x: number; y: number }[]; segments: string[]; area?: unknown; route?: boolean }[]; markers: { x: number; y: number; name: string }[]; tokens: { x: number; y: number; name: string }[] };
});
export const storedLines = async (page: Page) => (await storedMap(page)).lines;
export const storedMarkers = async (page: Page) => (await storedMap(page)).markers;

/** Sets a Map's saved device view (the same localStorage record the Map panel writes). Reload the page afterwards. */
export const setStoredView = (page: Page, mapId: string, v: View) =>
  page.evaluate(([id, view]) => localStorage.setItem(`dungeon-desktop:map-view:${id}`, JSON.stringify({ pxPerSquare: (view as View).px, x: (view as View).cx, y: (view as View).cy })), [mapId, v] as const);

/** After a reload: opens the campaign again and goes to the Map panel (the last Map is remembered). */
export async function reopenMap(page: Page, name: string) {
  await page.goto("/");
  await page.getByRole("listitem", { name }).getByRole("button", { name: "Open" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.keyboard.press("Alt+2");
  const map = page.getByRole("region", { name: "Map" });
  await expect(map.getByRole("group", { name: "Map canvas" })).toBeVisible();
  return map;
}

/** Edits the first Map record straight in IndexedDB (reload afterwards: the app does not hear about it). */
export const editStoredMap = (page: Page, patch: { tokenAt?: { x: number; y: number }; lines?: unknown[] }) => page.evaluate(async (p) => {
  const dbs = await indexedDB.databases();
  const db = await new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open(dbs[0].name!); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const tx = db.transaction("maps", "readwrite"), store = tx.objectStore("maps");
  const row = await new Promise<any>((res, rej) => { const r = store.getAll(); r.onsuccess = () => res(r.result[0]); r.onerror = () => rej(r.error); });
  if (p.tokenAt) row.tokens = row.tokens.map((t: any) => ({ ...t, ...p.tokenAt }));
  if (p.lines) row.lines = p.lines;
  store.put(row);
  await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  db.close();
}, patch);
