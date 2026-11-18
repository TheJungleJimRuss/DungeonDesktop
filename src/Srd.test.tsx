import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { setMonsterSource } from "./srd/monsters";
import { FIXTURE_MONSTERS, FIXTURE_REFERENCE } from "./srd/fixtures";
import { setReferenceSource } from "./srd/reference";
import { createCustomEntry, emptyMonsterData } from "./storage/customEntries";
import { listCampaigns } from "./storage";

async function openCampaign(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), name);
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText(name);
  await user.click(within(screen.getByRole("listitem", { name })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
}

beforeEach(() => { setMonsterSource(async () => FIXTURE_MONSTERS); setReferenceSource(async () => FIXTURE_REFERENCE); });
afterEach(() => { setMonsterSource(null); setReferenceSource(null); });

describe("global search and Stat Block", () => {
  it("Ctrl+K opens search; typing finds a monster; opening it shows the full Stat Block", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await user.keyboard("{Control>}k{/Control}");
    const dialog = await screen.findByRole("dialog", { name: /global search/i });
    expect(within(dialog).getByRole("searchbox", { name: "Search" })).toHaveFocus();
    await user.keyboard("wyrm");
    const group = await within(dialog).findByRole("list", { name: "Monsters" });
    await user.click(within(group).getByRole("button", { name: /Ancient Test Wyrm/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
    const sb = await screen.findByRole("article", { name: "Ancient Test Wyrm Stat Block" });
    expect(within(sb).getByText(/AC/)).toBeInTheDocument();
    expect(within(sb).getByText(/546 \(28d20 \+ 252\)/)).toBeInTheDocument();
    expect(within(sb).getByRole("table", { name: "Ability scores" })).toBeInTheDocument();
    for (const section of ["Actions", "Bonus Actions", "Reactions", "Legendary Actions", "Lair Actions"]) {
      expect(within(sb).getByRole("region", { name: section })).toBeInTheDocument();
    }
    expect(within(sb).getByText(/50,000 in lair/)).toBeInTheDocument();
  });

  it("finds by typo, opens the top result with Enter, and Esc closes search", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await user.keyboard("{Meta>}k{/Meta}");
    await screen.findByRole("dialog", { name: /global search/i });
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.keyboard("{Control>}k{/Control}");
    await user.keyboard("gobln{Enter}");
    expect(await screen.findByRole("article", { name: "Goblin Warrior Stat Block" })).toBeInTheDocument();
  });

  it("toggles the Stat Blocks overlay from the navbar and keeps the selection across Modes", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await user.keyboard("{Control>}k{/Control}owlbear{Enter}");
    await screen.findByRole("article", { name: "Owlbear Stat Block" });
    await user.keyboard("{Alt>}1{/Alt}");
    expect(await screen.findByRole("article", { name: "Owlbear Stat Block" })).toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "Stat Blocks" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    await user.click(toggle);
    expect(screen.queryByLabelText("Stat Block drawer")).toBeNull();
    await user.click(toggle);
    expect(await screen.findByRole("article", { name: "Owlbear Stat Block" })).toBeInTheDocument();
    await user.keyboard("{Alt>}s{/Alt}");
    await waitFor(() => expect(screen.queryByLabelText("Stat Block drawer")).toBeNull());
    await user.keyboard("{Alt>}s{/Alt}");
    expect(await screen.findByLabelText("Stat Block drawer")).toBeInTheDocument();
  });

  it("shows the SRD attribution in the app", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    expect(screen.getByText(/System Reference Document 5\.2\.1.*Creative Commons Attribution 4\.0/)).toBeVisible();
  });
});

describe("search across all SRD types", () => {
  it("groups results by type, opens a spell as a readable card, and keeps it as the selection", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await user.keyboard("{Control>}k{/Control}");
    const dialog = await screen.findByRole("dialog", { name: /global search/i });
    await user.keyboard("test");
    expect(await within(dialog).findByRole("list", { name: "Spells" })).toBeInTheDocument();
    expect(within(dialog).getByRole("list", { name: "Monsters" })).toBeInTheDocument();
    expect(within(dialog).getByRole("list", { name: "Equipment" })).toBeInTheDocument();
    await user.click(within(within(dialog).getByRole("list", { name: "Spells" })).getByRole("button", { name: /Fireball Test/ }));
    const card = await screen.findByRole("article", { name: "Fireball Test spell" });
    for (const t of [/Level 3 Evocation/, /Casting Time/, /150 feet/, /V, S, M \(a ball of bat guano\)/, /Instantaneous/, /A bright streak flashes\./, /1d6/]) expect(within(card).getByText(t)).toBeInTheDocument();
  });

  it("filters by type and by monster challenge rating and creature type", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await user.keyboard("{Control>}k{/Control}");
    const dialog = await screen.findByRole("dialog", { name: /global search/i });
    await user.keyboard("test");
    await within(dialog).findByRole("list", { name: "Spells" });
    await user.click(within(dialog).getByRole("button", { name: "Equipment" }));
    expect(within(dialog).queryByRole("list", { name: "Spells" })).toBeNull();
    expect(within(dialog).getByRole("list", { name: "Equipment" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Equipment" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(dialog).getByRole("button", { name: "Monsters" }));
    await user.clear(within(dialog).getByRole("searchbox", { name: "Search" }));
    await user.selectOptions(within(dialog).getByLabelText("Creature type"), "undead");
    const list = await within(dialog).findByRole("list", { name: "Monsters" });
    expect(within(list).getAllByRole("button").map((b) => b.textContent)).toEqual([expect.stringContaining("Skeleton"), expect.stringContaining("Will-o’-Wisp")]);
    await user.selectOptions(within(dialog).getByLabelText("Challenge rating"), "2");
    expect(within(within(dialog).getByRole("list", { name: "Monsters" })).getAllByRole("button")).toHaveLength(1);
    await user.click(within(dialog).getByRole("button", { name: "All" }));
    expect(within(dialog).queryByLabelText("Challenge rating")).toBeNull();
  });

  it("finds a condition with a typo and shows its rules text in Combat mode's panel", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await user.keyboard("{Control>}k{/Control}blindd{Enter}");
    const card = await screen.findByRole("article", { name: "Blinded condition" });
    expect(within(card).getByText("Can't See.")).toBeInTheDocument();
    await user.keyboard("{Alt>}1{/Alt}");
    const panel = await screen.findByRole("region", { name: "Stat Blocks" });
    expect(await within(panel).findByRole("article", { name: "Blinded condition" })).toBeInTheDocument();
  });

  it("opens magic items and equipment in their own layouts", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await user.keyboard("{Control>}k{/Control}longsord{Enter}");
    const w = await screen.findByRole("article", { name: "Longsword Test equipment" });
    expect(within(w).getByText(/1d8 Slashing \(1d10 two-handed\)/)).toBeInTheDocument();
    expect(within(w).getByText(/15 gp/)).toBeInTheDocument();
    await user.keyboard("{Control>}k{/Control}holdng{Enter}");
    const m = await screen.findByRole("article", { name: "Bag of Holding Test magic item" });
    expect(within(m).getByText(/Uncommon/)).toBeInTheDocument();
  });
});

describe("search keyboard and group caps", () => {
  const spell = (n: number) => ({ ...FIXTURE_REFERENCE.spells[1], id: `zap-${n}`, name: `Zap ${String(n).padStart(2, "0")}` });

  it("caps each group at 8 under All and 20 once a type chip is chosen", async () => {
    setReferenceSource(async () => ({ ...FIXTURE_REFERENCE, spells: Array.from({ length: 25 }, (_, i) => spell(i)) }));
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await user.keyboard("{Control>}k{/Control}zap");
    const dialog = await screen.findByRole("dialog", { name: /global search/i });
    expect(within(await within(dialog).findByRole("list", { name: "Spells" })).getAllByRole("button")).toHaveLength(8);
    await user.click(within(dialog).getByRole("button", { name: "Spells" }));
    expect(within(within(dialog).getByRole("list", { name: "Spells" })).getAllByRole("button")).toHaveLength(20);
  });

  it("arrows run through SRD groups into Custom, hover shares the highlight, Enter opens a Custom row", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await createCustomEntry((await listCampaigns())[0].id, "monster", "Test Brute", emptyMonsterData());
    await user.keyboard("{Control>}k{/Control}test");
    const dialog = await screen.findByRole("dialog", { name: /global search/i });
    const custom = await within(dialog).findByRole("button", { name: /Test Brute/ });
    const rows = () => within(dialog).getAllByRole("listitem").map((li) => within(li).getByRole("button"));
    const n = rows().length;
    expect(rows()[n - 1]).toBe(custom);
    await user.keyboard("{ArrowDown}".repeat(n - 1));
    expect(custom).toHaveAttribute("aria-current", "true");
    await user.keyboard("{ArrowDown}");
    expect(custom).toHaveAttribute("aria-current", "true");
    await user.hover(rows()[1]);
    expect(rows()[1]).toHaveAttribute("aria-current", "true");
    expect(custom).not.toHaveAttribute("aria-current");
    await user.hover(custom);
    await user.keyboard("{ArrowUp}");
    expect(rows()[n - 2]).toHaveAttribute("aria-current", "true");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await screen.findByRole("article", { name: "Test Brute Stat Block" })).toBeInTheDocument();
  });

  it("highlights an exact name match in a later group over a fuzzy match listed first, so Enter opens it", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await createCustomEntry((await listCampaigns())[0].id, "monster", "Goblin", emptyMonsterData());
    await user.keyboard("{Control>}k{/Control}goblin");
    const dialog = await screen.findByRole("dialog", { name: /global search/i });
    const customList = await within(dialog).findByRole("list", { name: "Custom" });
    const custom = within(customList).getByRole("button", { name: /Goblin/ });
    const rows = within(dialog).getAllByRole("listitem").map((li) => within(li).getByRole("button"));
    expect(rows[0]).toHaveTextContent("Goblin Warrior");
    expect(custom).toHaveAttribute("aria-current", "true");
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("article", { name: "Goblin Stat Block" })).toBeInTheDocument();
  });
});

describe("feats, backgrounds and rules", () => {
  it("narrows by chip, opens a feat, and follows a background's feat link", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await user.keyboard("{Control>}k{/Control}test");
    const dialog = await screen.findByRole("dialog", { name: /global search/i });
    for (const g of ["Feats", "Backgrounds", "Rules"]) expect(await within(dialog).findByRole("list", { name: g })).toBeInTheDocument();
    expect(within(within(dialog).getByRole("list", { name: "Feats" })).getAllByRole("button")[0]).toHaveTextContent("Origin feat");
    expect(within(within(dialog).getByRole("list", { name: "Rules" })).getByRole("button", { name: /Sap Test/ })).toHaveTextContent("Weapon mastery");
    await user.click(within(dialog).getByRole("button", { name: "Rules" }));
    expect(within(dialog).queryByRole("list", { name: "Feats" })).toBeNull();
    expect(within(dialog).getByRole("list", { name: "Rules" })).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Feats" }));
    await user.click(within(within(dialog).getByRole("list", { name: "Feats" })).getByRole("button", { name: /Grappler Test/ }));
    const feat = await screen.findByRole("article", { name: "Grappler Test feat" });
    expect(within(feat).getByText(/Level 4\+, Strength or Dexterity 13\+/)).toBeInTheDocument();

    await user.keyboard("{Control>}k{/Control}acolyt{Enter}");
    const bg = await screen.findByRole("article", { name: "Acolyte Test background" });
    expect(within(bg).getByText(/Intelligence, Wisdom, Charisma/)).toBeInTheDocument();
    expect(within(bg).getByText(/Insight, Religion/)).toBeInTheDocument();
    expect(within(bg).getByText(/Choose A or B/)).toBeInTheDocument();
    await user.click(within(bg).getByRole("button", { name: "Alert Test (Cleric)" }));
    const alert = await screen.findByRole("article", { name: "Alert Test feat" });
    expect(within(alert).getByText("Initiative Proficiency.")).toBeInTheDocument();
  });

  it("shows a skill's ability and a language's rarity and note, in the Stat Blocks panel", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await user.keyboard("{Control>}k{/Control}acrobat{Enter}");
    const skill = await screen.findByRole("article", { name: "Acrobatics Test skill" });
    expect(within(skill).getByText("Dexterity")).toBeInTheDocument();
    await user.keyboard("{Control>}k{/Control}primord{Enter}");
    const lang = await screen.findByRole("article", { name: "Primordial Test language" });
    expect(within(lang).getByText("Rare")).toBeInTheDocument();
    expect(within(lang).getByText(/Aquan dialect/)).toBeInTheDocument();
    await user.keyboard("{Alt>}1{/Alt}");
    expect(await within(await screen.findByRole("region", { name: "Stat Blocks" })).findByRole("article", { name: "Primordial Test language" })).toBeInTheDocument();
  });
});

describe("species, subspecies and traits", () => {
  it("follows a trait to its species and on to a subspecies, with traits collapsed by default", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await user.keyboard("{Control>}k{/Control}flame breath");
    const dialog = await screen.findByRole("dialog", { name: /global search/i });
    expect(await within(dialog).findByRole("button", { name: /Flame Breath Test/ })).toHaveTextContent("Species trait");
    await user.click(within(dialog).getByRole("button", { name: "Species" }));
    await user.clear(within(dialog).getByRole("searchbox"));
    await user.type(within(dialog).getByRole("searchbox"), "darksight");
    const hit = await within(dialog).findByRole("button", { name: /Darksight Test/ });
    expect(hit).toHaveTextContent("Drakeling Test trait");
    await user.click(hit);
    const trait = await screen.findByRole("article", { name: "Darksight Test trait" });
    expect(within(trait).getByText("You can see in the dark.")).toBeInTheDocument();
    await user.click(within(trait).getByRole("button", { name: "Drakeling Test" }));
    const species = await screen.findByRole("article", { name: "Drakeling Test species" });
    expect(within(species).getByText("Species · Medium")).toBeInTheDocument();
    expect(within(species).getByText("30 ft.")).toBeInTheDocument();
    const details = species.querySelectorAll("details");
    expect(details).toHaveLength(2);
    for (const d of details) expect(d).not.toHaveAttribute("open");
    await user.click(within(species).getByText("Scales Test"));
    expect(within(species).getByText("armored")).toBeVisible();
    await user.click(within(species).getByRole("button", { name: "Ancestor Test: Red" }));
    const sub = await screen.findByRole("article", { name: "Ancestor Test: Red subspecies" });
    expect(within(sub).getByText("Drakeling Test subspecies")).toBeInTheDocument();
    expect(within(sub).getByText("Fire")).toBeInTheDocument();
    await user.click(within(sub).getByRole("button", { name: "Drakeling Test" }));
    expect(await screen.findByRole("article", { name: "Drakeling Test species" })).toBeInTheDocument();
  });

  it("shows a Species opened from a Mode without a Stat Blocks panel in the side drawer", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await user.keyboard("{Alt>}5{/Alt}");
    await user.keyboard("{Control>}k{/Control}spritekin{Enter}");
    const drawer = await screen.findByLabelText("Stat Block drawer");
    expect(await within(drawer).findByRole("article", { name: "Spritekin Test species" })).toBeInTheDocument();
  });
});

describe("classes, subclasses and class features", () => {
  it("follows a Rage feature to its class, shows the Rages column, and a caster has slot columns but no Rages", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await user.keyboard("{Control>}k{/Control}rage");
    const dialog = await screen.findByRole("dialog", { name: /global search/i });
    await user.click(within(dialog).getByRole("button", { name: "Classes" }));
    const hit = await within(dialog).findByRole("button", { name: /Rage Test/ });
    expect(hit).toHaveTextContent("Savage Test feature · level 1");
    await user.click(hit);
    const feature = await screen.findByRole("article", { name: "Rage Test class feature" });
    expect(within(feature).getByText("Rage")).toBeInTheDocument();
    await user.click(within(feature).getByRole("button", { name: "Savage Test" }));
    const cls = await screen.findByRole("article", { name: "Savage Test class" });
    expect(within(cls).getByText("Class · d12")).toBeInTheDocument();
    const table = within(cls).getByRole("table", { name: /Savage Test features by level/ });
    expect(within(table).getByRole("columnheader", { name: "Rages" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Rage Damage" })).toBeInTheDocument();
    expect(within(table).queryByRole("columnheader", { name: "1st" })).toBeNull();
    for (const d of cls.querySelectorAll("details")) expect(d).not.toHaveAttribute("open");
    await user.click(within(cls).getByText("Rage Test", { selector: "summary" }));
    expect(within(cls).getByText("Rage")).toBeVisible();
    await user.click(within(cls).getByRole("button", { name: "Path Test" }));
    const sub = await screen.findByRole("article", { name: "Path Test subclass" });
    expect(within(sub).getByText("Savage Test subclass")).toBeInTheDocument();
    expect(within(sub).getByText("Frenzy Test", { selector: "summary" })).toBeInTheDocument();
    await user.click(within(sub).getByRole("button", { name: "Open Frenzy Test" }));
    const sf = await screen.findByRole("article", { name: "Frenzy Test class feature" });
    expect(within(sf).getByText("Path Test (Savage Test) · level 3")).toBeInTheDocument();

    await user.keyboard("{Control>}k{/Control}mage test{Enter}");
    const mage = await screen.findByRole("article", { name: "Mage Test class" });
    const mt = within(mage).getByRole("table");
    for (const h of ["Cantrips", "Prepared Spells", "1st", "2nd"]) expect(within(mt).getByRole("columnheader", { name: h })).toBeInTheDocument();
    expect(within(mt).queryByRole("columnheader", { name: "Rages" })).toBeNull();
  });
});
