import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { listCampaigns } from "./storage";
import { setPartyLocation } from "./storage/campaigns";
import { createLocation } from "./storage/locations";
import { listNpcs } from "./storage/npcs";

type User = ReturnType<typeof userEvent.setup>;
async function openCampaign(user: User) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), "Alpha");
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText("Alpha");
  await user.click(within(screen.getByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
  return (await listCampaigns())[0].id;
}
beforeEach(() => localStorage.clear());

const names = (panel: HTMLElement) => within(panel).getAllByRole("listitem").map((li) => li.querySelector(".gen-name")!.textContent!);

describe("Name Generator", () => {
  it("shows names, rerolls, and respects the style", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user);
    await user.keyboard("{Alt>}3{/Alt}");
    const panel = await screen.findByRole("region", { name: "Name Generator" });
    const first = names(panel);
    expect(first.length).toBeGreaterThanOrEqual(5);
    await user.click(within(panel).getByRole("button", { name: /reroll/i }));
    expect(names(panel)).not.toEqual(first);
    await user.selectOptions(within(panel).getByRole("combobox", { name: /name style/i }), "dwarven");
    expect(names(panel).length).toBeGreaterThanOrEqual(5);
  });

  it("creates an NPC at the party location and selects it on the card", async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = await openCampaign(user);
    const loc = await createLocation(id, { name: "Neverwinter", notes: "" });
    await setPartyLocation(id, loc.id);
    await user.keyboard("{Alt>}3{/Alt}");
    const panel = await screen.findByRole("region", { name: "Name Generator" });
    const [first] = names(panel);
    await user.click(within(panel).getAllByRole("button", { name: /create npc/i })[0]);
    const card = await screen.findByRole("region", { name: "NPC card" });
    expect(await within(card).findByRole("heading", { name: first })).toBeInTheDocument();
    const npcs = await listNpcs(id);
    expect(npcs).toHaveLength(1);
    expect(npcs[0]).toMatchObject({ name: first, locationId: loc.id, locationTag: "Neverwinter" });
  });

  it("creates an NPC with no location when the party has none", async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = await openCampaign(user);
    await user.keyboard("{Alt>}3{/Alt}");
    const panel = await screen.findByRole("region", { name: "Name Generator" });
    await user.click(within(panel).getAllByRole("button", { name: /create npc/i })[0]);
    await screen.findByRole("region", { name: "NPC card" });
    const npcs = await listNpcs(id);
    expect(npcs[0].locationId).toBeUndefined();
  });
});
