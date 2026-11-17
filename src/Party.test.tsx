import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import App from "./App";
import { addPartyMember } from "./storage/party";
import { listCampaigns } from "./storage";

type User = ReturnType<typeof userEvent.setup>;

let blobs: Blob[] = [];
beforeEach(() => {
  localStorage.clear();
  blobs = [];
  URL.createObjectURL = vi.fn((b: Blob) => (blobs.push(b), "blob:test"));
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

async function createCampaign(user: User, name: string) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), name);
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText(name);
  return (await listCampaigns()).find((c) => c.name === name)!.id;
}
async function openExisting(user: User, name: string) {
  await screen.findByText(name);
  await user.click(within(screen.getByRole("listitem", { name })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: "Dashboard" });
}
const party = () => screen.getByRole("region", { name: /player card/i });
const ARIN = { name: "Arin", class: "Rogue", level: 3, ac: 15, maxHp: 24, passivePerception: 14, notes: "Owes the guild" };

describe("Player card", () => {
  it("shows the same player card as Social, with AC, HP and passive Perception", async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = await createCampaign(user, "Strahd");
    await openExisting(user, "Strahd");
    expect(within(party()).getByText(/no player characters/i)).toBeInTheDocument();
    await addPartyMember(id, ARIN);
    const card = await within(party()).findByRole("article", { name: /arin player card/i });
    expect(card).toHaveTextContent("Rogue 3");
    expect(card).toHaveTextContent("AC 15");
    expect(card).toHaveTextContent("HP 24/24");
    expect(card).toHaveTextContent("Passive Perception 14");
    expect(card).toHaveTextContent("Owes the guild");
  });

  it("keeps the Party per Campaign and across reload", async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    const id = await createCampaign(user, "Alpha");
    await addPartyMember(id, ARIN);
    first.unmount();

    render(<App />);
    await openExisting(user, "Alpha");
    expect(await within(party()).findByRole("article", { name: /arin player card/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /all campaigns/i }));
    await createCampaign(user, "Beta");
    await openExisting(user, "Beta");
    expect(await within(party()).findByText(/no player characters/i)).toBeInTheDocument();
  });

  it("includes the Party in export and restores it on import", async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = await createCampaign(user, "Portable");
    await addPartyMember(id, ARIN);
    const item = await screen.findByRole("listitem", { name: "Portable" });
    await user.click(within(item).getByRole("button", { name: /export/i }));
    const text = await blobs[0].text();
    expect(text).toContain("Arin");

    await user.click(within(item).getByRole("button", { name: /delete/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /delete campaign/i }));
    await screen.findByText(/no campaigns yet/i);
    await user.upload(screen.getByLabelText(/import campaign file/i), new File([text], "c.json", { type: "application/json" }));
    await openExisting(user, "Portable");
    expect(await within(party()).findByRole("article", { name: /arin player card/i })).toHaveTextContent("AC 15");
  });
});
