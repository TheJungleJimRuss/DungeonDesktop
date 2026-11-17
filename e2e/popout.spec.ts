import { expect, test, type Page } from "@playwright/test";

/** Real-browser tests of the Pop-out Window sync (the spec's one e2e exception).
 *  Both pages share one browser context, so they share IndexedDB, localStorage and BroadcastChannel. */

async function openCampaign(page: Page, name: string) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "New campaign name" }).fill(name);
  await page.getByRole("button", { name: "Create campaign" }).click();
  await page.getByRole("listitem", { name }).getByRole("button", { name: "Open" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

async function popOut(page: Page, title: string) {
  const [pop] = await Promise.all([
    page.context().waitForEvent("page"),
    page.getByRole("button", { name: `Pop out ${title}` }).click(),
  ]);
  await pop.waitForLoadState();
  return pop;
}

test("Party edits in the Pop-out Window reach the main window; closing returns the panel", async ({ page }) => {
  await openCampaign(page, "Sync Camp");
  const party = page.getByRole("region", { name: "Party at a glance" });
  await party.getByRole("button", { name: "Add member" }).click();
  await party.getByLabel("Name").fill("Thia");
  await party.getByRole("button", { name: "Save member" }).click();
  await expect(party.getByText("Thia")).toBeVisible();

  const pop = await popOut(page, "Party at a glance");
  await expect(page.getByRole("region", { name: "Party at a glance" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Popped out — bring back/ })).toBeVisible();

  const popParty = pop.getByRole("region", { name: "Party at a glance" });
  await expect(popParty.getByText("Thia")).toBeVisible();
  await popParty.getByRole("button", { name: "Edit Thia" }).click();
  await popParty.getByLabel("Name").fill("Thia Renamed");
  await popParty.getByRole("button", { name: "Save member" }).click();
  await expect(popParty.getByText("Thia Renamed")).toBeVisible();

  await pop.close();
  const back = page.getByRole("region", { name: "Party at a glance" });
  await expect(back).toBeVisible();
  await expect(back.getByText("Thia Renamed")).toBeVisible();
});

test("NPC card in the Pop-out Window stays live-synced with the NPC list in the main window, both ways", async ({ page }) => {
  await openCampaign(page, "Npc Camp");
  await page.getByRole("navigation", { name: "Modes" }).getByRole("button", { name: /Prep/ }).click();
  const list = page.getByRole("region", { name: "NPCs", exact: true });
  const card = page.getByRole("region", { name: "NPC card" });
  await list.getByRole("button", { name: "New NPC" }).click();
  await card.getByLabel("Name").fill("Mira");
  await card.getByRole("button", { name: "Save", exact: true }).click();
  await expect(card.getByRole("heading", { name: "Mira" })).toBeVisible();

  const pop = await popOut(page, "NPC card");
  const popCard = pop.getByRole("region", { name: "NPC card" });
  await expect(popCard.getByRole("heading", { name: "Mira" })).toBeVisible();

  // pop-out edit -> main list
  await popCard.getByRole("button", { name: "Edit", exact: true }).click();
  await popCard.getByLabel("Name").fill("Mira Vale");
  await popCard.getByRole("button", { name: "Save", exact: true }).click();
  await expect(list.getByRole("button", { name: /Mira Vale/ })).toBeVisible();

  // main create -> pop-out card follows the new selection
  await list.getByRole("button", { name: "New NPC" }).click();
  await expect(popCard.getByLabel("Name")).toBeVisible();
  await popCard.getByLabel("Name").fill("Orin");
  await popCard.getByRole("button", { name: "Save", exact: true }).click();
  await expect(list.getByRole("button", { name: /Orin/ })).toBeVisible();

  // pop-out delete -> main list
  await popCard.getByRole("button", { name: "Delete", exact: true }).click();
  await popCard.getByRole("button", { name: "Delete NPC" }).click();
  await expect(list.getByRole("button", { name: /Orin/ })).toHaveCount(0);
});

test("a popped-out panel is remembered and can be reopened, and sent back from the pop-out", async ({ page }) => {
  await openCampaign(page, "Remember Camp");
  const pop = await popOut(page, "Pinned notes");
  await pop.getByRole("region", { name: "Pinned notes" }).getByRole("button", { name: "Bring back Pinned notes" }).click();
  await expect(page.getByRole("region", { name: "Pinned notes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reopen pop-out" })).toHaveCount(0);

  await popOut(page, "Pinned notes");
  await page.reload();
  await page.getByRole("listitem", { name: "Remember Camp" }).getByRole("button", { name: "Open" }).click();
  await expect(page.getByRole("button", { name: "Reopen pop-out" })).toBeVisible();
});

test("A Stat Block opened by search can be popped out and follows the next search", async ({ page }) => {
  await openCampaign(page, "Srd Camp");
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "Global search" });
  await dialog.getByRole("searchbox", { name: "Search" }).fill("owlbear");
  await dialog.getByRole("button", { name: /Owlbear/ }).click();
  await expect(page.getByRole("article", { name: "Owlbear Stat Block" })).toBeVisible();

  const pop = await popOut(page, "Stat Blocks");
  await expect(pop.getByRole("article", { name: "Owlbear Stat Block" })).toBeVisible();

  await page.keyboard.press("Control+k");
  await page.getByRole("searchbox", { name: "Search" }).fill("aboleth");
  await page.getByRole("button", { name: /Aboleth/ }).click();
  await expect(pop.getByRole("article", { name: "Aboleth Stat Block" })).toBeVisible();
});

test("A pinned NPC stays in the Pop-out Window while the main selection changes, syncs secrets, survives reload, and unpins", async ({ page }) => {
  await openCampaign(page, "Pin Camp");
  await page.getByRole("navigation", { name: "Modes" }).getByRole("button", { name: /Prep/ }).click();
  const list = page.getByRole("region", { name: "NPCs", exact: true });
  const card = page.getByRole("region", { name: "NPC card" });
  for (const name of ["Mira", "Orin"]) {
    await list.getByRole("button", { name: "New NPC" }).click();
    await card.getByLabel("Name").fill(name);
    if (name === "Mira") {
      await card.getByLabel("New secret").fill("Is a spy");
      await card.getByRole("button", { name: "Add secret" }).click();
    }
    await card.getByRole("button", { name: "Save", exact: true }).click();
    await expect(card.getByRole("heading", { name })).toBeVisible();
  }
  await list.getByRole("button", { name: /Mira/ }).click();

  const [pop] = await Promise.all([
    page.context().waitForEvent("page"),
    card.getByRole("button", { name: "Pin to Pop-out" }).click(),
  ]);
  await pop.waitForLoadState();
  const pinned = pop.getByRole("region", { name: "Pinned NPC" });
  await expect(pinned.getByRole("heading", { name: "Mira" })).toBeVisible();

  await list.getByRole("button", { name: /Orin/ }).click();
  await expect(card.getByRole("heading", { name: "Orin" })).toBeVisible();
  await expect(pinned.getByRole("heading", { name: "Mira" })).toBeVisible();

  await list.getByRole("button", { name: /Mira/ }).click();
  await card.getByRole("checkbox", { name: "Is a spy" }).click();
  await expect(pinned.getByRole("checkbox", { name: "Is a spy" })).toBeChecked();

  await pop.reload();
  await expect(pop.getByRole("region", { name: "Pinned NPC" }).getByRole("heading", { name: "Mira" })).toBeVisible();

  // a second pin stacks under the first in the same window
  await list.getByRole("button", { name: /Orin/ }).click();
  await card.getByRole("button", { name: "Pin to Pop-out" }).click();
  await expect(pinned.getByRole("heading", { name: "Orin" })).toBeVisible();
  await expect(pinned.getByRole("heading", { name: "Mira" })).toBeVisible();
  await expect(pinned.getByRole("button", { name: /^Unpin/ })).toHaveCount(2);

  // each has its own Unpin; the panel leaves the window with the last one
  await pinned.getByRole("button", { name: "Unpin Mira" }).click();
  await expect(pinned.getByRole("heading", { name: "Mira" })).toHaveCount(0);
  await expect(pinned.getByRole("heading", { name: "Orin" })).toBeVisible();
  await card.getByRole("button", { name: "Unpin from Pop-out" }).click();
  await expect(pop.getByRole("region", { name: "Pinned NPC" })).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Pin to Pop-out" })).toBeVisible();
});
