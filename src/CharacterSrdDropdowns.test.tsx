import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { listCampaigns } from "./storage";
import { addPartyMember, listParty } from "./storage/party";

beforeEach(() => localStorage.clear());

async function open(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), name);
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText(name);
  const id = (await listCampaigns()).find((c) => c.name === name)!.id;
  return id;
}
async function goParty(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(within(screen.getByRole("listitem", { name })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: "Dashboard" });
  await user.click(screen.getByRole("button", { name: /^party/i }));
  return within(await screen.findByRole("region", { name: /character sheets/i }));
}

describe("Class, Background and Species dropdowns", () => {
  it("saves an SRD pick as name and id", async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = await open(user, "Srd1");
    const p = await goParty(user, "Srd1");
    await user.click(p.getByRole("button", { name: /add character/i }));
    await user.type(p.getByLabelText("Name"), "Mira");
    await user.selectOptions(await p.findByRole("combobox", { name: "Class" }), "Mage Test");
    await user.selectOptions(p.getByLabelText("Background"), "Acolyte Test");
    await user.selectOptions(p.getByLabelText("Species"), "Drakeling Test");
    await user.click(p.getByRole("button", { name: /save member/i }));
    expect(await p.findByRole("article", { name: /mira character sheet/i })).toHaveTextContent(/Drakeling Test.*Mage Test 1.*Acolyte Test/);
    const [m] = await listParty(id);
    expect(m).toMatchObject({ class: "Mage Test", classId: "test-mage", background: "Acolyte Test", backgroundId: "test-acolyte", race: "Drakeling Test", speciesId: "test-drake" });
  });

  it("Custom shows a text box and saves the typed name with no id", async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = await open(user, "Srd2");
    const p = await goParty(user, "Srd2");
    await user.click(p.getByRole("button", { name: /add character/i }));
    await user.type(p.getByLabelText("Name"), "Vex");
    expect(p.queryByLabelText("Custom class")).not.toBeInTheDocument();
    await user.selectOptions(await p.findByRole("combobox", { name: "Class" }), "Mage Test");
    await user.selectOptions(p.getByLabelText("Class"), "Custom…");
    await user.type(p.getByLabelText("Custom class"), "Hexblade Knight");
    await user.click(p.getByRole("button", { name: /save member/i }));
    expect(await p.findByRole("article", { name: /vex character sheet/i })).toHaveTextContent("Hexblade Knight 1");
    const [m] = await listParty(id);
    expect(m.class).toBe("Hexblade Knight");
    expect(m.classId).toBeUndefined();
  });

  it("reads legacy text: 'mage test' is Mage Test, 'Hexblade Knight' is Custom", async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = await open(user, "Srd3");
    const base = { level: 1, ac: 10, maxHp: 5, passivePerception: 10, notes: "" };
    await addPartyMember(id, { ...base, name: "Old", class: "mage test" });
    await addPartyMember(id, { ...base, name: "Odd", class: "Hexblade Knight" });
    const p = await goParty(user, "Srd3");
    await user.click(within(await p.findByRole("listitem", { name: "Old" })).getByRole("button", { name: /^Old/ }));
    await user.click(await p.findByRole("button", { name: /^edit old sheet$/i }));
    expect(await p.findByRole("combobox", { name: "Class" })).toHaveValue("test-mage");
    expect(p.queryByLabelText("Custom class")).not.toBeInTheDocument();
    await user.click(p.getByRole("button", { name: /cancel/i }));
    await user.click(within(await p.findByRole("listitem", { name: "Odd" })).getByRole("button", { name: /^Odd/ }));
    await user.click(await p.findByRole("button", { name: /^edit .* sheet$/i }));
    expect(await p.findByRole("combobox", { name: "Class" })).toHaveValue("__custom");
    expect(p.getByLabelText("Custom class")).toHaveValue("Hexblade Knight");
  });

  it("a species with types offers them; picking one saves it and shows on the card", async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = await open(user, "Srd4");
    const p = await goParty(user, "Srd4");
    await user.click(p.getByRole("button", { name: /add character/i }));
    await user.type(p.getByLabelText("Name"), "Kava");
    await user.selectOptions(await p.findByRole("combobox", { name: "Species" }), "Spritekin Test");
    expect(p.queryByRole("combobox", { name: "Ancestor Test" })).not.toBeInTheDocument();
    await user.selectOptions(p.getByLabelText("Species"), "Drakeling Test");
    await user.selectOptions(p.getByRole("combobox", { name: "Ancestor Test" }), "Red (Fire)");
    await user.click(p.getByRole("button", { name: /save member/i }));
    expect(await p.findByRole("article", { name: /kava character sheet/i })).toHaveTextContent("Drakeling Test (Red)");
    const [m] = await listParty(id);
    expect(m).toMatchObject({ speciesId: "test-drake", subspeciesId: "test-drake-red", subspecies: "Ancestor Test: Red" });
    expect(m.autoFeatures).toContain("Flame Breath Test");
  });
});
