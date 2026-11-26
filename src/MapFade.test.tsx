import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { listCampaigns } from "./storage";
import { listMaps, updateMap, type MapLine, type MapMarker, type MapToken } from "./storage/maps";
import { createLocation } from "./storage/locations";

type User = ReturnType<typeof userEvent.setup>;

const sq = (x: number, y: number, s: number) => [{ x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s }];
const area = (id: string, x: number, y: number, s: number, locationId?: string): MapLine => ({
  id, points: sq(x, y, s), closed: true, segments: ["plain", "plain", "plain", "plain"], area: { kind: "Area", color: "#3498db", ...(locationId ? { locationId } : {}) },
});
const wall = (id: string, x: number, y: number, len: number): MapLine => ({ id, points: [{ x, y }, { x: x + len, y }], closed: false, segments: ["wall"] });
const token = (id: string, name: string, x: number, y: number): MapToken => ({ id, name, color: "#c0392b", x, y });
const marker = (id: string, x: number, y: number, locationId: string): MapMarker => ({ id, x, y, name: id, color: "#e67e22", icon: "pin", note: "", locationId });

async function openMap(user: User, build: (loc: { keep: string }) => { lines?: MapLine[]; markers?: MapMarker[]; tokens?: MapToken[] }) {
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
  const keep = (await createLocation(id, { name: "Keep", notes: "" })).id;
  const d = build({ keep });
  await updateMap((await listMaps(id))[0].id, (m) => ({ ...m, lines: d.lines ?? [], markers: d.markers ?? [], tokens: d.tokens ?? [] }));
  return { id, panel };
}
const zoomOut = async (user: User, panel: ReturnType<typeof within>, times: number) => {
  for (let i = 0; i < times; i++) await user.click(panel.getByRole("button", { name: "Zoom out" }));
};

beforeEach(() => localStorage.clear());

describe("fading by size", () => {
  it("hides Areas, Lines and Tokens that are too small to see, and keeps big ones", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { panel } = await openMap(user, () => ({
      lines: [area("big", -2, -2, 4), area("small", 5, 5, 1), wall("w", 3, 3, 1)],
      tokens: [token("t", "Goblin", 1, 1)],
    }));
    expect(await panel.findByRole("button", { name: "Token Goblin" })).toBeInTheDocument();
    expect(panel.getAllByRole("button", { name: /^Area / })).toHaveLength(2);
    expect(panel.getByRole("button", { name: "Line 1" })).toBeInTheDocument();
    await zoomOut(user, panel, 6); // 32px per square -> about 2.8 px
    expect(panel.queryByRole("button", { name: "Token Goblin" })).not.toBeInTheDocument();
    expect(panel.queryByRole("button", { name: "Line 1" })).not.toBeInTheDocument(); // a 1-square wall is under 4 px
    expect(panel.getAllByRole("button", { name: /^Area / })).toHaveLength(1); // the 4-square Area (11 px) stays, the 1-square one (2.8 px) goes
  });

  it("keeps every side of a shape while the shape is visible: short sides go with the whole shape, not before it", async () => {
    const user = userEvent.setup();
    render(<App />);
    const thin = (id: string, y: number, extra: Partial<MapLine>): MapLine =>
      ({ id, points: [{ x: 0, y }, { x: 10, y }, { x: 10, y: y + 1 }, { x: 0, y: y + 1 }], closed: true, segments: ["wall", "wall", "wall", "wall"], ...extra });
    const { panel } = await openMap(user, () => ({ lines: [thin("shape", 0, {}), thin("room", 3, { area: { kind: "Area", color: "#3498db" } })] }));
    await panel.findByRole("button", { name: "Shape 1" });
    await zoomOut(user, panel, 6); // the 1-square ends are about 2.8 px, the 10-square sides about 28 px
    const drawn = (id: string) => panel.getByRole("button", { name: id }).closest("g")!.querySelectorAll("[data-segment]").length;
    expect(drawn("Shape 1")).toBe(4);
    expect(drawn("Shape 2")).toBe(4);
  });

  it("keeps a selected Area visible even when it is tiny", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { panel } = await openMap(user, () => ({ lines: [area("small", 0, 0, 1)] }));
    await user.click(await panel.findByRole("button", { name: /^Area / }));
    await zoomOut(user, panel, 6);
    expect(panel.getByRole("button", { name: /^Area / })).toBeInTheDocument();
  });

  it("renders only what is in view", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { panel } = await openMap(user, () => ({ lines: [area("near", 0, 0, 3), area("far", 500, 500, 3)], tokens: [token("t", "Far", 400, 0)] }));
    await panel.findByRole("button", { name: /^Area / });
    expect(panel.getAllByRole("button", { name: /^Area / })).toHaveLength(1);
    expect(panel.queryByRole("button", { name: "Token Far" })).not.toBeInTheDocument();
  });
});

describe("Party Token zoomed far out", () => {
  it("stays on the Map at a minimum size and still sets the party location when moved onto a linked Marker", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user, ({ keep }) => ({ markers: [marker("Gate", 1.5, 0.5, keep)] }));
    await user.click(panel.getByRole("button", { name: "Add party token" }));
    const tok = await panel.findByRole("button", { name: "Party token" });
    await zoomOut(user, panel, 6);
    const scale = Number((tok.querySelector("g") as SVGGElement).style.transform.match(/scale\(([\d.]+)\)/)![1]);
    expect(scale).toBeGreaterThan(4); // about 14 px / 2.8 px: drawn at its minimum on-screen size
    expect(panel.getByRole("button", { name: "Party token" })).toBeInTheDocument();
    tok.focus();
    await user.keyboard("{ArrowRight}"); // the nearest whole square to the right, though it is a pixel or two away on screen
    await waitFor(async () => expect((await listMaps(id))[0].partyToken).toEqual({ x: 1, y: 0 }));
    await waitFor(async () => expect((await listCampaigns())[0].partyLocationId).toBe((await listMaps(id))[0].markers[0].locationId));
  });

  it("sets the party location when dropped on a linked Marker's icon zoomed far out, though the Marker is squares away", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user, ({ keep }) => ({ markers: [marker("Gate", 3.5, 0.5, keep)] }));
    await user.click(panel.getByRole("button", { name: "Add party token" }));
    const tok = await panel.findByRole("button", { name: "Party token" });
    await zoomOut(user, panel, 6);
    tok.focus();
    await user.keyboard("{ArrowRight}"); // to (1, 0): two squares from the Marker, about 6 px on screen, inside its icon
    await waitFor(async () => expect((await listCampaigns())[0].partyLocationId).toBe((await listMaps(id))[0].markers[0].locationId));
  });
});

describe("Marker Priority", () => {
  const pm = (id: string, x: number, priority?: MapMarker["priority"], placedAt = 32): MapMarker =>
    ({ id, x, y: 0, name: id, color: "#e67e22", icon: "pin", note: "", placedAt, ...(priority ? { priority } : {}) });
  const has = (panel: ReturnType<typeof within>, n: string) => panel.queryByRole("button", { name: `Marker ${n}` });

  it("hides Normal after zooming out past 10x, Minor sooner, and never Always", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { panel } = await openMap(user, () => ({ markers: [pm("Nrm", -3), pm("Min", 0, "minor"), pm("Alw", 3, "always"), pm("Maj", 6, "major")] }));
    await panel.findByRole("button", { name: "Marker Nrm" });
    await zoomOut(user, panel, 3); // 32 -> 9.5 px: ratio 3.4
    expect(has(panel, "Min")).toBeInTheDocument(); // ratio 3.4 is within Minor's ramp (3..4.5)
    await zoomOut(user, panel, 1); // ratio 5.06: Minor gone
    expect(has(panel, "Min")).not.toBeInTheDocument();
    expect(has(panel, "Nrm")).toBeInTheDocument();
    await zoomOut(user, panel, 5); // ratio ~38: Normal gone
    expect(has(panel, "Nrm")).not.toBeInTheDocument();
    expect(has(panel, "Alw")).toBeInTheDocument();
    expect(has(panel, "Maj")).toBeInTheDocument();
  });

  it("treats a Marker without placedAt or priority as Normal at battle scale", async () => {
    const user = userEvent.setup();
    render(<App />);
    const old = { id: "Old", x: 0, y: 0, name: "Old", color: "#e67e22", icon: "pin", note: "" } as MapMarker;
    const { panel } = await openMap(user, () => ({ markers: [old] }));
    await panel.findByRole("button", { name: "Marker Old" });
    await zoomOut(user, panel, 8); // ratio 25.6
    expect(has(panel, "Old")).not.toBeInTheDocument();
  });

  it("fades a selected Marker like any other, and drops the selection once it has faded out", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { panel } = await openMap(user, () => ({ markers: [pm("Nrm", 0)] }));
    await user.click(await panel.findByRole("button", { name: "Marker Nrm" }));
    expect(panel.getByRole("combobox", { name: "Priority" })).toBeInTheDocument(); // its editor is open
    await zoomOut(user, panel, 9); // ratio ~38: past Normal's 15x
    expect(has(panel, "Nrm")).not.toBeInTheDocument();
    await waitFor(() => expect(panel.queryByRole("combobox", { name: "Priority" })).not.toBeInTheDocument());
  });

  it("records the zoom on a new Marker and persists Priority and Set to this zoom", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user, () => ({ markers: [pm("Nrm", 0, undefined, 1)] }));
    await user.click(await panel.findByRole("button", { name: "Marker Nrm" }));
    await user.selectOptions(panel.getByRole("combobox", { name: "Priority" }), "Major");
    await waitFor(async () => expect((await listMaps(id))[0].markers[0].priority).toBe("major"));
    expect(panel.getByRole("combobox", { name: "Priority" })).toHaveValue("major");
    await zoomOut(user, panel, 2); // 32 / 2.25 = 14.2 px
    await user.click(panel.getByRole("button", { name: "Set to this zoom" }));
    await waitFor(async () => expect((await listMaps(id))[0].markers[0].placedAt).toBeCloseTo(32 / 2.25, 3));
  });

  it("Set to this zoom re-anchors a fading Marker, so it stays while the others go", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user, () => ({ markers: [pm("Nrm", 0), pm("Other", 3)] }));
    await user.click(await panel.findByRole("button", { name: "Marker Nrm" }));
    await zoomOut(user, panel, 6); // ratio ~11: both fading (Normal fades from 10x to 15x), the selected one still there to set
    await user.click(panel.getByRole("button", { name: "Set to this zoom" }));
    await waitFor(async () => expect((await listMaps(id))[0].markers[0].placedAt).toBeLessThan(3));
    await zoomOut(user, panel, 2); // ratio ~25 for Other, ~2 for the re-anchored one
    expect(has(panel, "Other")).toBeNull();
    expect(has(panel, "Nrm")).toBeInTheDocument();
  });

  it("a new Marker records the current zoom", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user, () => ({}));
    await zoomOut(user, panel, 2);
    await user.click(panel.getByRole("button", { name: /^Marker$/ }));
    const proto = SVGSVGElement.prototype as unknown as Record<string, unknown>;
    const saved = { ctm: proto.getScreenCTM, pt: proto.createSVGPoint };
    proto.getScreenCTM = () => ({ inverse: () => ({}) }); // jsdom has no SVG transform: identity
    proto.createSVGPoint = () => ({ x: 0, y: 0, matrixTransform() { return { x: this.x, y: this.y }; } });
    try { fireEvent.click(await panel.findByTestId("map-marker-surface"), { clientX: 10, clientY: 10 }); } finally { proto.getScreenCTM = saved.ctm; proto.createSVGPoint = saved.pt; }
    await waitFor(async () => expect((await listMaps(id))[0].markers[0].placedAt).toBeCloseTo(32 / 2.25, 3));
  });
});
