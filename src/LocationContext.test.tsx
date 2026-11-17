import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { listCampaigns } from "./storage";
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
