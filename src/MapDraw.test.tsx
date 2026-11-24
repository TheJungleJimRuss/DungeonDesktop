import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { listCampaigns } from "./storage";
import { listMaps, updateMap, type MapLine } from "./storage/maps";

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
  await panel.findByLabelText("Map width");
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

describe("Lines and Shapes on a Map", () => {
  it("selects a Line, changes segment types, and renders Walls and Doors distinctly; the record persists", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user, [line("a", [[1, 1], [4, 1], [4, 4]], false), line("b", [[6, 6], [9, 6], [9, 9]], true)]);
    const first = await panel.findByRole("button", { name: "Line 1" });
    expect(await panel.findByRole("button", { name: "Shape 1" })).toBeInTheDocument();
    expect(first.querySelectorAll(".map-wall, .map-door")).toHaveLength(0);

    await user.click(first);
    await user.selectOptions(await panel.findByLabelText("Segment 1 type"), "wall");
    await user.selectOptions(panel.getByLabelText("Segment 2 type"), "door");
    await waitFor(async () => expect((await stored(id)).lines[0].segments).toEqual(["wall", "door"]));
    expect(panel.getByRole("button", { name: "Line 1" }).querySelectorAll(".map-wall")).toHaveLength(1);
    expect(panel.getByRole("button", { name: "Line 1" }).querySelectorAll(".map-door")).toHaveLength(1);
    expect(panel.getByRole("button", { name: "Shape 1" }).querySelectorAll(".map-wall, .map-door")).toHaveLength(0);

    // A Shape has one extra segment (last back to first)
    await user.click(panel.getByRole("button", { name: "Shape 1" }));
    await user.selectOptions(await panel.findByLabelText("Segment 3 type"), "wall");
    await waitFor(async () => expect((await stored(id)).lines[1].segments).toEqual(["plain", "plain", "wall"]));
    expect(panel.getAllByLabelText(/^Segment \d type$/)).toHaveLength(3);
  });

  it("deletes the selection with the button and with Delete, but not while typing in a field", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user, [line("a", [[1, 1], [4, 1]], false), line("b", [[2, 3], [5, 3]], false)]);
    await user.click(await panel.findByRole("button", { name: "Line 1" }));
    await user.click(await panel.findByRole("button", { name: "Delete Line 1" }));
    await waitFor(async () => expect((await stored(id)).lines.map((l) => l.id)).toEqual(["b"]));

    await user.click(await panel.findByRole("button", { name: "Line 1" }));
    const field = panel.getByLabelText("Token name");
    await user.type(field, "ab{Backspace}{Delete}"); // typing: the keys edit the field only
    expect(field).toHaveValue("a");
    expect((await stored(id)).lines).toHaveLength(1);
    expect(panel.getByRole("button", { name: "Delete Line 1" })).toBeInTheDocument();

    await user.click(document.body);
    await user.keyboard("{Delete}");
    await waitFor(async () => expect((await stored(id)).lines).toHaveLength(0));
    expect(panel.queryByRole("button", { name: /^Line \d/ })).not.toBeInTheDocument();
  });

  it("Esc cancels the Line being drawn without leaving the Mode; with nothing drawn it still goes to the Dashboard", async () => {
    identitySvg();
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user);
    await user.click(panel.getByRole("button", { name: "Draw" }));
    const surface = await panel.findByTestId("map-draw");
    await user.pointer({ target: surface, keys: "[MouseLeft]", coords: { clientX: 82, clientY: 41 } });
    expect(await panel.findByRole("status", { name: "Drawing" })).toHaveTextContent("Drawing 1 point");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(panel.queryByRole("status", { name: "Drawing" })).not.toBeInTheDocument());
    expect(screen.getByRole("region", { name: "Map" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /dashboard/i })).not.toBeInTheDocument();
    expect((await stored(id)).lines).toHaveLength(0);

    await user.keyboard("{Escape}");
    await screen.findByRole("heading", { name: /dashboard/i });
  });

  it("draws an open Line with Enter, snapped to corners, and a Shape by clicking the first point", async () => {
    identitySvg();
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user);
    await user.click(panel.getByRole("button", { name: "Draw" }));
    const surface = await panel.findByTestId("map-draw");
    const click = (x: number, y: number) => user.pointer({ target: surface, keys: "[MouseLeft]", coords: { clientX: x, clientY: y } });
    await click(82, 41); await click(158, 43); // (2,1) (4,1)
    await user.keyboard("{Enter}");
    await waitFor(async () => expect((await stored(id)).lines).toHaveLength(1));
    expect((await stored(id)).lines[0]).toMatchObject({ closed: false, points: [{ x: 2, y: 1 }, { x: 4, y: 1 }], segments: ["plain"] });

    await click(200, 200); await click(320, 200); await click(320, 320); await click(201, 199); // back on the first point
    await waitFor(async () => expect((await stored(id)).lines).toHaveLength(2));
    expect((await stored(id)).lines[1]).toMatchObject({ closed: true, points: [{ x: 5, y: 5 }, { x: 8, y: 5 }, { x: 8, y: 8 }], segments: ["plain", "plain", "plain"] });
  });
});
