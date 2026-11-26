import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import App from "./App";
import { setMonsterSource } from "./srd/monsters";
import { FIXTURE_MONSTERS, FIXTURE_REFERENCE } from "./srd/fixtures";
import { setReferenceSource } from "./srd/reference";
import { listCampaigns } from "./storage";
import { createCustomEntry, emptyMonsterData, listCustomEntries } from "./storage/customEntries";

type User = ReturnType<typeof userEvent.setup>;

const BLOCK = `Gloomwick Warden
Large Aberration, Lawful Evil
AC 17 (natural armor) Initiative +7 (17)
HP 180 (19d10 + 76)
Speed 30 ft., Fly 60 ft. (hover)
MOD SAVE MOD SAVE MOD SAVE
Str 18 +4 +4 Dex 14 +2 +6 Con 18 +4 +4
Int 12 +1 +1 Wis 16 +3 +7 Cha 10 +0 +0
Skills Perception +7, Stealth +6
Resistances Cold
Senses Darkvision 120 ft.; Passive Perception 17
Languages Deep Speech
Hoard Many shiny buttons
CR 13 (XP 10,000; PB +5)
Actions
Slam. Melee Attack Roll: +9, reach 10 ft. Hit: 15 (2d8 + 6) Bludgeoning damage.`;

async function openCampaign(user: User, name: string) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), name);
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText(name);
  await user.click(within(screen.getByRole("listitem", { name })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
}
async function openEditor(user: User) {
  await user.keyboard("{Alt>}4{/Alt}");
  const p = await screen.findByRole("region", { name: "Custom Entries" });
  await user.click(within(p).getByRole("button", { name: "New monster" }));
  return { p, form: within(p).getByRole("form", { name: "Custom monster editor" }) };
}
async function pasteIn(user: User, form: HTMLElement, text: string) {
  await user.click(within(form).getByRole("button", { name: "Paste stat block" }));
  const dialog = await screen.findByRole("dialog", { name: "Paste stat block" });
  await user.click(within(dialog).getByLabelText("Stat block text"));
  await user.paste(text);
  await user.click(within(dialog).getByRole("button", { name: "Fill" }));
}

beforeEach(() => { localStorage.clear(); setMonsterSource(async () => FIXTURE_MONSTERS); setReferenceSource(async () => FIXTURE_REFERENCE); });
afterEach(() => { setMonsterSource(null); setReferenceSource(null); vi.unstubAllGlobals(); });

describe("paste a monster", () => {
  it("fills the editor, saves, shows in Global Search and the Stat Block, lists unread lines, and joins Combat", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    const { p, form } = await openEditor(user);
    await pasteIn(user, form, BLOCK);

    expect(within(form).getByLabelText("Name", { exact: true })).toHaveValue("Gloomwick Warden");
    expect(within(form).getByLabelText("AC", { exact: true })).toHaveValue(17);
    expect(within(form).getByLabelText("HP", { exact: true })).toHaveValue(180);
    expect(form).toHaveAttribute("data-dirty");
    const notice = within(p).getByRole("region", { name: "Lines not read" });
    expect(notice).toHaveTextContent("Hoard Many shiny buttons");

    await user.click(within(form).getByRole("button", { name: "Save" }));
    expect(await within(p).findByRole("button", { name: /Gloomwick Warden/ })).toBeInTheDocument();
    expect(within(p).queryByRole("region", { name: "Lines not read" })).not.toBeInTheDocument();

    await user.keyboard("{Control>}k{/Control}");
    const dialog = await screen.findByRole("dialog", { name: /global search/i });
    await user.keyboard("gloomwick");
    await user.click(within(await within(dialog).findByRole("list", { name: "Custom" })).getByRole("button", { name: /Gloomwick Warden/ }));
    const sb = await screen.findByRole("article", { name: "Gloomwick Warden Stat Block" });
    expect(sb).toHaveTextContent(/17/);
    expect(sb).toHaveTextContent(/180/);
    expect(within(sb).getByRole("region", { name: "Actions" })).toHaveTextContent("Slam.");

    const saved = (await listCustomEntries((await listCampaigns())[0].id))[0];
    expect(saved.data).toMatchObject({ acNote: "natural armor", saves: ["DEX +6", "WIS +7"], cr: 13, xp: 10000, pb: 5, size: "Large" });

    await user.keyboard("{Alt>}1{/Alt}");
    await user.click(await screen.findByRole("button", { name: /start encounter/i }));
    const box = await screen.findByRole("searchbox", { name: /search monsters/i });
    await user.type(box, "gloomwick");
    await user.click(await screen.findByRole("button", { name: "Add Gloomwick Warden" }));
    await waitFor(() => expect(within(screen.getByRole("list", { name: /initiative order/i })).getAllByRole("listitem")).toHaveLength(1));
  });

  it("keeps a saved monster's name and untouched fields when pasting into it", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    const id = (await listCampaigns())[0].id;
    await createCustomEntry(id, "monster", "My Warden", { ...emptyMonsterData(), hp: 40, languages: "Common" });
    await user.keyboard("{Alt>}4{/Alt}");
    const p = await screen.findByRole("region", { name: "Custom Entries" });
    await user.click(await within(p).findByRole("button", { name: /My Warden/ }));
    const form = within(p).getByRole("form", { name: "Custom monster editor" });
    await pasteIn(user, form, "Gloomwick Warden\nLarge Aberration, Lawful Evil\nAC 17\nHP 180 (19d10 + 76)");
    expect(within(form).getByLabelText("Name", { exact: true })).toHaveValue("My Warden");
    expect(within(form).getByLabelText("HP", { exact: true })).toHaveValue(180);
    await user.click(within(form).getByRole("button", { name: "Save" }));
    await waitFor(async () => expect((await listCustomEntries(id))[0].data).toMatchObject({ hp: 180, ac: 17, languages: "Common" }));
  });

  it("says when nothing could be read and keeps the dialog open", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    const { form } = await openEditor(user);
    await pasteIn(user, form, "just some words");
    expect(await screen.findByRole("alert")).toHaveTextContent(/nothing in that text could be read/i);
    expect(screen.getByRole("dialog", { name: "Paste stat block" })).toBeInTheDocument();
  });

  it("shows Gear and XP in lair as form fields after a paste, and keeps edits through save and reopen", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    const { p, form } = await openEditor(user);
    await pasteIn(user, form, BLOCK.replace("Hoard Many shiny buttons", "Gear Brass lantern, 3 spare wicks").replace("CR 13 (XP 10,000; PB +5)", "CR 5 (XP 1,800, or 2,300 in lair; PB +3)"));
    expect(within(form).getByLabelText("Gear", { exact: true })).toHaveValue("Brass lantern, 3 spare wicks");
    expect(within(form).getByLabelText("XP in lair", { exact: true })).toHaveValue(2300);

    await user.clear(within(form).getByLabelText("Gear", { exact: true }));
    await user.type(within(form).getByLabelText("Gear", { exact: true }), "Tin whistle");
    await user.clear(within(form).getByLabelText("XP in lair", { exact: true }));
    await user.type(within(form).getByLabelText("XP in lair", { exact: true }), "2500");
    await user.click(within(form).getByRole("button", { name: "Save" }));
    await user.click(await within(p).findByRole("button", { name: /Gloomwick Warden/ }));
    const again = within(p).getByRole("form", { name: "Custom monster editor" });
    expect(within(again).getByLabelText("Gear", { exact: true })).toHaveValue("Tin whistle");
    expect(within(again).getByLabelText("XP in lair", { exact: true })).toHaveValue(2500);

    await user.clear(within(again).getByLabelText("Gear", { exact: true }));
    await user.clear(within(again).getByLabelText("XP in lair", { exact: true }));
    await user.click(within(again).getByRole("button", { name: "Save" }));
    const saved = (await listCustomEntries((await listCampaigns())[0].id))[0].data as Record<string, unknown>;
    await waitFor(() => expect(saved.xp).toBe(1800));
    expect(saved.gear).toBeUndefined();
    expect(saved.xpInLair).toBeUndefined();
  });
});
