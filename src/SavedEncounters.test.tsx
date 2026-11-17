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
  return screen.findByRole("region", { name: "Initiative" });
}
const order = () => within(screen.getByRole("list", { name: /initiative order/i })).getAllByRole("listitem").map((li) => li.getAttribute("aria-label"));
async function addMonster(user: User, query: string, name: string) {
  const box = screen.getByRole("searchbox", { name: /search monsters/i });
  await user.clear(box);
  await user.type(box, query);
  await user.click(await screen.findByRole("button", { name: `Add ${name}` }));
}

beforeEach(() => { localStorage.clear(); setMonsterSource(async () => FIXTURE_MONSTERS); });
afterEach(() => setMonsterSource(null));

describe("saved encounters", () => {
  it("saves a composition, lists, renames, loads into a fresh Encounter with the Party, deletes, and exports", async () => {
    const user = userEvent.setup();
    render(<App />);
    const p = await openCombat(user);
    const id = (await listCampaigns())[0].id;
    await addPartyMember(id, { name: "Thia", class: "Fighter", level: 3, ac: 16, maxHp: 28, passivePerception: 12, notes: "" });
    await user.click(within(p).getByRole("button", { name: /start encounter/i }));
    await addMonster(user, "goblin", "Goblin Warrior");
    await addMonster(user, "goblin", "Goblin Warrior");
    await screen.findByRole("option", { name: "Thia" });
    await user.selectOptions(screen.getByRole("combobox", { name: "Add Party member" }), "Thia");
    await user.type(screen.getByLabelText("Ad-hoc name"), "Bandit");
    await user.type(screen.getByLabelText("Ad-hoc HP"), "11");
    await user.click(screen.getByRole("button", { name: /add ad-hoc/i }));
    await user.type(screen.getByLabelText("Initiative Thia"), "17{Enter}");

    await user.type(screen.getByLabelText("Saved encounter name"), "Goblin ambush");
    await user.click(screen.getByRole("button", { name: /save encounter/i }));
    expect((await exportCampaign(id))!.collections.savedEncounters).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: /end encounter/i }));

    const saved = await screen.findByRole("list", { name: /saved encounters/i });
    const item = within(saved).getByRole("listitem", { name: "Goblin ambush" });
    expect(item).toHaveTextContent(/Goblin Warrior ×2/);

    await user.click(within(item).getByRole("button", { name: /rename/i }));
    const box = screen.getByLabelText("New name for Goblin ambush");
    await user.clear(box);
    await user.type(box, "Ambush{Enter}");
    await user.click(within(await screen.findByRole("listitem", { name: "Ambush" })).getByRole("button", { name: /^load/i }));
    await waitFor(() => expect(order().sort()).toEqual(["Bandit", "Goblin Warrior 1", "Goblin Warrior 2", "Thia"]));
    // Fresh state: no initiative carried over.
    expect(screen.getByLabelText("Initiative Thia")).toHaveValue(null);
    expect(screen.getByLabelText("Initiative Goblin Warrior 1")).toHaveValue(null);

    await user.click(screen.getByRole("button", { name: /end encounter/i }));
    await user.click(within(await screen.findByRole("listitem", { name: "Ambush" })).getByRole("button", { name: /delete/i }));
    await waitFor(() => expect(screen.queryByRole("listitem", { name: "Ambush" })).not.toBeInTheDocument());
    expect((await exportCampaign(id))!.collections.savedEncounters).toHaveLength(0);
  });
});
