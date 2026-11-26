import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { listCampaigns } from "./storage";
import { listMaps, updateMap, type MapLine, type MapMarker } from "./storage/maps";
import { createLocation } from "./storage/locations";

type User = ReturnType<typeof userEvent.setup>;

const sq = (x: number, y: number, s: number) => [{ x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s }];
const area = (id: string, x: number, y: number, s: number, locationId?: string): MapLine => ({
  id, points: sq(x, y, s), closed: true, segments: ["plain", "plain", "plain", "plain"], area: { kind: "Area", color: "#3498db", ...(locationId ? { locationId } : {}) },
});
const marker = (id: string, x: number, y: number, locationId: string): MapMarker => ({ id, x, y, name: id, color: "#e67e22", icon: "pin", note: "", locationId });

/** Opens a Map in a fresh Campaign with two Locations ("Keep", "Cave"); `build` receives their ids and returns the Map's drawings. */
async function openMap(user: User, build: (loc: { keep: string; cave: string }) => { lines?: MapLine[]; markers?: MapMarker[] } = () => ({})) {
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
  const keep = (await createLocation(id, { name: "Keep", notes: "" })).id, cave = (await createLocation(id, { name: "Cave", notes: "" })).id;
  const d = build({ keep, cave });
  const map = (await listMaps(id))[0];
  await updateMap(map.id, (m) => ({ ...m, lines: d.lines ?? [], markers: d.markers ?? [] }));
  return { id, panel };
}
const partyAt = async (id: string) => (await listCampaigns()).find((c) => c.id === id)?.partyLocationId;
const addParty = async (user: User, panel: ReturnType<typeof within>) => {
  await user.click(panel.getByRole("button", { name: "Add party token" }));
  const tok = await panel.findByRole("button", { name: "Party token" });
  expect((tok.querySelector("g") as SVGGElement).style.transform).toBe("scale(1)"); // battle scale: its true square size (no boost)
  tok.focus();
  return tok;
};
const pos = (el: HTMLElement) => [el.getAttribute("data-col"), el.getAttribute("data-row")];

beforeEach(() => localStorage.clear());

describe("Party Token", () => {
  it("allows one per Map: Add hides while it is present and comes back after Remove; it avoids other Tokens and is drawn in the Token layer", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user);
    await user.type(panel.getByLabelText("Token name"), "Goblin");
    await user.click(panel.getByRole("button", { name: /^add token$/i }));
    await panel.findByRole("button", { name: "Token Goblin" });
    const tok = await addParty(user, panel);
    expect(pos(tok)).toEqual(["1", "0"]); // (0,0) is the Goblin's
    expect(panel.queryByRole("button", { name: "Add party token" })).not.toBeInTheDocument();
    await waitFor(async () => expect((await listMaps(id))[0].partyToken).toEqual({ x: 1, y: 0 }));
    expect(panel.getAllByRole("button", { name: "Party token" })).toHaveLength(1);
    expect(tok).toHaveTextContent("★");
    await user.click(panel.getByRole("button", { name: "Remove party token" }));
    await waitFor(async () => expect((await listMaps(id))[0].partyToken).toBeUndefined());
    expect(panel.queryByRole("button", { name: "Party token" })).not.toBeInTheDocument();
    expect(panel.getByRole("button", { name: "Add party token" })).toBeInTheDocument();
  });

  it("has no Party location select any more", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { panel } = await openMap(user);
    expect(panel.queryByLabelText("Party location")).not.toBeInTheDocument();
  });

  it("moving it into a linked Area sets the party location; an unlinked Area or empty ground changes nothing", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user, ({ keep }) => ({ lines: [area("a", 2, 2, 3, keep), area("u", 8, 0, 3)] }));
    const tok = await addParty(user, panel);
    await user.keyboard("{ArrowRight}{ArrowDown}");
    await waitFor(() => expect(pos(panel.getByRole("button", { name: "Party token" }))).toEqual(["1", "1"]));
    expect(await partyAt(id)).toBeUndefined();
    await user.keyboard("{ArrowRight}{ArrowDown}");
    await waitFor(async () => expect(await partyAt(id)).toBeDefined());
    expect(pos(tok)).toEqual(["2", "2"]);
    expect((await listMaps(id))[0].partyToken).toEqual({ x: 2, y: 2 });
    expect(await partyAt(id)).toBe((await listMaps(id))[0].lines[0].area!.locationId);
    // into an unlinked Area: nothing changes
    await user.keyboard("{ArrowUp}{ArrowUp}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}");
    await waitFor(async () => expect((await listMaps(id))[0].partyToken).toEqual({ x: 8, y: 0 }));
    expect(await partyAt(id)).toBe((await listMaps(id))[0].lines[0].area!.locationId);
  });

  it("moving it onto a linked Marker sets the party location", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user, ({ cave }) => ({ markers: [marker("Door", 2.5, 0.5, cave)] }));
    await addParty(user, panel);
    await user.keyboard("{ArrowRight}");
    await waitFor(async () => expect((await listMaps(id))[0].partyToken).toEqual({ x: 1, y: 0 }));
    expect(await partyAt(id)).toBeUndefined(); // centre 1.5: a full square away
    await user.keyboard("{ArrowRight}");
    await waitFor(async () => expect(await partyAt(id)).toBe((await listMaps(id))[0].markers[0].locationId));
  });

  it("picks the smallest of overlapping linked Areas", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user, ({ keep, cave }) => ({ lines: [area("big", 0, 0, 10, keep), area("small", 2, 2, 3, cave)] }));
    await addParty(user, panel);
    await user.keyboard("{ArrowRight}");
    await waitFor(async () => expect(await partyAt(id)).toBe((await listMaps(id))[0].lines[0].area!.locationId)); // only in the big one
    await user.keyboard("{ArrowRight}{ArrowDown}{ArrowDown}");
    await waitFor(async () => expect(await partyAt(id)).toBe((await listMaps(id))[0].lines[1].area!.locationId));
  });

  it("lets a Marker beat the Area under it", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user, ({ keep, cave }) => ({ lines: [area("big", 0, 0, 10, keep)], markers: [marker("Door", 2.5, 0.5, cave)] }));
    await addParty(user, panel);
    await user.keyboard("{ArrowRight}");
    await waitFor(async () => expect(await partyAt(id)).toBe((await listMaps(id))[0].lines[0].area!.locationId));
    await user.keyboard("{ArrowRight}");
    await waitFor(async () => expect(await partyAt(id)).toBe((await listMaps(id))[0].markers[0].locationId));
  });

  it("keeps the party location when the Party Token is removed", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user, ({ keep }) => ({ lines: [area("a", 0, 0, 3, keep)] }));
    await addParty(user, panel);
    await user.keyboard("{ArrowRight}");
    await waitFor(async () => expect(await partyAt(id)).toBeDefined());
    const loc = await partyAt(id);
    await user.click(panel.getByRole("button", { name: "Remove party token" }));
    await waitFor(async () => expect((await listMaps(id))[0].partyToken).toBeUndefined());
    expect(await partyAt(id)).toBe(loc);
  });
});
