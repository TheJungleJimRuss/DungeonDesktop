import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { setMonsterSource } from "./srd/monsters";
import { FIXTURE_MONSTERS } from "./srd/fixtures";
import { exportCampaign, listCampaigns } from "./storage";
import { addPartyMember } from "./storage/party";

type User = ReturnType<typeof userEvent.setup>;

async function openCombat(user: User) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), "Alpha");
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText("Alpha");
  await user.click(within(screen.getByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
  await user.keyboard("{Alt>}1{/Alt}");
  await screen.findByRole("heading", { name: /^combat$/i });
  await user.click(await screen.findByRole("button", { name: /start encounter/i }));
  return { id: (await listCampaigns())[0].id, map: within(await screen.findByRole("region", { name: "Battle Map" })) };
}
async function addMonster(user: User, query: string, name: string) {
  const box = screen.getByRole("searchbox", { name: /search monsters/i });
  await user.clear(box);
  await user.type(box, query);
  await user.click(await screen.findByRole("button", { name: `Add ${name}` }));
}
async function addAdhoc(user: User, name: string, hp: string) {
  await user.type(screen.getByLabelText("Ad-hoc name"), name);
  await user.type(screen.getByLabelText("Ad-hoc HP"), hp);
  await user.click(screen.getByRole("button", { name: /add ad-hoc/i }));
}
/** Non-active tracker rows start collapsed; open one to reach its controls. */
const expand = async (user: User, name: string) => { const b = screen.queryByRole("button", { name: `Expand ${name}` }); if (b) await user.click(b); };
const row = (name: string) => screen.getByRole("listitem", { name });
const pos = (el: HTMLElement) => [el.getAttribute("data-col"), el.getAttribute("data-row")];
const maps = async (id: string) => (await exportCampaign(id))!.collections.battleMaps as unknown as Record<string, any>[];

beforeEach(() => { localStorage.clear(); setMonsterSource(async () => FIXTURE_MONSTERS); });
afterEach(() => setMonsterSource(null));

describe("Battle Map tokens linked to Combatants", () => {
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
    // pressing it again adds nothing
    await user.click(map.getByRole("button", { name: /add tokens for all combatants/i }));
    await new Promise((r) => setTimeout(r, 50));
    expect(map.getAllByRole("button", { name: /^Token / })).toHaveLength(4);

    // the displayed name comes from the Combatant: auto-numbering renames the first goblin on a third copy
    await addMonster(user, "goblin", "Goblin Warrior");
    await user.click(map.getByRole("button", { name: /add tokens for all combatants/i }));
    await map.findByRole("button", { name: "Token Goblin Warrior 3" });
    expect(map.getByRole("button", { name: "Token Goblin Warrior 1" })).toBeInTheDocument();
    await waitFor(() => expect(map.getAllByRole("button", { name: /^Token / })).toHaveLength(5));

    // defeated: visible mark and accessible label
    await expand(user, "Bandit");
    await user.type(within(row("Bandit")).getByLabelText("Amount Bandit"), "10");
    await user.click(within(row("Bandit")).getByRole("button", { name: "Damage Bandit" }));
    expect(await map.findByRole("button", { name: "Token Bandit, defeated" })).toBeInTheDocument();
    // hidden when the Encounter removes defeated combatants
    await user.click(screen.getByLabelText(/remove defeated combatants/i));
    await waitFor(() => expect(map.queryByRole("button", { name: /Token Bandit/ })).not.toBeInTheDocument());
    await user.click(screen.getByLabelText(/remove defeated combatants/i));
    await map.findByRole("button", { name: "Token Bandit, defeated" });

    // removing a Combatant removes its token (and the record, not just the view)
    await expand(user, "Goblin Warrior 2");
    await user.click(screen.getByRole("button", { name: "Remove Goblin Warrior 2" }));
    await waitFor(() => expect(map.queryByRole("button", { name: "Token Goblin Warrior 2" })).not.toBeInTheDocument());
    expect(map.queryByLabelText("Name of Goblin Warrior 2")).not.toBeInTheDocument();
  });

  it("stores the removal in the map record", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, map } = await openCombat(user);
    await addAdhoc(user, "Bandit", "10");
    await user.click(map.getByRole("button", { name: /add tokens for all combatants/i }));
    await map.findByRole("button", { name: "Token Bandit" });
    await waitFor(async () => expect((await maps(id))[0].tokens[0]).toMatchObject({ name: "Bandit", combatantId: expect.any(String), color: expect.any(String) }));
    await user.click(screen.getByRole("button", { name: "Remove Bandit" }));
    await waitFor(async () => expect((await maps(id))[0].tokens).toHaveLength(0));
  });

  it("selection is shared both ways between the map and the tracker", async () => {
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
    expect(within(row("Bandit")).getByText("Selected")).toBeInTheDocument();
  });

  it("keeps the link through save and load, mapping old Combatants to the recreated ones", async () => {
    const user = userEvent.setup();
    render(<App />);
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
    await waitFor(async () => expect((await exportCampaign(id))!.collections.savedEncounters).toHaveLength(1));
    await user.click(screen.getByRole("button", { name: /end encounter/i }));
    await user.click(await screen.findByRole("button", { name: /yes, end it/i }));
    await user.click(await screen.findByRole("button", { name: /end without xp/i }, { timeout: 4000 }));
    await user.click(within(await screen.findByRole("listitem", { name: "Ambush" })).getByRole("button", { name: /^load/i }));

    // linked tokens exist again, with the new Combatants' ids
    const g2 = await map.findByRole("button", { name: "Token Goblin Warrior 2" });
    expect(pos(g2)).toEqual(["5", "3"]);
    await map.findByRole("button", { name: "Token Aria" });
    const enc = (await exportCampaign(id))!.collections.encounters as unknown as Record<string, any>[];
    const ids = new Set(enc[0].combatants.map((c: any) => c.id));
    const toks = (await maps(id))[0].tokens;
    expect(toks).toHaveLength(4);
    expect(toks.every((t: any) => ids.has(t.combatantId))).toBe(true);
    // and they still follow the Combatant: removing it removes the token
    await expand(user, "Bandit");
    await user.click(screen.getByRole("button", { name: "Remove Bandit" }));
    await waitFor(() => expect(map.queryByRole("button", { name: "Token Bandit" })).not.toBeInTheDocument());
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
    // the name now follows the Combatant, and Bandit is no longer offered on other tokens
    await map.findByRole("button", { name: "Token Bandit" });
    expect(map.queryByRole("button", { name: "Token Rock" })).not.toBeInTheDocument();
    await waitFor(async () => expect((await maps(id))[0].tokens[0]).toMatchObject({ combatantId: expect.any(String) }));
    const other = map.getByLabelText("Link to combatant for Stone");
    expect(within(other).getAllByRole("option").map((o) => o.textContent)).toEqual(["None", "Cultist"]);
    // the linked token's own select keeps its Combatant selected and offers None
    expect((map.getByLabelText("Link to combatant for Bandit") as HTMLSelectElement).selectedOptions[0].textContent).toBe("Bandit");

    // unlink: the token stays, as a free token named after the Combatant it had
    await user.selectOptions(map.getByLabelText("Link to combatant for Bandit"), "None");
    await waitFor(async () => expect((await maps(id))[0].tokens[0].combatantId).toBeUndefined());
    expect(await map.findByRole("button", { name: "Token Bandit" })).not.toHaveAttribute("aria-pressed");
    const name = map.getByLabelText("Name of Bandit") as HTMLInputElement;
    expect(name.tagName).toBe("INPUT");
    expect(within(map.getByLabelText("Link to combatant for Stone")).getAllByRole("option").map((o) => o.textContent)).toEqual(["None", "Bandit", "Cultist"]);
  });
});
