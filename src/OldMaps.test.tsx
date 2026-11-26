import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { openDB } from "idb";
import App from "./App";
import { closeDb, getDb } from "./storage/db";
import { listMaps } from "./storage/maps";

/** A version-8 database: old-shape Maps (size, unit, scale), an Encounter standing on one, a saved encounter with a Map copy. */
async function seedV8(withMaps = true) {
  closeDb();
  const old = await openDB("dungeon-desktop", 8, {
    upgrade(db) {
      db.createObjectStore("campaigns", { keyPath: "id" });
      for (const n of ["party", "npcs", "locations", "sessions", "notes", "customEntries", "encounters", "savedEncounters", "maps"]) {
        db.createObjectStore(n, { keyPath: "id" }).createIndex("byCampaign", "campaignId");
      }
    },
  });
  await old.put("campaigns", { id: "c", name: "Old Camp", createdAt: 1, updatedAt: 1 });
  await old.put("locations", { id: "l", campaignId: "c", name: "Inn", notes: "" });
  if (withMaps) {
    await old.put("maps", { id: "m1", campaignId: "c", name: "Cave", unit: "ft", perSquare: 5, showGrid: true, width: 20, height: 20, lines: [], markers: [], tokens: [{ id: "t", name: "Orc", color: "#c00", x: 1, y: 1 }], createdAt: 1, updatedAt: 1 });
    await old.put("encounters", { id: "e1", campaignId: "c", combatants: [], round: 1, startedAt: 1, mapId: "m1", tokens: [{ id: "t" }] });
    await old.put("savedEncounters", { id: "s1", campaignId: "c", name: "Ambush", createdAt: 1, members: [], mapId: "m1", tokens: [{ id: "t" }] });
  }
  old.close();
}

beforeEach(() => localStorage.clear());

describe("Old Maps notice (DB v9)", () => {
  it("asks first when old Maps exist, offers Export, and Continue upgrades: Maps cleared, the rest kept, device keys cleared", async () => {
    await seedV8();
    localStorage.setItem("dungeon-desktop:map-last:c", "m1");
    localStorage.setItem("dungeon-desktop:map-view:m1", JSON.stringify({ x: 1, y: 2, zoom: 3 }));
    localStorage.setItem("dungeon-desktop:other", "keep");
    const user = userEvent.setup();
    render(<App />);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: /export campaigns/i })).toBeInTheDocument();
    // Nothing is deleted until the user continues.
    const peek = await openDB("dungeon-desktop");
    expect(peek.version).toBe(8);
    expect(await peek.count("maps")).toBe(1);
    peek.close();

    await user.click(within(dialog).getByRole("button", { name: /continue and delete old maps/i }));
    await screen.findByRole("textbox", { name: /new campaign name/i });
    expect(screen.queryByRole("dialog")).toBeNull();

    const db = await getDb();
    expect(db.version).toBe(9);
    expect(await listMaps("c")).toHaveLength(0);
    expect(await db.get("locations", "l")).toMatchObject({ name: "Inn" });
    expect(await db.get("campaigns", "c")).toMatchObject({ name: "Old Camp" });
    for (const [store, id] of [["encounters", "e1"], ["savedEncounters", "s1"]] as const) {
      const row = (await db.get(store, id)) as unknown as Record<string, unknown>;
      expect(row).toBeTruthy();
      expect(row).not.toHaveProperty("mapId");
      expect(row).not.toHaveProperty("tokens");
    }
    expect(localStorage.getItem("dungeon-desktop:map-last:c")).toBeNull();
    expect(localStorage.getItem("dungeon-desktop:map-view:m1")).toBeNull();
    expect(localStorage.getItem("dungeon-desktop:other")).toBe("keep");
  });

  it("Export downloads each Campaign that has old Maps, with the Maps still in the file", async () => {
    await seedV8();
    const blobs: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => { blobs.push(b); return "blob:x"; });
    URL.revokeObjectURL = vi.fn();
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: /export campaigns/i }));
    await waitFor(() => expect(blobs).toHaveLength(1));
    const file = JSON.parse(await blobs[0].text());
    expect(file.campaign.name).toBe("Old Camp");
    expect(file.collections.maps[0]).toMatchObject({ id: "m1", width: 20 });
    expect(await screen.findByRole("status")).toHaveTextContent(/exported/i);
    expect(screen.getByRole("dialog")).toBeInTheDocument(); // still asking: exporting does not delete
  });

  it("does not appear when there are no old Maps", async () => {
    await seedV8(false);
    render(<App />);
    await screen.findByRole("textbox", { name: /new campaign name/i });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not appear on a fresh install", async () => {
    render(<App />);
    await screen.findByRole("textbox", { name: /new campaign name/i });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
