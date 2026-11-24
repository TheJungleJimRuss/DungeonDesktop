import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import App from "./App";
import { COLLECTIONS, getDb } from "./storage/db";
import { importCampaign, type CampaignExport } from "./storage/portability";

type User = ReturnType<typeof userEvent.setup>;

let blobs: Blob[] = [];
beforeEach(() => {
  blobs = [];
  URL.createObjectURL = vi.fn((b: Blob) => (blobs.push(b), "blob:test"));
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

async function createCampaign(user: User, name: string) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), name);
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText(name);
}
const upload = (user: User, content: string, name = "c.json") =>
  user.upload(screen.getByLabelText(/import campaign file/i), new File([content], name, { type: "application/json" }));
async function exportText(user: User, name: string) {
  await user.click(within(screen.getByRole("listitem", { name })).getByRole("button", { name: /export/i }));
  await waitFor(() => expect(blobs).toHaveLength(1));
  return blobs[0].text();
}

describe("Campaign export and import", () => {
  it("exports one JSON file with the whole Campaign", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createCampaign(user, "Strahd");
    const doc = JSON.parse(await exportText(user, "Strahd"));
    expect(doc.campaign.name).toBe("Strahd");
    expect(typeof doc.version).toBe("number");
  });

  it("round-trips a Campaign with its collection data", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createCampaign(user, "Round Trip");
    const text = await exportText(user, "Round Trip");
    const original = JSON.parse(text).campaign;
    // seed data in every collection, then export again
    const db = await getDb();
    const seed = (c: string) => ({ id: `${c}-1`, campaignId: original.id, label: `${c} row`, ...(c === "encounters" ? { mapId: "maps-1" } : {}) }); // an Encounter always stands on a Map
    for (const c of COLLECTIONS) await db.add(c, seed(c));
    blobs = [];
    const full = await exportText(user, "Round Trip");

    await user.click(within(screen.getByRole("listitem", { name: "Round Trip" })).getByRole("button", { name: /delete/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /delete campaign/i }));
    await screen.findByText(/no campaigns yet/i);
    for (const c of COLLECTIONS) expect(await db.getAll(c)).toHaveLength(0);

    await upload(user, full);
    expect(await screen.findByText("Round Trip")).toBeInTheDocument();
    expect(await db.get("campaigns", original.id)).toEqual(original);
    for (const c of COLLECTIONS) {
      expect(await db.getAll(c)).toEqual([seed(c)]);
    }
  });

  it("creates a Campaign from a valid file without a warning", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createCampaign(user, "Source");
    const text = await exportText(user, "Source");
    await user.click(within(screen.getByRole("listitem", { name: "Source" })).getByRole("button", { name: /delete/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /delete campaign/i }));
    await screen.findByText(/no campaigns yet/i);
    await upload(user, text);
    expect(await screen.findByText("Source")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("warns before overwriting, and cancel keeps the existing Campaign", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createCampaign(user, "Original");
    const text = await exportText(user, "Original");
    await user.click(within(screen.getByRole("listitem", { name: "Original" })).getByRole("button", { name: /rename/i }));
    const input = screen.getByRole("textbox", { name: /^campaign name$/i });
    await user.clear(input);
    await user.type(input, "Newer");
    await user.click(screen.getByRole("button", { name: /save/i }));
    await screen.findByText("Newer");

    await upload(user, text);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/overwrit/i);
    await user.click(within(dialog).getByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Newer")).toBeInTheDocument();
    expect(screen.queryByText("Original")).not.toBeInTheDocument();

    await upload(user, text);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /overwrite/i }));
    expect(await screen.findByText("Original")).toBeInTheDocument();
    expect(screen.queryByText("Newer")).not.toBeInTheDocument();
  });

  it.each([
    ["not JSON", "hello {", /not valid json/i],
    ["a different kind of JSON", JSON.stringify({ hello: 1 }), /not a dungeon desktop/i],
    ["a wrong version", JSON.stringify({ format: "dungeon-desktop-campaign", version: 99, campaign: {}, collections: {} }), /unsupported.*99/i],
    ["a missing campaign", JSON.stringify({ format: "dungeon-desktop-campaign", version: 1 }), /missing required/i],
  ])("rejects %s with a visible message and imports nothing", async (_n, content, message) => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(/no campaigns yet/i);
    await upload(user, content);
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByText(/no campaigns yet/i)).toBeInTheDocument();
  });
});

describe("Importing an old export", () => {
  it("drops Location map positions and gives an in-progress Encounter without a Map a blank one, clear of the Map names already there", async () => {
    const campaign = { id: "c1", name: "Old", createdAt: 1, updatedAt: 2 } as unknown as CampaignExport["campaign"];
    const empty = Object.fromEntries(COLLECTIONS.map((c) => [c, []])) as unknown as CampaignExport["collections"];
    const existing = { id: "m1", campaignId: "c1", name: "Encounter 1", unit: "ft", perSquare: 5, showGrid: true, width: 20, height: 20, lines: [], markers: [], tokens: [], createdAt: 1, updatedAt: 1 };
    await importCampaign({
      format: "dungeon-desktop-campaign", version: 1, exportedAt: 3, campaign,
      collections: {
        ...empty,
        locations: [{ id: "l1", campaignId: "c1", name: "Inn", notes: "", x: 3, y: 4 }, { id: "l2", campaignId: "c1", name: "Keep", notes: "" }],
        maps: [existing],
        encounters: [{ id: "e1", campaignId: "c1", startedAt: 1, combatants: [] }, { id: "e2", campaignId: "c1", mapId: "m1", startedAt: 1, combatants: [] }],
      } as unknown as CampaignExport["collections"],
    });
    const db = await getDb();
    expect(await db.getAll("locations")).toEqual([{ id: "l1", campaignId: "c1", name: "Inn", notes: "" }, { id: "l2", campaignId: "c1", name: "Keep", notes: "" }]);
    const maps = await db.getAll("maps");
    const e1 = (await db.get("encounters", "e1")) as unknown as { mapId?: string };
    const made = maps.find((m) => m.id === e1.mapId);
    expect(made).toMatchObject({ name: "Encounter 2", campaignId: "c1", width: 20, height: 20, tokens: [] });
    expect(maps).toHaveLength(2);
    expect(((await db.get("encounters", "e2")) as unknown as { mapId: string }).mapId).toBe("m1");
  });
});
