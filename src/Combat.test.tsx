import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { resetRolls, setRng } from "./dice/roller";
import { seqRng } from "./dice/dice";
import { setMonsterSource } from "./srd/monsters";
import { FIXTURE_MONSTERS } from "./srd/fixtures";
import { createCustomEntry, emptyMonsterData } from "./storage/customEntries";
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
  return screen.findByRole("region", { name: "Initiative" });
}
const order = () => within(screen.getByRole("list", { name: /initiative order/i })).getAllByRole("listitem").map((li) => li.getAttribute("aria-label"));
async function addMonster(user: User, query: string, name: string) {
  const box = screen.getByRole("searchbox", { name: /search monsters/i });
  await user.clear(box);
  await user.type(box, query);
  await user.click(await screen.findByRole("button", { name: `Add ${name}` }));
}

const expectOrder = (names: string[]) => waitFor(() => expect(order()).toEqual(names));
const expectInit = (name: string, v: number) => waitFor(() => expect(screen.getByLabelText(`Initiative ${name}`)).toHaveValue(v));

beforeEach(() => { localStorage.clear(); setMonsterSource(async () => FIXTURE_MONSTERS); });
afterEach(() => { setMonsterSource(null); resetRolls(); });

describe("combat setup and initiative", () => {
  it("builds an Encounter, numbers duplicates, rolls with the dex modifier, sorts, breaks ties and runs turns", async () => {
    // goblin dex 14 -> +2. d20 results: 0.5 -> 11, 0.0 -> 1  => 13 and 3
    setRng(seqRng([0.5, 0.0]));
    const user = userEvent.setup();
    render(<App />);
    const p = await openCombat(user);
    expect(within(p).getByText(/no encounter in progress/i)).toBeInTheDocument();
    await user.click(within(p).getByRole("button", { name: /start encounter/i }));

    await addMonster(user, "goblin", "Goblin Warrior");
    await addMonster(user, "goblin", "Goblin Warrior");
    await expectOrder(["Goblin Warrior 1", "Goblin Warrior 2"]);

    await user.type(screen.getByLabelText("Ad-hoc name"), "Bandit");
    await user.type(screen.getByLabelText("Ad-hoc initiative"), "13");
    await user.type(screen.getByLabelText("Ad-hoc HP"), "11");
    await user.click(screen.getByRole("button", { name: /add ad-hoc/i }));

    await user.click(screen.getByRole("button", { name: /roll monster initiative/i }));
    await expectInit("Goblin Warrior 1", 13);
    await expectInit("Goblin Warrior 2", 3);
    // Bandit ties the first goblin at 13; the existing order is kept until the DM breaks the tie.
    await expectOrder(["Bandit", "Goblin Warrior 1", "Goblin Warrior 2"]);
    await user.click(screen.getByRole("button", { name: "Move Goblin Warrior 1 up" }));
    await expectOrder(["Goblin Warrior 1", "Bandit", "Goblin Warrior 2"]);
    expect(screen.getByRole("button", { name: "Move Goblin Warrior 2 up" })).toBeDisabled();

    // Typing a new initiative re-sorts on commit.
    await user.clear(screen.getByLabelText("Initiative Goblin Warrior 2"));
    await user.type(screen.getByLabelText("Initiative Goblin Warrior 2"), "20{Enter}");
    await expectOrder(["Goblin Warrior 2", "Goblin Warrior 1", "Bandit"]);

    const active = () => screen.getByRole("list", { name: /initiative order/i }).querySelector("[aria-current=true]")?.getAttribute("aria-label");
    const expectActive = (n: string) => waitFor(() => expect(active()).toBe(n));
    await screen.findByText("Round 1");
    await expectActive("Goblin Warrior 2");
    await user.click(screen.getByRole("button", { name: /next turn/i }));
    await user.click(screen.getByRole("button", { name: /next turn/i }));
    await expectActive("Bandit");
    await user.click(screen.getByRole("button", { name: /next turn/i }));
    await screen.findByText("Round 2");
    await expectActive("Goblin Warrior 2");
    await user.click(screen.getByRole("button", { name: /previous turn/i }));
    await screen.findByText("Round 1");
    await expectActive("Bandit");
  });

  it("adds Party members and custom monsters, survives reload, ends, and is in the export", async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    const p = await openCombat(user);
    const id = (await listCampaigns())[0].id;
    await addPartyMember(id, { name: "Thia", class: "Fighter", level: 3, ac: 16, maxHp: 28, passivePerception: 12, notes: "" });
    await createCustomEntry(id, "monster", "Brine Hag", { ...emptyMonsterData(), hp: 40 });
    await user.click(within(p).getByRole("button", { name: /start encounter/i }));
    await screen.findByRole("option", { name: "Thia" });
    await user.selectOptions(screen.getByRole("combobox", { name: "Add Party member" }), "Thia");
    await addMonster(user, "brine", "Brine Hag");
    await user.type(screen.getByLabelText("Initiative Thia"), "17{Enter}");
    await expectOrder(["Thia", "Brine Hag"]);

    expect((await exportCampaign(id))!.collections.encounters).toHaveLength(1);

    first.unmount();
    render(<App />);
    await user.click(within(await screen.findByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
    await user.click(await screen.findByRole("button", { name: /continue in combat/i }));
    await screen.findByRole("list", { name: /initiative order/i });
    await expectOrder(["Thia", "Brine Hag"]);
    await expectInit("Thia", 17);

    await user.click(screen.getByRole("button", { name: /end encounter/i }));
    await user.click(await screen.findByRole("button", { name: /yes, end it/i }));
    expect(await screen.findByText(/no encounter in progress/i)).toBeInTheDocument();
    expect((await exportCampaign(id))!.collections.encounters).toHaveLength(0);
  });
});
