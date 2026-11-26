import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { listCampaigns } from "./storage";
import { listMaps, updateMap, type MapLine } from "./storage/maps";

type User = ReturnType<typeof userEvent.setup>;
type P = [number, number];

const line = (id: string, points: P[], closed: boolean, extra: Partial<MapLine> = {}): MapLine => ({
  id, closed, points: points.map(([x, y]) => ({ x, y })), segments: Array(closed ? points.length : points.length - 1).fill("plain"), ...extra,
});
const sq = (x: number, y: number, s: number): P[] => [[x, y], [x + s, y], [x + s, y + s], [x, y + s]];
const pts = (p: P[]) => p.map(([x, y]) => ({ x, y }));
const areaLine = (id: string, points: P[], kind: string, holes?: P[][]): MapLine =>
  line(id, points, true, { area: { kind, color: "#00f", ...(holes ? { holes: holes.map(pts) } : {}) } });

async function openMap(user: User, lines: MapLine[]) {
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
  await updateMap((await listMaps(id))[0].id, (m) => ({ ...m, lines }));
  return { id, panel };
}
beforeEach(() => localStorage.clear());
const stored = async (id: string) => (await listMaps(id))[0];
// A room with two Holes; Shape 2 is a far-away Shape to select something else.
const room = () => areaLine("room", sq(0, 0, 10), "Room", [sq(2, 2, 2), sq(6, 6, 2)]);
const other = () => line("other", sq(12, 0, 2), true);

describe("Hole selection", () => {
  it("draws Hole edges only while the Area is selected", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { panel } = await openMap(user, [room(), other()]);
    await panel.findByRole("button", { name: "Shape 1" });
    expect(panel.queryByRole("button", { name: /^Hole / })).not.toBeInTheDocument();
    await user.click(panel.getByRole("button", { name: "Shape 1" }));
    expect(await panel.findByRole("button", { name: "Hole 1 of Room" })).toBeInTheDocument();
    expect(panel.getByRole("button", { name: "Hole 2 of Room" })).toBeInTheDocument();
    expect(document.querySelectorAll(".map-hole-edge")).toHaveLength(2);
    await user.click(panel.getByRole("button", { name: "Shape 2" }));
    expect(panel.queryByRole("button", { name: /^Hole / })).not.toBeInTheDocument();
    expect(document.querySelectorAll(".map-hole-edge")).toHaveLength(0);
  });

  it("clicking a Hole's edge selects that Hole; Remove hole removes only it, and the last one drops holes", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user, [room(), other()]);
    await user.click(await panel.findByRole("button", { name: "Shape 1" }));
    expect(panel.queryByRole("button", { name: "Remove hole" })).not.toBeInTheDocument();
    await user.click(await panel.findByRole("button", { name: "Hole 2 of Room" }));
    expect(panel.getByRole("button", { name: "Hole 2 of Room" })).toHaveAttribute("aria-pressed", "true");
    expect(panel.getByRole("button", { name: "Hole 1 of Room" })).toHaveAttribute("aria-pressed", "false");
    await user.click(panel.getByRole("button", { name: "Remove hole" }));
    await waitFor(async () => expect((await stored(id)).lines[0].area?.holes).toEqual([pts(sq(2, 2, 2))]));
    expect(panel.getByRole("group", { name: "Edit Shape 1" })).toBeInTheDocument(); // the Area stays selected
    expect(panel.queryByRole("button", { name: "Remove hole" })).not.toBeInTheDocument(); // no Hole selected any more
    expect(panel.queryByRole("button", { name: "Hole 2 of Room" })).not.toBeInTheDocument();

    await user.click(panel.getByRole("button", { name: "Hole 1 of Room" }));
    await user.click(panel.getByRole("button", { name: "Remove hole" }));
    await waitFor(async () => expect((await stored(id)).lines[0].area).not.toHaveProperty("holes"));
    expect((await stored(id)).lines).toHaveLength(2);
  });

  it("Delete with a Hole selected removes only the Hole; Delete again removes the Area", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user, [room(), other()]);
    await user.click(await panel.findByRole("button", { name: "Shape 1" }));
    await user.click(await panel.findByRole("button", { name: "Hole 1 of Room" }));
    await user.keyboard("{Delete}");
    await waitFor(async () => expect((await stored(id)).lines[0].area?.holes).toEqual([pts(sq(6, 6, 2))]));
    expect((await stored(id)).lines).toHaveLength(2);
    expect(panel.getByRole("group", { name: "Edit Shape 1" })).toBeInTheDocument();
    await user.keyboard("{Delete}");
    await waitFor(async () => expect((await stored(id)).lines.map((l) => l.id)).toEqual(["other"]));
  });

  it("Esc steps from the Hole back to the Area, then drops the selection", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { panel } = await openMap(user, [room(), other()]);
    await user.click(await panel.findByRole("button", { name: "Shape 1" }));
    await user.click(await panel.findByRole("button", { name: "Hole 1 of Room" }));
    await user.keyboard("{Escape}");
    expect(panel.queryByRole("button", { name: "Remove hole" })).not.toBeInTheDocument();
    expect(panel.getByRole("group", { name: "Edit Shape 1" })).toBeInTheDocument();
    expect(panel.getByRole("button", { name: "Hole 1 of Room" })).toHaveAttribute("aria-pressed", "false");
    await user.keyboard("{Escape}");
    expect(panel.queryByRole("group", { name: "Edit Shape 1" })).not.toBeInTheDocument();
    expect(panel.queryByRole("button", { name: /^Hole / })).not.toBeInTheDocument();
  });

  it("while Subtract shape waits, Hole edges don't take clicks, so a cutter on a Hole's edge can still be picked", async () => {
    const user = userEvent.setup();
    render(<App />);
    // The pillar shares Hole 1's top and left edges (jsdom can't stack hit targets, so this checks the edges let clicks through); the cut merges into Hole 1.
    const { id, panel } = await openMap(user, [room(), line("pillar", sq(2, 2, 3), true)]);
    await user.click(await panel.findByRole("button", { name: "Shape 1" }));
    await user.click(await panel.findByRole("button", { name: "Hole 1 of Room" }));
    await user.click(panel.getByRole("button", { name: "Subtract shape" }));
    expect(panel.queryByRole("button", { name: "Remove hole" })).not.toBeInTheDocument(); // the Hole selection lapses
    expect(panel.getByRole("button", { name: "Hole 1 of Room" })).toHaveStyle({ pointerEvents: "none" });
    await user.click(panel.getByRole("button", { name: "Shape 2" }));
    expect(panel.queryByRole("status", { name: "Subtract shape" })).not.toBeInTheDocument();
    await waitFor(async () => expect((await stored(id)).lines[0].area?.holes?.flat()).toContainEqual({ x: 5, y: 5 }));
    expect((await stored(id)).lines[0].area?.holes).toHaveLength(2);
  });
});

/** jsdom has no SVG transform: use the identity, so client pixels are canvas pixels (40 per square). Restored after each test. */
const proto = SVGSVGElement.prototype as unknown as Record<string, unknown>;
const saved = { ctm: proto.getScreenCTM, pt: proto.createSVGPoint };
const identitySvg = () => {
  proto.getScreenCTM = () => ({ inverse: () => ({}) });
  proto.createSVGPoint = () => ({ x: 0, y: 0, matrixTransform() { return { x: this.x, y: this.y }; } });
};
afterEach(() => { proto.getScreenCTM = saved.ctm; proto.createSVGPoint = saved.pt; });
/** Drags a point handle to square (x, y). */
const dragTo = (user: User, handle: HTMLElement, x: number, y: number) =>
  user.pointer([{ keys: "[MouseLeft>]", target: handle }, { target: handle, coords: { clientX: x * 40, clientY: y * 40 } }, { keys: "[/MouseLeft]", target: handle }]);
// A U-shaped room (two arms up from a bottom bar) with a Hole in the left arm: dragging a Hole point past the right arm would cut its top off.
const uRoom = () => areaLine("u", [[0, 0], [3, 0], [3, 8], [6, 8], [6, 0], [9, 0], [9, 10], [0, 10]], "Hall", [[[1, 2], [2, 2], [2, 6], [1, 6]]]);

describe("Hole point drags", () => {
  it("a selected Area's Hole points have handles; dragging one saves the Hole", async () => {
    identitySvg();
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user, [room(), other()]);
    expect(panel.queryByRole("button", { name: /^Point 1 of Hole/ })).not.toBeInTheDocument();
    await user.click(await panel.findByRole("button", { name: "Shape 1" }));
    await dragTo(user, await panel.findByRole("button", { name: "Point 3 of Hole 1 of Room" }), 5, 5);
    await waitFor(async () => expect((await stored(id)).lines[0].area?.holes).toEqual([pts([[2, 2], [4, 2], [5, 5], [2, 4]]), pts(sq(6, 6, 2))]));
    expect((await stored(id)).lines[0].points).toEqual(pts(sq(0, 0, 10)));
  });

  it("Holes dragged into each other merge", async () => {
    identitySvg();
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user, [room(), other()]);
    await user.click(await panel.findByRole("button", { name: "Shape 1" }));
    await dragTo(user, await panel.findByRole("button", { name: "Point 3 of Hole 1 of Room" }), 7, 7);
    await waitFor(async () => expect((await stored(id)).lines[0].area?.holes).toHaveLength(1));
    expect((await stored(id)).lines[0].area?.holes?.[0]).toContainEqual({ x: 8, y: 8 });
  });

  it("a Hole dragged across the outline asks Cut notch? (dashed preview); No keeps the Area, Yes saves the Notch", async () => {
    identitySvg();
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user, [areaLine("room", sq(0, 0, 10), "Room", [sq(7, 4, 2)]), other()]);
    const before = (await stored(id)).lines[0];
    await user.click(await panel.findByRole("button", { name: "Shape 1" }));
    await dragTo(user, await panel.findByRole("button", { name: "Point 2 of Hole 1 of Room" }), 12, 4);
    const ask = await panel.findByRole("group", { name: "Cut notch" });
    expect(ask).toHaveTextContent("Cut notch? The new outline of Room is shown dashed");
    expect(panel.getByTestId("notch-preview")).toBeInTheDocument();
    expect(panel.queryByRole("button", { name: /^Point 1 of Hole/ })).not.toBeInTheDocument(); // no handles while it waits
    await user.click(within(ask).getByRole("button", { name: "No" }));
    expect(panel.queryByTestId("notch-preview")).not.toBeInTheDocument();
    expect((await stored(id)).lines[0]).toEqual(before);

    await dragTo(user, await panel.findByRole("button", { name: "Point 2 of Hole 1 of Room" }), 12, 4);
    await user.keyboard("{Escape}"); // Esc is No
    expect(panel.queryByRole("group", { name: "Cut notch" })).not.toBeInTheDocument();
    expect(panel.getByRole("group", { name: "Edit Shape 1" })).toBeInTheDocument();

    await dragTo(user, await panel.findByRole("button", { name: "Point 2 of Hole 1 of Room" }), 12, 4);
    await user.click(within(await panel.findByRole("group", { name: "Cut notch" })).getByRole("button", { name: "Yes" }));
    await waitFor(async () => expect((await stored(id)).lines[0].area).not.toHaveProperty("holes"));
    const l = (await stored(id)).lines[0];
    expect(l.points.length).toBeGreaterThan(4);
    expect(l.points).toContainEqual({ x: 7, y: 4 });
    expect(l.segments).toHaveLength(l.points.length);
  });

  it("an outline point pulled across a Hole asks Cut notch? too; an Area without Holes saves its outline drag at once", async () => {
    identitySvg();
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user, [areaLine("room", sq(0, 0, 10), "Room", [sq(6, 6, 2)]), areaLine("plain", sq(12, 0, 2), "Yard")]);
    await user.click(await panel.findByRole("button", { name: "Shape 1" }));
    await dragTo(user, await panel.findByRole("button", { name: "Point 3 of Shape 1" }), 7, 7);
    expect(await panel.findByRole("group", { name: "Cut notch" })).toBeInTheDocument();
    expect((await stored(id)).lines[0].points).toEqual(pts(sq(0, 0, 10)));
    await user.keyboard("{Escape}");

    await user.click(panel.getByRole("button", { name: "Shape 2" }));
    await dragTo(user, await panel.findByRole("button", { name: "Point 3 of Shape 2" }), 13, 3);
    await waitFor(async () => expect((await stored(id)).lines[1].points[2]).toEqual({ x: 13, y: 3 }));
    expect(panel.queryByRole("group", { name: "Cut notch" })).not.toBeInTheDocument();
  });

  it("a drag that would split the Area snaps back with a message", async () => {
    identitySvg();
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user, [uRoom()]);
    const before = (await stored(id)).lines[0];
    await user.click(await panel.findByRole("button", { name: "Shape 1" }));
    await dragTo(user, await panel.findByRole("button", { name: "Point 1 of Hole 1 of Hall" }), 10, 4);
    expect(await panel.findByRole("status", { name: "Point drag" })).toHaveTextContent("That would split Hall in two");
    expect(panel.queryByRole("group", { name: "Cut notch" })).not.toBeInTheDocument();
    expect((await stored(id)).lines[0]).toEqual(before);
    // The handle is back where it was.
    expect(panel.getByRole("button", { name: "Point 1 of Hole 1 of Hall" })).toHaveAttribute("cx", "40");
  });
});
