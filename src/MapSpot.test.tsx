import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { listCampaigns } from "./storage";
import { createMap, listMaps, readMapView, updateMap, writeMapView, type MapLine } from "./storage/maps";
import { getDb } from "./storage/db";
import { exportCampaign } from "./storage";

type User = ReturnType<typeof userEvent.setup>;

const rows = async (id: string, store: "maps" | "encounters" | "savedEncounters") => (await exportCampaign(id))!.collections[store] as unknown as Record<string, any>[];
const pos = (el: HTMLElement) => [Number(el.getAttribute("data-col")), Number(el.getAttribute("data-row"))];

async function openCampaign(user: User) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), "Alpha");
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText("Alpha");
  await user.click(within(screen.getByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
  return (await listCampaigns())[0].id;
}
async function openCombat(user: User) {
  const id = await openCampaign(user);
  await user.keyboard("{Alt>}1{/Alt}");
  await screen.findByRole("heading", { name: /^combat$/i });
  return id;
}
const startOn = async (user: User, mapName: string) => {
  await user.selectOptions(await screen.findByRole("combobox", { name: "Encounter map" }), mapName);
  await user.click(screen.getByRole("button", { name: /start encounter/i }));
  return within(await screen.findByRole("region", { name: "Map" }));
};
const addBandit = async (user: User) => {
  await user.type(await screen.findByLabelText("Ad-hoc name"), "Bandit");
  await user.type(screen.getByLabelText("Ad-hoc HP"), "11");
  await user.click(screen.getByRole("button", { name: /add ad-hoc/i }));
  await screen.findByRole("listitem", { name: "Bandit" }); // in the Encounter before anything reads it
};
const stored = (mapId: string) => readMapView(mapId);

beforeEach(() => localStorage.clear());

describe("Encounter spot", () => {
  it("starting zoomed out sets battle scale at the view's spot, and Tokens land near it", async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = await openCombat(user);
    const field = await createMap(id, "Field");
    await within(await screen.findByRole("combobox", { name: "Encounter map" })).findByRole("option", { name: "Field" });
    writeMapView(field.id, { centre: { x: 50, y: 40 }, pxPerSquare: 4 });
    const map = await startOn(user, "Field");
    await waitFor(() => expect(stored(field.id)).toEqual({ centre: { x: 50, y: 40 }, pxPerSquare: 32 }));
    expect((await rows(id, "encounters"))[0].spot).toEqual({ x: 50, y: 40 });
    await addBandit(user);
    await user.click(map.getByRole("button", { name: /add tokens for all combatants/i }));
    const [col, row] = pos(await map.findByRole("button", { name: "Token Bandit" }));
    expect(Math.abs(col - 50)).toBeLessThan(12);
    expect(Math.abs(row - 40)).toBeLessThan(12);
  });

  it("starting at battle scale or closer keeps the view", async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = await openCombat(user);
    const field = await createMap(id, "Field");
    await within(await screen.findByRole("combobox", { name: "Encounter map" })).findByRole("option", { name: "Field" });
    writeMapView(field.id, { centre: { x: 20, y: 10 }, pxPerSquare: 64 });
    await startOn(user, "Field");
    await waitFor(async () => expect((await rows(id, "encounters"))[0]?.spot).toEqual({ x: 20, y: 10 }));
    expect(stored(field.id)).toEqual({ centre: { x: 20, y: 10 }, pxPerSquare: 64 });
  });

  it("a saved Encounter keeps its spot, and loading it onto a new blank Map shows the spot at battle scale", async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = await openCombat(user);
    const field = await createMap(id, "Field");
    await within(await screen.findByRole("combobox", { name: "Encounter map" })).findByRole("option", { name: "Field" });
    writeMapView(field.id, { centre: { x: 50, y: 40 }, pxPerSquare: 4 });
    await startOn(user, "Field");
    await addBandit(user);
    await user.click(screen.getByRole("button", { name: "Save encounter" }));
    await user.type(screen.getByLabelText("Saved encounter name"), "Ambush");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(async () => expect(await rows(id, "savedEncounters")).toHaveLength(1));
    expect((await rows(id, "savedEncounters"))[0].spot).toEqual({ x: 50, y: 40 });
    await user.click(screen.getByRole("button", { name: /end encounter/i }));
    await user.click(await screen.findByRole("button", { name: /yes, end it/i }));
    await (await getDb()).delete("maps", field.id);
    await user.click(within(await screen.findByRole("listitem", { name: "Ambush" })).getByRole("button", { name: /^load/i }));
    await waitFor(async () => expect(await listMaps(id)).toHaveLength(1));
    const [blank] = await listMaps(id);
    expect(blank.id).not.toBe(field.id);
    await waitFor(() => expect(stored(blank.id)).toEqual({ centre: { x: 50, y: 40 }, pxPerSquare: 32 }));
    expect((await rows(id, "encounters"))[0].spot).toEqual({ x: 50, y: 40 });
  });
});

describe("Find fit rules", () => {
  const big: MapLine = { id: "a1", points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }], closed: true, segments: ["plain", "plain", "plain", "plain"], area: { kind: "Area", color: "#3498db" } };
  async function find(user: User, text: string, label: RegExp) {
    const id = await openCampaign(user);
    await user.keyboard("{Alt>}2{/Alt}");
    const panel = within(await screen.findByRole("region", { name: "Map" }));
    await user.click(await panel.findByRole("button", { name: "New map" }));
    await waitFor(async () => expect(await listMaps(id)).toHaveLength(1));
    const m = (await listMaps(id))[0];
    await updateMap(m.id, (x) => ({
      ...x, lines: [{ ...big, area: { ...big.area!, name: "Meadow" } as any }],
      markers: [{ id: "k1", x: 7, y: 9, name: "Keep", color: "#e67e22", icon: "pin", note: "", placedAt: 8, priority: "normal" }],
      tokens: [{ id: "t1", name: "Goblin", color: "#c0392b", x: 3, y: 4 }], partyToken: { x: 6, y: 6 },
    }));
    await user.type(await panel.findByRole("combobox", { name: "Find on map" }), text);
    await user.click(within(await panel.findByRole("list", { name: "Find results" })).getByRole("button", { name: label }));
    return m.id;
  }
  it("a Marker goes to its placing zoom", async () => {
    const user = userEvent.setup(); render(<App />);
    const mid = await find(user, "keep", /Keep/);
    await waitFor(() => expect(stored(mid)).toEqual({ centre: { x: 7, y: 9 }, pxPerSquare: 8 }));
  });
  it("an Area is fitted to its bounds", async () => {
    const user = userEvent.setup(); render(<App />);
    const mid = await find(user, "meadow", /Meadow/);
    await waitFor(() => expect(stored(mid)!.centre).toEqual({ x: 10, y: 10 }));
    expect(stored(mid)!.pxPerSquare).toBeCloseTo(500 / 24, 1);
  });
  it("a Token and the Party Token go to battle scale", async () => {
    const user = userEvent.setup(); render(<App />);
    const mid = await find(user, "goblin", /Goblin/);
    await waitFor(() => expect(stored(mid)).toEqual({ centre: { x: 3.5, y: 4.5 }, pxPerSquare: 32 }));
  });
});

describe("Adding a Token far from the start point", () => {
  it("puts a new Token and the Party Token in view, not at (0, 0)", async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = await openCombat(user);
    const far = await createMap(id, "Far");
    writeMapView(far.id, { centre: { x: 5000, y: -3000 }, pxPerSquare: 32 });
    const map = await startOn(user, "Far");
    await user.type(map.getByRole("textbox", { name: /token name/i }), "Scout");
    await user.click(map.getByRole("button", { name: "Add token" }));
    expect(pos(await map.findByRole("button", { name: "Token Scout" }))).toEqual([5000, -3000]);
    await user.click(map.getByRole("button", { name: "Add party token" }));
    await waitFor(async () => expect((await listMaps(id)).find((m) => m.id === far.id)?.partyToken).toEqual({ x: 5001, y: -3000 })); // next free square: the Scout stands on the centre
  });
});
