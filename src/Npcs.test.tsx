import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import App from "./App";

type User = ReturnType<typeof userEvent.setup>;

let blobs: Blob[] = [];
beforeEach(() => {
  blobs = [];
  localStorage.clear();
  URL.createObjectURL = vi.fn((b: Blob) => (blobs.push(b), "blob:test"));
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

async function openCampaign(user: User, name: string) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), name);
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText(name);
  await user.click(within(screen.getByRole("listitem", { name })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
}
async function openPrep(user: User) {
  await user.click(within(screen.getByRole("navigation", { name: /modes/i })).getByRole("button", { name: /prep/i }));
  await screen.findByRole("region", { name: /^npcs$/i });
}
const list = () => screen.getByRole("region", { name: /^npcs$/i });
const card = () => screen.getByRole("region", { name: /npc card/i });

interface Fields { name: string; role?: string; appearance?: string; motivation?: string; notes?: string; faction?: string; location?: string }
async function fill(user: User, f: Fields) {
  const c = within(card());
  const set = async (label: RegExp, v?: string) => {
    if (v === undefined) return;
    const el = c.getByLabelText(label);
    await user.clear(el);
    await user.type(el, v);
  };
  await set(/^name/i, f.name);
  await set(/^role/i, f.role);
  await set(/^appearance/i, f.appearance);
  await set(/^motivation/i, f.motivation);
  await set(/^notes/i, f.notes);
  await set(/^faction/i, f.faction);
  if (f.location !== undefined) await user.selectOptions(c.getByLabelText(/^location/i), f.location);
}
/** Arrange: a location must exist before an NPC can be linked to it. */
async function addLocation(user: User, name: string) {
  const region = within(screen.getByRole("region", { name: /^locations$/i }));
  await user.type(region.getByLabelText(/new location name/i), name);
  await user.click(region.getByRole("button", { name: /add location/i }));
  await region.findByRole("button", { name: new RegExp(`^${name}`) });
}
async function createNpc(user: User, f: Fields, secrets: string[] = []) {
  await user.click(within(list()).getByRole("button", { name: /new npc/i }));
  await fill(user, f);
  for (const s of secrets) {
    await user.type(within(card()).getByLabelText(/new secret/i), s);
    await user.click(within(card()).getByRole("button", { name: /add secret/i }));
  }
  await user.click(within(card()).getByRole("button", { name: /save/i }));
  await within(card()).findByRole("heading", { name: f.name });
}
const pick = (user: User, name: string) => user.click(within(list()).getByRole("button", { name: new RegExp(`^${name}`) }));

describe("NPC cards in Prep mode", () => {
  it("shows the NPC list and card in one panel with an empty state", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await openPrep(user);
    expect(list()).toBeInTheDocument();
    expect(card()).toBeInTheDocument();
    expect(list()).toContainElement(card());
    expect(document.querySelector('[data-panel-id="npc-card"]')).toBeNull();
    expect(within(list()).getByText(/no npcs yet/i)).toBeInTheDocument();
  });

  it("creates an NPC, lists it and shows its card", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await openPrep(user);
    await addLocation(user, "Phandalin");
    await createNpc(user, { name: "Elda", role: "Innkeeper", appearance: "Tall, grey braid", motivation: "Protect the inn", notes: "Knows rumours", faction: "Harpers", location: "Phandalin" });
    expect(within(list()).getByRole("button", { name: /elda/i })).toBeInTheDocument();
    const c = within(card());
    expect(c.getByText("Innkeeper")).toBeInTheDocument();
    expect(c.getByText("Tall, grey braid")).toBeInTheDocument();
    expect(c.getByText("Protect the inn")).toBeInTheDocument();
    expect(c.getByText("Knows rumours")).toBeInTheDocument();
    expect(c.getByText("Harpers")).toBeInTheDocument();
    expect(c.getByText("Phandalin")).toBeInTheDocument();
  });

  it("selecting an NPC in the list shows it in the card", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await openPrep(user);
    await createNpc(user, { name: "Elda" });
    await createNpc(user, { name: "Bram" });
    expect(within(card()).getByRole("heading", { name: "Bram" })).toBeInTheDocument();
    await pick(user, "Elda");
    expect(within(card()).getByRole("heading", { name: "Elda" })).toBeInTheDocument();
  });

  it("edits an NPC", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await openPrep(user);
    await createNpc(user, { name: "Elda", role: "Innkeeper" });
    await user.click(within(card()).getByRole("button", { name: /edit/i }));
    await fill(user, { name: "Elda Voss", role: "Spy" });
    await user.click(within(card()).getByRole("button", { name: /save/i }));
    expect(await within(card()).findByRole("heading", { name: "Elda Voss" })).toBeInTheDocument();
    expect(within(card()).getByText("Spy")).toBeInTheDocument();
    expect(within(list()).getByRole("button", { name: /elda voss/i })).toBeInTheDocument();
  });

  it("deletes an NPC after confirmation", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await openPrep(user);
    await createNpc(user, { name: "Elda" });
    await user.click(within(card()).getByRole("button", { name: /delete/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /delete npc/i }));
    expect(await within(list()).findByText(/no npcs yet/i)).toBeInTheDocument();
    expect(within(card()).queryByRole("heading", { name: "Elda" })).not.toBeInTheDocument();
  });

  it("searches by name and filters by faction and location tag", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await openPrep(user);
    await addLocation(user, "Phandalin");
    await addLocation(user, "Neverwinter");
    await createNpc(user, { name: "Elda", faction: "Harpers", location: "Phandalin" });
    await createNpc(user, { name: "Bram", faction: "Zhentarim", location: "Phandalin" });
    await createNpc(user, { name: "Cora", faction: "Harpers", location: "Neverwinter" });

    await user.type(within(list()).getByRole("searchbox", { name: /search npcs/i }), "br");
    expect(within(list()).getByRole("button", { name: /bram/i })).toBeInTheDocument();
    expect(within(list()).queryByRole("button", { name: /elda/i })).not.toBeInTheDocument();
    await user.clear(within(list()).getByRole("searchbox", { name: /search npcs/i }));

    await user.selectOptions(within(list()).getByLabelText(/filter by faction/i), "Harpers");
    expect(within(list()).queryByRole("button", { name: /bram/i })).not.toBeInTheDocument();
    expect(within(list()).getAllByRole("button", { name: /elda|cora/i })).toHaveLength(2);

    await user.selectOptions(within(list()).getByLabelText(/filter by location/i), "Neverwinter");
    expect(within(list()).getAllByRole("button", { name: /elda|bram|cora/i })).toHaveLength(1);
    expect(within(list()).getByRole("button", { name: /cora/i })).toBeInTheDocument();
  });

  it("marks secrets revealed or hidden", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await openPrep(user);
    await createNpc(user, { name: "Elda" }, ["Is a vampire", "Owes a debt"]);
    const c = within(card());
    expect(c.getByRole("checkbox", { name: /is a vampire/i })).not.toBeChecked();
    await user.click(c.getByRole("checkbox", { name: /is a vampire/i }));
    expect(c.getByRole("checkbox", { name: /is a vampire/i })).toBeChecked();
    expect(c.getByRole("checkbox", { name: /owes a debt/i })).not.toBeChecked();
    expect(c.getByText(/revealed/i)).toBeInTheDocument();
    await user.click(c.getByRole("checkbox", { name: /is a vampire/i }));
    expect(c.getByRole("checkbox", { name: /is a vampire/i })).not.toBeChecked();
  });

  it("persists NPCs and revealed secrets per Campaign across reload", async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    await openCampaign(user, "Alpha");
    await openPrep(user);
    await createNpc(user, { name: "Elda", faction: "Harpers" }, ["Is a vampire"]);
    await user.click(within(card()).getByRole("checkbox", { name: /is a vampire/i }));
    first.unmount();

    render(<App />);
    await screen.findByText("Alpha");
    await user.click(within(screen.getByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
    await user.click(within(screen.getByRole("navigation", { name: /modes/i })).getByRole("button", { name: /prep/i }));
    await screen.findByRole("region", { name: /^npcs$/i });
    await pick(user, "Elda");
    expect(within(card()).getByRole("checkbox", { name: /is a vampire/i })).toBeChecked();

    // a second Campaign has none
    await user.click(screen.getByRole("button", { name: /all campaigns/i }));
    await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), "Beta");
    await user.click(screen.getByRole("button", { name: /create campaign/i }));
    await screen.findByText("Beta");
    await user.click(within(screen.getByRole("listitem", { name: "Beta" })).getByRole("button", { name: /open/i }));
    await user.click(within(screen.getByRole("navigation", { name: /modes/i })).getByRole("button", { name: /prep/i }));
    expect(await within(list()).findByText(/no npcs yet/i)).toBeInTheDocument();
  });

  it("includes NPCs in export and import", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await openPrep(user);
    await addLocation(user, "Phandalin");
    await createNpc(user, { name: "Elda", location: "Phandalin" }, ["Is a vampire"]);
    await user.click(screen.getByRole("button", { name: /all campaigns/i }));
    await user.click(within(await screen.findByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /export/i }));
    const text = await blobs[0].text();
    await user.click(within(screen.getByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /delete/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /delete campaign/i }));
    await screen.findByText(/no campaigns yet/i);
    await user.upload(screen.getByLabelText(/import campaign file/i), new File([text], "c.json", { type: "application/json" }));
    await user.click(within(await screen.findByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
    await user.click(within(screen.getByRole("navigation", { name: /modes/i })).getByRole("button", { name: /prep/i }));
    await screen.findByRole("region", { name: /^npcs$/i });
    await pick(user, "Elda");
    expect(within(card()).getByText("Phandalin")).toBeInTheDocument();
    expect(within(card()).getByRole("checkbox", { name: /is a vampire/i })).toBeInTheDocument();
  });
});
