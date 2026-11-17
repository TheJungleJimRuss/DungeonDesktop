import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { getCampaign, listCampaigns } from "./storage";
import { createLocation, listLocations } from "./storage/locations";
import { createEdge } from "./storage/edges";

beforeEach(() => localStorage.clear());

async function setup() {
  const user = userEvent.setup();
  render(<App />);
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), "Alpha");
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText("Alpha");
  await user.click(within(screen.getByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
  const id = (await listCampaigns())[0].id;
  for (const n of ["A", "B", "C", "D"]) await createLocation(id, { name: n, notes: "" });
  const loc = Object.fromEntries((await listLocations(id)).map((l) => [l.name, l.id]));
  await createEdge(id, { fromId: loc.A, toId: loc.B, miles: 24, terrain: "" });
  await createEdge(id, { fromId: loc.B, toId: loc.C, miles: 24, terrain: "swamp" });
  await createEdge(id, { fromId: loc.A, toId: loc.C, miles: 100, terrain: "" });
  await user.keyboard("{Alt>}2{/Alt}");
  const panel = await screen.findByRole("region", { name: "Route" });
  return { user, id, loc, p: within(panel) };
}

describe("Route panel", () => {
  it("builds a route node by node, offering only connected nodes, with totals", async () => {
    const { user, p } = await setup();
    await waitFor(() => expect(within(p.getByLabelText("Start node")).getAllByRole("option")).toHaveLength(5));
    await user.selectOptions(p.getByLabelText("Start node"), "A");
    await user.click(p.getByRole("button", { name: "Start route" }));
    const opts = within(p.getByLabelText("Next node")).getAllByRole("option").map((o) => o.textContent);
    expect(opts).toEqual(["Next stop…", "B", "C"]); // D is not connected
    await user.selectOptions(p.getByLabelText("Next node"), "B");
    await user.click(p.getByRole("button", { name: "Add stop" }));
    await user.selectOptions(p.getByLabelText("Next node"), "C");
    await user.click(p.getByRole("button", { name: "Add stop" }));
    expect(p.getByLabelText("Route")).toHaveTextContent("A → B → C");
    // 24 mi road + 24 mi swamp (halved): normal 1 + 2 = 3 days
    expect(p.getByLabelText("Route totals")).toHaveTextContent("Total 48 mi");
    expect(p.getByLabelText("Route totals")).toHaveTextContent("normal 3 days");
  });

  it("suggests the shortest route by miles and reports no route", async () => {
    const { user, p } = await setup();
    await user.selectOptions(await p.findByLabelText("Suggest from"), "A");
    await user.selectOptions(p.getByLabelText("Suggest to"), "C");
    await user.click(p.getByRole("button", { name: /suggest shortest/i }));
    expect(p.getByLabelText("Route")).toHaveTextContent("A → B → C"); // 48 mi beats the 100 mi direct road
    await user.selectOptions(p.getByLabelText("Suggest to"), "D");
    await user.click(p.getByRole("button", { name: /suggest shortest/i }));
    expect(await p.findByRole("alert")).toHaveTextContent(/no route/i);
  });

  it("moves the Party to the route's end", async () => {
    const { user, id, loc, p } = await setup();
    await user.selectOptions(await p.findByLabelText("Suggest from"), "A");
    await user.selectOptions(p.getByLabelText("Suggest to"), "C");
    await user.click(p.getByRole("button", { name: /suggest shortest/i }));
    await user.click(p.getByRole("button", { name: /move party along route/i }));
    await waitFor(async () => expect((await getCampaign(id))!.partyLocationId).toBe(loc.C));
  });
});
