import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { exportCampaign, importCampaign, listCampaigns, parseCampaignFile } from "./storage";

type User = ReturnType<typeof userEvent.setup>;

async function openCombat(user: User) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), "Alpha");
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText("Alpha");
  await user.click(within(screen.getByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
  await user.keyboard("{Alt>}1{/Alt}");
  await screen.findByRole("heading", { name: /^combat$/i });
  return { id: (await listCampaigns())[0].id, map: await screen.findByRole("region", { name: "Battle Map" }) };
}
const maps = async (id: string) => (await exportCampaign(id))!.collections.battleMaps as unknown as Record<string, any>[];
const pos = (el: HTMLElement) => [el.getAttribute("data-col"), el.getAttribute("data-row")];

beforeEach(() => localStorage.clear());

describe("Battle Map", () => {
  it("needs an Encounter, then keeps grid settings and tokens (keyboard moves snap; the grid never ends)", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, map } = await openCombat(user);
    const m = within(map);
    expect(m.getByText(/start an encounter/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /start encounter/i }));
    await m.findByLabelText("Grid width");
    expect(m.getByLabelText("Grid width")).toHaveValue(20);
    expect(m.getByLabelText("Feet per square")).toHaveValue(5);

    await user.clear(m.getByLabelText("Grid width")); await user.type(m.getByLabelText("Grid width"), "12" + "{Tab}");
    await user.clear(m.getByLabelText("Grid height")); await user.type(m.getByLabelText("Grid height"), "8" + "{Tab}");
    await user.clear(m.getByLabelText("Feet per square")); await user.type(m.getByLabelText("Feet per square"), "10" + "{Tab}");
    await waitFor(async () => expect((await maps(id))[0]).toMatchObject({ width: 12, height: 8, feetPerSquare: 10 }));

    await user.type(m.getByLabelText("Token name"), "Goblin");
    await user.click(m.getByRole("button", { name: /^add token$/i }));
    const tok = await m.findByRole("button", { name: "Token Goblin" });
    expect(pos(tok)).toEqual(["0", "0"]);
    tok.focus();
    await user.keyboard("{ArrowLeft}{ArrowUp}"); // past the map's edge: the grid carries on
    await waitFor(() => expect(pos(m.getByRole("button", { name: "Token Goblin" }))).toEqual(["-1", "-1"]));
    m.getByRole("button", { name: "Token Goblin" }).focus();
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}{ArrowDown}{ArrowDown}");
    await waitFor(() => expect(pos(m.getByRole("button", { name: "Token Goblin" }))).toEqual(["2", "1"]));
    await waitFor(async () => expect((await maps(id))[0].tokens[0]).toMatchObject({ name: "Goblin", x: 2, y: 1 }));

    // shrinking the map area leaves tokens where they are
    await user.clear(m.getByLabelText("Grid width")); await user.type(m.getByLabelText("Grid width"), "2" + "{Tab}");
    await waitFor(async () => expect((await maps(id))[0]).toMatchObject({ width: 2 }));
    expect(pos(m.getByRole("button", { name: "Token Goblin" }))).toEqual(["2", "1"]);

    // edit and delete
    const name = m.getByLabelText("Name of Goblin");
    await user.clear(name); await user.type(name, "Boss{Enter}");
    await m.findByRole("button", { name: "Token Boss" });
    await user.click(m.getByRole("button", { name: "Delete token Boss" }));
    await waitFor(() => expect(m.queryByRole("button", { name: "Token Boss" })).not.toBeInTheDocument());
  });

  it("exports and imports with the Campaign, and saved encounters carry the map", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, map } = await openCombat(user);
    const m = within(map);
    await user.click(screen.getByRole("button", { name: /start encounter/i }));
    await user.type(await m.findByLabelText("Token name"), "Ogre");
    await user.click(m.getByRole("button", { name: /^add token$/i }));
    (await m.findByRole("button", { name: "Token Ogre" })).focus();
    await user.keyboard("{ArrowRight}{ArrowDown}{ArrowDown}");
    await waitFor(async () => expect((await maps(id))[0].tokens[0]).toMatchObject({ x: 1, y: 2 }));

    const doc = (await exportCampaign(id))!;
    expect(doc.collections.battleMaps).toHaveLength(1);
    const parsed = parseCampaignFile(JSON.stringify(doc));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) await importCampaign(parsed.data);
    expect(await maps(id)).toHaveLength(1);

    await user.type(screen.getByLabelText("Ad-hoc name"), "Bandit");
    await user.type(screen.getByLabelText("Ad-hoc HP"), "11");
    await user.click(screen.getByRole("button", { name: /add ad-hoc/i }));
    await user.type(screen.getByLabelText("Saved encounter name"), "Ambush");
    await user.click(screen.getByRole("button", { name: /save encounter/i }));
    await waitFor(async () => expect((await exportCampaign(id))!.collections.savedEncounters).toHaveLength(1));
    await user.click(screen.getByRole("button", { name: /end encounter/i }));
    await user.click(await screen.findByRole("button", { name: /yes, end it/i }));
    await waitFor(async () => expect(await maps(id)).toHaveLength(0));
    expect(m.getByText(/start an encounter/i)).toBeInTheDocument();

    const item = await screen.findByRole("listitem", { name: "Ambush" });
    await user.click(within(item).getByRole("button", { name: /^load/i }));
    const tok = await m.findByRole("button", { name: "Token Ogre" });
    expect(pos(tok)).toEqual(["1", "2"]);
    expect(await maps(id)).toHaveLength(1);
  });
  it("measures between squares with the ruler (click start, click end), in feet per square", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { map } = await openCombat(user);
    const m = within(map);
    await user.click(screen.getByRole("button", { name: /start encounter/i }));
    await m.findByLabelText("Grid width");
    expect(m.queryByLabelText("Square 0,0")).not.toBeInTheDocument();
    const ruler = m.getByRole("button", { name: "Ruler" });
    expect(ruler).toHaveAttribute("aria-pressed", "false");
    await user.click(ruler);
    expect(ruler).toHaveAttribute("aria-pressed", "true");

    await user.click(m.getByLabelText("Square 1,1"));
    await user.click(m.getByLabelText("Square 6,3"));
    expect(m.getByRole("status", { name: "Measured distance" })).toHaveTextContent("5 squares, 25 ft");
    expect(m.getByTestId("ruler-line")).toBeInTheDocument();

    // a third click starts a new measurement; diagonals cost one square each
    await user.click(m.getByLabelText("Square 0,0"));
    await user.click(m.getByLabelText("Square 3,3"));
    expect(m.getByRole("status", { name: "Measured distance" })).toHaveTextContent("3 squares, 15 ft");

    // squares past the map area measure too, once zoomed out to show them
    await user.click(m.getByRole("button", { name: "Zoom out" }));
    await user.click(m.getByLabelText("Square -2,0"));
    await user.click(m.getByLabelText("Square 2,0"));
    expect(m.getByRole("status", { name: "Measured distance" })).toHaveTextContent("4 squares, 20 ft");

    await user.clear(m.getByLabelText("Feet per square")); await user.type(m.getByLabelText("Feet per square"), "10{Tab}");
    await waitFor(() => expect(m.getByRole("status", { name: "Measured distance" })).toHaveTextContent("40 ft"));

    await user.click(m.getByRole("button", { name: "Clear measurement" }));
    expect(m.queryByTestId("ruler-line")).not.toBeInTheDocument();
    await user.click(m.getByRole("button", { name: "Ruler" }));
    expect(m.queryByLabelText("Square 0,0")).not.toBeInTheDocument();
  });
});

describe("Battle Map zoom", () => {
  it("fits the whole map by default, zooms in and out without limit, and Fit goes back", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), "Zoomy");
    await user.click(screen.getByRole("button", { name: /create campaign/i }));
    await user.click(within(await screen.findByRole("listitem", { name: "Zoomy" })).getByRole("button", { name: /open/i }));
    await screen.findByRole("heading", { name: /dashboard/i });
    await user.keyboard("{Alt>}1{/Alt}");
    await user.click(await within(await screen.findByRole("region", { name: "Initiative" })).findByRole("button", { name: /start encounter/i }));
    const map = within(await screen.findByRole("region", { name: "Battle Map" }));
    const grid = await map.findByRole("group", { name: "Battle grid" });
    const fit = grid.getAttribute("viewBox")!;
    const width = () => Number(grid.getAttribute("viewBox")!.split(" ")[2]);
    const w0 = width();
    expect(map.getByRole("button", { name: "Fit" })).toHaveAttribute("aria-pressed", "true");
    for (let i = 0; i < 8; i++) await user.click(map.getByRole("button", { name: "Zoom in" }));
    expect(width()).toBeCloseTo(w0 / 1.5 ** 8);
    expect(map.getByRole("button", { name: "Zoom in" })).toBeEnabled();
    expect(map.getByRole("button", { name: "Fit" })).toHaveAttribute("aria-pressed", "false");
    for (let i = 0; i < 12; i++) await user.click(map.getByRole("button", { name: "Zoom out" }));
    expect(width()).toBeCloseTo(w0 * 1.5 ** 4); // past the fit view: the grid shrinks inside empty space
    expect(map.getByRole("button", { name: "Zoom out" })).toBeEnabled();
    await user.click(map.getByRole("button", { name: "Fit" }));
    expect(grid.getAttribute("viewBox")).toBe(fit);
  });
});
