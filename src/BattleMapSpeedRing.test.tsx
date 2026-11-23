import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { setMonsterSource } from "./srd/monsters";
import { FIXTURE_MONSTERS } from "./srd/fixtures";
import { listCampaigns } from "./storage";
import { addPartyMember } from "./storage/party";

beforeEach(() => { localStorage.clear(); setMonsterSource(async () => FIXTURE_MONSTERS); });
afterEach(() => setMonsterSource(null));

describe("Battle Map speed ring", () => {
  it("shows only around the selected token, sized from its speed", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), "Alpha");
    await user.click(screen.getByRole("button", { name: /create campaign/i }));
    await user.click(within(await screen.findByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
    await screen.findByRole("heading", { name: /dashboard/i });
    const id = (await listCampaigns())[0].id;
    await addPartyMember(id, { name: "Thia", class: "Rogue", level: 1, ac: 14, maxHp: 10, passivePerception: 12, notes: "", speed: "35 ft." });
    await addPartyMember(id, { name: "Bram", class: "Fighter", level: 1, ac: 16, maxHp: 12, passivePerception: 10, notes: "" });
    await user.keyboard("{Alt>}1{/Alt}");
    const tracker = await screen.findByRole("region", { name: "Initiative" });
    await user.click(within(tracker).getByRole("button", { name: /start encounter/i }));
    await within(tracker).findByRole("option", { name: "Entire Party (2)" });
    await user.selectOptions(within(tracker).getByLabelText("Add Party member"), "Entire Party (2)");
    const map = within(await screen.findByRole("region", { name: "Battle Map" }));
    await user.click(map.getByRole("button", { name: /add tokens for all combatants/i }));

    expect(map.queryByTestId("speed-ring")).toBeNull(); // nothing selected
    await user.click(await map.findByRole("button", { name: "Token Thia" }));
    const ring = await map.findByTestId("speed-ring");
    expect(ring).toHaveAccessibleName("Speed 35 ft, 7 squares");
    expect(within(ring).getByText("35 ft")).toBeInTheDocument();

    // Bram's sheet has no speed: no ring rather than a guess
    await user.click(map.getByRole("button", { name: "Token Bram" }));
    expect(map.queryByTestId("speed-ring")).toBeNull();
  });
});
