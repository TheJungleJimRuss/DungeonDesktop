import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { listCampaigns } from "./storage";
import { addPartyMember, listParty } from "./storage/party";

beforeEach(() => localStorage.clear());
const T = { timeout: 4000 };
type U = ReturnType<typeof userEvent.setup>;

async function open(user: U, name: string) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), name);
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText(name);
  return (await listCampaigns()).find((c) => c.name === name)!.id;
}
async function goParty(user: U, name: string) {
  await user.click(within(screen.getByRole("listitem", { name })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: "Dashboard" });
  await user.click(screen.getByRole("button", { name: /^party/i }));
  return within(await screen.findByRole("region", { name: /character sheets/i }));
}
const setLevel = async (user: U, p: ReturnType<typeof within>, n: string) => {
  await user.clear(p.getByLabelText("Level")); await user.type(p.getByLabelText("Level"), n);
};

describe("Auto fields with manual override", () => {
  it("picking a class fills saves, hit dice, HP and slots; level and Max HP override behave", async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = await open(user, "Auto1");
    const p = await goParty(user, "Auto1");
    await user.click(p.getByRole("button", { name: /add character/i }));
    await user.type(p.getByLabelText("Name"), "Mira");
    await user.selectOptions(await p.findByRole("combobox", { name: "Class" }, T), "Mage Test");
    expect(p.getByLabelText("Hit Dice")).toHaveValue("1d6");
    expect(p.getByLabelText("Max HP")).toHaveValue(6);
    expect(p.getByLabelText("Intelligence save")).toBeChecked();
    expect(p.getByLabelText("Wisdom save")).toBeChecked();
    expect(p.getByLabelText("Strength save")).not.toBeChecked();
    expect(p.getByLabelText("Spellcasting ability")).toHaveValue("int");
    expect(p.getByLabelText("Level 1 slots")).toHaveValue(2);
    expect(p.getAllByText("auto").length).toBeGreaterThan(3);

    await setLevel(user, p, "5");
    expect(p.getByLabelText("Hit Dice")).toHaveValue("5d6");
    expect(p.getByLabelText("Max HP")).toHaveValue(22);
    expect(p.getByLabelText("Level 1 slots")).toHaveValue(4);
    expect(p.getByLabelText("Level 3 slots")).toHaveValue(2);

    await user.clear(p.getByLabelText("CON score")); await user.type(p.getByLabelText("CON score"), "14");
    expect(p.getByLabelText("Max HP")).toHaveValue(6 + 2 + 4 * 6);

    await user.clear(p.getByLabelText("Max HP")); await user.type(p.getByLabelText("Max HP"), "40");
    expect(p.getByRole("button", { name: "Reset Max HP to auto" })).toBeInTheDocument();
    await setLevel(user, p, "3");
    expect(p.getByLabelText("Max HP")).toHaveValue(40);
    expect(p.getByLabelText("Hit Dice")).toHaveValue("3d6");

    await user.click(p.getByRole("button", { name: "Reset Max HP to auto" }));
    expect(p.getByLabelText("Max HP")).toHaveValue(6 + 2 + 2 * 6);
    expect(p.queryByRole("button", { name: "Reset Max HP to auto" })).not.toBeInTheDocument();

    await user.clear(p.getByLabelText("Max HP")); await user.type(p.getByLabelText("Max HP"), "50");
    await user.click(p.getByRole("button", { name: /save member/i }));
    await p.findByRole("article", { name: /mira character sheet/i }, T);
    const [m] = await listParty(id);
    expect(m).toMatchObject({ maxHp: 50, hitDice: "3d6", classId: "test-mage", manual: { maxHp: true }, saveProficiencies: ["int", "wis"] });
    expect(m.spellSlotsMax?.slice(0, 3)).toEqual([4, 2, 0]);
    expect(m.features).toEqual(["Casting Test", "Recovery Test"]);
  });

  it("editing a saving throw marks saves manual; switching class keeps it", async () => {
    const user = userEvent.setup();
    render(<App />);
    await open(user, "Auto2");
    const p = await goParty(user, "Auto2");
    await user.click(p.getByRole("button", { name: /add character/i }));
    await user.type(p.getByLabelText("Name"), "Rho");
    await user.selectOptions(await p.findByRole("combobox", { name: "Class" }, T), "Mage Test");
    await user.click(p.getByLabelText("Strength save"));
    expect(p.getByRole("button", { name: "Reset Saving throws to auto" })).toBeInTheDocument();
    await user.selectOptions(p.getByLabelText("Class"), "Savage Test");
    expect(p.getByLabelText("Strength save")).toBeChecked();
    expect(p.getByLabelText("Intelligence save")).toBeChecked(); // the manual list holds what was shown when edited
    expect(p.getByLabelText("Hit Dice")).toHaveValue("1d12");
    await user.click(p.getByRole("button", { name: "Reset Saving throws to auto" }));
    expect(p.getByLabelText("Constitution save")).toBeChecked();
  });

  it("a custom class leaves class-driven fields as typed", async () => {
    const user = userEvent.setup();
    render(<App />);
    await open(user, "Auto3");
    const p = await goParty(user, "Auto3");
    await user.click(p.getByRole("button", { name: /add character/i }));
    await user.type(p.getByLabelText("Name"), "Vex");
    await user.selectOptions(await p.findByRole("combobox", { name: "Class" }, T), "Custom…");
    await user.clear(p.getByLabelText("Max HP")); await user.type(p.getByLabelText("Max HP"), "33");
    await setLevel(user, p, "4");
    expect(p.getByLabelText("Max HP")).toHaveValue(33);
    expect(p.queryByRole("button", { name: /to auto/i })).not.toBeInTheDocument();
  });
});

describe("Generated features (legacy records fold into the normal lists) and the Player card", () => {
  const MIRA = { name: "Mira", class: "Mage Test", classId: "test-mage", level: 5, ac: 12, maxHp: 22, passivePerception: 10, notes: "",
    features: ["Lucky"], autoFeatures: ["Casting Test", "Recovery Test"], proficiencies: ["Lute"], autoProficiencies: ["Daggers"] };

  it("Character Sheet lists both as ordinary, removable entries", async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = await open(user, "Auto4");
    await addPartyMember(id, MIRA);
    const p = await goParty(user, "Auto4");
    await user.click(within(await p.findByRole("listitem", { name: "Mira" }, T)).getByRole("button", { name: /^Mira/ }));
    const sheet = within(await p.findByRole("article", { name: /mira character sheet/i }, T));
    for (const t of ["Casting Test", "Recovery Test", "Lucky", "Daggers", "Lute"]) expect(sheet.getByText(t)).toBeInTheDocument();
    expect(sheet.getByRole("button", { name: /^remove lucky$/i })).toBeInTheDocument();
    expect(sheet.getByRole("button", { name: /^remove casting test$/i })).toBeInTheDocument();
    expect(sheet.getByRole("button", { name: /^remove daggers$/i })).toBeInTheDocument();
  });

  it("Player card shows proficiency bonus and the combined features and proficiencies", async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = await open(user, "Auto5");
    await addPartyMember(id, MIRA);
    await user.click(within(screen.getByRole("listitem", { name: "Auto5" })).getByRole("button", { name: /open/i }));
    await screen.findByRole("heading", { name: /dashboard/i });
    await user.click(within(screen.getByRole("navigation", { name: /modes/i })).getByRole("button", { name: /combat/i }));
    const card = within(screen.getByRole("region", { name: /player card/i }));
    expect(await card.findByRole("article", { name: /mira player card/i }, T)).toHaveTextContent("Proficiency +3");
    await user.click(card.getByRole("button", { name: "Story" }));
    for (const t of ["Casting Test", "Recovery Test", "Lucky", "Daggers", "Lute"]) expect(card.getByText(t)).toBeInTheDocument();
  });
});
