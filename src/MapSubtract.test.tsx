import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
const rect = (x: number, y: number, w: number, h: number): P[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const pts = (p: P[]) => p.map(([x, y]) => ({ x, y }));
const keys = (ring: { x: number; y: number }[]) => ring.map((p) => `${p.x},${p.y}`).sort();
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
/** jsdom has no SVG transform: use the identity, so client pixels are canvas pixels (40 per square). Restored after each test. */
const proto = SVGSVGElement.prototype as unknown as Record<string, unknown>;
const saved = { ctm: proto.getScreenCTM, pt: proto.createSVGPoint };
const identitySvg = () => {
  proto.getScreenCTM = () => ({ inverse: () => ({}) });
  proto.createSVGPoint = () => ({ x: 0, y: 0, matrixTransform() { return { x: this.x, y: this.y }; } });
};
afterEach(() => { proto.getScreenCTM = saved.ctm; proto.createSVGPoint = saved.pt; });
beforeEach(() => localStorage.clear());
const stored = async (id: string) => (await listMaps(id))[0];
const status = (panel: ReturnType<typeof within>) => panel.queryByRole("status", { name: "Subtract shape" });

describe("Subtract shape", () => {
  it("cuts a Shape fully inside the selected Area out as a Hole; the cutter stays and the Area stays selected", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user, [areaLine("room", sq(1, 1, 8), "Room"), line("pillar", sq(3, 3, 2), true, { segments: ["wall", "wall", "wall", "wall"] })]);
    await user.click(await panel.findByRole("button", { name: "Shape 1" }));
    await user.click(await panel.findByRole("button", { name: "Subtract shape" }));
    expect(status(panel)).toHaveTextContent("Click a Shape or Area to cut from Room, Esc to cancel");
    expect(panel.queryByRole("button", { name: "Subtract shape" })).not.toBeInTheDocument();

    await user.click(panel.getByRole("button", { name: "Shape 2" }));
    await waitFor(async () => expect((await stored(id)).lines[0].area?.holes).toHaveLength(1));
    const after = await stored(id);
    expect(keys(after.lines[0].area!.holes![0])).toEqual(keys(pts(sq(3, 3, 2))));
    expect(after.lines[0].points).toEqual(pts(sq(1, 1, 8))); // outline untouched
    expect(after.lines[1]).toEqual(line("pillar", sq(3, 3, 2), true, { segments: ["wall", "wall", "wall", "wall"] })); // cutter kept as it was
    expect(panel.getByRole("group", { name: "Edit Shape 1" })).toBeInTheDocument(); // still the Area, not the cutter
    expect(status(panel)).not.toBeInTheDocument();
    await waitFor(() => expect(panel.getByRole("button", { name: "Area Room" }).getAttribute("d")!.match(/M/g)).toHaveLength(2));
  });

  it("cuts another Area (clicked on its fill) and merges the cut with the Hole it overlaps", async () => {
    identitySvg();
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user, [areaLine("forest", sq(0, 0, 10), "Forest", [sq(6, 6, 2)]), areaLine("lake", sq(5, 5, 2), "Lake")]);
    await user.click(await panel.findByRole("button", { name: "Shape 1" }));
    await user.click(await panel.findByRole("button", { name: "Subtract shape" }));
    fireEvent.click(panel.getByRole("button", { name: "Area Lake" }), { clientX: 5.5 * 40, clientY: 5.5 * 40 });
    await waitFor(async () => expect(keys((await stored(id)).lines[0].area!.holes![0])).toEqual(
      keys(pts([[5, 5], [7, 5], [7, 6], [8, 6], [8, 8], [6, 8], [6, 7], [5, 7]])),
    ));
    const after = await stored(id);
    expect(after.lines[0].area!.holes).toHaveLength(1);
    expect(after.lines[1]).toEqual(areaLine("lake", sq(5, 5, 2), "Lake")); // the cutter Area stays
    expect(panel.getByRole("group", { name: "Edit Shape 1" })).toBeInTheDocument();
    expect(panel.getByRole("button", { name: "Area Lake" })).toBeInTheDocument();
  });

  it("refuses cuts that miss, erase, split or touch the edge, and ignores Routes and open Lines, saying why", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user, [
      areaLine("room", sq(1, 1, 4), "Room"), line("out", sq(8, 1, 2), true), line("all", sq(0, 0, 6), true), line("bar", rect(0, 2, 6, 1), true),
      line("touch", [[1, 3], [3, 2], [3, 4]], true), line("route", [[1, 7], [5, 7]], false, { route: true }), line("open", [[1, 8], [5, 8]], false),
    ]);
    await user.click(await panel.findByRole("button", { name: "Shape 1" }));
    await user.click(await panel.findByRole("button", { name: "Subtract shape" }));
    const tries: [string, string][] = [
      ["Shape 2", "That shape doesn't overlap Room"], ["Shape 3", "That cut would remove all of Room"], ["Shape 4", "That cut would split Room in two"],
      ["Shape 5", "That cut touches the edge of Room"], ["Route 1", "Only a Shape or Area can cut"], ["Line 1", "Only a Shape or Area can cut"],
    ];
    for (const [name, why] of tries) {
      await user.click(panel.getByRole("button", { name }));
      expect(status(panel)).toHaveTextContent(`${why}. Click a Shape or Area to cut from Room, Esc to cancel`);
      expect(panel.getByRole("group", { name: "Edit Shape 1" })).toBeInTheDocument(); // selection unchanged
    }
    const after = await stored(id);
    expect(after.lines[0].area?.holes).toBeUndefined();
    expect(after.lines[0].points).toEqual(pts(sq(1, 1, 4)));
  });

  it("Esc, a click on the Area itself or on empty Map cancels Subtract shape and keeps the Area selected", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user, [areaLine("room", sq(1, 1, 6), "Room"), line("pillar", sq(3, 3, 1), true)]);
    await user.click(await panel.findByRole("button", { name: "Shape 1" }));
    const start = async () => { await user.click(await panel.findByRole("button", { name: "Subtract shape" })); expect(status(panel)).toBeInTheDocument(); };

    await start();
    await user.keyboard("{Escape}");
    expect(status(panel)).not.toBeInTheDocument();
    expect(panel.getByRole("group", { name: "Edit Shape 1" })).toBeInTheDocument();

    await start();
    await user.click(panel.getByRole("button", { name: "Shape 1" }));
    expect(status(panel)).not.toBeInTheDocument();

    await start();
    const bg = panel.getByTestId("map-pan");
    fireEvent.pointerDown(bg, { clientX: 400, clientY: 400 });
    fireEvent.pointerUp(bg, { clientX: 400, clientY: 400 });
    expect(status(panel)).not.toBeInTheDocument();
    expect(panel.getByRole("group", { name: "Edit Shape 1" })).toBeInTheDocument();

    await user.click(panel.getByRole("button", { name: "Shape 2" })); // not subtracting any more: an ordinary selection, no cut
    expect(await panel.findByRole("group", { name: "Edit Shape 2" })).toBeInTheDocument();
    expect((await stored(id)).lines[0].area?.holes).toBeUndefined();
  });

  describe("a cut across the edge (Notch)", () => {
    // Room 1..9 with a wall along the top and a door on the right; the cutter bites 4..6 out of the top edge.
    const room = () => areaLine("room", sq(1, 1, 8), "Room");
    const walled = () => ({ ...room(), segments: ["wall", "door", "plain", "plain"] as MapLine["segments"] });
    const bite = () => line("bite", sq(4, 0, 2), true);
    const startCut = async (user: User, panel: ReturnType<typeof within>) => {
      await user.click(await panel.findByRole("button", { name: "Shape 1" }));
      await user.click(await panel.findByRole("button", { name: "Subtract shape" }));
      await user.click(panel.getByRole("button", { name: "Shape 2" }));
      return panel.getByRole("group", { name: "Cut notch" });
    };

    it("previews the new outline and asks first; Yes saves the outline, keeps walls and doors on surviving edges, new edges plain", async () => {
      const user = userEvent.setup();
      render(<App />);
      const { id, panel } = await openMap(user, [walled(), bite()]);
      const ask = await startCut(user, panel);
      expect(ask).toHaveTextContent("Cut notch?");
      expect(panel.getByTestId("notch-preview").getAttribute("d")!.match(/L/g)).toHaveLength(7); // 8 points
      expect(status(panel)).not.toBeInTheDocument();

      await user.click(panel.getByRole("button", { name: "Shape 2" })); // ignored while asking
      expect(panel.getByRole("group", { name: "Cut notch" })).toBeInTheDocument();
      expect((await stored(id)).lines[0]).toEqual(walled());

      await user.click(within(ask).getByRole("button", { name: "Yes" }));
      await waitFor(async () => expect((await stored(id)).lines[0].points).toHaveLength(8));
      const l = (await stored(id)).lines[0];
      expect(keys(l.points)).toEqual(keys(pts([[1, 1], [4, 1], [4, 2], [6, 2], [6, 1], [9, 1], [9, 9], [1, 9]])));
      const kind = (a: P, b: P) => {
        const i = l.points.findIndex((p, j) => { const q = l.points[(j + 1) % l.points.length]; return `${p.x},${p.y},${q.x},${q.y}` === `${a},${b}` || `${q.x},${q.y},${p.x},${p.y}` === `${a},${b}`; });
        return l.segments[i];
      };
      expect(l.segments).toHaveLength(8);
      expect([kind([1, 1], [4, 1]), kind([6, 1], [9, 1])]).toEqual(["wall", "wall"]); // the walled top survives on both sides
      expect(kind([9, 1], [9, 9])).toBe("door");
      expect([kind([4, 1], [4, 2]), kind([4, 2], [6, 2]), kind([6, 2], [6, 1])]).toEqual(["plain", "plain", "plain"]);
      expect(l.area?.holes).toBeUndefined();
      expect((await stored(id)).lines[1]).toEqual(bite()); // the cutter stays
      expect(panel.getByRole("group", { name: "Edit Shape 1" })).toBeInTheDocument();
      expect(panel.queryByRole("group", { name: "Cut notch" })).not.toBeInTheDocument();
      expect(panel.queryByTestId("notch-preview")).not.toBeInTheDocument();
      expect(status(panel)).not.toBeInTheDocument();
    });

    it("No and Esc leave the Area unchanged and end Subtract shape, the Area still selected", async () => {
      const user = userEvent.setup();
      render(<App />);
      const { id, panel } = await openMap(user, [room(), bite()]);
      await user.click(within(await startCut(user, panel)).getByRole("button", { name: "No" }));
      expect(panel.queryByRole("group", { name: "Cut notch" })).not.toBeInTheDocument();
      expect(panel.queryByTestId("notch-preview")).not.toBeInTheDocument();
      expect(status(panel)).not.toBeInTheDocument();
      expect(panel.getByRole("group", { name: "Edit Shape 1" })).toBeInTheDocument();

      await user.click(await panel.findByRole("button", { name: "Subtract shape" }));
      await user.click(panel.getByRole("button", { name: "Shape 2" }));
      expect(panel.getByRole("group", { name: "Cut notch" })).toBeInTheDocument();
      await user.keyboard("{Escape}");
      expect(panel.queryByRole("group", { name: "Cut notch" })).not.toBeInTheDocument();
      expect(panel.getByRole("group", { name: "Edit Shape 1" })).toBeInTheDocument(); // Esc stepped back only out of the cut
      expect((await stored(id)).lines).toEqual([room(), bite()]);
    });

    it("Delete and Backspace do nothing while Cut notch? or Subtract shape waits", async () => {
      const user = userEvent.setup();
      render(<App />);
      const { id, panel } = await openMap(user, [room(), bite()]);
      await startCut(user, panel);
      await user.keyboard("{Delete}");
      await user.keyboard("{Backspace}");
      expect(panel.getByRole("group", { name: "Cut notch" })).toBeInTheDocument();
      await user.click(within(panel.getByRole("group", { name: "Cut notch" })).getByRole("button", { name: "No" }));
      await user.click(await panel.findByRole("button", { name: "Subtract shape" }));
      await user.keyboard("{Delete}");
      expect(status(panel)).toBeInTheDocument();
      expect(panel.getByRole("group", { name: "Edit Shape 1" })).toBeInTheDocument();
      await new Promise((r) => setTimeout(r, 50)); // a delete would have been saved by now
      expect((await stored(id)).lines).toEqual([room(), bite()]);
    });
  });
});
