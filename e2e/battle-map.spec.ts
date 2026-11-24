import { expect, test, type Page } from "@playwright/test";

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
  const grid = await map.getByRole("group", { name: "Map canvas" }).boundingBox();
  const cell = Math.min(grid!.width, grid!.height) / 20; // the 20x20 grid is letterboxed inside the svg box
  const ox = grid!.x + (grid!.width - cell * 20) / 2, oy = grid!.y + (grid!.height - cell * 20) / 2;
  const from = await token.boundingBox();
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(ox + cell * 3.3, oy + cell * 2.4, { steps: 5 });
  await page.mouse.up();
  await expect(token).toHaveAttribute("data-col", "3");
  await expect(token).toHaveAttribute("data-row", "2");

});

test("ruler measures by pointer drag, snapping to square centres and corners, and leaves token dragging alone when off", async ({ page }) => {
  await openCombat(page, "Ruler Camp");
  const map = page.getByRole("region", { name: "Map" });
  const grid = await map.getByRole("group", { name: "Map canvas" }).boundingBox();
  const cell = Math.min(grid!.width, grid!.height) / 20;
  const ox = grid!.x + (grid!.width - cell * 20) / 2, oy = grid!.y + (grid!.height - cell * 20) / 2;
  const at = (col: number, row: number, f = 0.5) => [ox + cell * (col + f), oy + cell * (row + f)] as const;

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

test("a background image is set, scaled under the grid and survives a reload", async ({ page }) => {
  await openCombat(page, "Bg Camp");
  const map = page.getByRole("region", { name: "Map" });
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  await map.getByText("Map settings").click();
  await map.getByLabel("Background image").setInputFiles({ name: "bg.png", mimeType: "image/png", buffer: png });
  const img = map.locator(".map-canvas image");
  await expect(img).toHaveAttribute("href", /^blob:/);
  await map.getByLabel("Background scale").fill("2");
  await map.getByLabel("Background scale").blur();
  await expect(img).toHaveAttribute("width", "1600");
  await page.reload();
  await page.getByRole("listitem", { name: "Bg Camp" }).getByRole("button", { name: "Open" }).click();
  await page.getByRole("navigation", { name: "Modes" }).getByRole("button", { name: /Combat/ }).click();
  await expect(page.getByRole("region", { name: "Map" }).locator(".map-canvas image")).toHaveAttribute("width", "1600");
  await page.getByRole("region", { name: "Map" }).getByText("Map settings").click();
  await page.getByRole("region", { name: "Map" }).getByRole("button", { name: "Clear background" }).click();
  await expect(page.locator(".map-canvas image")).toHaveCount(0);
});

test("a large background image is downscaled to at most 2048 px on its longest side", async ({ page }) => {
  await openCombat(page, "Big Bg Camp");
  const map = page.getByRole("region", { name: "Map" });
  const b64 = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 4000; c.height = 1000;
    const g = c.getContext("2d")!;
    g.fillStyle = "#3a7"; g.fillRect(0, 0, 4000, 1000);
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/png"));
    return btoa(String.fromCharCode(...new Uint8Array(await blob.arrayBuffer())));
  });
  await map.getByText("Map settings").click();
  await map.getByLabel("Background image").setInputFiles({ name: "big.png", mimeType: "image/png", buffer: Buffer.from(b64, "base64") });
  await expect(map.locator(".map-canvas image")).toHaveAttribute("href", /^blob:/);
  const size = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open("dungeon-desktop"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const rows = await new Promise<any[]>((res, rej) => { const r = db.transaction("maps").objectStore("maps").getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const img = rows[0].background.image;
    const bmp = await createImageBitmap(new Blob([img.data], { type: img.type }));
    return { w: bmp.width, h: bmp.height, type: img.type };
  });
  expect(size).toMatchObject({ w: 2048, h: 512 });
});
