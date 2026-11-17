import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { listCampaigns } from "./storage";
import { createLocation, setNpcLocation } from "./storage/locations";
import { createNpc, emptyNpcDraft } from "./storage/npcs";
import { addPartyMember } from "./storage/party";

type User = ReturnType<typeof userEvent.setup>;
async function openExploration(user: User) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), "Alpha");
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText("Alpha");
  await user.click(within(screen.getByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
  return (await listCampaigns())[0].id;
}
const member = (name: string, over: object = {}) => ({
  name, class: "Fighter", level: 1, ac: 10, maxHp: 5, passivePerception: 10, notes: "", ...over,
});

beforeEach(() => localStorage.clear());

describe("Location context in Exploration", () => {
  it("shows a clicked node's notes and linked NPCs", async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = await openExploration(user);
    const inn = await createLocation(id, { name: "Neverwinter", notes: "Smells of fish." });
    await createLocation(id, { name: "Waterdeep", notes: "Towers everywhere." });
    const npc = await createNpc(id, { ...emptyNpcDraft(), name: "Harbormaster Lo" });
    await createNpc(id, { ...emptyNpcDraft(), name: "Elsewhere Eve" });
    await setNpcLocation(npc.id, inn);
    await user.keyboard("{Alt>}2{/Alt}");

    const map = await screen.findByRole("region", { name: "World Map" });
    const loc = await screen.findByRole("region", { name: "Location" });
    expect(loc).toHaveTextContent(/select a location/i);

    await user.click(within(map).getByRole("button", { name: "Location Neverwinter" }));
    await waitFor(() => expect(loc).toHaveTextContent("Smells of fish."));
    expect(within(loc).getByRole("button", { name: "Harbormaster Lo" })).toBeInTheDocument();
    expect(within(loc).queryByRole("button", { name: "Elsewhere Eve" })).toBeNull();

    await user.click(within(map).getByRole("button", { name: "Location Waterdeep" }));
    await waitFor(() => expect(loc).toHaveTextContent("Towers everywhere."));
    expect(loc).toHaveTextContent(/no npcs linked here/i);
  });
});

describe("Passive Perception in Exploration", () => {
  it("shows per-member values from sheets and the highest", async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = await openExploration(user);
    // WIS 14 (+2), level 5 (prof +3), proficient: 10 + 5 = 15
    await addPartyMember(id, member("Mira", { level: 5, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 }, skills: { perception: "proficient" } }));
    // WIS 10, expertise at level 1 (+4): 14
    await addPartyMember(id, member("Bram", { abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, skills: { perception: "expertise" } }));
    // no sheet: falls back to the typed value
    await addPartyMember(id, member("Quick", { passivePerception: 12 }));
    await user.keyboard("{Alt>}2{/Alt}");

    const panel = await screen.findByRole("region", { name: "Passive Perception" });
    const p = within(panel);
    expect(await p.findByLabelText("Mira passive Perception")).toHaveTextContent("Mira: 15");
    expect(p.getByLabelText("Bram passive Perception")).toHaveTextContent("Bram: 14");
    expect(p.getByLabelText("Quick passive Perception")).toHaveTextContent("Quick: 12");
    expect(p.getByLabelText("Highest passive Perception")).toHaveTextContent("Highest: 15 (Mira)");
  });
});
