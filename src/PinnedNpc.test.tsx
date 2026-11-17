import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import App from "./App";
import { listCampaigns } from "./storage";
import { createNpc, emptyNpcDraft, selectNpc } from "./storage/npcs";
import { getPoppedPanels } from "./popout/popoutState";
import { pinNpc } from "./popout/pinnedNpc";

type User = ReturnType<typeof userEvent.setup>;
interface FakeWindow { closed: boolean; close(): void; focus(): void }
let opened: FakeWindow[];

beforeEach(() => {
  localStorage.clear();
  opened = [];
  vi.stubGlobal("open", vi.fn(() => {
    const w: FakeWindow = { closed: false, close() { this.closed = true; }, focus() {} };
    opened.push(w);
    return w;
  }));
});
afterEach(() => vi.unstubAllGlobals());

async function openCampaign(user: User) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), "Alpha");
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText("Alpha");
  await user.click(within(screen.getByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
  return (await listCampaigns())[0].id;
}

describe("Pinned NPC", () => {
  it("pins one NPC to the Pop-out Window, ignores main selection, syncs secrets, unpins from either window, survives reload", async () => {
    const user = userEvent.setup();
    const main = render(<App />);
    const id = await openCampaign(user);
    const mira = await createNpc(id, { ...emptyNpcDraft(), name: "Mira", secrets: [{ id: "s1", text: "Is a spy", revealed: false }] });
    const orin = await createNpc(id, { ...emptyNpcDraft(), name: "Orin" });
    selectNpc(id, mira.id);
    await user.keyboard("{Alt>}3{/Alt}");
    const card = within(await screen.findByRole("region", { name: "NPC card" }));
    await card.findByRole("heading", { name: "Mira" });
    await user.click(card.getByRole("button", { name: /pin to pop-out/i }));
    expect(opened).toHaveLength(1);
    expect(getPoppedPanels(id)).toContain("pinned-npc");

    const pop = render(<App search={`?popout=${id}`} />);
    const pinned = within(await within(pop.container).findByRole("region", { name: "Pinned NPC" }));
    expect(await pinned.findByRole("heading", { name: "Mira" })).toBeInTheDocument();

    // main selection moves on; pinned card does not follow
    selectNpc(id, orin.id);
    await card.findByRole("heading", { name: "Orin" });
    expect(pinned.getByRole("heading", { name: "Mira" })).toBeInTheDocument();

    // revealing a secret in main reaches the pinned card
    selectNpc(id, mira.id);
    await user.click(await card.findByRole("checkbox", { name: "Is a spy" }));
    await waitFor(() => expect(pinned.getByRole("checkbox", { name: "Is a spy" })).toBeChecked());

    // reload of the pop-out keeps the pin
    pop.unmount();
    const pop2 = render(<App search={`?popout=${id}`} />);
    const pinned2 = within(await within(pop2.container).findByRole("region", { name: "Pinned NPC" }));
    await pinned2.findByRole("heading", { name: "Mira" });

    // unpin from the pop-out
    await user.click(pinned2.getByRole("button", { name: /unpin/i }));
    await waitFor(() => expect(within(pop2.container).queryByRole("region", { name: "Pinned NPC" })).toBeNull());
    expect(await card.findByRole("button", { name: /pin to pop-out/i })).toBeInTheDocument();

    // pin again, unpin from the main card
    await user.click(card.getByRole("button", { name: /pin to pop-out/i }));
    await within(pop2.container).findByRole("region", { name: "Pinned NPC" });
    await user.click(card.getByRole("button", { name: /unpin/i }));
    await waitFor(() => expect(within(pop2.container).queryByRole("region", { name: "Pinned NPC" })).toBeNull());
    main.unmount();
  });

  it("stacks several pinned NPCs, each with its own Unpin; the panel leaves the Pop-out Window with the last one", async () => {
    const user = userEvent.setup();
    const main = render(<App />);
    const id = await openCampaign(user);
    const mira = await createNpc(id, { ...emptyNpcDraft(), name: "Mira" });
    const orin = await createNpc(id, { ...emptyNpcDraft(), name: "Orin" });
    selectNpc(id, mira.id);
    await user.keyboard("{Alt>}3{/Alt}");
    const card = within(await screen.findByRole("region", { name: "NPC card" }));
    await card.findByRole("heading", { name: "Mira" });
    await user.click(card.getByRole("button", { name: /pin to pop-out/i }));
    selectNpc(id, orin.id);
    await card.findByRole("heading", { name: "Orin" });
    await user.click(card.getByRole("button", { name: /pin to pop-out/i }));
    expect(opened).toHaveLength(1); // the second pin reuses the open window

    const pop = render(<App search={`?popout=${id}`} />);
    const panel = within(await within(pop.container).findByRole("region", { name: "Pinned NPC" }));
    const heads = await panel.findAllByRole("heading", { level: 3 });
    expect(heads.map((h) => h.textContent)).toEqual(["Mira", "Orin"]); // in pin order
    expect(panel.getAllByRole("button", { name: /^unpin/i })).toHaveLength(2);

    // pinning an NPC that is already pinned changes nothing
    pinNpc(id, mira.id);
    await new Promise((r) => setTimeout(r, 30));
    expect(panel.getAllByRole("button", { name: /^unpin/i })).toHaveLength(2);
    expect(panel.getAllByRole("heading", { level: 3 })).toHaveLength(2);

    // unpin one from the Pop-out Window: the other stays
    await user.click(panel.getAllByRole("button", { name: /^unpin/i })[0]);
    await waitFor(() => expect(panel.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Orin"]));
    expect(getPoppedPanels(id)).toContain("pinned-npc");
    // unpin the last one from the main card: the panel goes
    await user.click(card.getByRole("button", { name: /unpin/i }));
    await waitFor(() => expect(within(pop.container).queryByRole("region", { name: "Pinned NPC" })).toBeNull());
    expect(getPoppedPanels(id)).not.toContain("pinned-npc");
    main.unmount();
  });

  it("reads a pin saved in the old single-id format", async () => {
    const user = userEvent.setup();
    const main = render(<App />);
    const id = await openCampaign(user);
    const mira = await createNpc(id, { ...emptyNpcDraft(), name: "Mira" });
    localStorage.setItem(`dungeon-desktop:npc-pin:${id}`, mira.id);
    localStorage.setItem(`dungeon-desktop:popouts:${id}`, JSON.stringify(["pinned-npc"]));
    const pop = render(<App search={`?popout=${id}`} />);
    const panel = within(await within(pop.container).findByRole("region", { name: "Pinned NPC" }));
    await panel.findByRole("heading", { name: "Mira" });
    main.unmount();
  });
});
