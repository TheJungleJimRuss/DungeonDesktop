import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { setMonsterSource } from "./srd/monsters";
import { FIXTURE_MONSTERS, FIXTURE_REFERENCE } from "./srd/fixtures";
import { setReferenceSource } from "./srd/reference";

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

  it("shows the Stat Block panel in Combat mode and keeps the selection", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await user.keyboard("{Control>}k{/Control}owlbear{Enter}");
    await screen.findByRole("article", { name: "Owlbear Stat Block" });
    await user.keyboard("{Alt>}1{/Alt}");
    const panel = await screen.findByRole("region", { name: "Stat Blocks" });
    expect(await within(panel).findByRole("article", { name: "Owlbear Stat Block" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Stat Block drawer")).toBeNull();
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
