import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { setMonsterSource } from "./srd/monsters";
import { FIXTURE_MONSTERS } from "./srd/fixtures";
import { createCustomEntry, emptyMonsterData } from "./storage/customEntries";
import { listCampaigns } from "./storage";
import { addPartyMember } from "./storage/party";

type User = ReturnType<typeof userEvent.setup>;
const member = (name: string, level: number) => ({ name, class: "Fighter", level, ac: 16, maxHp: 28, passivePerception: 12, notes: "" });

async function openInitiative(user: User) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), "Alpha");
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText("Alpha");
  return (await listCampaigns())[0].id;
}
async function enter(user: User) {
  await user.click(within(screen.getByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
  await user.keyboard("{Alt>}1{/Alt}");
  const p = await screen.findByRole("region", { name: "Initiative" });
  await user.click(within(p).getByRole("button", { name: /start encounter/i }));
  await screen.findByRole("button", { name: /end encounter/i });
  return p;
}
async function addMonster(user: User, query: string, name: string) {
  const box = screen.getByRole("searchbox", { name: /search monsters/i });
  await user.clear(box);
  await user.type(box, query);
  await user.click(await screen.findByRole("button", { name: `Add ${name}` }));
}
const line = () => screen.queryByRole("status", { name: /encounter difficulty/i });

beforeEach(() => { localStorage.clear(); setMonsterSource(async () => FIXTURE_MONSTERS); });
afterEach(() => setMonsterSource(null));

describe("encounter difficulty", () => {
  it("updates as monsters are added and removed, using party combatants in the Encounter", async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = await openInitiative(user);
    await addPartyMember(id, member("Thia", 3));
    await addPartyMember(id, member("Bram", 10));
    const p = await enter(user);
    await within(p).findByRole("option", { name: "Thia" });
    await user.selectOptions(within(p).getByRole("combobox", { name: "Add Party member" }), "Thia");
    expect(line()).toBeNull();

    await addMonster(user, "owlbear", "Owlbear");
    await waitFor(() => expect(line()).toHaveTextContent("Above High · 700 XP"));
    expect(line()).toHaveTextContent("Low 150 · Moderate 225 · High 400 for 1 character (level 3)");
    expect(line()).not.toHaveTextContent("whole party");

    const expand = screen.queryByRole("button", { name: "Expand Owlbear" });
    if (expand) await user.click(expand);
    await user.click(screen.getByRole("button", { name: "Remove Owlbear" }));
    await waitFor(() => expect(line()).toBeNull());
  });

  it("falls back to the whole party when no party combatants are in the Encounter", async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = await openInitiative(user);
    await addPartyMember(id, member("Thia", 3));
    await addPartyMember(id, member("Bram", 10));
    await enter(user);
    await addMonster(user, "goblin", "Goblin Warrior");
    await waitFor(() => expect(line()).toHaveTextContent("Below Low · 50 XP"));
    expect(line()).toHaveTextContent("Low 1750 · Moderate 2525 · High 3500 for 2 characters (whole party)");
  });

  it("counts custom monster XP and reports ad-hoc and XP-less ones as not counted", async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = await openInitiative(user);
    await addPartyMember(id, member("Thia", 3));
    await createCustomEntry(id, "monster", "Zorb", { ...emptyMonsterData(), xp: 200 } as never);
    await createCustomEntry(id, "monster", "Nada", { ...emptyMonsterData(), xp: 0 } as never);
    const p = await enter(user);
    await addMonster(user, "zorb", "Zorb");
    await addMonster(user, "nada", "Nada");
    await user.type(within(p).getByLabelText("Ad-hoc name"), "Cultist");
    await user.click(within(p).getByRole("button", { name: /add ad-hoc/i }));
    await waitFor(() => expect(line()).toHaveTextContent("Low · 200 XP"));
    expect(line()).toHaveTextContent("2 without XP not counted");
  });

  it("is hidden when there is no Party at all", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openInitiative(user);
    await enter(user);
    await addMonster(user, "goblin", "Goblin Warrior");
    await screen.findByRole("listitem", { name: "Goblin Warrior" });
    expect(line()).toBeNull();
  });
});
