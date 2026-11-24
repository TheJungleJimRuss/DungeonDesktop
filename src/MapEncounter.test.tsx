import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { openDB } from "idb";
import App from "./App";
import { setMonsterSource } from "./srd/monsters";
import { FIXTURE_MONSTERS } from "./srd/fixtures";
import { exportCampaign, importCampaign, listCampaigns, parseCampaignFile } from "./storage";
import { addPartyMember } from "./storage/party";
import { createMap, listMaps, updateMap } from "./storage/maps";
import { closeDb, getDb } from "./storage/db";

type User = ReturnType<typeof userEvent.setup>;

/** Opens the campaign on Combat. `start` clicks Start encounter (with whatever the Encounter map picker says). */
async function openCombat(user: User, start = true) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), "Alpha");
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText("Alpha");
  await user.click(within(screen.getByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
  await user.keyboard("{Alt>}1{/Alt}");
  await screen.findByRole("heading", { name: /^combat$/i });
  if (start) await user.click(await screen.findByRole("button", { name: /start encounter/i }));
  return { id: (await listCampaigns())[0].id, map: within(await screen.findByRole("region", { name: "Map" })) };
}
async function addMonster(user: User, query: string, name: string) {
  const box = await screen.findByRole("searchbox", { name: /search monsters/i });
  await user.clear(box);
  await user.type(box, query);
  await user.click(await screen.findByRole("button", { name: `Add ${name}` }));
}
async function addAdhoc(user: User, name: string, hp: string) {
  await user.type(await screen.findByLabelText("Ad-hoc name"), name);
  await user.type(screen.getByLabelText("Ad-hoc HP"), hp);
  await user.click(screen.getByRole("button", { name: /add ad-hoc/i }));
}
/** Non-active tracker rows start collapsed; open one to reach its controls. */
const expand = async (user: User, name: string) => { const b = screen.queryByRole("button", { name: `Expand ${name}` }); if (b) await user.click(b); };
const row = (name: string) => screen.getByRole("listitem", { name });
const pos = (el: HTMLElement) => [el.getAttribute("data-col"), el.getAttribute("data-row")];
const rows = async (id: string, store: "maps" | "encounters" | "savedEncounters") => (await exportCampaign(id))!.collections[store] as unknown as Record<string, any>[];
const endEncounter = async (user: User) => {
  await user.click(screen.getByRole("button", { name: /end encounter/i }));
  await user.click(await screen.findByRole("button", { name: /yes, end it/i }));
};

beforeEach(() => { localStorage.clear(); setMonsterSource(async () => FIXTURE_MONSTERS); });
afterEach(() => setMonsterSource(null));

describe("Encounter map choice", () => {
  it("a double click on Start encounter makes one Map and one Encounter", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id } = await openCombat(user, false);
    await user.dblClick(await screen.findByRole("button", { name: /start encounter/i }));
    await screen.findByRole("region", { name: "Map" });
    await waitFor(async () => expect(await rows(id, "encounters")).toHaveLength(1));
    expect(await rows(id, "maps")).toHaveLength(1);
  });
  it("with no pick, makes a blank 20x20, 5 ft Map named after the Encounter and shows it in Combat, locked", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, map } = await openCombat(user);
    await waitFor(async () => expect(await rows(id, "maps")).toHaveLength(1));
    const [m] = await rows(id, "maps");
    expect(m).toMatchObject({ name: "Encounter 1", width: 20, height: 20, perSquare: 5, unit: "ft", showGrid: true });
    expect((await rows(id, "encounters"))[0].mapId).toBe(m.id);
    // Combat shows the Encounter's Map; the picker is locked to it and its Map cannot be deleted under it
    const picker = await map.findByRole("combobox", { name: "Map" });
    expect(picker).toHaveDisplayValue("Encounter 1");
    expect(picker).toBeDisabled();
    expect(map.getByRole("button", { name: "Delete map" })).toBeDisabled();
    expect(map.getByRole("button", { name: /add tokens for all combatants/i })).toBeInTheDocument();
  });

  it("with a picked Map, the Encounter is played on it and no Map is created", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id } = await openCombat(user, false);
    await createMap(id, "Goblin Cave");
    const dungeon = await createMap(id, "Crypt");
    const picker = await screen.findByRole("combobox", { name: "Encounter map" });
    await waitFor(() => expect(within(picker).getAllByRole("option").map((o) => o.textContent)).toEqual(["New blank map", "Crypt", "Goblin Cave"]));
    await user.selectOptions(picker, "Crypt");
    await user.click(screen.getByRole("button", { name: /start encounter/i }));
    const map = within(await screen.findByRole("region", { name: "Map" }));
    await waitFor(async () => expect((await rows(id, "encounters"))[0].mapId).toBe(dungeon.id));
    expect(await listMaps(id)).toHaveLength(2);
    expect(await map.findByRole("combobox", { name: "Map" })).toHaveDisplayValue("Crypt");

    await addAdhoc(user, "Bandit", "10");
    await user.click(map.getByRole("button", { name: /add tokens for all combatants/i }));
    await map.findByRole("button", { name: "Token Bandit" });
    expect((await listMaps(id)).find((m) => m.id === dungeon.id)!.tokens).toHaveLength(1);
    expect((await listMaps(id)).find((m) => m.name === "Goblin Cave")!.tokens).toHaveLength(0);
  });

  it("outside Combat the picker stays free, even while an Encounter runs", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id } = await openCombat(user);
    await createMap(id, "Elsewhere");
    await user.keyboard("{Alt>}2{/Alt}");
    const explore = within(await screen.findByRole("region", { name: "Map" }));
    const picker = await explore.findByRole("combobox", { name: "Map" });
    expect(picker).toBeEnabled();
    await user.selectOptions(picker, "Elsewhere");
    expect(explore.queryByRole("button", { name: /add tokens for all combatants/i })).not.toBeInTheDocument();
  });
});

describe("Tokens linked to Combatants", () => {
  it("bulk adds one token per unplaced Combatant, names follow, defeat marks and hides, removal removes", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { map } = await openCombat(user);
    await addMonster(user, "goblin", "Goblin Warrior");
    await addMonster(user, "goblin", "Goblin Warrior");
    await addAdhoc(user, "Bandit", "10");
    // a free token that is already placed is left alone
    await user.type(map.getByLabelText("Token name"), "Rock");
    await user.click(map.getByRole("button", { name: /^add token$/i }));
    await map.findByRole("button", { name: "Token Rock" });

    await user.click(map.getByRole("button", { name: /add tokens for all combatants/i }));
    await map.findByRole("button", { name: "Token Goblin Warrior 1" });
    await map.findByRole("button", { name: "Token Goblin Warrior 2" });
    await map.findByRole("button", { name: "Token Bandit" });
    await user.click(map.getByRole("button", { name: /add tokens for all combatants/i })); // again adds nothing
    await new Promise((r) => setTimeout(r, 50));
    expect(map.getAllByRole("button", { name: /^Token / })).toHaveLength(4);

    // the displayed name comes from the Combatant: auto-numbering renames the first goblin on a third copy
    await addMonster(user, "goblin", "Goblin Warrior");
    await user.click(map.getByRole("button", { name: /add tokens for all combatants/i }));
    await map.findByRole("button", { name: "Token Goblin Warrior 3" });
    expect(map.getByRole("button", { name: "Token Goblin Warrior 1" })).toBeInTheDocument();
    await waitFor(() => expect(map.getAllByRole("button", { name: /^Token / })).toHaveLength(5));

    // defeated: visible mark and accessible label; hidden when the Encounter removes defeated combatants
    await expand(user, "Bandit");
    await user.type(within(row("Bandit")).getByLabelText("Amount Bandit"), "10");
    await user.click(within(row("Bandit")).getByRole("button", { name: "Damage Bandit" }));
    expect(await map.findByRole("button", { name: "Token Bandit, defeated" })).toBeInTheDocument();
    await user.click(screen.getByLabelText(/remove defeated combatants/i));
    await waitFor(() => expect(map.queryByRole("button", { name: /Token Bandit/ })).not.toBeInTheDocument());
    await user.click(screen.getByLabelText(/remove defeated combatants/i));
    await map.findByRole("button", { name: "Token Bandit, defeated" });

    // removing a Combatant removes its token
    await expand(user, "Goblin Warrior 2");
    await user.click(screen.getByRole("button", { name: "Remove Goblin Warrior 2" }));
    await waitFor(() => expect(map.queryByRole("button", { name: "Token Goblin Warrior 2" })).not.toBeInTheDocument());
    expect(map.queryByLabelText("Name of Goblin Warrior 2")).not.toBeInTheDocument();
  });

  it("stores the removal in the Map record", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, map } = await openCombat(user);
    await addAdhoc(user, "Bandit", "10");
    await user.click(map.getByRole("button", { name: /add tokens for all combatants/i }));
    await map.findByRole("button", { name: "Token Bandit" });
    await waitFor(async () => expect((await rows(id, "maps"))[0].tokens[0]).toMatchObject({ name: "Bandit", combatantId: expect.any(String), color: expect.any(String) }));
    await user.click(screen.getByRole("button", { name: "Remove Bandit" }));
    await waitFor(async () => expect((await rows(id, "maps"))[0].tokens).toHaveLength(0));
  });

  it("selection is shared both ways between the Map and the tracker", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { map } = await openCombat(user);
    await addAdhoc(user, "Bandit", "10");
    await addAdhoc(user, "Cultist", "9");
    await user.click(map.getByRole("button", { name: /add tokens for all combatants/i }));
    const bandit = await map.findByRole("button", { name: "Token Bandit" });
    const cultist = await map.findByRole("button", { name: "Token Cultist" });
    expect(bandit).toHaveAttribute("aria-pressed", "false");

    await user.click(cultist);
    await waitFor(() => expect(within(row("Cultist")).getByText("Selected")).toBeInTheDocument());
    expect(within(row("Bandit")).queryByText("Selected")).not.toBeInTheDocument();
    expect(map.getByRole("button", { name: "Token Cultist" })).toHaveAttribute("aria-pressed", "true");

    await user.click(within(row("Bandit")).getByRole("button", { name: "Show Bandit Stat Block" }));
    await waitFor(() => expect(map.getByRole("button", { name: "Token Bandit" })).toHaveAttribute("aria-pressed", "true"));
    expect(map.getByRole("button", { name: "Token Cultist" })).toHaveAttribute("aria-pressed", "false");
  });

  it("links a free token to an unplaced Combatant from the token list, and unlinks it keeping the name", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, map } = await openCombat(user);
    await addAdhoc(user, "Bandit", "10");
    await addAdhoc(user, "Cultist", "9");
    await user.type(map.getByLabelText("Token name"), "Rock");
    await user.click(map.getByRole("button", { name: /^add token$/i }));
    await map.findByRole("button", { name: "Token Rock" });
    await user.type(map.getByLabelText("Token name"), "Stone");
    await user.click(map.getByRole("button", { name: /^add token$/i }));
    await map.findByRole("button", { name: "Token Stone" });

    const pick = map.getByLabelText("Link to combatant for Rock");
    expect(within(pick).getAllByRole("option").map((o) => o.textContent)).toEqual(["None", "Bandit", "Cultist"]);
    await user.selectOptions(pick, "Bandit");
    await map.findByRole("button", { name: "Token Bandit" });
    expect(map.queryByRole("button", { name: "Token Rock" })).not.toBeInTheDocument();
    await waitFor(async () => expect((await rows(id, "maps"))[0].tokens[0]).toMatchObject({ combatantId: expect.any(String) }));
    expect(within(map.getByLabelText("Link to combatant for Stone")).getAllByRole("option").map((o) => o.textContent)).toEqual(["None", "Cultist"]);
    expect((map.getByLabelText("Link to combatant for Bandit") as HTMLSelectElement).selectedOptions[0].textContent).toBe("Bandit");

    await user.selectOptions(map.getByLabelText("Link to combatant for Bandit"), "None");
    await waitFor(async () => expect((await rows(id, "maps"))[0].tokens[0].combatantId).toBeUndefined());
    expect(await map.findByRole("button", { name: "Token Bandit" })).not.toHaveAttribute("aria-pressed");
    expect((map.getByLabelText("Name of Bandit") as HTMLInputElement).tagName).toBe("INPUT");
    expect(within(map.getByLabelText("Link to combatant for Stone")).getAllByRole("option").map((o) => o.textContent)).toEqual(["None", "Bandit", "Cultist"]);
  });

  it("shows the speed ring only around the selected token, sized from its speed, in a Map in feet", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id } = await openCombat(user, false);
    await addPartyMember(id, { name: "Thia", class: "Rogue", level: 1, ac: 14, maxHp: 10, passivePerception: 12, notes: "", speed: "35 ft." });
    await addPartyMember(id, { name: "Bram", class: "Fighter", level: 1, ac: 16, maxHp: 12, passivePerception: 10, notes: "" });
    await user.click(await screen.findByRole("button", { name: /start encounter/i }));
    await screen.findByRole("option", { name: "Entire Party (2)" });
    await user.selectOptions(screen.getByLabelText("Add Party member"), "Entire Party (2)");
    const map = within(await screen.findByRole("region", { name: "Map" }));
    await user.click(map.getByRole("button", { name: /add tokens for all combatants/i }));

    expect(map.queryByTestId("speed-ring")).toBeNull(); // nothing selected
    await user.click(await map.findByRole("button", { name: "Token Thia" }));
    const ring = await map.findByTestId("speed-ring");
    expect(ring).toHaveAccessibleName("Speed 35 ft, 7 squares");
    expect(within(ring).getByText("35 ft")).toBeInTheDocument();

    await user.click(map.getByRole("button", { name: "Token Bram" })); // no speed on the sheet: no ring rather than a guess
    expect(map.queryByTestId("speed-ring")).toBeNull();
    await user.click(map.getByRole("button", { name: "Token Thia" }));
    await map.findByTestId("speed-ring");
    await user.selectOptions(map.getByLabelText("Scale unit"), "mi"); // feet make no sense on a Map in miles
    await waitFor(() => expect(map.queryByTestId("speed-ring")).toBeNull());
  });
});

describe("Ending an Encounter", () => {
  it("keeps its tokens on the Map: linked ones become free tokens with their last name; defeated ones hidden during the fight stay too", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, map } = await openCombat(user);
    await addMonster(user, "goblin", "Goblin Warrior");
    await addMonster(user, "goblin", "Goblin Warrior");
    await addAdhoc(user, "Bandit", "10");
    await user.type(map.getByLabelText("Token name"), "Rock");
    await user.click(map.getByRole("button", { name: /^add token$/i }));
    await user.click(map.getByRole("button", { name: /add tokens for all combatants/i }));
    const g2 = await map.findByRole("button", { name: "Token Goblin Warrior 2" });
    const [c0, r0] = pos(g2).map(Number);
    g2.focus();
    await user.keyboard("{ArrowLeft}{ArrowDown}");
    await waitFor(async () => expect((await rows(id, "maps"))[0].tokens.find((t: any) => t.name === "Goblin Warrior 2")).toMatchObject({ x: c0 - 1, y: r0 + 1 }));
    const before = (await rows(id, "maps"))[0].tokens.map((t: any) => [t.name, t.x, t.y]);

    // Bandit is defeated while the Encounter hides defeated combatants: its token is out of sight, but ending keeps it
    await expand(user, "Bandit");
    await user.type(within(row("Bandit")).getByLabelText("Amount Bandit"), "10");
    await user.click(within(row("Bandit")).getByRole("button", { name: "Damage Bandit" }));
    await user.click(screen.getByLabelText(/remove defeated combatants/i));
    await waitFor(() => expect(map.queryByRole("button", { name: /Token Bandit/ })).not.toBeInTheDocument());

    await endEncounter(user);
    await waitFor(async () => expect(await rows(id, "encounters")).toHaveLength(0));
    const [m] = await rows(id, "maps");
    expect(m.tokens.map((t: any) => [t.name, t.x, t.y])).toEqual(before);
    expect(m.tokens.every((t: any) => t.combatantId === undefined)).toBe(true);

    // the Map is still there with the tokens as free tokens: editable names, no combatant link
    await map.findByRole("button", { name: "Token Goblin Warrior 2" });
    expect((map.getByLabelText("Name of Goblin Warrior 2") as HTMLInputElement).tagName).toBe("INPUT");
    expect(map.queryByRole("button", { name: /add tokens for all combatants/i })).not.toBeInTheDocument();
    expect(map.getByRole("combobox", { name: "Map" })).toBeEnabled();
  });
});

describe("Saved encounters keep their Map and token positions", () => {
  async function saveAmbush(user: User) {
    const { id, map } = await openCombat(user);
    await addPartyMember(id, { name: "Aria", class: "Rogue", level: 3, ac: 15, maxHp: 20, passivePerception: 12 } as any);
    await waitFor(() => expect(screen.getByRole("option", { name: "Aria" })).toBeInTheDocument());
    await user.selectOptions(screen.getByRole("combobox", { name: "Add Party member" }), "Aria");
    await addMonster(user, "goblin", "Goblin Warrior");
    await addMonster(user, "goblin", "Goblin Warrior");
    await addAdhoc(user, "Bandit", "11");
    await user.click(map.getByRole("button", { name: /add tokens for all combatants/i }));
    const goblin2 = await map.findByRole("button", { name: "Token Goblin Warrior 2" });
    await map.findByRole("button", { name: "Token Bandit" });
    goblin2.focus();
    await user.keyboard("{ArrowLeft}{ArrowLeft}{ArrowDown}");
    await waitFor(() => expect(pos(map.getByRole("button", { name: "Token Goblin Warrior 2" }))).toEqual(["5", "3"]));
    await user.type(screen.getByLabelText("Saved encounter name"), "Ambush");
    await user.click(screen.getByRole("button", { name: /save encounter/i }));
    await waitFor(async () => expect(await rows(id, "savedEncounters")).toHaveLength(1));
    await endEncounter(user);
    await user.click(await screen.findByRole("button", { name: /end without xp/i }, { timeout: 4000 }));
    return { id, map };
  }
  const load = async (user: User) => user.click(within(await screen.findByRole("listitem", { name: "Ambush" })).getByRole("button", { name: /^load/i }));

  it("stores the mapId and linked tokens (no map copy), and loading restores them on that Map, linked to the new Combatants", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, map } = await saveAmbush(user);
    const [saved] = await rows(id, "savedEncounters");
    const [m] = await rows(id, "maps");
    expect(saved.map).toBeUndefined();
    expect(saved.mapId).toBe(m.id);
    expect(saved.tokens).toHaveLength(4);
    expect(saved.tokens.find((t: any) => t.name === "Goblin Warrior 2")).toMatchObject({ x: 5, y: 3, link: "m:1", color: expect.any(String) });
    expect(saved.tokens.find((t: any) => t.name === "Aria").link).toMatch(/^p:/);

    // ending left free tokens behind; loading replaces them rather than stacking a second set
    expect((await rows(id, "maps"))[0].tokens).toHaveLength(4);
    await load(user);
    const g2 = await map.findByRole("button", { name: "Token Goblin Warrior 2" });
    expect(pos(g2)).toEqual(["5", "3"]);
    await map.findByRole("button", { name: "Token Aria" });
    expect(await listMaps(id)).toHaveLength(1);
    const enc = (await rows(id, "encounters"))[0];
    expect(enc.mapId).toBe(m.id);
    const ids = new Set(enc.combatants.map((c: any) => c.id));
    const toks = (await rows(id, "maps"))[0].tokens;
    expect(toks).toHaveLength(4);
    expect(toks.every((t: any) => ids.has(t.combatantId))).toBe(true);
    // and they follow the Combatant again: removing it removes the token
    await expand(user, "Bandit");
    await user.click(screen.getByRole("button", { name: "Remove Bandit" }));
    await waitFor(() => expect(map.queryByRole("button", { name: "Token Bandit" })).not.toBeInTheDocument());
  });

  it("falls back to a blank Map named after the saved encounter when its Map was deleted", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, map } = await saveAmbush(user);
    const [old] = await listMaps(id);
    await (await getDb()).delete("maps", old.id);
    await load(user);
    await waitFor(async () => expect(await listMaps(id)).toHaveLength(1));
    const [fresh] = await listMaps(id);
    expect(fresh.id).not.toBe(old.id);
    expect(fresh).toMatchObject({ name: "Ambush", width: 20, height: 20, perSquare: 5, unit: "ft", showGrid: true });
    expect((await rows(id, "encounters"))[0].mapId).toBe(fresh.id);
    // the Combatants still get tokens on it, lined up on their sides
    await map.findByRole("button", { name: "Token Aria" });
    await waitFor(async () => expect((await listMaps(id))[0].tokens).toHaveLength(4));
    expect(await map.findByRole("combobox", { name: "Map" })).toHaveDisplayValue("Ambush");
  });

  it("loads a saved encounter from before Maps (no mapId) onto a blank Map", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id } = await openCombat(user, false);
    await (await getDb()).put("savedEncounters", { id: "s1", campaignId: id, name: "Ambush", createdAt: 1, members: [{ kind: "adhoc", name: "Bandit", hp: 9, dexMod: 0 }] });
    await load(user);
    const map = within(await screen.findByRole("region", { name: "Map" }));
    await map.findByRole("button", { name: "Token Bandit" });
    expect((await listMaps(id)).map((m) => m.name)).toEqual(["Ambush"]);
  });
});

describe("Portability and upgrade", () => {
  it("imports an old export with battleMaps and a saved-encounter map copy without failing, ignoring both", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id } = await openCombat(user);
    await (await getDb()).put("savedEncounters", { id: "s1", campaignId: id, name: "Old", createdAt: 1, members: [] });
    const old = JSON.parse(JSON.stringify((await exportCampaign(id))!));
    old.collections.battleMaps = [{ id: "e1", campaignId: id, encounterId: "e1", width: 5, height: 5, feetPerSquare: 5, tokens: [] }];
    old.collections.savedEncounters[0].map = { width: 8, height: 8, feetPerSquare: 5, tokens: [] };
    const parsed = parseCampaignFile(JSON.stringify(old));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) await importCampaign(parsed.data);
    expect((await getDb()).objectStoreNames.contains("battleMaps" as never)).toBe(false);
    const [s] = await rows(id, "savedEncounters");
    expect(s).toMatchObject({ id: "s1", name: "Old" });
    expect(s).not.toHaveProperty("map");
    expect(await listMaps(id)).toHaveLength(1);
    expect((await exportCampaign(id))!.collections).not.toHaveProperty("battleMaps");
  });

  it("upgrading from version 7 removes battleMaps and the saved-encounter map copy, and gives a running Encounter a Map", async () => {
    closeDb();
    const old = await openDB("dungeon-desktop", 7, {
      upgrade(db) {
        db.createObjectStore("campaigns", { keyPath: "id" });
        for (const n of ["party", "npcs", "locations", "sessions", "notes", "customEntries", "encounters", "savedEncounters", "battleMaps", "maps"]) {
          db.createObjectStore(n, { keyPath: "id" }).createIndex("byCampaign", "campaignId");
        }
      },
    });
    await old.put("campaigns", { id: "c", name: "Old", createdAt: 1, updatedAt: 1 });
    await old.put("battleMaps", { id: "e1", campaignId: "c", encounterId: "e1", width: 20, height: 20, feetPerSquare: 5, tokens: [{ id: "t", name: "Orc", color: "#c00", x: 1, y: 1 }] });
    await old.put("encounters", { id: "e1", campaignId: "c", combatants: [], round: 1, startedAt: 1 });
    await old.put("savedEncounters", { id: "s1", campaignId: "c", name: "Ambush", createdAt: 1, members: [{ kind: "adhoc", name: "Bandit", hp: 9, dexMod: 0 }], map: { width: 9, height: 9, feetPerSquare: 5, tokens: [] } });
    await old.put("savedEncounters", { id: "s2", campaignId: "c", name: "Plain", createdAt: 2, members: [] });
    old.close();

    const db = await getDb();
    expect([...db.objectStoreNames]).not.toContain("battleMaps");
    expect([...db.objectStoreNames]).toContain("maps");
    expect(await db.get("savedEncounters", "s1")).toEqual({ id: "s1", campaignId: "c", name: "Ambush", createdAt: 1, members: [{ kind: "adhoc", name: "Bandit", hp: 9, dexMod: 0 }] });
    expect(await db.get("savedEncounters", "s2")).toMatchObject({ name: "Plain" });
    const maps = await listMaps("c");
    expect(maps).toHaveLength(1);
    expect(maps[0]).toMatchObject({ name: "Encounter 1", width: 20, height: 20, perSquare: 5, tokens: [] });
    expect((await db.get("encounters", "e1"))!.mapId).toBe(maps[0].id);
  });

  it("changing a Map's tokens from storage keeps whole squares", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id } = await openCombat(user, false);
    const m = await createMap(id);
    await updateMap(m.id, (r) => ({ ...r, tokens: [{ id: "t", name: "A", color: "#000", x: 2.6, y: -0.4 }] }));
    expect((await listMaps(id))[0].tokens[0]).toMatchObject({ x: 3, y: -0 });
  });
});
