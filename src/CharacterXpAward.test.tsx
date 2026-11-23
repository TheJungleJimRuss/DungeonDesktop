import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { listCampaigns } from "./storage";
import { addPartyMember, listParty, type PartyMemberInput } from "./storage/party";
import { createCustomEntry, emptyMonsterData } from "./storage/customEntries";

beforeEach(() => localStorage.clear());
const T = { timeout: 4000 };
type U = ReturnType<typeof userEvent.setup>;

const MIRA: PartyMemberInput = { name: "Mira", class: "Mage Test", classId: "test-mage", level: 1, ac: 10, maxHp: 6, passivePerception: 10, notes: "", xp: 0 };
const BRAN: PartyMemberInput = { name: "Bran", class: "Mage Test", classId: "test-mage", level: 1, ac: 10, maxHp: 6, passivePerception: 10, notes: "", xp: 0 };

async function createCampaign(user: U, name: string) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), name);
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText(name);
  return (await listCampaigns()).find((c) => c.name === name)!.id;
}
async function open(user: U, name: string) {
  await user.click(within(screen.getByRole("listitem", { name })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
}
const mira = async (id: string) => (await listParty(id)).find((m) => m.name === "Mira")!;

describe("Award XP on the Player card", () => {
  it("300 XP takes a level-1 SRD-class member to level 2 and raises max HP", async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = await createCampaign(user, "Alpha");
    await addPartyMember(id, MIRA);
    await open(user, "Alpha");
    const card = within(await screen.findByRole("region", { name: /player card/i }));
    await card.findByRole("article", { name: /mira player card/i }, T);
    await user.type(card.getByLabelText("XP to award Mira"), "300");
    await user.click(card.getByRole("button", { name: "Award XP Mira" }));
    expect(await card.findByText("Level up! Now level 2", undefined, T)).toBeInTheDocument();
    await waitFor(async () => expect(await mira(id)).toMatchObject({ xp: 300, level: 2, maxHp: 10 }), T);
    expect(await card.findByLabelText("XP Mira", undefined, T)).toHaveTextContent("XP 300 / 900");
  });

  it("does not change a manual level", async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = await createCampaign(user, "Alpha");
    await addPartyMember(id, { ...MIRA, level: 3, maxHp: 14, manual: { level: true } });
    await open(user, "Alpha");
    const card = within(await screen.findByRole("region", { name: /player card/i }));
    await card.findByRole("article", { name: /mira player card/i }, T);
    await user.type(card.getByLabelText("XP to award Mira"), "2000");
    await user.click(card.getByRole("button", { name: "Award XP Mira" }));
    await waitFor(async () => expect(await mira(id)).toMatchObject({ xp: 2000, level: 3 }), T);
    expect(card.queryByText(/level up/i)).not.toBeInTheDocument();
  });
});

describe("Award XP to party when an Encounter ends", () => {
  async function fight(user: U, defeat: boolean) {
    render(<App />);
    const id = await createCampaign(user, "Alpha");
    await addPartyMember(id, MIRA);
    await addPartyMember(id, BRAN);
    await createCustomEntry(id, "monster", "Home Brew", { ...emptyMonsterData(), xp: 100 });
    await open(user, "Alpha");
    await user.keyboard("{Alt>}1{/Alt}");
    const p = within(await screen.findByRole("region", { name: "Initiative" }));
    await user.click(p.getByRole("button", { name: /start encounter/i }));
    await p.findByRole("option", { name: "Mira" }, T);
    await user.selectOptions(p.getByRole("combobox", { name: "Add Party member" }), "__all__");
    for (const q of ["Goblin", "Home Brew"]) {
      await user.clear(p.getByRole("searchbox", { name: "Search monsters" }));
      await user.type(p.getByRole("searchbox", { name: "Search monsters" }), q);
      await user.click(await p.findByRole("button", { name: `Add ${q === "Goblin" ? "Goblin Warrior" : q}` }, T));
    }
    if (defeat) {
      for (const name of ["Goblin Warrior", "Home Brew"]) {
        await user.click(p.getByRole("button", { name: `Expand ${name}` }));
        await user.type(p.getByLabelText(`Amount ${name}`), "999");
        await user.click(p.getByRole("button", { name: `Damage ${name}` }));
      }
    }
    await user.click(p.getByRole("button", { name: /end encounter/i }));
    await user.click(await p.findByRole("button", { name: /yes, end it/i }));
    return { id, p };
  }

  it("pre-fills the defeated monsters' XP (SRD and custom), shows the split, and Award and end gives each their share", async () => {
    const user = userEvent.setup();
    const { id, p } = await fight(user, true);
    const step = within(await screen.findByRole("dialog", { name: /award xp to party/i }, T));
    expect(step.getByLabelText("Total XP")).toHaveValue(150);
    expect(step.getByText(/75 XP each/)).toBeInTheDocument();
    await user.clear(step.getByLabelText("Total XP"));
    await user.type(step.getByLabelText("Total XP"), "151");
    expect(step.getByText(/75 XP each/)).toBeInTheDocument();
    await user.click(step.getByRole("button", { name: "Award and end" }));
    expect(await p.findByText(/no encounter in progress/i, undefined, T)).toBeInTheDocument();
    await waitFor(async () => expect((await listParty(id)).map((m) => m.xp)).toEqual([75, 75]), T);
  });

  it("End without XP ends the encounter and leaves XP unchanged", async () => {
    const user = userEvent.setup();
    const { id, p } = await fight(user, true);
    await user.click(await screen.findByRole("button", { name: "End without XP" }, T));
    expect(await p.findByText(/no encounter in progress/i, undefined, T)).toBeInTheDocument();
    expect((await listParty(id)).map((m) => m.xp)).toEqual([0, 0]);
  });

  it("pre-fills 0 when nothing was defeated", async () => {
    const user = userEvent.setup();
    await fight(user, false);
    const step = within(await screen.findByRole("dialog", { name: /award xp to party/i }, T));
    expect(step.getByLabelText("Total XP")).toHaveValue(0);
  });
});

describe("Level in the character form", () => {
  it("follows XP live, typing a level makes it manual, Reset returns to XP", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createCampaign(user, "Alpha");
    await user.click(within(screen.getByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
    await screen.findByRole("heading", { name: "Dashboard" });
    await user.click(screen.getByRole("button", { name: /^party/i }));
    const p = within(await screen.findByRole("region", { name: /character sheets/i }));
    await user.click(p.getByRole("button", { name: /add character/i }));
    await user.type(p.getByLabelText("Name"), "Mira");
    await user.type(p.getByLabelText("XP"), "900");
    expect(p.getByLabelText("Level")).toHaveValue(3);
    await user.clear(p.getByLabelText("XP")); await user.type(p.getByLabelText("XP"), "2700");
    expect(p.getByLabelText("Level")).toHaveValue(4);
    await user.clear(p.getByLabelText("Level")); await user.type(p.getByLabelText("Level"), "2");
    expect(p.getByLabelText("Level")).toHaveValue(2);
    await user.click(p.getByRole("button", { name: "Reset Level to auto" }));
    expect(p.getByLabelText("Level")).toHaveValue(4);
  });
});

describe("Quick XP edit on the Party screen", () => {
  async function sheet(user: U) {
    render(<App />);
    const id = await createCampaign(user, "Alpha");
    await addPartyMember(id, MIRA);
    await open(user, "Alpha");
    await user.click(screen.getByRole("button", { name: /^party/i }));
    const panel = within(await screen.findByRole("region", { name: /character sheets/i }));
    return { id, s: within(await panel.findByRole("article", { name: "Mira character sheet" }, T)) };
  }

  it("sets the XP total directly, raising or lowering the level", async () => {
    const user = userEvent.setup();
    const { id, s } = await sheet(user);
    const total = s.getByRole("spinbutton", { name: "Total XP Mira" });
    await user.clear(total);
    await user.type(total, "2700{Enter}");
    await waitFor(async () => expect(await mira(id)).toMatchObject({ xp: 2700, level: 4 }), T);
    expect(await s.findByText("Level up! Now level 4", undefined, T)).toBeInTheDocument();
    await user.clear(total);
    await user.type(total, "300");
    await user.tab();
    await waitFor(async () => expect(await mira(id)).toMatchObject({ xp: 300, level: 2 }), T);
    expect(await s.findByText("Now level 2", undefined, T)).toBeInTheDocument();
  });

  it("adds XP from the sheet", async () => {
    const user = userEvent.setup();
    const { id, s } = await sheet(user);
    await user.type(s.getByLabelText("XP to award Mira"), "300{Enter}");
    await waitFor(async () => expect(await mira(id)).toMatchObject({ xp: 300, level: 2 }), T);
    expect(await s.findByRole("spinbutton", { name: "Total XP Mira" }, T)).toHaveValue(300);
  });
});
