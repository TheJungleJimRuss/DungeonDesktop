import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { resetRolls, setRng } from "./dice/roller";
import { seqRng } from "./dice/dice";
import { setMonsterSource } from "./srd/monsters";
import { FIXTURE_MONSTERS } from "./srd/fixtures";
import { listCampaigns } from "./storage";
import { addPartyMember } from "./storage/party";
import { createNpc, emptyNpcDraft } from "./storage/npcs";
import { createCustomEntry, emptyMonsterData } from "./storage/customEntries";

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
  await screen.findByRole("button", { name: /end encounter/i });
}
const panel = () => screen.getByRole("region", { name: "Combatant Stat Block" });
const order = () => within(screen.getByRole("list", { name: /initiative order/i })).getAllByRole("listitem").map((li) => li.getAttribute("aria-label"));

beforeEach(() => { localStorage.clear(); setMonsterSource(async () => FIXTURE_MONSTERS); });
afterEach(() => { setMonsterSource(null); resetRolls(); });

describe("Stat Block beside the tracker", () => {
  it("follows the active combatant, shows any selected one, falls back to Party sheet numbers", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCombat(user);
    const id = (await listCampaigns())[0].id;
    await addPartyMember(id, { name: "Thia", class: "Fighter", level: 3, ac: 16, maxHp: 28, passivePerception: 12, notes: "", abilities: { str: 16, dex: 14, con: 15, int: 8, wis: 12, cha: 10 } });
    await createCustomEntry(id, "monster", "Brine Hag", { ...emptyMonsterData(), hp: 40 });
    await screen.findByRole("option", { name: "Thia" });
    await user.selectOptions(screen.getByRole("combobox", { name: "Add Party member" }), "Thia");
    await user.type(screen.getByRole("searchbox", { name: /search monsters/i }), "goblin");
    await user.click(await screen.findByRole("button", { name: "Add Goblin Warrior" }));
    await user.type(screen.getByLabelText("Initiative Thia"), "20{Enter}");
    await user.type(screen.getByLabelText("Initiative Goblin Warrior"), "10{Enter}");
    await waitFor(() => expect(order()).toEqual(["Thia", "Goblin Warrior"]));

    // Active combatant is Thia: Party sheet numbers, no Stat Block.
    const sheet = await within(panel()).findByRole("article", { name: "Thia Party sheet" });
    expect(sheet).toHaveTextContent(/AC 16/);
    expect(sheet).toHaveTextContent(/HP 28/);
    expect(sheet).toHaveTextContent(/Passive Perception 12/);
    expect(within(sheet).getByLabelText("STR")).toHaveTextContent("16 (+3)");
    expect(within(sheet).getByLabelText("INT")).toHaveTextContent("8 (-1)");

    // Selecting another combatant shows its Stat Block.
    await user.click(screen.getByRole("button", { name: "Show Goblin Warrior Stat Block" }));
    expect(await within(panel()).findByRole("article", { name: "Goblin Warrior Stat Block" })).toBeInTheDocument();

    // Advancing the turn returns to following the active combatant.
    await user.click(screen.getByRole("button", { name: /next turn/i }));
    await user.click(screen.getByRole("button", { name: /next turn/i }));
    await within(panel()).findByRole("article", { name: "Thia Party sheet" });
    await user.click(screen.getByRole("button", { name: /next turn/i }));
    expect(await within(panel()).findByRole("article", { name: "Goblin Warrior Stat Block" })).toBeInTheDocument();
  });

  it("rolls attack bonus and damage from the Stat Block into the dice roller history", async () => {
    setRng(seqRng([0.5, 0.0]));
    const user = userEvent.setup();
    render(<App />);
    await openCombat(user);
    await user.type(screen.getByRole("searchbox", { name: /search monsters/i }), "goblin");
    await user.click(await screen.findByRole("button", { name: "Add Goblin Warrior" }));
    await within(panel()).findByRole("article", { name: "Goblin Warrior Stat Block" });
    const history = screen.getByRole("list", { name: /roll history/i });
    await user.click(within(panel()).getByRole("button", { name: "Roll attack +4" }));
    expect(within(history).getByText("1d20+4")).toBeInTheDocument();
    expect(within(history).getByText("15")).toBeInTheDocument(); // 0.5 -> 11, +4
    await user.click(within(panel()).getByRole("button", { name: "Roll damage 1d6 + 2" }));
    expect(within(history).getAllByRole("listitem")).toHaveLength(2);
    expect(within(history).getByText("3")).toBeInTheDocument(); // 0.0 -> 1, +2
  });

  it("adds a linked NPC to the Encounter using its Stat Block under the NPC's name", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCombat(user);
    const id = (await listCampaigns())[0].id;
    await createNpc(id, { ...emptyNpcDraft(), name: "Elda", statBlockId: "test-goblin" });
    await createNpc(id, { ...emptyNpcDraft(), name: "Bran" });
    await screen.findByRole("option", { name: "Elda" });
    await user.selectOptions(screen.getByRole("combobox", { name: "Add NPC" }), "Elda");
    await waitFor(() => expect(order()).toEqual(["Elda"]));
    expect(screen.queryByRole("option", { name: "Bran" })).not.toBeInTheDocument();
    expect(screen.getByText(/HP 7/)).toBeInTheDocument();
    const block = await within(panel()).findByRole("article", { name: "Elda Stat Block" });
    expect(within(block).getByText(/Scimitar/)).toBeInTheDocument();
  });
});
