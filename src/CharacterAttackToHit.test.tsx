import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { listCampaigns } from "./storage";
import { listParty, updatePartyMember } from "./storage/party";

beforeEach(() => localStorage.clear());

describe("automatic attack to-hit", () => {
  it("shows to-hit on the Player card Gear tab and follows level changes", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), "Hit");
    await user.click(screen.getByRole("button", { name: /create campaign/i }));
    await screen.findByText("Hit");
    const id = (await listCampaigns()).find((c) => c.name === "Hit")!.id;
    await user.click(within(screen.getByRole("listitem", { name: "Hit" })).getByRole("button", { name: /open/i }));
    await screen.findByRole("heading", { name: "Dashboard" });
    await user.click(screen.getByRole("button", { name: /^party/i }));
    const p = within(await screen.findByRole("region", { name: /character sheets/i }));
    await user.click(p.getByRole("button", { name: /add character/i }));
    await user.type(p.getByLabelText("Name"), "Rook");
    await user.clear(p.getByLabelText("Level")); await user.type(p.getByLabelText("Level"), "3");
    await user.clear(p.getByLabelText("DEX score")); await user.type(p.getByLabelText("DEX score"), "16");
    expect(p.queryByLabelText("Attack bonus")).not.toBeInTheDocument();
    await user.type(p.getByLabelText("Attack name"), "Rapier");
    await user.selectOptions(p.getByLabelText("Ability"), "dex");
    expect(p.getByLabelText("Proficient")).toBeChecked();
    await user.click(p.getByRole("button", { name: "Add attack" }));
    expect(await p.findByText(/\+5 to hit — 1d8\+3 slashing/)).toBeInTheDocument();
    // Edit opens the full fields; dropping proficiency lowers to-hit only.
    await user.click(p.getByRole("button", { name: "Edit attack Rapier" }));
    await user.click(p.getByLabelText("Proficient with Rapier"));
    expect(await p.findByText(/\+3 to hit — 1d8\+3 slashing/)).toBeInTheDocument();
    await user.click(p.getByLabelText("Proficient with Rapier"));
    await user.selectOptions(p.getByLabelText("Dice of Rapier"), "6");
    expect(await p.findByText(/\+5 to hit — 1d6\+3 slashing/)).toBeInTheDocument();
    await user.click(p.getByRole("button", { name: /save member/i }));
    await p.findByRole("article", { name: /rook character sheet/i });

    await user.click(within(screen.getByRole("navigation", { name: /modes/i })).getByRole("button", { name: /combat/i }));
    await screen.findByRole("heading", { name: /^combat$/i });
    const card = within(screen.getByRole("region", { name: /player card/i }));
    await user.click(await card.findByRole("button", { name: "Gear" }));
    expect(await card.findByText(/\+5 to hit — 1d6\+3 slashing/)).toBeInTheDocument();

    const [m] = await listParty(id);
    await updatePartyMember(m.id, { level: 5 });
    expect(await card.findByText(/\+6 to hit — 1d6\+3 slashing/)).toBeInTheDocument();
  });
});
