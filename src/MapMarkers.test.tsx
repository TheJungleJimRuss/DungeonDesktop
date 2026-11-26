import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { listCampaigns } from "./storage";
import { listMaps, updateMap, type MapLine, type MapMarker } from "./storage/maps";
import { createLocation, deleteLocation, listLocations, updateLocation } from "./storage/locations";
import { unlinkLocationFromMarkers } from "./map/markers";
import { MARKER_ICON_IDS } from "./map/icons";

type User = ReturnType<typeof userEvent.setup>;

const line = (id: string, points: [number, number][], closed: boolean, segments?: MapLine["segments"]): MapLine => ({
  id, closed, points: points.map(([x, y]) => ({ x, y })), segments: segments ?? Array(closed ? points.length : points.length - 1).fill("plain"),
});

async function openMap(user: User, lines: MapLine[] = [], markers: MapMarker[] = []) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), "Alpha");
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText("Alpha");
  await user.click(within(screen.getByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
  await user.keyboard("{Alt>}2{/Alt}");
  const panel = within(await screen.findByRole("region", { name: "Map" }));
  await user.click(await panel.findByRole("button", { name: "New map" }));
  await panel.findByLabelText("Map summary");
  const id = (await listCampaigns())[0].id;
  if (lines.length || markers.length) {
    const map = (await listMaps(id))[0];
    await updateMap(map.id, (m) => ({ ...m, lines, markers }));
  }
  return { id, panel };
}
/** jsdom has no SVG transform: use the identity, so client pixels are canvas pixels (40 per square). Restored after each test. */
const proto = SVGSVGElement.prototype as unknown as Record<string, unknown>;
const saved = { ctm: proto.getScreenCTM, pt: proto.createSVGPoint };
const identitySvg = () => {
  proto.getScreenCTM = () => ({ inverse: () => ({}) });
  proto.createSVGPoint = () => ({ x: 0, y: 0, matrixTransform() { return { x: this.x, y: this.y }; } });
};
afterEach(() => { proto.getScreenCTM = saved.ctm; proto.createSVGPoint = saved.pt; });
const stored = async (id: string) => (await listMaps(id))[0];
beforeEach(() => localStorage.clear());
const sq = (x: number, y: number, s: number): [number, number][] => [[x, y], [x + s, y], [x + s, y + s], [x, y + s]];
const area = (id: string, s: number, a: NonNullable<MapLine["area"]>): MapLine => ({ ...line(id, sq(2, 2, s), true), area: a });
const setText = (el: HTMLElement, v: string) => { fireEvent.change(el, { target: { value: v } }); fireEvent.blur(el); };

const mk = (id: string, name: string, x: number, y: number, extra: Partial<MapMarker> = {}): MapMarker => ({ id, name, x, y, color: "#e67e22", icon: "pin", note: "", ...extra });
const markers = async (id: string) => (await stored(id)).markers;
const svgBox = (panel: ReturnType<typeof within>) => panel.getByRole("group", { name: "Map canvas" }).getAttribute("viewBox");

describe("Markers", () => {
  it("places a Marker at the unsnapped point with the defaults, selects it, edits name, color, icon and note, and deletes it", async () => {
    identitySvg();
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user);
    await user.click(panel.getByRole("button", { name: "Marker" }));
    fireEvent.click(await panel.findByTestId("map-marker-surface"), { clientX: 123.4, clientY: 77.7 });
    const placed = await panel.findByRole("button", { name: "Marker Marker 1" });
    expect(placed).toHaveAttribute("aria-pressed", "true");
    await waitFor(async () => expect(await markers(id)).toEqual([expect.objectContaining({ x: 123.4 / 40, y: 77.7 / 40, name: "Marker 1", icon: "pin", note: "", color: expect.stringMatching(/^#/) })]));
    expect(Number.isInteger((await markers(id))[0].x)).toBe(false);

    setText(await panel.findByLabelText("Marker name"), "  Camp Fire ");
    setText(panel.getByLabelText("Marker color"), "#00aa00");
    await user.click(panel.getByRole("button", { name: "Icon camp" }));
    setText(panel.getByLabelText("Marker note"), "Bring rope");
    await waitFor(async () => expect((await markers(id))[0]).toMatchObject({ name: "Camp Fire", color: "#00aa00", icon: "camp", note: "Bring rope" }));
    expect(await panel.findByRole("button", { name: "Marker Camp Fire" })).toBeInTheDocument();
    expect(panel.getByRole("button", { name: "Icon camp" })).toHaveAttribute("aria-pressed", "true");
    expect(panel.getByLabelText("Marker note")).toHaveValue("Bring rope");

    await user.click(panel.getByRole("button", { name: "Delete Marker Camp Fire" }));
    await waitFor(async () => expect(await markers(id)).toEqual([]));
    expect(panel.queryByRole("button", { name: /^Marker / })).not.toBeInTheDocument();
  });

  it("offers the 12 icons and draws every one", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { panel } = await openMap(user, [], [mk("a", "A", 3, 3)]);
    await user.click(await panel.findByRole("button", { name: "Marker A" }));
    expect(MARKER_ICON_IDS).toEqual(["pin", "city", "camp", "cave", "skull", "chest", "door", "tower", "temple", "tavern", "ship", "star"]);
    for (const icon of MARKER_ICON_IDS) expect(panel.getByRole("button", { name: `Icon ${icon}` })).toBeInTheDocument();
  });

  it("Select picks and drags a Marker freely (no snap); a press without a move keeps its place; Delete and Backspace remove it", async () => {
    identitySvg();
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user, [], [mk("a", "A", 3, 3), mk("b", "B", 6, 6)]);
    const a = await panel.findByRole("button", { name: "Marker A" });
    await user.pointer([{ keys: "[MouseLeft>]", target: a, coords: { clientX: 120, clientY: 120 } }, { coords: { clientX: 203.3, clientY: 99.9 } }, { keys: "[/MouseLeft]" }]);
    await waitFor(async () => expect((await markers(id))[0]).toMatchObject({ x: 203.3 / 40, y: 99.9 / 40 }));
    expect(await panel.findByRole("group", { name: "Edit Marker A" })).toBeInTheDocument();

    const b = panel.getByRole("button", { name: "Marker B" });
    await user.pointer([{ keys: "[MouseLeft>]", target: b, coords: { clientX: 240, clientY: 240 } }, { keys: "[/MouseLeft]" }]);
    expect(await panel.findByRole("group", { name: "Edit Marker B" })).toBeInTheDocument();
    expect((await markers(id))[1]).toMatchObject({ x: 6, y: 6 });
    await user.keyboard("{Delete}");
    await waitFor(async () => expect((await markers(id)).map((m) => m.id)).toEqual(["a"]));
    await user.click(panel.getByRole("button", { name: "Marker A" }));
    await user.keyboard("{Backspace}");
    await waitFor(async () => expect(await markers(id)).toEqual([]));
  });

  it("links a Marker to a Location: live name, follow-through selection, unlink; and deleting the Location unlinks it and keeps the old name", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user, [], [mk("a", "Pin", 3, 3)]);
    const loc = await createLocation(id, { name: "Riverdale", notes: "" });
    await user.click(await panel.findByRole("button", { name: "Marker Pin" }));
    expect(localStorage.getItem(`dungeon-desktop:location-selection:${id}`)).toBeNull();
    await user.selectOptions(await panel.findByLabelText("Marker location"), "Riverdale");
    await waitFor(async () => expect((await markers(id))[0].locationId).toBe(loc.id));
    expect(await panel.findByRole("button", { name: "Marker Riverdale" })).toBeInTheDocument();
    expect(panel.getByLabelText("Marker name")).toHaveValue("Riverdale");

    await updateLocation(loc.id, { name: "Rivervale" });
    expect(await panel.findByRole("button", { name: "Marker Rivervale" })).toBeInTheDocument();

    await user.click(panel.getByRole("button", { name: "Select" })); // deselects
    await user.click(await panel.findByRole("button", { name: "Marker Rivervale" }));
    await waitFor(() => expect(localStorage.getItem(`dungeon-desktop:location-selection:${id}`)).toBe(loc.id));

    await deleteLocation(loc.id);
    await waitFor(async () => expect((await markers(id))[0]).toEqual(mk("a", "Rivervale", 3, 3)));
    expect(await panel.findByRole("button", { name: "Marker Rivervale" })).toBeInTheDocument();
    expect((await markers(id))[0].locationId).toBeUndefined();
  });

  it("creates a Location from the Marker's name and links it", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user, [], [mk("a", "Harbour", 3, 3)]);
    await user.click(await panel.findByRole("button", { name: "Marker Harbour" }));
    await user.selectOptions(await panel.findByLabelText("Marker location"), "Create location");
    await waitFor(async () => expect((await listLocations(id)).map((l) => l.name)).toEqual(["Harbour"]));
    const loc = (await listLocations(id))[0];
    await waitFor(async () => expect((await markers(id))[0].locationId).toBe(loc.id));
    await waitFor(() => expect(localStorage.getItem(`dungeon-desktop:location-selection:${id}`)).toBe(loc.id));
    await user.selectOptions(panel.getByLabelText("Marker location"), "None");
    await waitFor(async () => expect((await markers(id))[0].locationId).toBeUndefined());
  });

  it("unlinkLocationFromMarkers keeps other Markers and returns the same array when nothing links", () => {
    const list = [mk("a", "A", 1, 1, { locationId: "L" }), mk("b", "B", 2, 2, { locationId: "M" })];
    expect(unlinkLocationFromMarkers(list, "L", "Old")).toEqual([mk("a", "Old", 1, 1), list[1]]);
    expect(unlinkLocationFromMarkers(list, "Z", "Old")).toBe(list);
  });
});

describe("Select tool: pan and click", () => {
  it("dragging from an Area's fill pans the Map and selects nothing; a press that does not move selects the Area; empty map deselects on a click, pans on a drag", async () => {
    identitySvg();
    const user = userEvent.setup();
    render(<App />);
    const { panel } = await openMap(user, [area("a", 4, { kind: "Forest", color: "#0a0" })]);
    const fill = await panel.findByRole("button", { name: "Area Forest" });
    const before = svgBox(panel);
    await user.pointer([{ keys: "[MouseLeft>]", target: fill, coords: { clientX: 120, clientY: 120 } }, { coords: { clientX: 180, clientY: 150 } }, { keys: "[/MouseLeft]" }]);
    await waitFor(() => expect(svgBox(panel)).not.toBe(before));
    expect(panel.queryByRole("group", { name: /Edit Shape/ })).not.toBeInTheDocument();

    await user.pointer([{ keys: "[MouseLeft>]", target: fill, coords: { clientX: 120, clientY: 120 } }, { keys: "[/MouseLeft]" }]);
    expect(await panel.findByRole("group", { name: "Edit Shape 1" })).toBeInTheDocument();

    const bgBox = svgBox(panel);
    const bg = panel.getByTestId("map-pan");
    await user.pointer([{ keys: "[MouseLeft>]", target: bg, coords: { clientX: 500, clientY: 500 } }, { keys: "[/MouseLeft]" }]);
    await waitFor(() => expect(panel.queryByRole("group", { name: /Edit Shape/ })).not.toBeInTheDocument());
    expect(svgBox(panel)).toBe(bgBox);
    await user.pointer([{ keys: "[MouseLeft>]", target: bg, coords: { clientX: 500, clientY: 500 } }, { coords: { clientX: 540, clientY: 520 } }, { keys: "[/MouseLeft]" }]);
    await waitFor(() => expect(svgBox(panel)).not.toBe(bgBox));
  });
});
