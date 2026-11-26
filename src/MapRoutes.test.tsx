import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { listCampaigns } from "./storage";
import { listMaps, updateMap, type MapLine, type MapMarker } from "./storage/maps";
import { createLocation } from "./storage/locations";

type User = ReturnType<typeof userEvent.setup>;

const line = (id: string, points: [number, number][], closed: boolean, extra: Partial<MapLine> = {}): MapLine => ({
  id, closed, points: points.map(([x, y]) => ({ x, y })), segments: Array(closed ? points.length : points.length - 1).fill("plain"), ...extra,
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
  if (lines.length || markers.length) await updateMap((await listMaps(id))[0].id, (m) => ({ ...m, lines, markers }));
  return { id, panel };
}
const proto = SVGSVGElement.prototype as unknown as Record<string, unknown>;
const saved = { ctm: proto.getScreenCTM, pt: proto.createSVGPoint };
const identitySvg = () => {
  proto.getScreenCTM = () => ({ inverse: () => ({}) });
  proto.createSVGPoint = () => ({ x: 0, y: 0, matrixTransform() { return { x: this.x, y: this.y }; } });
};
afterEach(() => { proto.getScreenCTM = saved.ctm; proto.createSVGPoint = saved.pt; });
const stored = async (id: string) => (await listMaps(id))[0];
beforeEach(() => localStorage.clear());
const route = (id = "r") => line(id, [[2, 1], [5, 1], [5, 5]], false, { route: true }); // 3 + 4 squares

describe("Routes", () => {
  it("the Route tool draws an open Line flagged as a Route; clicking its first point adds a point, it never closes", async () => {
    identitySvg();
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user);
    await user.click(panel.getByRole("button", { name: "Route" }));
    const surface = await panel.findByTestId("map-draw");
    const click = (x: number, y: number) => user.pointer({ target: surface, keys: "[MouseLeft]", coords: { clientX: x, clientY: y } });
    await click(200, 200); await click(320, 200); await click(320, 320); await click(201, 199); // back on the first point
    await user.keyboard("{Enter}");
    await waitFor(async () => expect((await stored(id)).lines).toHaveLength(1));
    expect((await stored(id)).lines[0]).toMatchObject({ closed: false, route: true, points: [{ x: 5, y: 5 }, { x: 8, y: 5 }, { x: 8, y: 8 }, { x: 5, y: 5 }] });
    expect(await panel.findByRole("button", { name: "Route 1" })).toBeInTheDocument();

    // Esc cancels, one point is not a Route
    await click(40, 40);
    await user.keyboard("{Escape}");
    await click(80, 80); await user.keyboard("{Enter}");
    expect((await stored(id)).lines).toHaveLength(1);
  });

  it("labels a multi-segment Route with its length in feet and in miles, and in miles", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user, [route(), line("l", [[1, 8], [3, 8]], false)]);
    const r = await panel.findByRole("button", { name: "Route 1" });
    expect(r).toHaveClass("map-route");
    expect(within(r).getByText("35 ft")).toBeInTheDocument(); // 7 squares x 5 ft
    expect(panel.getByRole("button", { name: "Line 1" })).not.toHaveClass("map-route");


    // from 1,000 ft it reads in miles (5 ft per square)
    await updateMap((await stored(id)).id, (m) => ({ ...m, lines: [line("r", [[0, 0], [400, 0]], false, { route: true })] }));
    await waitFor(() => expect(panel.getByRole("button", { name: "Route 1" })).toHaveTextContent("0.38 mi"));
  });

  it("selects a Route, shows its length, offers no Make area or segment types, and deletes it", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user, [route()]);
    await user.click(await panel.findByRole("button", { name: "Route 1" }));
    const editor = await panel.findByRole("group", { name: "Edit Route 1" });
    expect(within(editor).getByText("35 ft")).toBeInTheDocument();
    expect(panel.queryByRole("button", { name: "Make area" })).not.toBeInTheDocument();
    expect(panel.queryByLabelText("Segment 1 type")).not.toBeInTheDocument();
    await user.click(panel.getByRole("button", { name: "Delete Route 1" }));
    await waitFor(async () => expect((await stored(id)).lines).toHaveLength(0));
  });
});

describe("unlinking a Location from a Marker or Area", () => {
  it("choosing None keeps the Location's current name as the Marker's own", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user);
    const loc = await createLocation(id, { name: "Riverdale", notes: "" });
    await updateMap((await stored(id)).id, (m) => ({ ...m, markers: [{ id: "m", x: 3, y: 3, name: "Marker 1", color: "#fff", icon: "pin", note: "", locationId: loc.id }] }));
    await user.click(await panel.findByRole("button", { name: "Marker Riverdale" }));
    await user.selectOptions(await panel.findByLabelText("Marker location"), "None");
    await waitFor(async () => expect((await stored(id)).markers[0]).toMatchObject({ name: "Riverdale" }));
    expect((await stored(id)).markers[0].locationId).toBeUndefined();
    expect(await panel.findByRole("button", { name: "Marker Riverdale" })).toBeInTheDocument();
  });

  it("choosing None keeps the Location's current name as the Area's own (unless it had one)", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user);
    const loc = await createLocation(id, { name: "Riverdale", notes: "" });
    const shape = (i: string, extra: object) => line(i, [[2, 2], [5, 2], [5, 5], [2, 5]], true, { area: { kind: "City", color: "#f00", locationId: loc.id, ...extra } });
    await updateMap((await stored(id)).id, (m) => ({ ...m, lines: [shape("a", {})] }));
    await user.click(await panel.findByRole("button", { name: "Shape 1" }));
    await user.selectOptions(await panel.findByLabelText("Area location"), "None");
    await waitFor(async () => expect((await stored(id)).lines[0].area).toEqual({ kind: "City", color: "#f00", name: "Riverdale" }));

    await updateMap((await stored(id)).id, (m) => ({ ...m, lines: [shape("a", { name: "Own" })] }));
    await user.selectOptions(await panel.findByLabelText("Area location"), "None");
    await waitFor(async () => expect((await stored(id)).lines[0].area).toEqual({ kind: "City", color: "#f00", name: "Own" }));
  });
});
