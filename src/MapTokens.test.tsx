import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { exportCampaign, importCampaign, listCampaigns, parseCampaignFile } from "./storage";
import { listMaps } from "./storage/maps";

type User = ReturnType<typeof userEvent.setup>;

async function openMap(user: User) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), "Alpha");
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText("Alpha");
  await user.click(within(screen.getByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
  await user.keyboard("{Alt>}2{/Alt}");
  const panel = within(await screen.findByRole("region", { name: "Map" }));
  await user.click(await panel.findByRole("button", { name: "New map" }));
  await panel.findByLabelText("Map summary");
  return { id: (await listCampaigns())[0].id, panel };
}
const pos = (el: HTMLElement) => [el.getAttribute("data-col"), el.getAttribute("data-row")];
const addToken = async (user: User, panel: ReturnType<typeof within>, name: string) => {
  await user.type(panel.getByLabelText("Token name"), name);
  await user.click(panel.getByRole("button", { name: /^add token$/i }));
  return panel.findByRole("button", { name: `Token ${name}` });
};

beforeEach(() => localStorage.clear());

describe("Tokens on a Map", () => {
  it("adds free Tokens, moves them by keyboard in whole squares (past the edge too), edits and deletes", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user);
    // No Encounter: nothing to link to
    expect(panel.queryByRole("button", { name: /add tokens for all combatants/i })).not.toBeInTheDocument();

    const tok = await addToken(user, panel, "Goblin");
    expect(pos(tok)).toEqual(["0", "0"]);
    tok.focus();
    await user.keyboard("{ArrowLeft}{ArrowUp}"); // past the Map's edge: tokens may stand outside
    await waitFor(() => expect(pos(panel.getByRole("button", { name: "Token Goblin" }))).toEqual(["-1", "-1"]));
    panel.getByRole("button", { name: "Token Goblin" }).focus();
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}{ArrowDown}{ArrowDown}");
    await waitFor(() => expect(pos(panel.getByRole("button", { name: "Token Goblin" }))).toEqual(["2", "1"]));
    await waitFor(async () => expect((await listMaps(id))[0].tokens[0]).toMatchObject({ name: "Goblin", x: 2, y: 1 }));
    expect((await listMaps(id))[0].tokens[0].combatantId).toBeUndefined();

    // snapping does not depend on the grid being shown
    await user.click(panel.getByLabelText("Show grid"));
    await waitFor(async () => expect((await listMaps(id))[0].showGrid).toBe(false));
    panel.getByRole("button", { name: "Token Goblin" }).focus();
    await user.keyboard("{ArrowRight}");
    await waitFor(async () => expect((await listMaps(id))[0].tokens[0]).toMatchObject({ x: 3, y: 1 }));

    const name = panel.getByLabelText("Name of Goblin");
    await user.clear(name); await user.type(name, "Boss{Enter}");
    await panel.findByRole("button", { name: "Token Boss" });
    await user.click(panel.getByRole("button", { name: "Delete token Boss" }));
    await waitFor(() => expect(panel.queryByRole("button", { name: "Token Boss" })).not.toBeInTheDocument());
    await waitFor(async () => expect((await listMaps(id))[0].tokens).toHaveLength(0));
  });

  it("Delete and Backspace remove a selected Token, free or not; nothing is removed while no Token is selected", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user);
    const a = await addToken(user, panel, "Ann");
    await addToken(user, panel, "Bob");
    await user.keyboard("{Delete}");
    expect((await listMaps(id))[0].tokens).toHaveLength(2);
    await user.click(a);
    await user.keyboard("{Delete}");
    await waitFor(async () => expect((await listMaps(id))[0].tokens.map((t) => t.name)).toEqual(["Bob"]));
    await user.click(panel.getByRole("button", { name: "Token Bob" }));
    await user.keyboard("{Backspace}");
    await waitFor(async () => expect((await listMaps(id))[0].tokens).toEqual([]));
  });

  it("places new Tokens on free squares and keeps them through export and import", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openMap(user);
    await addToken(user, panel, "Ogre");
    const imp = await addToken(user, panel, "Imp");
    expect(pos(imp)).toEqual(["1", "0"]); // not on top of the Ogre
    imp.focus();
    await user.keyboard("{ArrowRight}{ArrowDown}{ArrowDown}");
    await waitFor(async () => expect((await listMaps(id))[0].tokens[1]).toMatchObject({ x: 2, y: 2 }));
    const parsed = parseCampaignFile(JSON.stringify((await exportCampaign(id))!));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) await importCampaign(parsed.data);
    expect((await listMaps(id))[0].tokens.map((t) => [t.name, t.x, t.y])).toEqual([["Ogre", 0, 0], ["Imp", 2, 2]]);
  });

  it("measures between squares with the ruler (click start, click end) in feet", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { panel } = await openMap(user);
    expect(panel.queryByLabelText("Square 0,0")).not.toBeInTheDocument();
    const ruler = panel.getByRole("button", { name: "Ruler" });
    expect(ruler).toHaveAttribute("aria-pressed", "false");
    await user.click(ruler);
    expect(ruler).toHaveAttribute("aria-pressed", "true");

    await user.click(panel.getByLabelText("Square 1,1"));
    await user.click(panel.getByLabelText("Square 6,3"));
    expect(panel.getByRole("status", { name: "Measured distance" })).toHaveTextContent("5 squares, 25 ft");
    expect(panel.getByTestId("ruler-line")).toBeInTheDocument();
    // finishing a measurement goes back to Select; the measurement stays until cleared
    expect(ruler).toHaveAttribute("aria-pressed", "false");
    expect(panel.getByRole("button", { name: "Select" })).toHaveAttribute("aria-pressed", "true");

    // M picks the Ruler again; a new measurement replaces the old one; diagonals cost one square each. Shift keeps the Ruler.
    await user.keyboard("m");
    expect(ruler).toHaveAttribute("aria-pressed", "true");
    await user.keyboard("{Shift>}");
    await user.click(panel.getByLabelText("Square 0,0"));
    await user.click(panel.getByLabelText("Square 3,3"));
    await user.keyboard("{/Shift}");
    expect(panel.getByRole("status", { name: "Measured distance" })).toHaveTextContent("3 squares, 15 ft");
    expect(ruler).toHaveAttribute("aria-pressed", "true");

    // squares anywhere count, once zoomed out to show them
    await user.click(panel.getByRole("button", { name: "Zoom out" }));
    await user.click(panel.getByLabelText("Square -2,0"));
    await user.click(panel.getByLabelText("Square 2,0"));
    // the count is in shown grid squares (zoomed out, each stands for more), the distance in feet (or miles from 1,000 ft)
    expect(panel.getByRole("status", { name: "Measured distance" })).toHaveTextContent(/squares, 20 ft/);

    expect(ruler).toHaveAttribute("aria-pressed", "false");
    expect(panel.queryByLabelText("Square 0,0")).not.toBeInTheDocument();
    // Esc clears the measurement before it steps back any further
    await user.keyboard("{Escape}");
    expect(panel.queryByTestId("ruler-line")).not.toBeInTheDocument();
  });

  it("zooms in and out and Fit all goes back to battle scale on an empty Map", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { panel } = await openMap(user);
    const grid = panel.getByRole("group", { name: "Map canvas" });
    const fit = grid.getAttribute("viewBox")!;
    const width = () => Number(grid.getAttribute("viewBox")!.split(" ")[2]);
    const w0 = width();
    for (let i = 0; i < 8; i++) await user.click(panel.getByRole("button", { name: "Zoom in" }));
    expect(width()).toBeLessThan(w0 / 10); // about 1.5x per click, locked to round grid values
    for (let i = 0; i < 12; i++) await user.click(panel.getByRole("button", { name: "Zoom out" }));
    expect(width()).toBeGreaterThan(w0);
    await user.click(panel.getByRole("button", { name: "Fit all" }));
    expect(grid.getAttribute("viewBox")).toBe(fit);
  });
});
