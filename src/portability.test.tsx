import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import App from "./App";
import { COLLECTIONS, getDb } from "./storage/db";

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
    for (const c of COLLECTIONS) await db.add(c, { id: `${c}-1`, campaignId: original.id, label: `${c} row` });
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
      expect(await db.getAll(c)).toEqual([{ id: `${c}-1`, campaignId: original.id, label: `${c} row` }]);
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
