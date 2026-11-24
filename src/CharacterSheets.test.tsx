import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { setReferenceSource } from "./srd/reference";
import { FIXTURE_REFERENCE } from "./srd/fixtures";

async function openCampaign(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), name);
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText(name);
  await user.click(within(screen.getByRole("listitem", { name })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: "Dashboard" });
}

describe("Party tab and character sheets", () => {
  it("builds a full sheet and shows derived numbers", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Sheets");
    await user.click(screen.getByRole("button", { name: /^party/i }));
    const panel = await screen.findByRole("region", { name: /character sheets/i });
    const p = within(panel);
    await user.click(p.getByRole("button", { name: /add character/i }));
    await user.type(p.getByLabelText("Name"), "Mira");
    await user.selectOptions(await p.findByRole("combobox", { name: "Class" }), "Mage Test");
    await user.clear(p.getByLabelText("Level")); await user.type(p.getByLabelText("Level"), "5");
    await user.clear(p.getByLabelText("INT score")); await user.type(p.getByLabelText("INT score"), "18");
    // Intelligence save is already ticked: the Mage class grants it.
    await user.selectOptions(p.getByLabelText(/^Arcana/), "expertise");
    await user.selectOptions(p.getByLabelText("Spellcasting ability"), "int");
    await user.clear(p.getByLabelText("Level 1 slots")); await user.type(p.getByLabelText("Level 1 slots"), "4");
    await user.type(p.getByLabelText("Attack name"), "Dagger");
    await user.click(p.getByRole("button", { name: "Add attack" }));
    await user.type(p.getByLabelText("Attack name"), "Fire Bolt");
    await user.clear(p.getByLabelText("Quantity")); await user.type(p.getByLabelText("Quantity"), "3");
    await user.clear(p.getByLabelText("Dice count")); await user.type(p.getByLabelText("Dice count"), "2");
    await user.selectOptions(p.getByLabelText("Dice"), "10");
    await user.clear(p.getByLabelText("Extra damage")); await user.type(p.getByLabelText("Extra damage"), "3");
    await user.selectOptions(p.getByLabelText("Damage type"), "fire");
    await user.click(p.getByRole("button", { name: "Add attack" }));
    await user.click(p.getByRole("button", { name: "Remove attack Dagger" }));
    await user.type(p.getByLabelText("New item"), "Spellbook");
    await user.click(p.getByRole("button", { name: "Add item" }));
    await user.type(p.getByLabelText("New item"), "Spell Satchel");
    await user.click(p.getByRole("button", { name: "Add pack" }));
    await user.type(p.getByLabelText("New item in Spell Satchel"), "Ink{Enter}");
    await user.type(p.getByLabelText("New item in Spell Satchel"), "Parchment{Enter}");
    await user.click(p.getByRole("button", { name: "Remove Ink from Spell Satchel" }));
    await user.clear(p.getByLabelText("Count of Parchment in Spell Satchel")); await user.type(p.getByLabelText("Count of Parchment in Spell Satchel"), "5");
    await user.click(p.getByRole("button", { name: "Collapse Spell Satchel" }));
    expect(p.queryByLabelText("New item in Spell Satchel")).not.toBeInTheDocument();
    expect(p.getByRole("button", { name: "Expand Spell Satchel" })).toHaveTextContent("1 item");
    await user.click(p.getByRole("button", { name: "Expand Spell Satchel" }));
    expect(p.getByLabelText("New item in Spell Satchel")).toBeInTheDocument();
    await user.type(p.getByLabelText("New item"), "Torch");
    await user.clear(p.getByLabelText("Count")); await user.type(p.getByLabelText("Count"), "10{Enter}");
    await user.clear(p.getByLabelText("Count of Spellbook")); await user.type(p.getByLabelText("Count of Spellbook"), "2");
    await user.type(p.getByLabelText("New trait"), "Arcane Recovery{Enter}");
    await user.type(p.getByLabelText("New proficiency"), "Darts{Enter}");
    await user.type(p.getByLabelText("New language"), "Common{Enter}");
    await user.type(p.getByLabelText("New language"), "Draconic{Enter}");
    await user.type(p.getByLabelText("Backstory"), "Fled the academy.");
    await user.click(p.getByRole("button", { name: /save member/i }));

    const sheet = await p.findByRole("article", { name: /mira character sheet/i });
    const s = within(sheet);
    expect(sheet).toHaveTextContent("Mage Test 5");
    expect(s.getByLabelText("Intelligence save")).toHaveTextContent("+7");
    expect(s.getByLabelText("Arcana")).toHaveTextContent("+10");
    expect(s.getByText(/spell save dc 15/i)).toBeInTheDocument();
    expect(s.getByLabelText("Quantity of Spellbook")).toHaveValue(2);
    expect(s.getByLabelText("Quantity of Torch")).toHaveValue(10);
    for (const t of ["Arcane Recovery", "Darts", "Common", "Draconic"]) expect(s.getByText(t).tagName).toBe("LI");
    expect(s.getByLabelText("Quantity of Fire Bolt")).toHaveValue(3);
    expect(s.getByText(/— \+3 to hit, 2d10\+3 fire/)).toBeInTheDocument();
    expect(s.queryByLabelText("Attack bonus of Fire Bolt")).not.toBeInTheDocument();
    await user.click(s.getByLabelText("Increase Fire Bolt"));
    await waitFor(() => expect(s.getByText(/\+3 to hit, 2d10\+3 fire/)).toBeInTheDocument());
    await waitFor(() => expect(s.getByLabelText("Quantity of Fire Bolt")).toHaveValue(4));
    const pack = within(s.getByRole("list", { name: "Spell Satchel contents" }));
    expect(pack.getByLabelText("Quantity of Parchment in Spell Satchel")).toHaveValue(5);
    expect(pack.queryByText("Ink")).not.toBeInTheDocument();
    await user.click(s.getByRole("button", { name: "Collapse Spell Satchel" }));
    expect(s.queryByRole("list", { name: "Spell Satchel contents" })).not.toBeInTheDocument();
    expect(s.getByText("(1 item)")).toBeInTheDocument();
    await user.click(s.getByRole("button", { name: "Expand Spell Satchel" }));
    expect(s.getByRole("list", { name: "Spell Satchel contents" })).toBeInTheDocument();
    expect(s.queryByText(/^Dagger —/)).not.toBeInTheDocument();
    expect(s.getByText("Fled the academy.")).toBeInTheDocument();

    await user.click(s.getByRole("button", { name: /use level 1 slot/i }));
    expect(await s.findByText("3/4")).toBeInTheDocument();
  });

  it("adjusts HP and inspiration from the roster card", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Quick HP");
    await user.click(screen.getByRole("button", { name: /^party/i }));
    const p = within(await screen.findByRole("region", { name: /character sheets/i }));
    await user.click(p.getByRole("button", { name: /add character/i }));
    await user.type(p.getByLabelText("Name"), "Bram");
    await user.clear(p.getByLabelText("Max HP")); await user.type(p.getByLabelText("Max HP"), "20");
    await user.click(p.getByRole("button", { name: /save member/i }));
    const card = within(await p.findByRole("listitem", { name: "Bram" }));
    await user.clear(card.getByLabelText("HP change Bram")); await user.type(card.getByLabelText("HP change Bram"), "7");
    await user.click(card.getByRole("button", { name: "Damage Bram" }));
    expect(await card.findByText("13/20")).toBeInTheDocument();
    await user.click(card.getByRole("button", { name: "Heal Bram" }));
    expect(await card.findByText("20/20")).toBeInTheDocument();
    await user.click(card.getByRole("button", { name: "Inspiration Bram" }));
    expect(await card.findByRole("button", { name: "Inspiration Bram" })).toHaveAttribute("aria-pressed", "true");
  });

  it("adds and removes items on the sheet without edit mode", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Inline");
    await user.click(screen.getByRole("button", { name: /^party/i }));
    const p = within(await screen.findByRole("region", { name: /character sheets/i }));
    await user.click(p.getByRole("button", { name: /add character/i }));
    await user.type(p.getByLabelText("Name"), "Tess");
    await user.click(p.getByRole("button", { name: /save member/i }));
    const s = within(await p.findByRole("article", { name: /tess character sheet/i }));
    await user.type(s.getByLabelText("Add item"), "Rope{Enter}");
    expect(await s.findByText("Rope")).toBeInTheDocument();
    await user.type(s.getByLabelText("Add item"), "Pack");
    await user.click(s.getByRole("button", { name: "Add pack" }));
    await user.type(await s.findByLabelText("Add item in Pack"), "Torch{Enter}");
    expect(await s.findByText("Torch")).toBeInTheDocument();
    await user.click(s.getByRole("button", { name: "Remove Torch from Pack" }));
    await user.click(s.getByRole("button", { name: "Confirm remove Torch from Pack" }));
    await user.click(s.getByRole("button", { name: "Remove Rope" }));
    await user.click(s.getByRole("button", { name: "Cancel remove Rope" }));
    expect(s.getByText("Rope")).toBeInTheDocument();
    await user.click(s.getByRole("button", { name: "Remove Rope" }));
    await user.click(s.getByRole("button", { name: "Confirm remove Rope" }));
    await user.type(s.getByLabelText("Add attack"), "Dagger{Enter}");
    expect(await s.findByText(/^Dagger/)).toBeInTheDocument();
    expect(s.queryByLabelText("Attack bonus of Dagger")).not.toBeInTheDocument();
    expect(s.getByLabelText("Ability of Dagger")).toHaveValue("str");
    await user.type(s.getByLabelText("Add language"), "Elvish{Enter}");
    await user.click(await s.findByRole("button", { name: "Remove Elvish" }));
    await user.click(s.getByRole("button", { name: "Confirm remove Elvish" }));
    await waitFor(() => expect(s.queryByText("Elvish")).not.toBeInTheDocument());
    expect(s.queryByText("Rope")).not.toBeInTheDocument();
    expect(s.queryByText("Torch")).not.toBeInTheDocument();
  });
});

describe("Coin on the character sheet", () => {
  it("gains, spends and edits coin without opening Edit sheet", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Purse");
    await user.click(screen.getByRole("button", { name: /^party/i }));
    const panel = await screen.findByRole("region", { name: /character sheets/i });
    const p = within(panel);
    await user.click(p.getByRole("button", { name: /add character/i }));
    await user.type(p.getByLabelText("Name"), "Bram");
    await user.click(p.getByRole("button", { name: /save member/i }));
    const sheet = within(await p.findByRole("article", { name: "Bram character sheet" }));

    await user.type(sheet.getByLabelText("Coin amount for Bram"), "30");
    await user.click(sheet.getByRole("button", { name: "Gain" }));
    await waitFor(() => expect(sheet.getByLabelText("gp Bram")).toHaveValue(30));

    await user.type(sheet.getByLabelText("Coin amount for Bram"), "12");
    await user.click(sheet.getByRole("button", { name: "Spend" }));
    await waitFor(() => expect(sheet.getByLabelText("gp Bram")).toHaveValue(18));

    await user.type(sheet.getByLabelText("Coin amount for Bram"), "5");
    await user.selectOptions(sheet.getByLabelText("Coin type for Bram"), "pp");
    await user.click(sheet.getByRole("button", { name: "Spend" }));
    expect(sheet.getByRole("alert")).toHaveTextContent("Not enough pp");

    await user.clear(sheet.getByLabelText("sp Bram"));
    await user.type(sheet.getByLabelText("sp Bram"), "7{Enter}");
    await waitFor(() => expect(sheet.getByLabelText("sp Bram")).toHaveValue(7));
    expect(sheet.getByLabelText("gp Bram")).toHaveValue(18);
  });
});

describe("Item counts on the character sheet", () => {
  it("changes counts of items and pack contents without opening Edit sheet", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Counts");
    await user.click(screen.getByRole("button", { name: /^party/i }));
    const panel = await screen.findByRole("region", { name: /character sheets/i });
    const p = within(panel);
    await user.click(p.getByRole("button", { name: /add character/i }));
    await user.type(p.getByLabelText("Name"), "Bram");
    await user.click(p.getByRole("button", { name: /save member/i }));
    const sheet = within(await p.findByRole("article", { name: "Bram character sheet" }));

    await user.type(sheet.getByLabelText("Add item"), "Torch{Enter}");
    expect(await sheet.findByLabelText("Quantity of Torch")).toHaveValue(1);
    expect(sheet.getByRole("button", { name: "Decrease Torch" })).toBeDisabled();
    await user.click(sheet.getByRole("button", { name: "Increase Torch" }));
    await waitFor(() => expect(sheet.getByLabelText("Quantity of Torch")).toHaveValue(2));
    await user.clear(sheet.getByLabelText("Quantity of Torch"));
    await user.type(sheet.getByLabelText("Quantity of Torch"), "10{Enter}");
    await waitFor(() => expect(sheet.getByLabelText("Quantity of Torch")).toHaveValue(10));
    await user.click(sheet.getByRole("button", { name: "Decrease Torch" }));
    await waitFor(() => expect(sheet.getByLabelText("Quantity of Torch")).toHaveValue(9));

    await user.type(sheet.getByLabelText("Add item"), "Trail Kit");
    await user.click(sheet.getByRole("button", { name: "Add pack" }));
    await user.type(await sheet.findByLabelText("Add item in Trail Kit"), "Rations{Enter}");
    await user.click(await sheet.findByRole("button", { name: "Increase Rations in Trail Kit" }));
    await waitFor(() => expect(sheet.getByLabelText("Quantity of Rations in Trail Kit")).toHaveValue(2));
    expect(sheet.getByLabelText("Quantity of Torch")).toHaveValue(9);
  });
});

describe("SRD packs", () => {
  afterEach(() => setReferenceSource(null));
  it("adds an SRD pack with its contents, from the sheet and from Edit sheet", async () => {
    setReferenceSource(async () => FIXTURE_REFERENCE);
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Packs");
    await user.click(screen.getByRole("button", { name: /^party/i }));
    const p = within(await screen.findByRole("region", { name: /character sheets/i }));
    await user.click(p.getByRole("button", { name: /add character/i }));
    await user.type(p.getByLabelText("Name"), "Vex");
    const box = p.getByLabelText("New item");
    await waitFor(() => expect(document.getElementById(box.getAttribute("list")!)?.querySelector("option[value=\"Explorer's Pack\"]")).toBeTruthy());
    await user.type(box, "explorer's pack{Enter}");
    expect(p.getByRole("button", { name: "Collapse Explorer's Pack" })).toHaveTextContent("(pack)");
    expect(p.getByLabelText("Count of Rations in Explorer's Pack")).toHaveValue(10);
    await user.click(p.getByRole("button", { name: /save member/i }));

    const s = within(await p.findByRole("article", { name: /vex character sheet/i }));
    expect(within(s.getByRole("list", { name: "Explorer's Pack contents" })).getByText("Backpack")).toBeInTheDocument();
    await user.type(s.getByLabelText("Add item"), "Explorer's Pack{Enter}");
    await waitFor(() => expect(s.getAllByRole("button", { name: "Collapse Explorer's Pack" })).toHaveLength(2));
    expect(s.getAllByLabelText("Quantity of Torch in Explorer's Pack")[1]).toHaveValue(10);
  });
});
