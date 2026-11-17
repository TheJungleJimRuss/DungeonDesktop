import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { setMonsterSource } from "./srd/monsters";
import { FIXTURE_MONSTERS } from "./srd/fixtures";
import { listCampaigns } from "./storage";
import { addPartyMember } from "./storage/party";

type User = ReturnType<typeof userEvent.setup>;
beforeEach(() => { localStorage.clear(); setMonsterSource(async () => FIXTURE_MONSTERS); });

async function openCampaign(user: User) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), "Alpha");
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText("Alpha");
  await user.click(within(await screen.findByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
}

describe("Prep workspaces", () => {
  it("focuses one workspace at a time and keeps the choice", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user);
    await user.keyboard("{Alt>}4{/Alt}");
    await screen.findByRole("region", { name: /^scenes$/i });
    expect(screen.getByRole("region", { name: /custom entries/i })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /monsters/i }));
    expect(screen.getByRole("region", { name: /custom entries/i })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /^scenes$/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New monster" }));
    expect(await screen.findByRole("form", { name: /custom monster editor/i })).toBeInTheDocument();

    await user.keyboard("{Alt>}1{/Alt}");
    await user.keyboard("{Alt>}4{/Alt}");
    expect(screen.getByRole("tab", { name: /monsters/i })).toHaveAttribute("aria-selected", "true");
  });
});

describe("Add players dropdown", () => {
  it("adds one member or the whole Party from a single dropdown", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user);
    const id = (await listCampaigns())[0].id;
    for (const name of ["Thia", "Bram"]) await addPartyMember(id, { name, maxHp: 10 } as never);
    await user.keyboard("{Alt>}1{/Alt}");
    const p = await screen.findByRole("region", { name: "Initiative" });
    await user.click(within(p).getByRole("button", { name: /start encounter/i }));
    await within(p).findByRole("option", { name: "Entire Party" });
    await user.selectOptions(within(p).getByRole("combobox", { name: "Add Party member" }), "Entire Party");
    await waitFor(() => expect(within(p).getAllByRole("listitem", { name: /Thia|Bram/ })).toHaveLength(2));
    expect(within(p).queryByRole("button", { name: /^Add (Thia|Bram)$/ })).not.toBeInTheDocument();
  });
});

describe("Keyboard shortcut help", () => {
  it("opens with ? and closes with Escape, listing the Mode shortcuts", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user);
    await user.keyboard("?");
    const dialog = await screen.findByRole("dialog", { name: /keyboard shortcuts/i });
    expect(within(dialog).getByText("Alt+1")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
  });
});

describe("Social mode", () => {
  it("shows the real NPC list and card panels", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user);
    await user.keyboard("{Alt>}3{/Alt}");
    expect(await screen.findByRole("region", { name: /npcs/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /npc card/i })).toBeInTheDocument();
  });
});
