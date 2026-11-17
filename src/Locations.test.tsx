import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import App from "./App";
import { createNpc as seedNpc, emptyNpcDraft } from "./storage/npcs";

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

const modes = () => within(screen.getByRole("navigation", { name: /modes/i }));
async function openCampaign(user: User, name: string) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), name);
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText(name);
  await user.click(within(screen.getByRole("listitem", { name })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
}
async function openPrep(user: User) {
  await user.click(modes().getByRole("button", { name: /prep/i }));
  await screen.findByRole("region", { name: /^locations$/i });
}
const locs = () => within(screen.getByRole("region", { name: /^locations$/i }));
const view = () => within(screen.getByRole("region", { name: /^location$/i }));
const npcList = () => within(screen.getByRole("region", { name: /^npcs$/i }));
const card = () => within(screen.getByRole("region", { name: /npc card/i }));

async function addLocation(user: User, name: string) {
  await user.type(locs().getByLabelText(/new location name/i), name);
  await user.click(locs().getByRole("button", { name: /add location/i }));
  await view().findByRole("heading", { name });
}
async function editLocation(user: User, name: string, notes?: string) {
  await user.click(view().getByRole("button", { name: /edit/i }));
  const n = view().getByLabelText(/^name/i);
  await user.clear(n);
  await user.type(n, name);
  if (notes !== undefined) {
    const t = view().getByLabelText(/^notes/i);
    await user.clear(t);
    await user.type(t, notes);
  }
  await user.click(view().getByRole("button", { name: /save/i }));
  await view().findByRole("heading", { name });
}
async function addNpc(user: User, name: string, location?: string) {
  await user.click(npcList().getByRole("button", { name: /new npc/i }));
  await user.type(card().getByLabelText(/^name/i), name);
  if (location) await user.selectOptions(card().getByLabelText(/^location/i), location);
  await user.click(card().getByRole("button", { name: /save/i }));
  await card().findByRole("heading", { name });
}
const pickLocation = (user: User, name: string) => user.click(locs().getByRole("button", { name: new RegExp(`^${name}`) }));

describe("Locations in Prep mode", () => {
  it("shows an empty state, then creates a location with notes", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await openPrep(user);
    expect(locs().getByText(/no locations yet/i)).toBeInTheDocument();
    await addLocation(user, "Phandalin");
    await editLocation(user, "Phandalin", "A frontier town under threat");
    expect(view().getByText("A frontier town under threat")).toBeInTheDocument();
    expect(locs().getByRole("button", { name: /phandalin/i })).toBeInTheDocument();
  });

  it("edits and deletes a location after confirmation", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await openPrep(user);
    await addLocation(user, "Phandalin");
    await editLocation(user, "Phandalin Town");
    expect(locs().getByRole("button", { name: /phandalin town/i })).toBeInTheDocument();
    await user.click(view().getByRole("button", { name: /delete/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /delete location/i }));
    expect(await locs().findByText(/no locations yet/i)).toBeInTheDocument();
    expect(view().getByText(/select a location/i)).toBeInTheDocument();
  });

  it("links an NPC from the card, shows it in the location view and unlinks it", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await openPrep(user);
    await addLocation(user, "Phandalin");
    await addNpc(user, "Elda", "Phandalin");
    expect(card().getByText("Phandalin")).toBeInTheDocument();
    await pickLocation(user, "Phandalin");
    expect(await view().findByRole("button", { name: "Elda" })).toBeInTheDocument();
    await user.click(view().getByRole("button", { name: /unlink elda/i }));
    expect(await view().findByText(/no npcs linked/i)).toBeInTheDocument();
    expect(card().queryByText("Phandalin")).not.toBeInTheDocument();
  });

  it("links an existing NPC from the location view", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await openPrep(user);
    await addNpc(user, "Bram");
    await addLocation(user, "Neverwinter");
    await user.selectOptions(view().getByLabelText(/npc to link here/i), "Bram");
    await user.click(view().getByRole("button", { name: /link npc/i }));
    expect(await view().findByRole("button", { name: "Bram" })).toBeInTheDocument();
    await user.selectOptions(npcList().getByLabelText(/filter by location/i), "Neverwinter");
    expect(npcList().getByRole("button", { name: /bram/i })).toBeInTheDocument();
  });

  it("renaming a location updates its NPCs' tag", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await openPrep(user);
    await addLocation(user, "Phandalin");
    await addNpc(user, "Elda", "Phandalin");
    await pickLocation(user, "Phandalin");
    await editLocation(user, "New Phandalin");
    expect(await card().findByText("New Phandalin")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: /^npcs$/i })).getByRole("option", { name: "New Phandalin" })).toBeInTheDocument();
  });

  it("deleting a location unlinks its NPCs but keeps the old tag as free text", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await openPrep(user);
    await addLocation(user, "Phandalin");
    await addNpc(user, "Elda", "Phandalin");
    await pickLocation(user, "Phandalin");
    await user.click(view().getByRole("button", { name: /delete/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /delete location/i }));
    await locs().findByText(/no locations yet/i);
    await user.click(npcList().getByRole("button", { name: /elda/i }));
    expect(card().getByText("Phandalin")).toBeInTheDocument();
    // the legacy tag still filters, and shows as free text in the form
    await user.selectOptions(npcList().getByLabelText(/filter by location/i), "Phandalin");
    expect(npcList().getByRole("button", { name: /elda/i })).toBeInTheDocument();
    await user.click(card().getByRole("button", { name: /edit/i }));
    expect(card().getByRole("option", { name: /phandalin \(free text\)/i })).toBeInTheDocument();
  });

  it("keeps legacy free-text tags displayed and lets them be relinked to a real location", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    // seed a legacy NPC through storage (as data created before locations existed)
    const { listCampaigns } = await import("./storage");
    const [c] = await listCampaigns();
    await seedNpc(c.id, { ...emptyNpcDraft(), name: "Old Hand", locationTag: "Waterdeep" });
    await openPrep(user);
    await addLocation(user, "Waterdeep");
    await user.click(await npcList().findByRole("button", { name: /old hand/i }));
    expect(card().getByText("Waterdeep")).toBeInTheDocument();
    await user.click(card().getByRole("button", { name: /edit/i }));
    await user.selectOptions(card().getByLabelText(/^location/i), "Waterdeep");
    await user.click(card().getByRole("button", { name: /save/i }));
    await pickLocation(user, "Waterdeep");
    expect(await view().findByRole("button", { name: "Old Hand" })).toBeInTheDocument();
  });

  it("is isolated per Campaign and persists across reload", async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    await openCampaign(user, "Alpha");
    await openPrep(user);
    await addLocation(user, "Phandalin");
    first.unmount();

    render(<App />);
    await screen.findByText("Alpha");
    await user.click(within(screen.getByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
    await modes().findByRole("button", { name: /prep/i });
    await user.click(modes().getByRole("button", { name: /prep/i }));
    expect(await locs().findByRole("button", { name: /phandalin/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /all campaigns/i }));
    await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), "Beta");
    await user.click(screen.getByRole("button", { name: /create campaign/i }));
    await screen.findByText("Beta");
    await user.click(within(screen.getByRole("listitem", { name: "Beta" })).getByRole("button", { name: /open/i }));
    await user.click(modes().getByRole("button", { name: /prep/i }));
    expect(await locs().findByText(/no locations yet/i)).toBeInTheDocument();
  });

  it("includes locations and NPC links in export and import", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await openPrep(user);
    await addLocation(user, "Phandalin");
    await editLocation(user, "Phandalin", "Frontier town");
    await addNpc(user, "Elda", "Phandalin");
    await user.click(screen.getByRole("button", { name: /all campaigns/i }));
    await user.click(within(await screen.findByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /export/i }));
    const text = await blobs[0].text();
    await user.click(within(screen.getByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /delete/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /delete campaign/i }));
    await screen.findByText(/no campaigns yet/i);
    await user.upload(screen.getByLabelText(/import campaign file/i), new File([text], "c.json", { type: "application/json" }));
    await user.click(within(await screen.findByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
    await user.click(modes().getByRole("button", { name: /prep/i }));
    await pickLocation(user, "Phandalin");
    expect(await view().findByText("Frontier town")).toBeInTheDocument();
    expect(view().getByRole("button", { name: "Elda" })).toBeInTheDocument();
  });
});
