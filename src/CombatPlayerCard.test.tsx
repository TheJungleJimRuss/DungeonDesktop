import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { addPartyMember } from "./storage/party";
import { listCampaigns } from "./storage";

const THIA = { name: "Thia", class: "Fighter", level: 3, ac: 16, maxHp: 28, passivePerception: 12, notes: "" };
const BRAN = { name: "Bran", class: "Cleric", level: 3, ac: 18, maxHp: 24, passivePerception: 14, notes: "" };

beforeEach(() => localStorage.clear());

describe("Player card in Combat Mode", () => {
  it("shows the Player card with a PC picker alongside the other Combat panels", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), "Alpha");
    await user.click(screen.getByRole("button", { name: /create campaign/i }));
    await screen.findByText("Alpha");
    const id = (await listCampaigns()).find((c) => c.name === "Alpha")!.id;
    await addPartyMember(id, THIA);
    await addPartyMember(id, BRAN);
    await user.click(within(screen.getByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
    await screen.findByRole("heading", { name: /dashboard/i });
    await user.click(within(screen.getByRole("navigation", { name: /modes/i })).getByRole("button", { name: /combat/i }));
    await screen.findByRole("heading", { name: /^combat$/i });

    const card = screen.getByRole("region", { name: /player card/i });
    expect(await within(card).findByRole("article", { name: /thia player card/i }, { timeout: 4000 })).toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: /bran/i }));
    expect(await within(card).findByRole("article", { name: /bran player card/i }, { timeout: 4000 })).toBeInTheDocument();

    for (const name of [/initiative/i, /dice/i]) {
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }
  });
});
