import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { listCampaigns } from "./storage";
import { setPartyLocation } from "./storage/campaigns";
import { createLocation } from "./storage/locations";
import { createNpc, emptyNpcDraft } from "./storage/npcs";

type User = ReturnType<typeof userEvent.setup>;
async function openCampaign(user: User) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), "Alpha");
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText("Alpha");
  await user.click(within(screen.getByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
  return (await listCampaigns())[0].id;
}
const secret = (text: string, revealed = false) => ({ id: crypto.randomUUID(), text, revealed });

beforeEach(() => localStorage.clear());

async function seed(user: User) {
  const id = await openCampaign(user);
  const inn = (await createLocation(id, { name: "Neverwinter", notes: "" })).id;
  const keep = (await createLocation(id, { name: "Waterdeep", notes: "" })).id;
  const mk = (name: string, over: object) => createNpc(id, { ...emptyNpcDraft(), name, ...over });
  await mk("Harbormaster Lo", { locationId: inn, locationTag: "Neverwinter", factionTag: "Guild", motivation: "Wants gold", secrets: [secret("Smuggles elves"), secret("Owes a debt", true)] });
  await mk("Innkeeper Ida", { locationId: inn, locationTag: "Neverwinter", factionTag: "Harpers" });
  await mk("Lord Vex", { locationId: keep, locationTag: "Waterdeep", factionTag: "Guild" });
  await setPartyLocation(id, inn);
  return id;
}

describe("Social mode", () => {
  it("lists NPCs at the party location by default and can show all", async () => {
    const user = userEvent.setup();
    render(<App />);
    await seed(user);
    await user.keyboard("{Alt>}3{/Alt}");
    const list = await screen.findByRole("region", { name: "NPCs" });
    const l = within(list);
    expect(await l.findByRole("button", { name: /Harbormaster Lo/ })).toBeInTheDocument();
    expect(l.getByRole("button", { name: /Innkeeper Ida/ })).toBeInTheDocument();
    expect(l.queryByRole("button", { name: /Lord Vex/ })).toBeNull();

    await user.click(l.getByRole("button", { name: /show all npcs/i }));
    expect(await l.findByRole("button", { name: /Lord Vex/ })).toBeInTheDocument();
  });

  it("combines faction and location filters and shows an empty state", async () => {
    const user = userEvent.setup();
    render(<App />);
    await seed(user);
    await user.keyboard("{Alt>}3{/Alt}");
    const l = within(await screen.findByRole("region", { name: "NPCs" }));
    await l.findByRole("button", { name: /Harbormaster Lo/ });
    await user.selectOptions(l.getByRole("combobox", { name: /filter by faction/i }), "Harpers");
    expect(l.queryByRole("button", { name: /Harbormaster Lo/ })).toBeNull();
    expect(l.getByRole("button", { name: /Innkeeper Ida/ })).toBeInTheDocument();
    await user.selectOptions(l.getByRole("combobox", { name: /filter by location/i }), "Waterdeep");
    expect(l.getByText(/no npcs match/i)).toBeInTheDocument();
    await user.selectOptions(l.getByRole("combobox", { name: /filter by faction/i }), "Guild");
    expect(l.getByRole("button", { name: /Lord Vex/ })).toBeInTheDocument();
  });

  it("shows motivation and secrets and toggles revealed, visible in Prep", async () => {
    const user = userEvent.setup();
    render(<App />);
    await seed(user);
    await user.keyboard("{Alt>}3{/Alt}");
    const list = within(await screen.findByRole("region", { name: "NPCs" }));
    await user.click(await list.findByRole("button", { name: /Harbormaster Lo/ }));
    const card = within(await screen.findByRole("region", { name: "NPC card" }));
    expect(await card.findByText("Wants gold")).toBeInTheDocument();
    const row = (t: string) => card.getByText(t).closest("li")!;
    expect(within(row("Smuggles elves")).getByText("Hidden")).toBeInTheDocument();
    expect(within(row("Owes a debt")).getByText("Revealed")).toBeInTheDocument();

    await user.click(card.getByRole("checkbox", { name: "Smuggles elves" }));
    await waitFor(() => expect(within(row("Smuggles elves")).getByText("Revealed")).toBeInTheDocument());
    await user.click(card.getByRole("checkbox", { name: "Owes a debt" }));
    await waitFor(() => expect(within(row("Owes a debt")).getByText("Hidden")).toBeInTheDocument());

    await user.keyboard("{Alt>}4{/Alt}");
    const prep = within(await screen.findByRole("region", { name: "NPC card" }));
    const li = (await prep.findByText("Smuggles elves")).closest("li")!;
    expect(within(li).getByText("Revealed")).toBeInTheDocument();
  });
});
