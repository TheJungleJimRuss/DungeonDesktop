import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { openDB } from "idb";
import { vi } from "vitest";
import App from "./App";
import { exportCampaign, importCampaign, listCampaigns, parseCampaignFile, readDashboard, setDashboard } from "./storage";
import { createLocation, listLocations } from "./storage/locations";
import { listMaps } from "./storage/maps";
import { setImageResizer } from "./storage/imageResize";
import { closeDb, getDb } from "./storage/db";

type User = ReturnType<typeof userEvent.setup>;
const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
const png = (name = "bg.png") => new File([PNG], name, { type: "image/png" });

beforeEach(() => {
  localStorage.clear();
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:bg-${n++}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => { vi.restoreAllMocks(); setImageResizer(null); });

async function openCampaign(user: User, name = "Alpha") {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), name);
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText(name);
  await user.click(within(screen.getByRole("listitem", { name })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
  return (await listCampaigns())[0].id;
}
async function openMapPanel(user: User) {
  const id = await openCampaign(user);
  await user.keyboard("{Alt>}2{/Alt}");
  return { id, panel: within(await screen.findByRole("region", { name: "Map" })) };
}
const setVal = async (user: User, el: HTMLElement, v: string) => { await user.clear(el); await user.type(el, v + "{Tab}"); };
const image = () => document.querySelector<SVGImageElement>(".map-canvas image");
const gridLines = () => document.querySelectorAll(".map-canvas .grid-line").length;

describe("Map panel", () => {
  it("offers New map when empty, then creates, renames and deletes with a confirm", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMapPanel(user);
    await user.click(await panel.findByRole("button", { name: "New map" }));
    await waitFor(async () => expect(await listMaps(id)).toHaveLength(1));
    const picker = await panel.findByRole("combobox", { name: "Map" });
    expect(within(picker).getByRole("option", { name: "Map 1" })).toBeInTheDocument();

    await user.click(panel.getByRole("button", { name: "Rename" }));
    const name = panel.getByLabelText("Map name");
    await user.clear(name);
    await user.type(name, "Neverwinter{Enter}");
    await waitFor(async () => expect((await listMaps(id))[0].name).toBe("Neverwinter"));
    expect(within(await panel.findByRole("combobox", { name: "Map" })).getByRole("option", { name: "Neverwinter" })).toBeInTheDocument();

    await user.click(panel.getByRole("button", { name: "New map" }));
    await waitFor(async () => expect(await listMaps(id)).toHaveLength(2));
    expect(within(panel.getByRole("combobox", { name: "Map" })).getAllByRole("option").map((o) => o.textContent)).toEqual(["Map 2", "Neverwinter"]);

    // Delete asks first; Cancel keeps the Map
    await user.click(panel.getByRole("button", { name: "Delete map" }));
    expect(await listMaps(id)).toHaveLength(2);
    await user.click(panel.getByRole("button", { name: "Cancel" }));
    expect(panel.queryByRole("button", { name: /yes, delete it/i })).toBeNull();
    await user.click(panel.getByRole("button", { name: "Delete map" }));
    await user.click(panel.getByRole("button", { name: /yes, delete it/i }));
    await waitFor(async () => expect(await listMaps(id)).toHaveLength(1));
    expect((await listMaps(id))[0].name).toBe("Neverwinter");
    await user.click(panel.getByRole("button", { name: "Delete map" }));
    await user.click(panel.getByRole("button", { name: /yes, delete it/i }));
    await panel.findByRole("button", { name: "New map" });
    expect(await listMaps(id)).toHaveLength(0);
  });

  it("persists scale, unit, grid and size (size commits on blur/Enter) across a reload", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    const { id, panel } = await openMapPanel(user);
    await user.click(await panel.findByRole("button", { name: "New map" }));
    await panel.findByLabelText("Map width");
    expect(gridLines()).toBeGreaterThan(0);

    await setVal(user, panel.getByLabelText("Scale per square"), "10");
    await user.selectOptions(panel.getByLabelText("Scale unit"), "mi");
    await user.click(panel.getByLabelText("Show grid"));
    const w = panel.getByLabelText("Map width");
    await user.clear(w);
    await user.type(w, "30{Enter}");
    await setVal(user, panel.getByLabelText("Map height"), "12");
    await waitFor(async () => expect((await listMaps(id))[0]).toMatchObject({ perSquare: 10, unit: "mi", showGrid: false, width: 30, height: 12 }));
    expect(gridLines()).toBe(0);
    expect(panel.getByLabelText("Map summary")).toHaveTextContent("30 × 12 squares, 10 mi per square");

    unmount();
    render(<App />);
    await user.click(within(await screen.findByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
    await screen.findByRole("heading", { name: /dashboard/i });
    await user.keyboard("{Alt>}2{/Alt}");
    const again = within(await screen.findByRole("region", { name: "Map" }));
    expect(await again.findByLabelText("Map summary")).toHaveTextContent("30 × 12 squares, 10 mi per square");
    expect(gridLines()).toBe(0);
    await user.click(again.getByLabelText("Show grid"));
    await waitFor(() => expect(gridLines()).toBeGreaterThan(0));
  });

  it("sets, scales, offsets and clears a background image; export/import round-trips it", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMapPanel(user);
    await user.click(await panel.findByRole("button", { name: "New map" }));
    expect(image()).toBeNull();
    await user.upload(await panel.findByLabelText("Background image"), png());
    await waitFor(() => expect(image()).not.toBeNull());
    expect(image()!.getAttribute("href")).toMatch(/^blob:/);
    const svg = document.querySelector(".map-canvas")!;
    expect([...svg.children].indexOf(image()!)).toBeLessThan([...svg.children].indexOf(svg.querySelector(".grid-line")!));
    await setVal(user, panel.getByLabelText("Background scale"), "1.5");
    await setVal(user, panel.getByLabelText("Background offset X"), "2");
    await setVal(user, panel.getByLabelText("Background offset Y"), "3");
    await waitFor(async () => expect((await listMaps(id))[0].background).toMatchObject({ scale: 1.5, offsetX: 2, offsetY: 3 }));
    expect(image()).toHaveAttribute("x", "80");
    expect((await listMaps(id))[0].background!.image!.data.byteLength).toBe(PNG.length);

    await user.click(panel.getByRole("button", { name: "Add party token" }));
    await waitFor(async () => expect((await listMaps(id))[0].partyToken).toEqual({ x: 0, y: 0 }));
    const text = JSON.stringify((await exportCampaign(id))!);
    expect(text).toContain("data:image/png;base64,");
    const parsed = parseCampaignFile(text);
    expect(parsed.ok).toBe(true);
    await (await getDb()).clear("maps");
    if (parsed.ok) await importCampaign(parsed.data);
    const back = (await listMaps(id))[0];
    expect(back.background).toMatchObject({ scale: 1.5, offsetX: 2 });
    expect(back.partyToken).toEqual({ x: 0, y: 0 });
    expect(new Uint8Array(back.background!.image!.data)).toEqual(PNG);
    expect(back).toMatchObject({ lines: [], markers: [], tokens: [] });

    await user.click(await panel.findByRole("button", { name: /clear background/i }));
    await waitFor(() => expect(image()).toBeNull());
  });

  it("stores what the resizer returns for a large image, and the original when it declines or fails", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMapPanel(user);
    await user.click(await panel.findByRole("button", { name: "New map" }));
    await panel.findByRole("combobox", { name: "Map" });
    await user.click(panel.getByText("Map settings"));
    const stored = async () => (await listMaps(id))[0].background?.image;
    const small = { type: "image/webp", data: new Uint8Array([1, 2, 3]).buffer };
    const seen: number[] = [];
    setImageResizer(async (_f, max) => (seen.push(max), small));
    await user.upload(panel.getByLabelText("Background image"), png());
    await waitFor(async () => expect((await stored())?.type).toBe("image/webp"));
    expect(seen).toEqual([2048]);
    expect((await stored())!.data.byteLength).toBe(3);

    setImageResizer(async () => null); // small enough, or no canvas APIs: keep the file as chosen
    await user.upload(panel.getByLabelText("Background image"), png("again.png"));
    await waitFor(async () => expect((await stored())!.type).toBe("image/png"));
    expect((await stored())!.data.byteLength).toBe(PNG.length);

    setImageResizer(async () => small);
    await user.upload(panel.getByLabelText("Background image"), png("x.png"));
    await waitFor(async () => expect((await stored())!.type).toBe("image/webp"));
    setImageResizer(async () => { throw new Error("decode failed"); });
    await user.upload(panel.getByLabelText("Background image"), png("y.png"));
    await waitFor(async () => expect((await stored())!.type).toBe("image/png"));
  });

  it("opens the last viewed Map and keeps the view per Map", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    const { panel } = await openMapPanel(user);
    await user.click(await panel.findByRole("button", { name: "New map" }));
    await user.click(await panel.findByRole("button", { name: "New map" }));
    await waitFor(() => expect(within(panel.getByRole("combobox", { name: "Map" })).getAllByRole("option")).toHaveLength(2));
    const list = within(panel.getByRole("combobox", { name: "Map" })).getAllByRole("option");
    expect(list).toHaveLength(2);
    await user.selectOptions(panel.getByRole("combobox", { name: "Map" }), "Map 1");
    await user.click(panel.getByRole("button", { name: "Zoom in" }));
    await waitFor(() => expect(panel.getByText("150%")).toBeInTheDocument());
    await user.selectOptions(panel.getByRole("combobox", { name: "Map" }), "Map 2");
    expect(await panel.findByText("100%")).toBeInTheDocument();

    await user.selectOptions(panel.getByRole("combobox", { name: "Map" }), "Map 1");
    unmount();
    render(<App />);
    await user.click(within(await screen.findByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
    await screen.findByRole("heading", { name: /dashboard/i });
    await user.keyboard("{Alt>}2{/Alt}");
    const again = within(await screen.findByRole("region", { name: "Map" }));
    expect(await again.findByRole("combobox", { name: "Map" })).toHaveDisplayValue("Map 1");
    expect(again.getByText("150%")).toBeInTheDocument();
  });

  it("keeps the grid's on-screen size when zooming: one grid square stands for less when zoomed in, more when zoomed out", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { panel } = await openMapPanel(user);
    await user.click(await panel.findByRole("button", { name: "New map" }));
    expect(await panel.findByLabelText("Grid scale")).toHaveTextContent("1 square = 5 ft");
    expect(panel.getByRole("img", { name: /^Scale bar \d+(\.\d+)? ft$/ })).toBeInTheDocument(); // round distance in the Map's unit
    const lines = () => document.querySelectorAll(".grid-line").length;
    const atFit = lines();
    await user.click(panel.getByRole("button", { name: "Zoom in" }));
    await waitFor(() => expect(panel.getByLabelText("Grid scale")).toHaveTextContent("1 square = 3.33 ft"));
    expect(Math.abs(lines() - atFit)).toBeLessThanOrEqual(4); // about as many lines in view, not fewer, wider squares
    await user.click(panel.getByRole("button", { name: "Zoom out" }));
    await user.click(panel.getByRole("button", { name: "Zoom out" }));
    await waitFor(() => expect(panel.getByLabelText("Grid scale")).toHaveTextContent("1 square = 7.5 ft"));
    // No edge: zoomed out, the grid runs past the Map's own size to fill the view.
    const xs = [...document.querySelectorAll(".map-canvas .grid-line")].map((l) => Number(l.getAttribute("x1")));
    expect(Math.min(...xs)).toBeLessThan(0);

    // Keys: "+" (or "=") zooms in, "-" zooms out, not while typing in a field.
    await user.keyboard("+");
    await waitFor(() => expect(panel.getByLabelText("Grid scale")).toHaveTextContent("1 square = 5 ft"));
    await user.keyboard("=");
    await waitFor(() => expect(panel.getByLabelText("Grid scale")).toHaveTextContent("1 square = 3.33 ft"));
    await user.keyboard("-");
    await waitFor(() => expect(panel.getByLabelText("Grid scale")).toHaveTextContent("1 square = 5 ft"));
    panel.getByLabelText("Map width").focus();
    await user.keyboard("-");
    expect(panel.getByLabelText("Grid scale")).toHaveTextContent("1 square = 5 ft");

    // Cmd/Ctrl + wheel: up zooms in, down zooms out; a plain wheel does not zoom.
    const canvas = panel.getByRole("group", { name: "Map canvas" });
    fireEvent.wheel(canvas, { deltaY: 100 });
    expect(panel.getByLabelText("Grid scale")).toHaveTextContent("1 square = 5 ft");
    fireEvent.wheel(canvas, { deltaY: -100, metaKey: true });
    await waitFor(() => expect(panel.getByLabelText("Grid scale")).not.toHaveTextContent("1 square = 5 ft"));
    expect(Number(/= ([\d.]+)/.exec(panel.getByLabelText("Grid scale").textContent!)![1])).toBeLessThan(5);
    fireEvent.wheel(canvas, { deltaY: 100, ctrlKey: true });
    fireEvent.wheel(canvas, { deltaY: 100, ctrlKey: true });
    await waitFor(() => expect(Number(/= ([\d.]+)/.exec(panel.getByLabelText("Grid scale").textContent!)![1])).toBeGreaterThan(5));
  });

  it("shows the Map panel where saved layouts and old imports named world-map", async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = await openCampaign(user);
    await setDashboard(id, [{ panelId: "world-map", x: 0, y: 0, w: 60, h: 40 }]);
    expect(readDashboard((await listCampaigns())[0].dashboard).map((e) => e.panelId)).toEqual(["map"]);
    await waitFor(() => expect(screen.getByRole("region", { name: "Map" })).toBeInTheDocument());
    expect(screen.queryByRole("region", { name: "World Map" })).toBeNull();

    const exp = (await exportCampaign(id))!;
    const old = JSON.parse(JSON.stringify(exp));
    old.campaign.dashboard.panels[0].panelId = "world-map";
    const p = parseCampaignFile(JSON.stringify(old));
    expect(p.ok && p.data.campaign.dashboard!.panels[0].panelId).toBe("map");
  });

  it("imports an old export with edges and Location x/y without failing, ignoring edges", async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = await openCampaign(user);
    const loc = await createLocation(id, { name: "Neverwinter", notes: "" });
    const old = JSON.parse(JSON.stringify((await exportCampaign(id))!));
    old.collections.edges = [{ id: "e1", campaignId: id, fromId: loc.id, toId: loc.id, miles: 5, terrain: "" }];
    delete old.collections.maps;
    const parsed = parseCampaignFile(JSON.stringify(old));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) await importCampaign(parsed.data);
    expect(await listLocations(id)).toHaveLength(1);
    expect(await listMaps(id)).toHaveLength(0);
    expect((await getDb()).objectStoreNames.contains("edges" as never)).toBe(false);
  });
});

describe("Upgrade from version 6", () => {
  it("drops edges, strips Location x/y and keeps Locations, NPC links and the party location", async () => {
    closeDb();
    const old = await openDB("dungeon-desktop", 6, {
      upgrade(db) {
        db.createObjectStore("campaigns", { keyPath: "id" });
        for (const n of ["party", "npcs", "locations", "sessions", "notes", "customEntries", "encounters", "savedEncounters", "edges", "battleMaps"]) {
          db.createObjectStore(n, { keyPath: "id" }).createIndex("byCampaign", "campaignId");
        }
      },
    });
    await old.put("campaigns", { id: "c", name: "Old", createdAt: 1, updatedAt: 1, partyLocationId: "l1" });
    await old.put("locations", { id: "l1", campaignId: "c", name: "Neverwinter", notes: "n", x: 10, y: 20, createdAt: 1, updatedAt: 1 });
    await old.put("locations", { id: "l2", campaignId: "c", name: "Waterdeep", notes: "", createdAt: 1, updatedAt: 1 });
    await old.put("npcs", { id: "n1", campaignId: "c", name: "Mira", locationId: "l1", locationTag: "Neverwinter" });
    await old.put("edges", { id: "e1", campaignId: "c", fromId: "l1", toId: "l2", miles: 100, terrain: "road" });
    old.close();

    const db = await getDb();
    expect([...db.objectStoreNames]).not.toContain("edges");
    expect([...db.objectStoreNames]).toContain("maps");
    const locs = await listLocations("c");
    expect(locs.map((l) => l.name)).toEqual(["Neverwinter", "Waterdeep"]);
    for (const l of locs) { expect(l).not.toHaveProperty("x"); expect(l).not.toHaveProperty("y"); }
    expect(locs[0].notes).toBe("n");
    expect(await db.get("npcs", "n1")).toMatchObject({ locationId: "l1", locationTag: "Neverwinter" });
    expect(await db.get("campaigns", "c")).toMatchObject({ partyLocationId: "l1" });
    expect(await listMaps("c")).toEqual([]);
  });
});
