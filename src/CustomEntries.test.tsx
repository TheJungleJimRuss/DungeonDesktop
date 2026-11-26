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
    await user.click(within(form).getByRole("button", { name: "Add action" }));
    await fill(user, form, "Action 1 name", "Claw");
    await fill(user, form, "Action 1 description", "Melee Attack Roll: +5, reach 5 ft. Hit: 7 Slashing damage.");
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
    expect(within(form).getByLabelText("Trait 1 name")).toHaveValue("Nimble Escape");
    expect(within(form).getByLabelText("Trait 1 description")).toHaveValue("Disengage or Hide as a Bonus Action.");
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

  it("saves a duplicated SRD monster without edits and keeps its data identical", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await user.keyboard("{Alt>}4{/Alt}");
    const p = await panel();
    await user.keyboard("{Control>}k{/Control}goblin{Enter}");
    await user.click(await screen.findByRole("button", { name: "Duplicate as custom" }));
    await user.click(await within(p).findByRole("button", { name: /Goblin Warrior \(copy\)/ }));
    const cid = (await listCampaigns())[0].id;
    const before = (await listCustomEntries(cid))[0];
    const form = within(p).getByRole("form", { name: "Custom monster editor" });
    await user.click(within(form).getByRole("button", { name: "Save" }));
    await screen.findByRole("article", { name: "Goblin Warrior (copy) Stat Block" });
    await waitFor(() => expect(within(p).queryByRole("form", { name: "Custom monster editor" })).toBeNull());
    const after = (await listCustomEntries(cid))[0];
    expect(after.data).toEqual(before.data);
  });

  it("fills XP and proficiency bonus from the CR, and bonuses follow the scores", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await user.keyboard("{Alt>}4{/Alt}");
    const p = await panel();
    await user.click(within(p).getByRole("button", { name: "New monster" }));
    const form = within(p).getByRole("form", { name: "Custom monster editor" });
    await user.selectOptions(within(form).getByLabelText("CR"), "5");
    expect(within(form).getByLabelText("XP")).toHaveValue(1800);
    expect(within(form).getByLabelText("Proficiency bonus")).toHaveValue(3);
    await user.selectOptions(within(form).getByLabelText("CR"), "1/4");
    expect(within(form).getByLabelText("XP")).toHaveValue(50);
    expect(within(form).getByLabelText("Proficiency bonus")).toHaveValue(2);

    await user.click(within(form).getByLabelText("DEX save"));
    expect(within(form).getByLabelText("DEX save bonus")).toHaveValue(2); // mod 0 + PB 2
    await fill(user, form, "DEX", "16");
    expect(within(form).getByLabelText("DEX save bonus")).toHaveValue(5); // +3 + 2
    await fill(user, form, "DEX save bonus", "9");
    await fill(user, form, "DEX", "10");
    expect(within(form).getByLabelText("DEX save bonus")).toHaveValue(9);
    await user.click(within(form).getByRole("button", { name: "Reset DEX save bonus to auto" }));
    expect(within(form).getByLabelText("DEX save bonus")).toHaveValue(2);

    expect(within(form).getByLabelText("Passive Perception")).toHaveTextContent("10");
    await user.selectOptions(within(form).getByLabelText("Add skill"), "Perception");
    await user.click(within(form).getByRole("button", { name: "Add selected skill" }));
    expect(within(form).getByLabelText("Perception bonus")).toHaveValue(2);
    expect(within(form).getByLabelText("Passive Perception")).toHaveTextContent("12");
    await user.selectOptions(within(form).getByLabelText("Perception level"), "expertise");
    expect(within(form).getByLabelText("Passive Perception")).toHaveTextContent("14");
  });

  it("saves a fire resistance checkbox and the Stat Block lists it", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await user.keyboard("{Alt>}4{/Alt}");
    const p = await panel();
    await user.click(within(p).getByRole("button", { name: "New monster" }));
    const form = within(p).getByRole("form", { name: "Custom monster editor" });
    await fill(user, form, "Name", "Ember Imp");
    await user.click(within(form).getByLabelText("Resistances: Fire"));
    await user.click(within(form).getByLabelText("Condition immunities: Poisoned"));
    await user.click(within(form).getByRole("button", { name: "Save" }));
    await within(p).findByRole("button", { name: /Ember Imp/ });
    await user.keyboard("{Control>}k{/Control}ember{Enter}");
    const sb = await screen.findByRole("article", { name: "Ember Imp Stat Block" });
    expect(sb).toHaveTextContent(/Resistances\W+Fire/i);
    const stored = (await listCustomEntries((await listCampaigns())[0].id))[0].data as { resistances: string[]; conditionImmunities: string[] };
    expect(stored.resistances).toEqual(["Fire"]);
    expect(stored.conditionImmunities).toEqual(["Poisoned"]);
  });

  it("reorders and removes entries", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await user.keyboard("{Alt>}4{/Alt}");
    const p = await panel();
    await user.click(within(p).getByRole("button", { name: "New monster" }));
    const form = within(p).getByRole("form", { name: "Custom monster editor" });
    await user.click(within(form).getByRole("button", { name: "Add trait" }));
    await user.click(within(form).getByRole("button", { name: "Add trait" }));
    await fill(user, form, "Trait 1 name", "First");
    await fill(user, form, "Trait 2 name", "Second");
    await user.click(within(form).getByRole("button", { name: "Move Trait 2 up" }));
    expect(within(form).getByLabelText("Trait 1 name")).toHaveValue("Second");
    expect(within(form).getByLabelText("Trait 2 name")).toHaveValue("First");
    await user.click(within(form).getByRole("button", { name: "Remove Trait 1" }));
    expect(within(form).queryByLabelText("Trait 2 name")).toBeNull();
    expect(within(form).getByLabelText("Trait 1 name")).toHaveValue("First");
    await user.click(within(form).getByRole("button", { name: "Add legendary action" }));
    expect(within(form).getByLabelText("Uses per round")).toHaveValue(3);
  });

  describe("attack builder", () => {
    async function setup(user: User) {
      render(<App />);
      await openCampaign(user, "Alpha");
      await user.keyboard("{Alt>}4{/Alt}");
      const p = await panel();
      await user.click(within(p).getByRole("button", { name: "New monster" }));
      const form = within(p).getByRole("form", { name: "Custom monster editor" });
      await fill(user, form, "Name", "Biter");
      await fill(user, form, "STR", "16");
      await user.selectOptions(within(form).getByLabelText("CR"), "1");
      await user.click(within(form).getByRole("button", { name: "Add action" }));
      await fill(user, form, "Action 1 name", "Bite");
      await user.click(within(form).getByRole("button", { name: "Build attack for Action 1" }));
      return { p, form };
    }

    it("writes melee text with an extra damage line and shows it on the Stat Block", async () => {
      const user = userEvent.setup();
      const { p, form } = await setup(user);
      expect(within(form).queryByRole("button", { name: /Build attack for Trait/ })).toBeNull();
      expect(within(form).getByRole("button", { name: "Build attack for Action 1" })).toHaveAttribute("aria-expanded", "true");
      await user.selectOptions(within(form).getByLabelText("Damage die for Action 1"), "d8");
      await user.selectOptions(within(form).getByLabelText("Damage type for Action 1"), "Piercing");
      await user.click(within(form).getByRole("button", { name: "Write description for Action 1" }));
      expect(within(form).getByLabelText("Action 1 description")).toHaveValue("Melee Attack Roll: +5, reach 5 ft. Hit: 7 (1d8 + 3) Piercing damage.");
      expect(within(form).queryByLabelText("Damage die for Action 1")).toBeNull();

      await user.click(within(form).getByRole("button", { name: "Build attack for Action 1" }));
      await user.click(within(form).getByRole("button", { name: "Add extra damage for Action 1" }));
      await user.selectOptions(within(form).getByLabelText("Damage die for Action 1"), "d8");
      await user.selectOptions(within(form).getByLabelText("Damage type for Action 1"), "Piercing");
      expect(within(form).getByLabelText("Attack preview for Action 1")).toHaveTextContent("plus 3 (1d6) Fire damage.");
      await user.click(within(form).getByRole("button", { name: "Write description for Action 1" }));
      expect(within(form).getByLabelText("Action 1 description")).toHaveValue(
        "Melee Attack Roll: +5, reach 5 ft. Hit: 7 (1d8 + 3) Piercing damage plus 3 (1d6) Fire damage.");

      await user.click(within(form).getByRole("button", { name: "Save" }));
      await within(p).findByRole("button", { name: /Biter/ });
      await user.keyboard("{Control>}k{/Control}");
      const dialog = await screen.findByRole("dialog", { name: /global search/i });
      await user.keyboard("biter");
      const group = await within(dialog).findByRole("list", { name: "Custom" });
      await user.click(within(group).getByRole("button", { name: /Biter/ }));
      const sb = await screen.findByRole("article", { name: "Biter Stat Block" });
      const actions = within(sb).getByRole("region", { name: "Actions" });
      expect(actions).toHaveTextContent("Bite.");
      expect(actions).toHaveTextContent("+5");
    });

    it("writes ranged text with the default 80/320 range and DEX", async () => {
      const user = userEvent.setup();
      const { form } = await setup(user);
      await user.selectOptions(within(form).getByLabelText("Attack kind for Action 1"), "Ranged");
      expect(within(form).getByLabelText("Attack ability for Action 1")).toHaveValue("dex");
      await user.click(within(form).getByRole("button", { name: "Write description for Action 1" }));
      expect(within(form).getByLabelText("Action 1 description")).toHaveValue("Ranged Attack Roll: +2, range 80/320 ft. Hit: 3 (1d6) Slashing damage.");
    });
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

describe("custom spell and item extra fields", () => {
  async function openPanel() {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await user.keyboard("{Alt>}4{/Alt}");
    return { user, p: await panel() };
  }

  /** Shows a custom entry's card the way the DM does: global search, pick the hit. */
  async function showCard(user: User, query: string, hit: RegExp, cardName: string) {
    await user.keyboard(`{Control>}k{/Control}${query}`);
    const group = await screen.findByRole("list", { name: "Custom" });
    await user.click(within(group).getByRole("button", { name: hit }));
    return screen.findByRole("article", { name: cardName });
  }

  it("types Classes, Ritual and Higher Level on a spell, saves, reopens and shows them on the card", async () => {
    const { user, p } = await openPanel();
    await user.click(within(p).getByRole("button", { name: "New spell" }));
    let form = within(p).getByRole("form", { name: "Custom spell editor" });
    await fill(user, form, "Name", "Frost Lance");
    await fill(user, form, "Level", "2");
    await fill(user, form, "School", "Evocation");
    await fill(user, form, "Classes", "Wizard, Sorcerer");
    await user.click(within(form).getByRole("checkbox", { name: "Ritual" }));
    await fill(user, form, "Description", "A lance of ice.");
    await fill(user, form, "Higher Level", "Damage rises by 1d8 per slot above 2nd.");
    await user.click(within(form).getByRole("button", { name: "Save" }));

    const card = await showCard(user, "frost", /Frost Lance/, "Frost Lance Spell");
    expect(card).toHaveTextContent("Level 2 Evocation (ritual) · Wizard, Sorcerer");
    expect(card).toHaveTextContent("Damage rises by 1d8 per slot above 2nd.");

    await user.click(await within(p).findByRole("button", { name: /Frost Lance/ }));
    form = within(p).getByRole("form", { name: "Custom spell editor" });
    expect(within(form).getByLabelText("Classes")).toHaveValue("Wizard, Sorcerer");
    expect(within(form).getByRole("checkbox", { name: "Ritual" })).toBeChecked();
    expect(within(form).getByLabelText("Higher Level")).toHaveValue("Damage rises by 1d8 per slot above 2nd.");
  });

  it("types Attunement on an item, saves, reopens and shows it in the subtitle", async () => {
    const { user, p } = await openPanel();
    await user.click(within(p).getByRole("button", { name: "New item" }));
    let form = within(p).getByRole("form", { name: "Custom item editor" });
    await fill(user, form, "Name", "Ring of Mild Warmth");
    await fill(user, form, "Type", "Ring");
    await fill(user, form, "Rarity", "Uncommon");
    await fill(user, form, "Attunement", "Requires Attunement by a Wizard");
    await fill(user, form, "Description", "Keeps you toasty.");
    await user.click(within(form).getByRole("button", { name: "Save" }));
    const card = await showCard(user, "warmth", /Ring of Mild Warmth/, "Ring of Mild Warmth Item");
    expect(card).toHaveTextContent("Ring, Uncommon (requires attunement by a wizard)");
    await user.click(await within(p).findByRole("button", { name: /Ring of Mild Warmth/ }));
    form = within(p).getByRole("form", { name: "Custom item editor" });
    expect(within(form).getByLabelText("Attunement")).toHaveValue("Requires Attunement by a Wizard");
  });

  it("opens and shows old records that lack the new fields", async () => {
    const { user, p } = await openPanel();
    const c = (await listCampaigns())[0];
    // deliberately the old shape: no classes, ritual, higherLevel or attunement
    await createCustomEntry(c.id, "spell", "Old Spark", { level: 1, school: "Evocation", castingTime: "1 action", range: "30 ft", components: "V", duration: "Instant", desc: "Zap." });
    await createCustomEntry(c.id, "item", "Old Amulet", { type: "Wondrous", rarity: "Rare", desc: "Shiny." });
    await user.click(await within(p).findByRole("button", { name: /Old Spark/ }));
    const form = within(p).getByRole("form", { name: "Custom spell editor" });
    expect(within(form).getByLabelText("Classes")).toHaveValue("");
    expect(within(form).getByRole("checkbox", { name: "Ritual" })).not.toBeChecked();
    expect(within(form).getByLabelText("Higher Level")).toHaveValue("");
    await user.click(within(form).getByRole("button", { name: "Save" }));
    const spell = await showCard(user, "spark", /Old Spark/, "Old Spark Spell");
    expect(spell).toHaveTextContent("Level 1 Evocation");
    expect(spell).not.toHaveTextContent(/ritual|·/);
    await user.click(await within(p).findByRole("button", { name: /Old Amulet/ }));
    await user.click(within(within(p).getByRole("form", { name: "Custom item editor" })).getByRole("button", { name: "Save" }));
    const item = await showCard(user, "amulet", /Old Amulet/, "Old Amulet Item");
    expect(item).toHaveTextContent("Wondrous, Rare");
    expect(item).not.toHaveTextContent(/attunement|\(/);
  });

  it("keeps the new fields through Campaign export and import, and imports files without them", async () => {
    const { p } = await openPanel();
    expect(p).toBeInTheDocument();
    const [a] = await listCampaigns();
    const e = await createCustomEntry(a.id, "spell", "Frost Lance", { level: 2, school: "Evocation", castingTime: "", range: "", components: "", duration: "", desc: "x", classes: ["Wizard"], ritual: true, higherLevel: "More." });
    const i = await createCustomEntry(a.id, "item", "Warm Ring", { type: "Ring", rarity: "Rare", desc: "y", attunement: "Requires Attunement" });
    const doc = (await exportCampaign(a.id))!;
    await deleteCustomEntry(e.id);
    await deleteCustomEntry(i.id);
    const parsed = parseCampaignFile(JSON.stringify(doc));
    if (!parsed.ok) throw new Error(parsed.error);
    await importCampaign(parsed.data);
    const rows = await listCustomEntries(a.id);
    expect(rows.find((r) => r.name === "Frost Lance")!.data).toMatchObject({ classes: ["Wizard"], ritual: true, higherLevel: "More." });
    expect(rows.find((r) => r.name === "Warm Ring")!.data).toMatchObject({ attunement: "Requires Attunement" });

    const old = { ...doc, collections: { ...doc.collections, customEntries: [{ ...doc.collections.customEntries[0], data: { level: 0, school: "", castingTime: "", range: "", components: "", duration: "", desc: "" } }] } };
    expect(parseCampaignFile(JSON.stringify(old)).ok).toBe(true);
  });
});

describe("paste a spell", () => {
  const SPELL = `Glimmer Lance
Level 3 Evocation (Sorcerer, Wizard)
Casting Time: 10 minutes or Ritual
Range: 90 feet
Components: V, S
Duration: Instantaneous
A shard of pale light streaks toward a creature you can see. It takes 8d6 Radiant damage.

Using a Higher-Level Spell Slot. The damage increases by 1d6 per slot level above 3.`;

  async function openSpell() {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await user.keyboard("{Alt>}4{/Alt}");
    const p = await panel();
    await user.click(within(p).getByRole("button", { name: "New spell" }));
    return { user, p, form: within(p).getByRole("form", { name: "Custom spell editor" }) };
  }
  /** Opens the paste dialog, pastes (typed as one chunk) and presses Fill. */
  async function pasteAndFill(user: User, p: HTMLElement, text: string) {
    await user.click(within(p).getByRole("button", { name: "Paste stat block" }));
    const dialog = screen.getByRole("dialog", { name: "Paste stat block" });
    await user.click(within(dialog).getByLabelText("Stat block text"));
    await user.paste(text);
    await user.click(within(dialog).getByRole("button", { name: "Fill" }));
  }

  it("fills the form from pasted text, then Save is found in search and the card shows it", async () => {
    const { user, p, form } = await openSpell();
    await pasteAndFill(user, p, SPELL);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(within(form).getByLabelText("Name")).toHaveValue("Glimmer Lance");
    expect(within(form).getByLabelText("Level")).toHaveValue("3");
    expect(within(form).getByLabelText("School")).toHaveValue("Evocation");
    expect(within(form).getByLabelText("Classes")).toHaveValue("Sorcerer, Wizard");
    expect(within(form).getByRole("checkbox", { name: "Ritual" })).toBeChecked();
    expect(within(form).getByLabelText("Casting Time")).toHaveValue("10 minutes");
    expect(within(form).getByLabelText("Range")).toHaveValue("90 feet");
    expect(within(form).getByLabelText("Higher Level")).toHaveValue("The damage increases by 1d6 per slot level above 3.");
    expect(within(form).getByLabelText("Description")).toHaveValue("A shard of pale light streaks toward a creature you can see. It takes 8d6 Radiant damage.");
    // nothing saved until Save
    expect(await listCustomEntries((await listCampaigns())[0].id)).toHaveLength(0);
    await user.click(within(form).getByRole("button", { name: "Save" }));

    await user.keyboard("{Control>}k{/Control}glimmer");
    const group = await screen.findByRole("list", { name: "Custom" });
    await user.click(within(group).getByRole("button", { name: /Glimmer Lance/ }));
    const card = await screen.findByRole("article", { name: "Glimmer Lance Spell" });
    expect(card).toHaveTextContent("Level 3 Evocation (ritual) · Sorcerer, Wizard");
    expect(card).toHaveTextContent("The damage increases by 1d6 per slot level above 3.");
  });

  it("keeps a typed Name, and pasting into a saved entry keeps its name and the fields not in the paste", async () => {
    const { user, p, form } = await openSpell();
    await fill(user, form, "Name", "My Lance");
    await pasteAndFill(user, p, SPELL);
    expect(within(form).getByLabelText("Name")).toHaveValue("My Lance");
    await user.click(within(form).getByRole("button", { name: "Save" }));

    await user.click(await within(p).findByRole("button", { name: /My Lance/ }));
    const again = within(p).getByRole("form", { name: "Custom spell editor" });
    await pasteAndFill(user, p, "Other Name\nRange: Touch");
    expect(within(again).getByLabelText("Name")).toHaveValue("My Lance");
    expect(within(again).getByLabelText("Range")).toHaveValue("Touch");
    expect(within(again).getByLabelText("School")).toHaveValue("Evocation");
    expect(within(again).getByLabelText("Classes")).toHaveValue("Sorcerer, Wizard");
  });

  it("lists lines it could not place under the form until Save", async () => {
    const { user, p, form } = await openSpell();
    await pasteAndFill(user, p, SPELL.replace("Range:", "Page 214\nRange:"));
    const notice = within(p).getByRole("region", { name: "Lines not read" });
    expect(notice).toHaveTextContent("Page 214");
    await user.click(within(form).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(within(p).queryByRole("region", { name: "Lines not read" })).toBeNull());
  });

  it("keeps the dialog open with a message when nothing could be read", async () => {
    const { user, p } = await openSpell();
    await pasteAndFill(user, p, "just some words");
    const dialog = screen.getByRole("dialog", { name: "Paste stat block" });
    expect(within(dialog).getByText("Nothing in that text could be read.")).toBeInTheDocument();
  });

  it("closes on Esc and on Cancel without leaving the panel, and a Fill marks the form unsaved", async () => {
    const { user, p, form } = await openSpell();
    await user.click(within(p).getByRole("button", { name: "Paste stat block" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(within(p).getByRole("form", { name: "Custom spell editor" })).toBeInTheDocument();
    expect(form).not.toHaveAttribute("data-dirty");
    await user.click(within(p).getByRole("button", { name: "Paste stat block" }));
    await user.click(within(screen.getByRole("dialog"), ).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(form).not.toHaveAttribute("data-dirty");
    await pasteAndFill(user, p, SPELL);
    expect(form).toHaveAttribute("data-dirty");
  });
});

describe("paste an item", () => {
  const ITEM = `Lantern of Quiet Hours
Wondrous Item, Rare (Requires Attunement by a Wizard)
While lit, the lantern sheds dim light in a 30-foot radius.`;

  async function openItem() {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await user.keyboard("{Alt>}4{/Alt}");
    const p = await panel();
    await user.click(within(p).getByRole("button", { name: "New item" }));
    return { user, p, form: within(p).getByRole("form", { name: "Custom item editor" }) };
  }
  async function pasteAndFill(user: User, p: HTMLElement, text: string) {
    await user.click(within(p).getByRole("button", { name: "Paste stat block" }));
    const dialog = screen.getByRole("dialog", { name: "Paste stat block" });
    await user.click(within(dialog).getByLabelText("Stat block text"));
    await user.paste(text);
    await user.click(within(dialog).getByRole("button", { name: "Fill" }));
  }

  it("fills the form, Save is found in search and the card shows type, rarity and attunement", async () => {
    const { user, p, form } = await openItem();
    await pasteAndFill(user, p, ITEM);
    expect(within(form).getByLabelText("Name")).toHaveValue("Lantern of Quiet Hours");
    expect(within(form).getByLabelText("Type")).toHaveValue("Wondrous Item");
    expect(within(form).getByLabelText("Rarity")).toHaveValue("Rare");
    expect(within(form).getByLabelText("Attunement")).toHaveValue("Requires Attunement by a Wizard");
    expect(within(form).getByLabelText("Description")).toHaveValue("While lit, the lantern sheds dim light in a 30-foot radius.");
    expect(form).toHaveAttribute("data-dirty");
    await user.click(within(form).getByRole("button", { name: "Save" }));

    await user.keyboard("{Control>}k{/Control}lantern");
    const group = await screen.findByRole("list", { name: "Custom" });
    await user.click(within(group).getByRole("button", { name: /Lantern of Quiet Hours/ }));
    const card = await screen.findByRole("article", { name: "Lantern of Quiet Hours Item" });
    expect(card).toHaveTextContent("Wondrous Item");
    expect(card).toHaveTextContent("Rare");
    expect(card).toHaveTextContent("Wondrous Item, Rare (requires attunement by a wizard)"); // the card lower-cases the attunement text
  });

  it("lists an unparsed header under the form, and says when nothing could be read", async () => {
    const { user, p } = await openItem();
    await pasteAndFill(user, p, "Hollow Bell\nOdd header line\nIt rings once.");
    expect(within(p).getByRole("region", { name: "Lines not read" })).toHaveTextContent("Odd header line");
    await pasteAndFill(user, p, "just some words");
    expect(within(screen.getByRole("dialog", { name: "Paste stat block" })).getByText("Nothing in that text could be read.")).toBeInTheDocument();
  });
});
