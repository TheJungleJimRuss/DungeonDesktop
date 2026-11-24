import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { setReferenceSource } from "./srd/reference";
import { FIXTURE_REFERENCE } from "./srd/fixtures";

const REF = {
  ...FIXTURE_REFERENCE,
  equipment: [...FIXTURE_REFERENCE.equipment,
    { id: "rapier", name: "Rapier", categories: ["Weapons", "Melee Weapons"], cost: "25 gp", properties: ["Finesse"], desc: "", damage: "1d8 Piercing" }],
  spells: [...FIXTURE_REFERENCE.spells,
    { id: "fire-bolt", name: "Fire Bolt", level: 0, school: "Evocation", classes: ["Wizard"], castingTime: "Action", ritual: false, range: "120 feet",
      components: "V, S", duration: "Instantaneous", description: "Make a ranged spell attack. On a hit, the target takes 1d10 Fire damage." }],
};

beforeEach(() => { localStorage.clear(); setReferenceSource(async () => REF); });
afterEach(() => setReferenceSource(null));

describe("attack search", () => {
  it("fills a new attack from an SRD weapon or spell", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), "Search");
    await user.click(screen.getByRole("button", { name: /create campaign/i }));
    await user.click(within(await screen.findByRole("listitem", { name: "Search" })).getByRole("button", { name: /open/i }));
    await screen.findByRole("heading", { name: "Dashboard" });
    await user.click(screen.getByRole("button", { name: /^party/i }));
    const p = within(await screen.findByRole("region", { name: /character sheets/i }));
    await user.click(p.getByRole("button", { name: /add character/i }));
    await user.type(p.getByLabelText("Name"), "Vex");
    await user.clear(p.getByLabelText("DEX score")); await user.type(p.getByLabelText("DEX score"), "16");
    await user.clear(p.getByLabelText("INT score")); await user.type(p.getByLabelText("INT score"), "18");
    await user.selectOptions(p.getByLabelText(/spellcasting ability/i), "int");

    const search = p.getByRole("combobox", { name: /search weapons and spells/i });
    await user.type(search, "rap");
    await user.click(await p.findByRole("option", { name: /Rapier/ }));
    expect(p.getByLabelText("Attack name")).toHaveValue("Rapier");
    expect(p.getByLabelText("Ability")).toHaveValue("finesse");
    await user.click(p.getByRole("button", { name: "Add attack" }));
    expect(await p.findByText(/\+5 to hit — 1d8\+3 piercing/)).toBeInTheDocument();

    // Keyboard pick; the spell's INT goes to hit but not to damage.
    await user.type(search, "fire bolt{Enter}");
    expect(p.getByLabelText("Attack name")).toHaveValue("Fire Bolt");
    expect(p.getByLabelText("Ability to damage")).not.toBeChecked();
    await user.click(p.getByRole("button", { name: "Add attack" }));
    expect(await p.findByText(/\+6 to hit — 1d10 fire/)).toBeInTheDocument();

    await user.type(search, "zzz");
    expect(await p.findByText(/no weapon or damaging spell matches/i)).toBeInTheDocument();
  });
});

describe("attack search on the sheet view", () => {
  it("adds a found weapon straight to the attacks list", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), "Sheet");
    await user.click(screen.getByRole("button", { name: /create campaign/i }));
    await user.click(within(await screen.findByRole("listitem", { name: "Sheet" })).getByRole("button", { name: /open/i }));
    await screen.findByRole("heading", { name: "Dashboard" });
    await user.click(screen.getByRole("button", { name: /^party/i }));
    const p = within(await screen.findByRole("region", { name: /character sheets/i }));
    await user.click(p.getByRole("button", { name: /add character/i }));
    await user.type(p.getByLabelText("Name"), "Rook");
    await user.click(p.getByRole("button", { name: /save member/i }));
    const sheet = within(await p.findByRole("article", { name: /rook character sheet/i }));
    await user.type(sheet.getByRole("combobox", { name: /find weapon or spell/i }), "longsword{Enter}");
    expect(await sheet.findByText(/\+2 to hit, 1d8 slashing/)).toBeInTheDocument();
  });
});
