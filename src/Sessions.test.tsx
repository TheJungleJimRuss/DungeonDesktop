import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import App from "./App";
import { createNpc as seedNpc, emptyNpcDraft } from "./storage/npcs";
import { createLocation as seedLocation } from "./storage/locations";
import { listCampaigns } from "./storage";

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
  await openExisting(user, name);
}
async function openExisting(user: User, name: string) {
  await user.click(within(await screen.findByRole("listitem", { name })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
}
async function openPrep(user: User) {
  await user.click(modes().getByRole("button", { name: /prep/i }));
  await screen.findByRole("region", { name: /^scenes$/i });
}
const sessions = () => within(screen.getByRole("region", { name: /^sessions$/i }));
const scenes = () => within(screen.getByRole("region", { name: /^scenes$/i }));
const summary = () => within(screen.getByRole("region", { name: /session summary/i }));
async function toDashboard(user: User) {
  await user.click(screen.getByRole("button", { name: /^dashboard/i }));
  await screen.findByRole("heading", { name: /^dashboard$/i });
}

async function addSession(user: User, title: string) {
  await user.type(sessions().getByLabelText(/new session title/i), title);
  await user.click(sessions().getByRole("button", { name: /add session/i }));
  await sessions().findByDisplayValue(title);
}
async function addScene(user: User, o: { title: string; goal?: string; notes?: string; secrets?: string[]; clues?: string[]; location?: string; npcs?: string[] }) {
  await user.click(await scenes().findByRole("button", { name: /add scene/i }));
  await user.type(scenes().getByLabelText(/scene title/i), o.title);
  if (o.goal) await user.type(scenes().getByLabelText(/^goal/i), o.goal);
  if (o.notes) await user.type(scenes().getByLabelText(/^notes/i), o.notes);
  for (const s of o.secrets ?? []) {
    await user.type(scenes().getByLabelText(/new secret/i), s);
    await user.click(scenes().getByRole("button", { name: /add secret/i }));
  }
  for (const c of o.clues ?? []) {
    await user.type(scenes().getByLabelText(/new clue/i), c);
    await user.click(scenes().getByRole("button", { name: /add clue/i }));
  }
  if (o.location) await user.selectOptions(scenes().getByLabelText(/scene location/i), o.location);
  for (const n of o.npcs ?? []) await user.click(scenes().getByRole("checkbox", { name: n }));
  await user.click(scenes().getByRole("button", { name: /save scene/i }));
  await scenes().findByRole("article", { name: `Scene ${o.title}` });
}
const order = () => within(screen.getByRole("region", { name: /^scenes$/i })).getAllByRole("heading", { level: 4 }).map((h) => h.textContent);

describe("Sessions and scenes", () => {
  it("creates sessions, edits title and summary, and marks one current", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await openPrep(user);
    expect(sessions().getByText(/no sessions yet/i)).toBeInTheDocument();
    await addSession(user, "Goblin Ambush");
    expect(sessions().getByRole("button", { name: /goblin ambush \(current\)/i })).toBeInTheDocument();
    await addSession(user, "Cragmaw Hideout");
    expect(sessions().queryByRole("button", { name: /cragmaw hideout \(current\)/i })).not.toBeInTheDocument();
    await user.type(sessions().getByLabelText(/^summary/i), "Into the cave");
    await user.click(sessions().getByRole("button", { name: /save session/i }));
    await user.click(sessions().getByRole("button", { name: /mark as current/i }));
    expect(await sessions().findByRole("button", { name: /cragmaw hideout \(current\)/i })).toBeInTheDocument();
    expect(sessions().getByRole("button", { name: /^goblin ambush$/i })).toBeInTheDocument();
    await toDashboard(user);
    expect(await summary().findByText("Cragmaw Hideout")).toBeInTheDocument();
    expect(summary().getByText("Into the cave")).toBeInTheDocument();
  });

  it("adds, edits and deletes scenes", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await openPrep(user);
    expect(scenes().getByText(/create a session/i)).toBeInTheDocument();
    await addSession(user, "S1");
    await addScene(user, { title: "Ambush", goal: "Survive", notes: "Wolves", secrets: ["Chief is a wolf"], clues: ["Tracks"] });
    const sc = () => within(scenes().getByRole("article", { name: /scene ambush/i }));
    expect(sc().getByText("Survive")).toBeInTheDocument();
    expect(sc().getByRole("checkbox", { name: "Chief is a wolf" })).not.toBeChecked();
    await user.click(scenes().getByRole("button", { name: /edit ambush/i }));
    const t = scenes().getByLabelText(/scene title/i);
    await user.clear(t);
    await user.type(t, "Ambush at dawn");
    await user.click(scenes().getByRole("button", { name: /save scene/i }));
    await scenes().findByRole("article", { name: "Scene Ambush at dawn" });
    await user.click(scenes().getByRole("button", { name: /^delete ambush at dawn/i }));
    await user.click(scenes().getByRole("button", { name: /confirm delete/i }));
    expect(await scenes().findByText(/no scenes yet/i)).toBeInTheDocument();
  });

  it("reorders scenes with the move buttons and by dragging", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await openPrep(user);
    await addSession(user, "S1");
    for (const t of ["A", "B", "C"]) await addScene(user, { title: t });
    expect(order()).toEqual(["A", "B", "C"]);
    expect(scenes().getByRole("button", { name: /move a up/i })).toBeDisabled();
    await user.click(scenes().getByRole("button", { name: /move c up/i }));
    await vi.waitFor(() => expect(order()).toEqual(["A", "C", "B"]));
    await user.click(scenes().getByRole("button", { name: /move a down/i }));
    await vi.waitFor(() => expect(order()).toEqual(["C", "A", "B"]));
    const items = scenes().getAllByRole("listitem").filter((li) => li.classList.contains("scene"));
    fireEvent.dragStart(items[2]);
    fireEvent.dragOver(items[0]);
    fireEvent.drop(items[0]);
    await vi.waitFor(() => expect(order()).toEqual(["B", "C", "A"]));
  });

  it("ticks secrets and clues, marks scenes played, and the Dashboard shows what is left", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await toDashboard(user);
    expect(summary().getByText(/no current session/i)).toBeInTheDocument();
    await openPrep(user);
    await addSession(user, "S1");
    await addScene(user, { title: "One", secrets: ["s1"], clues: ["c1"] });
    await addScene(user, { title: "Two", secrets: ["s2"] });
    await toDashboard(user);
    expect(await summary().findByText(/unplayed scenes: 2/i)).toBeInTheDocument();
    expect(summary().getByText(/unticked secrets and clues: 3/i)).toBeInTheDocument();
    await openPrep(user);
    await user.click(scenes().getByRole("checkbox", { name: "s1" }));
    await user.click(scenes().getByRole("checkbox", { name: "c1" }));
    await user.click(scenes().getByRole("checkbox", { name: /played one/i }));
    expect(await scenes().findByRole("checkbox", { name: "s1" })).toBeChecked();
    await toDashboard(user);
    expect(await summary().findByText(/unplayed scenes: 1/i)).toBeInTheDocument();
    expect(summary().getByText(/unticked secrets and clues: 1/i)).toBeInTheDocument();
  });

  it("links a scene to a location and NPCs by name, and survives deletions", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    const camp = (await listCampaigns())[0];
    await seedLocation(camp.id, { name: "Phandalin", notes: "" });
    await seedNpc(camp.id, { ...emptyNpcDraft(), name: "Elda" });
    await seedNpc(camp.id, { ...emptyNpcDraft(), name: "Gundren" });
    await openPrep(user);
    await addSession(user, "S1");
    await addScene(user, { title: "Arrival", location: "Phandalin", npcs: ["Elda", "Gundren"] });
    const sc = within(scenes().getByRole("article", { name: /scene arrival/i }));
    expect(sc.getByText("Phandalin")).toBeInTheDocument();
    expect(sc.getByText(/Elda/)).toBeInTheDocument();
    expect(sc.getByText(/Gundren/)).toBeInTheDocument();
    // delete the location and an NPC through the app
    await user.click(screen.getByRole("button", { name: /^phandalin/i }));
    await user.click(within(screen.getByRole("region", { name: /^locations$/i })).getByRole("button", { name: /^delete/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /delete/i }));
    expect(await sc.findByText("Deleted location")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^elda/i }));
    await user.click(within(screen.getByRole("region", { name: /npc card/i })).getByRole("button", { name: /^delete/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /delete/i }));
    expect(await sc.findByText("Deleted NPC")).toBeInTheDocument();
    expect(sc.getByText(/Gundren/)).toBeInTheDocument();
  });

  it("saves a post-session log", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await openPrep(user);
    await addSession(user, "S1");
    await user.type(sessions().getByLabelText(/post-session log/i), "The party fled");
    await user.click(sessions().getByRole("button", { name: /save log/i }));
    await user.click(screen.getByRole("button", { name: /all campaigns/i }));
    await openExisting(user, "Alpha");
    await openPrep(user);
    expect(await sessions().findByDisplayValue("The party fled")).toBeInTheDocument();
  });

  it("carries unplayed scenes and unticked items into a new current session", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await openPrep(user);
    await addSession(user, "Night 1");
    await addScene(user, { title: "Played", secrets: ["used", "unused"], clues: ["clue left"] });
    await addScene(user, { title: "Unplayed", secrets: ["done one", "open one"] });
    await user.click(scenes().getByRole("checkbox", { name: "used" }));
    await user.click(scenes().getByRole("checkbox", { name: "done one" }));
    await user.click(scenes().getByRole("checkbox", { name: /played played/i }));
    await user.click(sessions().getByRole("button", { name: /carry over/i }));
    // the new session is current and selected
    await sessions().findByRole("button", { name: /next after night 1 \(current\)/i });
    await scenes().findByRole("heading", { level: 3, name: "Next after Night 1" });
    expect(order()).toEqual(["Unplayed", "Carried over from Night 1"]);
    const un = within(scenes().getByRole("article", { name: "Scene Unplayed" }));
    expect(un.getByRole("checkbox", { name: "done one" })).toBeChecked();
    expect(un.getByRole("checkbox", { name: "open one" })).not.toBeChecked();
    const co = within(scenes().getByRole("article", { name: /carried over from night 1/i }));
    expect(co.getByRole("checkbox", { name: "unused" })).not.toBeChecked();
    expect(co.getByRole("checkbox", { name: "clue left" })).not.toBeChecked();
    expect(co.queryByRole("checkbox", { name: "used" })).not.toBeInTheDocument();
    // the old session keeps its played scene without the moved items
    await user.click(sessions().getByRole("button", { name: /^night 1$/i }));
    const old = within(await scenes().findByRole("article", { name: "Scene Played" }));
    expect(old.getByRole("checkbox", { name: "used" })).toBeChecked();
    expect(old.queryByRole("checkbox", { name: "unused" })).not.toBeInTheDocument();
    expect(scenes().queryByRole("article", { name: "Scene Unplayed" })).not.toBeInTheDocument();
  });

  it("persists per Campaign across reload and round-trips through export and import", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await openCampaign(user, "Alpha");
    await openPrep(user);
    await addSession(user, "Night 1");
    await addScene(user, { title: "Ambush", secrets: ["wolf"] });
    await user.click(screen.getByRole("button", { name: /all campaigns/i }));
    unmount();
    render(<App />);
    await openExisting(user, "Alpha");
    await openPrep(user);
    expect(await scenes().findByRole("article", { name: "Scene Ambush" })).toBeInTheDocument();
    // another Campaign sees nothing
    await user.click(screen.getByRole("button", { name: /all campaigns/i }));
    await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), "Beta");
    await user.click(screen.getByRole("button", { name: /create campaign/i }));
    await openExisting(user, "Beta");
    await openPrep(user);
    expect(sessions().getByText(/no sessions yet/i)).toBeInTheDocument();
    // export Alpha, delete, import
    await user.click(screen.getByRole("button", { name: /all campaigns/i }));
    await user.click(within(await screen.findByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /export/i }));
    const text = await blobs[0].text();
    await user.click(within(screen.getByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /delete/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /delete campaign/i }));
    await user.upload(screen.getByLabelText(/import campaign file/i), new File([text], "c.json", { type: "application/json" }));
    await openExisting(user, "Alpha");
    await openPrep(user);
    const sc = within(await scenes().findByRole("article", { name: "Scene Ambush" }));
    expect(sc.getByRole("checkbox", { name: "wolf" })).toBeInTheDocument();
    expect(sessions().getByRole("button", { name: /night 1 \(current\)/i })).toBeInTheDocument();
  });
});
