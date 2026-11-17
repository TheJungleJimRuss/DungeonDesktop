import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { exportCampaign, listCampaigns } from "./storage";
import { createLocation, deleteLocation, listLocations } from "./storage/locations";

type User = ReturnType<typeof userEvent.setup>;
async function openExploration(user: User) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), "Alpha");
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText("Alpha");
  await user.click(within(screen.getByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
  const id = (await listCampaigns())[0].id;
  await createLocation(id, { name: "Neverwinter", notes: "" });
  await createLocation(id, { name: "Waterdeep", notes: "" });
  await user.keyboard("{Alt>}2{/Alt}");
  return { id, panel: await screen.findByRole("region", { name: "World Map" }) };
}

beforeEach(() => localStorage.clear());

describe("World Map", () => {
  it("creates, edits and deletes edges, moves nodes, and exports both", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openExploration(user);
    const p = within(panel);
    await p.findByRole("button", { name: "Location Neverwinter" });

    await user.selectOptions(p.getByLabelText("Edge from"), "Neverwinter");
    await user.selectOptions(p.getByLabelText("Edge to"), "Waterdeep");
    await user.type(p.getByLabelText("Edge miles"), "0");
    await user.click(p.getByRole("button", { name: /add edge/i }));
    expect(await p.findByRole("alert")).toHaveTextContent(/more than 0/i);
    await user.clear(p.getByLabelText("Edge miles"));
    await user.type(p.getByLabelText("Edge miles"), "120");
    await user.type(p.getByLabelText("Edge terrain"), "road");
    await user.click(p.getByRole("button", { name: /add edge/i }));
    const row = await p.findByRole("listitem", { name: "Neverwinter to Waterdeep" });
    expect(panel).toHaveTextContent("120 mi · road");

    // a second edge between the same pair, in either order, is refused
    await user.selectOptions(p.getByLabelText("Edge from"), "Waterdeep");
    await user.selectOptions(p.getByLabelText("Edge to"), "Neverwinter");
    await user.type(p.getByLabelText("Edge miles"), "5");
    await user.click(p.getByRole("button", { name: /add edge/i }));
    expect(await p.findByRole("alert")).toHaveTextContent(/already joined/i);

    const miles = within(row).getByLabelText(/^Miles/);
    await user.clear(miles); await user.type(miles, "100"); await user.tab();
    await waitFor(() => expect(panel).toHaveTextContent("100 mi · road"));

    // keyboard move persists
    const node = p.getByRole("button", { name: "Location Neverwinter" });
    const x0 = Number(node.getAttribute("data-x"));
    node.focus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    await waitFor(async () => expect((await listLocations(id)).find((l) => l.name === "Neverwinter")!.x).toBe(x0 + 20));

    const exp = (await exportCampaign(id))!;
    expect(exp.collections.edges).toHaveLength(1);
    expect(exp.collections.locations.find((l) => l.name === "Neverwinter")!.x).toBe(x0 + 20);

    await user.click(within(row).getByRole("button", { name: /delete edge/i }));
    await waitFor(() => expect(p.queryByRole("listitem", { name: "Neverwinter to Waterdeep" })).toBeNull());
  });

  it("removes a location's edges when the location is deleted", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openExploration(user);
    const p = within(panel);
    await user.selectOptions(await p.findByLabelText("Edge from"), "Neverwinter");
    await user.selectOptions(p.getByLabelText("Edge to"), "Waterdeep");
    await user.type(p.getByLabelText("Edge miles"), "10");
    await user.click(p.getByRole("button", { name: /add edge/i }));
    await p.findByRole("listitem", { name: "Neverwinter to Waterdeep" });
    const loc = (await listLocations(id)).find((l) => l.name === "Waterdeep")!;
    await deleteLocation(loc.id);
    await waitFor(() => expect(p.queryByRole("listitem", { name: /Neverwinter to/ })).toBeNull());
    expect((await exportCampaign(id))!.collections.edges).toHaveLength(0);
  });
});

describe("Party location and pace", () => {
  it("sets the party location, shows days per pace with terrain, and persists", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, panel } = await openExploration(user);
    const p = within(panel);
    await user.selectOptions(await p.findByLabelText("Edge from"), "Neverwinter");
    await user.selectOptions(p.getByLabelText("Edge to"), "Waterdeep");
    await user.type(p.getByLabelText("Edge miles"), "120");
    await user.type(p.getByLabelText("Edge terrain"), "mountains");
    await user.click(p.getByRole("button", { name: /add edge/i }));
    await p.findByRole("listitem", { name: "Neverwinter to Waterdeep" });

    expect(p.queryByRole("list", { name: /travel from party/i })).toBeNull();
    await user.selectOptions(p.getByLabelText("Party location"), "Neverwinter");
    const row = await p.findByRole("listitem", { name: "Travel to Waterdeep" });
    // 120 mi, difficult terrain: 9/12/15 mi per day
    expect(row).toHaveTextContent("slow 13.3 days, normal 10 days, fast 8 days");
    expect(p.getByLabelText("Party is here")).toBeInTheDocument();
    await waitFor(async () => expect((await listCampaigns())[0].partyLocationId).toBeTruthy());

    expect(p.getByLabelText("Pace reminder")).toHaveTextContent(/24 mi\/day/);
    await user.selectOptions(p.getByLabelText("Travel pace"), "fast");
    expect(p.getByLabelText("Pace reminder")).toHaveTextContent(/-5 to passive Wisdom/);

    expect((await exportCampaign(id))!.campaign.partyLocationId).toBe((await listCampaigns())[0].partyLocationId);

    // deleting the location clears the marker
    const loc = (await listLocations(id)).find((l) => l.name === "Neverwinter")!;
    await deleteLocation(loc.id);
    await waitFor(() => expect(p.queryByLabelText("Party is here")).toBeNull());
    expect((await listCampaigns())[0].partyLocationId).toBeUndefined();
  });
});
