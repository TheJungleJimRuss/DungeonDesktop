import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { openDB } from "idb";
import { vi } from "vitest";
import App from "./App";
import { exportCampaign, importCampaign, listCampaigns, parseCampaignFile, readDashboard, setDashboard } from "./storage";
import { createLocation, listLocations } from "./storage/locations";
import { listMaps, updateMap } from "./storage/maps";
import { closeDb, getDb } from "./storage/db";

type User = ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  localStorage.clear();
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:bg-${n++}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => { vi.restoreAllMocks(); });

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
const gridLines = () => document.querySelectorAll(".map-canvas .grid-line").length;

describe("Map panel", () => {
  it("Find centres the view on a Marker and selects it", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMapPanel(user);
    await user.click(await panel.findByRole("button", { name: "New map" }));
    await waitFor(async () => expect(await listMaps(id)).toHaveLength(1));
    const map = (await listMaps(id))[0];
    await updateMap(map.id, (m) => ({ ...m, markers: [{ id: "k1", x: 7, y: 9, name: "Blackwater Keep", color: "#e67e22", icon: "pin", note: "" }] }));
    const find = await panel.findByRole("combobox", { name: "Find on map" });
    await user.type(find, "keep");
    await user.click(within(await panel.findByRole("list", { name: "Find results" })).getByRole("button", { name: /Blackwater Keep/ }));
    expect(panel.queryByRole("list", { name: "Find results" })).toBeNull();
    expect(JSON.parse(localStorage.getItem(`dungeon-desktop:map-view:${map.id}`)!)).toMatchObject({ x: 7, y: 9 });
    await user.type(find, "zzz");
    expect(await panel.findByText("Nothing found")).toBeInTheDocument();
  });

  it("a plain wheel pans the view; Shift + wheel pans sideways; neither zooms", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMapPanel(user);
    await user.click(await panel.findByRole("button", { name: "New map" }));
    await waitFor(async () => expect(await listMaps(id)).toHaveLength(1));
    const map = (await listMaps(id))[0];
    const view = () => JSON.parse(localStorage.getItem(`dungeon-desktop:map-view:${map.id}`) ?? "null");
    const canvas = await panel.findByRole("group", { name: "Map canvas" });
    // At battle scale (32 px per square): 64 px down = 2 squares down.
    fireEvent.wheel(canvas, { deltaY: 64 });
    await waitFor(() => expect(view()).toMatchObject({ x: 0, y: 2, pxPerSquare: 32 }));
    fireEvent.wheel(canvas, { deltaX: -32 }); // trackpad sideways swipe
    await waitFor(() => expect(view()).toMatchObject({ x: -1, y: 2 }));
    fireEvent.wheel(canvas, { deltaY: 96, shiftKey: true }); // mouse wheel + Shift = sideways
    await waitFor(() => expect(view()).toMatchObject({ x: 2, y: 2, pxPerSquare: 32 }));
  });

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

  it("has no size, scale, unit or background controls; the summary reads 1 square = …; grid persists across a reload", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    const { id, panel } = await openMapPanel(user);
    await user.click(await panel.findByRole("button", { name: "New map" }));
    await panel.findByLabelText("Map summary");
    for (const label of ["Map width", "Map height", "Scale per square", "Scale unit", "Background image"]) expect(panel.queryByLabelText(label)).toBeNull();
    expect(panel.getByLabelText("Map summary")).toHaveTextContent(/1 square = /);
    expect(gridLines()).toBeGreaterThan(0);

    await user.click(panel.getByLabelText("Show grid"));
    await waitFor(async () => expect((await listMaps(id))[0].showGrid).toBe(false));
    expect(gridLines()).toBe(0);

    unmount();
    render(<App />);
    await user.click(within(await screen.findByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
    await screen.findByRole("heading", { name: /dashboard/i });
    await user.keyboard("{Alt>}2{/Alt}");
    const again = within(await screen.findByRole("region", { name: "Map" }));
    expect(await again.findByLabelText("Map summary")).toHaveTextContent(/1 square = /);
    expect(gridLines()).toBe(0);
    await user.click(again.getByLabelText("Show grid"));
    await waitFor(() => expect(gridLines()).toBeGreaterThan(0));
  });

  it("Fit all works on an empty Map (battle scale at the origin) and on a drawn one", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMapPanel(user);
    await user.click(await panel.findByRole("button", { name: "New map" }));
    const scale = () => panel.getByLabelText("Grid scale").textContent;
    await user.click(await panel.findByRole("button", { name: "Fit all" }));
    expect(scale()).toBe("1 square = 5 ft");
    const map = (await listMaps(id))[0];
    await updateMap(map.id, (m) => ({ ...m, markers: [{ id: "k1", x: 5000, y: 9000, name: "Far Keep", color: "#e67e22", icon: "pin", note: "" }, { id: "k2", x: 0, y: 0, name: "Home", color: "#e67e22", icon: "pin", note: "" }] }));
    await user.click(await panel.findByRole("button", { name: "Fit all" }));
    await waitFor(() => expect(scale()).not.toBe("1 square = 5 ft"));
    expect(scale()).toMatch(/mi/);
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
    await waitFor(() => expect(panel.getByText("1.5x")).toBeInTheDocument());
    await user.selectOptions(panel.getByRole("combobox", { name: "Map" }), "Map 2");
    expect(await panel.findByText("1x")).toBeInTheDocument();

    await user.selectOptions(panel.getByRole("combobox", { name: "Map" }), "Map 1");
    unmount();
    render(<App />);
    await user.click(within(await screen.findByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
    await screen.findByRole("heading", { name: /dashboard/i });
    await user.keyboard("{Alt>}2{/Alt}");
    const again = within(await screen.findByRole("region", { name: "Map" }));
    expect(await again.findByRole("combobox", { name: "Map" })).toHaveDisplayValue("Map 1");
    expect(again.getByText("1.5x")).toBeInTheDocument();
  });

  it("zooms continuously: the grid label is the more visible round step, never finer than 5 ft; keys and Cmd/Ctrl + wheel zoom", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { panel } = await openMapPanel(user);
    await user.click(await panel.findByRole("button", { name: "New map" }));
    const label = () => panel.getByLabelText("Grid scale");
    expect(await panel.findByLabelText("Grid scale")).toHaveTextContent("1 square = 5 ft");
    expect(panel.getByRole("img", { name: /^Scale bar \d+(\.\d+)? ft$/ })).toBeInTheDocument(); // round distance in the Map's unit
    const lines = () => document.querySelectorAll(".grid-line").length;
    const atFit = lines();
    await user.click(panel.getByRole("button", { name: "Zoom in" }));
    expect(panel.getByText("1.5x")).toBeInTheDocument(); // continuous: exactly one 1.5x step, no snapping
    expect(label()).toHaveTextContent("1 square = 5 ft"); // zoomed in the grid stays at the 5 ft base square
    await user.click(panel.getByRole("button", { name: "Zoom out" }));
    await user.click(panel.getByRole("button", { name: "Zoom out" }));
    await user.click(panel.getByRole("button", { name: "Zoom out" }));
    expect(panel.getByText("0.444x")).toBeInTheDocument();
    expect(label()).toHaveTextContent("1 square = 10 ft");
    expect(Math.abs(lines() - atFit)).toBeLessThanOrEqual(atFit); // two crossfaded steps, about as many lines as one
    // No edge: zoomed out, the grid runs past the Map's own size to fill the view.
    const xs = [...document.querySelectorAll(".map-canvas .grid-line")].map((l) => Number(l.getAttribute("x1")));
    expect(Math.min(...xs)).toBeLessThan(0);

    // Keys: "+" (or "=") zooms in, "-" zooms out, not while typing in a field.
    await user.keyboard("+");
    expect(panel.getByText("0.667x")).toBeInTheDocument();
    await user.keyboard("=");
    expect(panel.getByText("1x")).toBeInTheDocument();
    await user.keyboard("-");
    expect(panel.getByText("0.667x")).toBeInTheDocument();
    panel.getByLabelText("Show grid").focus();
    await user.keyboard("-");
    expect(panel.getByText("0.667x")).toBeInTheDocument();

    // Cmd/Ctrl + wheel: up zooms in, down zooms out, unsnapped; a plain wheel does not zoom.
    const canvas = panel.getByRole("group", { name: "Map canvas" });
    fireEvent.wheel(canvas, { deltaY: 100 });
    expect(panel.getByText("0.667x")).toBeInTheDocument();
    fireEvent.wheel(canvas, { deltaY: -100, metaKey: true });
    await waitFor(() => expect(panel.getByText("1.1x")).toBeInTheDocument()); // 0.667 x e^0.5
    fireEvent.wheel(canvas, { deltaY: 100, ctrlKey: true });
    await waitFor(() => expect(panel.getByText("0.667x")).toBeInTheDocument());
  });

  it("animates the + step with easing and lands on step x 1.5 (frames and motion preferences stubbed)", async () => {
    const frames: ((t: number) => void)[] = [];
    let now = 0;
    vi.stubGlobal("requestAnimationFrame", (f: (t: number) => void) => frames.push(f));
    vi.stubGlobal("cancelAnimationFrame", () => { frames.length = 0; });
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    try {
      const user = userEvent.setup();
      render(<App />);
      const { panel } = await openMapPanel(user);
      await user.click(await panel.findByRole("button", { name: "New map" }));
      await panel.findByLabelText("Grid scale");
      const step = (t: number) => { now = t; const f = frames.splice(0); act(() => f.forEach((fn) => fn(t))); };
      await user.click(panel.getByRole("button", { name: "Zoom in" }));
      expect(panel.getByText("1x")).toBeInTheDocument(); // nothing moves until a frame runs
      step(75); // halfway in time: eased, so already past half the step
      const mid = Number(/^([\d.]+)x$/.exec(panel.getByText(/^[\d.]+x$/).textContent!)![1]);
      expect(mid).toBeGreaterThan(1.25); // linear halfway would be 1.22
      expect(mid).toBeLessThan(1.5);
      step(160);
      expect(panel.getByText("1.5x")).toBeInTheDocument();
      expect(frames).toHaveLength(0);
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
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
