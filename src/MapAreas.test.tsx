import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { listCampaigns } from "./storage";
import { listMaps, updateMap, type MapLine } from "./storage/maps";
import { createLocation, deleteLocation, listLocations, updateLocation } from "./storage/locations";
import { areaAt } from "./map/areas";

type User = ReturnType<typeof userEvent.setup>;

const line = (id: string, points: [number, number][], closed: boolean, segments?: MapLine["segments"]): MapLine => ({
  id, closed, points: points.map(([x, y]) => ({ x, y })), segments: segments ?? Array(closed ? points.length : points.length - 1).fill("plain"),
});

async function openMap(user: User, lines: MapLine[] = []) {
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
  if (lines.length) {
    const map = (await listMaps(id))[0];
    await updateMap(map.id, (m) => ({ ...m, lines }));
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

describe("Areas", () => {
  it("makes an Area from a Shape, edits kind, color and name, and unmakes it; an open Line offers no Make area", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user, [line("o", [[1, 1], [4, 1]], false), line("s", sq(5, 5, 3), true)]);
    await user.click(await panel.findByRole("button", { name: "Line 1" }));
    await panel.findByRole("group", { name: "Edit Line 1" });
    expect(panel.queryByRole("button", { name: "Make area" })).not.toBeInTheDocument();

    await user.click(panel.getByRole("button", { name: "Shape 1" }));
    await user.click(await panel.findByRole("button", { name: "Make area" }));
    await waitFor(async () => expect((await stored(id)).lines[1].area).toMatchObject({ kind: expect.any(String), color: expect.stringMatching(/^#/) }));
    setText(await panel.findByLabelText("Area kind"), "Forest");
    setText(panel.getByLabelText("Area color"), "#00aa00");
    setText(panel.getByLabelText("Area name"), "Darkwood");
    await waitFor(async () => expect((await stored(id)).lines[1].area).toEqual({ kind: "Forest", color: "#00aa00", name: "Darkwood" }));
    expect(panel.getByText("Darkwood", { selector: "text" })).toBeInTheDocument();
    expect(panel.getByRole("button", { name: "Shape 1" })).toBeInTheDocument();

    await user.click(panel.getByRole("button", { name: "Unmake area" }));
    await waitFor(async () => expect((await stored(id)).lines[1].area).toBeUndefined());
    expect(await panel.findByRole("button", { name: "Make area" })).toBeInTheDocument();
    expect(panel.queryByText("Darkwood", { selector: "text" })).not.toBeInTheDocument();
  });

  it("labels an unnamed Area with its kind, and links an existing Location whose live name it then shows", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user, [area("a", 4, { kind: "City", color: "#ff0000" })]);
    const loc = await createLocation(id, { name: "Riverdale", notes: "" });
    expect(await panel.findByText("City", { selector: "text" })).toBeInTheDocument();
    await user.click(await panel.findByRole("button", { name: "Shape 1" }));
    await user.selectOptions(await panel.findByLabelText("Area location"), "Riverdale");
    await waitFor(async () => expect((await stored(id)).lines[0].area?.locationId).toBe(loc.id));
    expect(await panel.findByText("Riverdale", { selector: "text" })).toBeInTheDocument();

    await updateLocation(loc.id, { name: "Rivervale" });
    expect(await panel.findByText("Rivervale", { selector: "text" })).toBeInTheDocument();
    expect(panel.queryByText("Riverdale", { selector: "text" })).not.toBeInTheDocument();
  });

  it("creates a Location from the Area, named after the Area's name or else its kind", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user, [area("a", 4, { kind: "Forest", color: "#00aa00", name: "Darkwood" }), { ...area("b", 3, { kind: "Swamp", color: "#336633" }), points: sq(10, 4, 3).map(([x, y]) => ({ x, y })) }]);
    await user.click(await panel.findByRole("button", { name: "Shape 1" }));
    await user.selectOptions(await panel.findByLabelText("Area location"), "Create location");
    await waitFor(async () => expect((await listLocations(id)).map((l) => l.name)).toEqual(["Darkwood"]));
    const first = (await listLocations(id))[0];
    await waitFor(async () => expect((await stored(id)).lines[0].area?.locationId).toBe(first.id));

    await user.click(panel.getByRole("button", { name: "Shape 2" }));
    await user.selectOptions(await panel.findByLabelText("Area location"), "Create location");
    await waitFor(async () => expect((await listLocations(id)).map((l) => l.name).sort()).toEqual(["Darkwood", "Swamp"]));
  });

  it("deleting the Location unlinks its Areas on every Map and keeps the old name unless the Area had its own", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user);
    const loc = await createLocation(id, { name: "Riverdale", notes: "" });
    await updateMap((await stored(id)).id, (m) => ({ ...m, lines: [area("a", 4, { kind: "City", color: "#f00", locationId: loc.id }), area("b", 3, { kind: "City", color: "#f00", name: "Own", locationId: loc.id })] }));
    await waitFor(() => expect(panel.getAllByText("Riverdale", { selector: "text" })).toHaveLength(2));
    await deleteLocation(loc.id);
    await waitFor(async () => expect((await stored(id)).lines.map((l) => l.area)).toEqual([{ kind: "City", color: "#f00", name: "Riverdale" }, { kind: "City", color: "#f00", name: "Own" }]));
    expect(await panel.findAllByText("Riverdale", { selector: "text" })).toHaveLength(1);
    expect(panel.getByText("Own", { selector: "text" })).toBeInTheDocument();
  });

  it("selecting a linked Area selects its Location", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user);
    const loc = await createLocation(id, { name: "Riverdale", notes: "" });
    await updateMap((await stored(id)).id, (m) => ({ ...m, lines: [area("a", 4, { kind: "City", color: "#f00", locationId: loc.id })] }));
    await user.click(await panel.findByRole("button", { name: "Shape 1" }));
    await waitFor(() => expect(localStorage.getItem(`dungeon-desktop:location-selection:${id}`)).toBe(loc.id));
  });

  it("clicking an Area's fill selects it; an overlapping click picks the smaller Area; Draw clicks still add points", async () => {
    identitySvg();
    const user = userEvent.setup();
    render(<App />);
    const { panel } = await openMap(user, [area("big", 10, { kind: "Forest", color: "#0a0" }), area("small", 3, { kind: "Clearing", color: "#ff0" })]);
    const small = await panel.findByRole("button", { name: "Area Clearing" });
    const big = panel.getByRole("button", { name: "Area Forest" });
    fireEvent.click(big, { clientX: 3 * 40 + 20, clientY: 3 * 40 + 20 }); // inside both: the smaller wins
    expect(await panel.findByRole("group", { name: "Edit Shape 2" })).toBeInTheDocument();
    fireEvent.click(big, { clientX: 9 * 40, clientY: 9 * 40 }); // inside only the big one
    expect(await panel.findByRole("group", { name: "Edit Shape 1" })).toBeInTheDocument();
    await user.click(small);
    expect(await panel.findByRole("group", { name: /Edit Shape/ })).toBeInTheDocument();

    await user.click(panel.getByRole("button", { name: "Draw" }));
    expect(panel.queryByRole("button", { name: "Area Forest" })).not.toBeInTheDocument();
    await user.pointer({ target: await panel.findByTestId("map-draw"), keys: "[MouseLeft]", coords: { clientX: 200, clientY: 200 } });
    expect(await panel.findByRole("status", { name: "Drawing" })).toHaveTextContent("Drawing 1 point");
  });

  it("areaAt picks the smallest containing Area and ignores plain Shapes and open Lines", () => {
    const lines = [area("big", 10, { kind: "A", color: "#000" }), area("small", 3, { kind: "B", color: "#000" }), line("plain", sq(2, 2, 2), true), line("open", [[0, 0], [9, 9]], false)];
    expect(areaAt(lines, { x: 3, y: 3 })?.id).toBe("small");
    expect(areaAt(lines, { x: 9, y: 9 })?.id).toBe("big");
    expect(areaAt(lines, { x: 20, y: 20 })).toBeUndefined();
  });
});
