import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

/** Real-browser offline tests against the production build (vite preview, port 5198). */
test.use({ baseURL: "http://localhost:5198" });

async function activated(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise((r) => navigator.serviceWorker.addEventListener("controllerchange", r, { once: true }));
  });
}

test("a loaded site works offline: campaigns, search and Stat Blocks", async ({ page, context }) => {
  await page.goto("/");
  await activated(page);
  await page.getByRole("textbox", { name: "New campaign name" }).fill("Offline Camp");
  await page.getByRole("button", { name: "Create campaign" }).click();
  await expect(page.getByRole("listitem", { name: "Offline Camp" })).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await page.getByRole("listitem", { name: "Offline Camp" }).getByRole("button", { name: "Open" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "Global search" });
  await dialog.getByRole("searchbox", { name: "Search" }).fill("owlbear");
  await dialog.getByRole("button", { name: /Owlbear/ }).click();
  await expect(page.getByRole("article", { name: "Owlbear Stat Block" })).toBeVisible();
  await context.setOffline(false);
});

test("a new version shows a prompt and only reloads when accepted", async ({ page }) => {
  await page.goto("/");
  await activated(page);
  await expect(page.getByRole("status", { name: "Update available" })).toHaveCount(0);

  // Ship "a new version": change the built worker script on disk (restored afterwards) so the browser sees an update.
  const file = path.resolve("dist/sw.js");
  const original = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, original.replace(/VERSION = "[^"]*"/, 'VERSION = "next"'));
  try {
  await page.evaluate(() => window.name = "before-update");
  await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())!.update(); });
  const prompt = page.getByRole("status", { name: "Update available" });
  await expect(prompt).toBeVisible();
  expect(await page.evaluate(() => window.name)).toBe("before-update"); // nothing reloaded yet
  await page.evaluate(() => { (window as unknown as { __loaded: boolean }).__loaded = true; });

  await Promise.all([page.waitForEvent("load"), prompt.getByRole("button", { name: "Update now" }).click()]);
  expect(await page.evaluate(() => (window as unknown as { __loaded?: boolean }).__loaded)).toBeUndefined();
  await expect(page.getByRole("status", { name: "Update available" })).toHaveCount(0);
  } finally {
    fs.writeFileSync(file, original);
  }
});
