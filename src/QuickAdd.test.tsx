import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { listCampaigns } from "./storage";
import { listLocations } from "./storage/locations";
import { listNpcs } from "./storage/npcs";
import { listCustomEntries } from "./storage/customEntries";
import { listParty } from "./storage/party";

beforeEach(() => localStorage.clear());

describe("Quick add button", () => {
  it("adds a location, NPC, spell, monster and player by name", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), "Alpha");
    await user.click(screen.getByRole("button", { name: /create campaign/i }));
    await screen.findByText("Alpha");
    await user.click(within(screen.getByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
    await screen.findByRole("heading", { name: /dashboard/i });
    const id = (await listCampaigns())[0].id;

    await user.click(screen.getByRole("button", { name: "+ Add" }));
    const dialog = await screen.findByRole("dialog");
    for (const [kind, name] of [["Location", "Phandalin"], ["NPC", "Sildar"], ["Spell", "Zap"], ["Monster", "Goblin Boss"], ["Player", "Aria"]]) {
      await user.click(within(dialog).getByRole("radio", { name: kind }));
      await user.type(within(dialog).getByRole("textbox"), name);
      await user.click(within(dialog).getByRole("button", { name: `Add ${kind}` }));
      await waitFor(() => expect(within(dialog).getByRole("status")).toHaveTextContent(`Added ${kind} "${name}"`));
    }
    expect((await listLocations(id)).map((l) => l.name)).toEqual(["Phandalin"]);
    expect((await listNpcs(id)).map((n) => n.name)).toEqual(["Sildar"]);
    const entries = await listCustomEntries(id);
    expect(entries.map((e) => `${e.kind}:${e.name}`).sort()).toEqual(["monster:Goblin Boss", "spell:Zap"]);
    expect((await listParty(id)).map((m) => m.name)).toEqual(["Aria"]);
  });
});
