import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { setMonsterSource } from "./srd/monsters";
import { FIXTURE_MONSTERS } from "./srd/fixtures";
import { listCampaigns } from "./storage";
import { addPartyMember, listParty } from "./storage/party";
import { exportCampaign } from "./storage/portability";

type User = ReturnType<typeof userEvent.setup>;
const THIA = { name: "Thia", class: "Fighter", level: 3, ac: 16, maxHp: 28, passivePerception: 12, notes: "" };

async function createCampaign(user: User, name: string) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), name);
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText(name);
  return (await listCampaigns()).find((c) => c.name === name)!.id;
}
async function startCombat(user: User, name: string) {
  await user.click(within(screen.getByRole("listitem", { name })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
  await user.keyboard("{Alt>}1{/Alt}");
  const p = await screen.findByRole("region", { name: "Initiative" });
  await user.click(within(p).getByRole("button", { name: /start encounter/i }));
  await screen.findByRole("button", { name: /end encounter/i });
  return p;
}
const row = (name: string) => screen.getByRole("listitem", { name });
const hp = (name: string, text: string) => waitFor(() => expect(within(row(name)).getByLabelText(`HP ${name}`)).toHaveTextContent(text));
async function hit(user: User, name: string, amount: string, type?: string) {
  const r = within(row(name));
  const expand = r.queryByRole("button", { name: `Expand ${name}` });
  if (expand) await user.click(expand);
  await user.type(r.getByLabelText(`Amount ${name}`), amount);
  if (type) await user.selectOptions(r.getByLabelText(`Damage type ${name}`), type);
  await user.click(r.getByRole("button", { name: `Damage ${name}` }));
}

beforeEach(() => { localStorage.clear(); setMonsterSource(async () => FIXTURE_MONSTERS); });
afterEach(() => setMonsterSource(null));

describe("Damage types in combat", () => {
  it("applies monster immunity, resistance and vulnerability with a reason note; untyped is unchanged", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createCampaign(user, "Alpha");
    const p = await startCombat(user, "Alpha");
    await user.type(screen.getByRole("searchbox", { name: /search monsters/i }), "ghoul");
    await user.click(await screen.findByRole("button", { name: "Add Test Ghoul" }));
    await hp("Test Ghoul", "HP 22/22");

    await hit(user, "Test Ghoul", "10", "Poison");
    expect(await within(row("Test Ghoul")).findByRole("status")).toHaveTextContent("Immune: poison (10 → 0)");
    await hp("Test Ghoul", "HP 22/22");
    expect(screen.getByLabelText("Damage type Test Ghoul")).toHaveValue("");

    await hit(user, "Test Ghoul", "7", "Necrotic");
    await hp("Test Ghoul", "HP 19/22");
    expect(within(row("Test Ghoul")).getByRole("status")).toHaveTextContent("Resistant: necrotic (7 → 3)");

    await hit(user, "Test Ghoul", "2", "Radiant");
    await hp("Test Ghoul", "HP 15/22");
    expect(within(row("Test Ghoul")).getByRole("status")).toHaveTextContent("Vulnerable: radiant (2 → 4)");

    await hit(user, "Test Ghoul", "3");
    await hp("Test Ghoul", "HP 12/22");
    expect(within(row("Test Ghoul")).queryByRole("status")).toBeNull();
    expect(p).toBeInTheDocument();
  });

  it("halves fire damage for a fire-resistant party member and never adjusts ad-hoc combatants", async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = await createCampaign(user, "Beta");
    await addPartyMember(id, { ...THIA, damageResistances: ["Fire"] });
    const p = await startCombat(user, "Beta");
    await within(p).findByRole("option", { name: "Thia" });
    await user.selectOptions(within(p).getByRole("combobox", { name: "Add Party member" }), "Thia");
    await hp("Thia", "HP 28/28");
    await hit(user, "Thia", "10", "Fire");
    await hp("Thia", "HP 23/28");
    expect(within(row("Thia")).getByRole("status")).toHaveTextContent("Resistant: fire (10 → 5)");
    await hit(user, "Thia", "4", "Cold");
    await hp("Thia", "HP 19/28");

    await user.type(await screen.findByLabelText("Ad-hoc name"), "Bandit");
    await user.type(screen.getByLabelText("Ad-hoc HP"), "10");
    await user.click(screen.getByRole("button", { name: /add ad-hoc/i }));
    await hp("Bandit", "HP 10/10");
    await hit(user, "Bandit", "6", "Poison");
    await hp("Bandit", "HP 4/10");
    expect(within(row("Bandit")).queryByRole("status")).toBeNull();
  });

  it("edits Defenses on the Character form, shows the line, and exports the fields", async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = await createCampaign(user, "Gamma");
    await user.click(within(screen.getByRole("listitem", { name: "Gamma" })).getByRole("button", { name: /open/i }));
    await screen.findByRole("heading", { name: /dashboard/i });
    await user.click(screen.getByRole("button", { name: /^party/i }));
    const sheets = within(await screen.findByRole("region", { name: /character sheets/i }));
    await user.click(sheets.getByRole("button", { name: /add character/i }));
    await user.type(sheets.getByLabelText("Name"), "Dorn");
    await user.click(sheets.getByLabelText("Resistances: Poison"));
    await user.click(sheets.getByLabelText("Vulnerabilities: Radiant"));
    await user.click(sheets.getByRole("button", { name: /save member/i }));
    expect(await sheets.findByLabelText("Defenses Dorn")).toHaveTextContent("Resist poison · Vulnerable radiant");
    const [m] = await listParty(id);
    expect(m.damageResistances).toEqual(["Poison"]);
    expect(m.damageVulnerabilities).toEqual(["Radiant"]);
    expect(m.damageImmunities ?? []).toEqual([]);
    expect(JSON.stringify(await exportCampaign(id))).toContain('"damageResistances":["Poison"]');
  });

  it("the Player card's Damage uses the damage type too, with a reason note", async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = await createCampaign(user, "Epsilon");
    await addPartyMember(id, { ...THIA, currentHp: 28, damageResistances: ["Fire"] });
    await user.click(within(screen.getByRole("listitem", { name: "Epsilon" })).getByRole("button", { name: /open/i }));
    const card = within(await screen.findByRole("article", { name: /thia player card/i }));
    const box = card.getByLabelText("HP change Thia");
    await user.clear(box); await user.type(box, "10");
    await user.selectOptions(card.getByLabelText("Damage type Thia"), "Fire");
    await user.click(card.getByRole("button", { name: "Damage Thia" }));
    await waitFor(async () => expect((await listParty(id))[0].currentHp).toBe(23));
    expect(card.getByText("Resistant: fire (10 → 5)")).toHaveAttribute("role", "status");
    expect(card.getByLabelText("Damage type Thia")).toHaveValue("");
    await user.clear(box); await user.type(box, "4");
    await user.click(card.getByRole("button", { name: "Damage Thia" }));
    await waitFor(async () => expect((await listParty(id))[0].currentHp).toBe(19));
    expect(card.queryByText(/Resistant: fire/)).toBeNull();
  });

  it("hides the defenses line when empty", async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = await createCampaign(user, "Delta");
    await addPartyMember(id, THIA);
    await user.click(within(screen.getByRole("listitem", { name: "Delta" })).getByRole("button", { name: /open/i }));
    expect(await screen.findByRole("article", { name: /thia player card/i })).toBeInTheDocument();
    expect(screen.queryByLabelText("Defenses Thia")).toBeNull();
  });
});
