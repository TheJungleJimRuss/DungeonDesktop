import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { listCampaigns } from "./storage";
import { listMaps, updateMap, type MapLine } from "./storage/maps";
import type { Pt } from "./map/geometry";

// Records the outline arrays labelPoint is asked about: its cache is keyed by array, so it only hits when the same stored array comes back.
const asked = vi.hoisted(() => [] as unknown[]);
vi.mock("./map/geometry", async (importOriginal) => {
  const real = await importOriginal<typeof import("./map/geometry")>();
  return { ...real, labelPoint: (poly: Pt[], holes?: Pt[][]) => { asked.push(poly); return real.labelPoint(poly, holes); } };
});

type P = [number, number];
const sq = (x: number, y: number, s: number): P[] => [[x, y], [x + s, y], [x + s, y + s], [x, y + s]];
const pts = (p: P[]) => p.map(([x, y]) => ({ x, y }));
const line = (id: string, points: P[], extra: Partial<MapLine> = {}): MapLine => ({ id, closed: true, points: pts(points), segments: Array(points.length).fill("plain"), ...extra });

beforeEach(() => localStorage.clear());

it("an Area's label point is worked out once per stored shape, not on every render", async () => {
  const user = userEvent.setup();
  render(<App />);
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
  await updateMap((await listMaps(id))[0].id, (m) => ({ ...m, lines: [
    line("room", sq(0, 0, 10), { area: { kind: "Room", color: "#00f", holes: [pts(sq(2, 2, 2))] } }), line("other", sq(12, 0, 2)),
  ] }));
  await user.click(await panel.findByRole("button", { name: "Shape 2" })); // re-renders the Map several times
  await user.click(panel.getByRole("button", { name: "Shape 1" }));
  await user.click(panel.getByRole("button", { name: "Shape 2" }));
  expect(asked.length).toBeGreaterThan(2);
  expect(new Set(asked).size).toBe(1);
});
