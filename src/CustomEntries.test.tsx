import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import App from "./App";
import { setMonsterSource } from "./srd/monsters";
import { FIXTURE_MONSTERS, FIXTURE_REFERENCE } from "./srd/fixtures";
import { setReferenceSource } from "./srd/reference";
import { createCustomEntry, deleteCustomEntry, emptyMonsterData, listCustomEntries, monsterFromEntry } from "./storage/customEntries";
import { exportCampaign, importCampaign, listCampaigns, parseCampaignFile } from "./storage";

type User = ReturnType<typeof userEvent.setup>;

async function openCampaign(user: User, name: string) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), name);
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText(name);
  await user.click(within(screen.getByRole("listitem", { name })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
}
const panel = () => screen.findByRole("region", { name: "Custom Entries" });
async function fill(user: User, form: HTMLElement, label: string, value: string) {
  const el = within(form).getByLabelText(label, { exact: true });
  await user.clear(el);
  await user.type(el, value);
}

beforeEach(() => { localStorage.clear(); setMonsterSource(async () => FIXTURE_MONSTERS); setReferenceSource(async () => FIXTURE_REFERENCE); });
afterEach(() => { setMonsterSource(null); setReferenceSource(null); vi.unstubAllGlobals(); });

describe("custom entries", () => {
  it("creates a custom monster, finds it in search marked custom, and shows the same Stat Block layout", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await user.keyboard("{Alt>}4{/Alt}");
    const p = await panel();
    await user.click(within(p).getByRole("button", { name: "New monster" }));
    const form = within(p).getByRole("form", { name: "Custom monster editor" });
    await fill(user, form, "Name", "Brine Hag");
    await fill(user, form, "AC", "14");
    await fill(user, form, "HP", "40");
    await fill(user, form, "Actions", "Claw: Melee Attack Roll: +5, reach 5 ft. Hit: 7 Slashing damage.");
    await user.click(within(form).getByRole("button", { name: "Save" }));
    expect(await within(p).findByRole("button", { name: /Brine Hag/ })).toBeInTheDocument();

    await user.keyboard("{Control>}k{/Control}");
    const dialog = await screen.findByRole("dialog", { name: /global search/i });
    await user.keyboard("brine");
    const group = await within(dialog).findByRole("list", { name: "Custom" });
    const hit = within(group).getByRole("button", { name: /Brine Hag/ });
    expect(hit).toHaveTextContent(/custom monster/i);
    await user.click(hit);
    const sb = await screen.findByRole("article", { name: "Brine Hag Stat Block" });
    expect(within(sb).getByRole("table", { name: "Ability scores" })).toBeInTheDocument();
    expect(within(sb).getByRole("region", { name: "Actions" })).toHaveTextContent("Claw.");
    expect(within(sb).getByText(/14/)).toBeInTheDocument();
  });

  it("duplicates an SRD monster into an editable custom one, edits it, then deletes it", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await user.keyboard("{Alt>}4{/Alt}");
    const p = await panel();
    await user.keyboard("{Control>}k{/Control}goblin{Enter}");
    await user.click(await screen.findByRole("button", { name: "Duplicate as custom" }));
    expect(await screen.findByRole("article", { name: "Goblin Warrior (copy) Stat Block" })).toBeInTheDocument();
    await user.click(await within(p).findByRole("button", { name: /Goblin Warrior \(copy\)/ }));
    const form = within(p).getByRole("form", { name: "Custom monster editor" });
    expect(within(form).getByLabelText("Traits", { exact: true })).toHaveValue("Nimble Escape: Disengage or Hide as a Bonus Action.");
    await fill(user, form, "Name", "Goblin Boss");
    await user.click(within(form).getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("article", { name: "Goblin Boss Stat Block" })).toBeInTheDocument();
    // the SRD original is untouched
    expect(FIXTURE_MONSTERS.find((m) => m.id === "test-goblin")!.name).toBe("Goblin Warrior");
    await user.click(within(p).getByRole("button", { name: /Goblin Boss/ }));
    await user.click(within(p).getByRole("button", { name: "Delete entry" }));
    await waitFor(() => expect(within(p).queryByRole("button", { name: /Goblin Boss/ })).toBeNull());
    expect(await listCustomEntries((await listCampaigns())[0].id)).toHaveLength(0);
  });

  it("creates custom spells and items that show in search and display as cards", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await user.keyboard("{Alt>}4{/Alt}");
    const p = await panel();
    await user.click(within(p).getByRole("button", { name: "New spell" }));
    let form = within(p).getByRole("form", { name: "Custom spell editor" });
    await fill(user, form, "Name", "Frost Lance");
    await fill(user, form, "Level", "2");
    await fill(user, form, "School", "Evocation");
    await fill(user, form, "Description", "A lance of ice hits for 3d8 Cold damage.");
    await user.click(within(form).getByRole("button", { name: "Save" }));
    await user.click(await within(p).findByRole("button", { name: "New item" }));
    form = within(p).getByRole("form", { name: "Custom item editor" });
    await fill(user, form, "Name", "Ring of Mild Warmth");
    await fill(user, form, "Rarity", "Uncommon");
    await fill(user, form, "Description", "Keeps you toasty.");
    await user.click(within(form).getByRole("button", { name: "Save" }));
    await within(p).findByRole("button", { name: /Ring of Mild Warmth/ });

    await user.keyboard("{Control>}k{/Control}frost");
    let group = await screen.findByRole("list", { name: "Custom" });
    expect(within(group).getByRole("button", { name: /Frost Lance/ })).toHaveTextContent(/custom spell/i);
    await user.keyboard("{Enter}");
    const spell = await screen.findByRole("article", { name: "Frost Lance Spell" });
    expect(spell).toHaveTextContent(/Level 2 Evocation/);
    expect(spell).toHaveTextContent(/3d8 Cold damage/);

    await user.keyboard("{Control>}k{/Control}warmth");
    group = await screen.findByRole("list", { name: "Custom" });
    await user.click(within(group).getByRole("button", { name: /Ring of Mild Warmth/ }));
    const item = await screen.findByRole("article", { name: "Ring of Mild Warmth Item" });
    expect(item).toHaveTextContent(/Uncommon/);
  });

  it("updates the list live when another window writes an entry (no reload)", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await user.keyboard("{Alt>}4{/Alt}");
    const p = await panel();
    const c = (await listCampaigns())[0];
    const e = await createCustomEntry(c.id, "spell", "Far Whisper", { level: 0, school: "Divination", castingTime: "", range: "", components: "", duration: "", desc: "x" });
    expect(await within(p).findByRole("button", { name: /Far Whisper/ })).toBeInTheDocument();
    await deleteCustomEntry(e.id);
    await waitFor(() => expect(within(p).queryByRole("button", { name: /Far Whisper/ })).toBeNull());
  });
});

describe("custom entries storage", () => {
  it("is isolated per Campaign and survives export and import", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    const [a] = await listCampaigns();
    const entry = await createCustomEntry(a.id, "monster", "Pit Fiend Lite", { ...emptyMonsterData(), cr: 4, hp: 60 });
    await createCustomEntry("other-campaign", "monster", "Elsewhere", emptyMonsterData());
    expect((await listCustomEntries(a.id)).map((x) => x.name)).toEqual(["Pit Fiend Lite"]);
    expect(monsterFromEntry(entry)).toMatchObject({ id: `custom:${entry.id}`, name: "Pit Fiend Lite", hp: 60, cr: 4 });

    const doc = (await exportCampaign(a.id))!;
    expect(doc.collections.customEntries.map((x) => x.name)).toEqual(["Pit Fiend Lite"]);
    await deleteCustomEntry(entry.id);
    const parsed = parseCampaignFile(JSON.stringify(doc));
    if (!parsed.ok) throw new Error(parsed.error);
    await importCampaign(parsed.data);
    expect((await listCustomEntries(a.id)).map((x) => x.name)).toEqual(["Pit Fiend Lite"]);
  });

  it("still imports older exports that have no custom entries", () => {
    const old = { format: "dungeon-desktop-campaign", version: 1, exportedAt: 1, campaign: { id: "c", name: "Old", createdAt: 1, updatedAt: 1 }, collections: { party: [], npcs: [], locations: [], sessions: [], notes: [] } };
    const r = parseCampaignFile(JSON.stringify(old));
    expect(r.ok && r.data.collections.customEntries).toEqual([]);
  });
});
