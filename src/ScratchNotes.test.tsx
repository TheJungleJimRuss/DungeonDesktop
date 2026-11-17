import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { listCampaigns } from "./storage";
import { createNpc, emptyNpcDraft } from "./storage/npcs";
import { addScene, createSession, emptySceneDraft } from "./storage/sessions";
import { getDb } from "./storage/db";
import { listPinnedNotes } from "./storage/notes";

type User = ReturnType<typeof userEvent.setup>;
async function openCampaign(user: User) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), "Alpha");
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText("Alpha");
  await user.click(within(screen.getByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
  return (await listCampaigns())[0].id;
}

beforeEach(() => localStorage.clear());

async function seed(user: User) {
  const id = await openCampaign(user);
  await createNpc(id, { ...emptyNpcDraft(), name: "Harbormaster Lo" });
  await createNpc(id, { ...emptyNpcDraft(), name: "Innkeeper Ida" });
  const s = await createSession(id, { title: "Session One" });
  await addScene(s.id, { ...emptySceneDraft(), title: "Tavern Brawl" });
  return id;
}

describe("Scratch notes", () => {
  it("adds, edits and deletes notes, newest first", async () => {
    const user = userEvent.setup();
    render(<App />);
    await seed(user);
    await user.keyboard("{Alt>}3{/Alt}");
    const panel = within(await screen.findByRole("region", { name: "Scratch notes" }));
    await user.type(panel.getByLabelText("New scratch note"), "first thought");
    await user.click(panel.getByRole("button", { name: /add scratch note/i }));
    await panel.findByText("first thought");
    await user.type(panel.getByLabelText("New scratch note"), "second thought");
    await user.click(panel.getByRole("button", { name: /add scratch note/i }));
    await panel.findByText("second thought");
    const texts = () => panel.getAllByRole("listitem").map((li) => li.querySelector("[data-note-text]")?.textContent);
    expect(texts()).toEqual(["second thought", "first thought"]);

    await user.click(panel.getByRole("button", { name: "Edit scratch note: first thought" }));
    const edit = panel.getByLabelText("Edit scratch note");
    await user.clear(edit);
    await user.type(edit, "revised");
    await user.click(panel.getByRole("button", { name: /save scratch note/i }));
    await panel.findByText("revised");

    await user.click(panel.getByRole("button", { name: "Delete scratch note: second thought" }));
    await waitFor(() => expect(panel.queryByText("second thought")).toBeNull());
    expect(texts()).toEqual(["revised"]);
  });

  it("attaches to the selected NPC by default and shows on the NPC card, and on the scene in Prep", async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = await seed(user);
    await user.keyboard("{Alt>}3{/Alt}");
    const list = within(await screen.findByRole("region", { name: "NPCs" }));
    await user.click(await list.findByRole("button", { name: /Harbormaster Lo/ }));
    const panel = within(await screen.findByRole("region", { name: "Scratch notes" }));
    expect(panel.getByRole("combobox", { name: /attach to npc/i })).toHaveDisplayValue("Harbormaster Lo");
    await user.type(panel.getByLabelText("New scratch note"), "owes me a favour");
    await user.selectOptions(panel.getByRole("combobox", { name: /attach to scene/i }), "Session One: Tavern Brawl");
    await user.click(panel.getByRole("button", { name: /add scratch note/i }));
    await panel.findByText("owes me a favour");

    const card = within(screen.getByRole("region", { name: "NPC card" }));
    expect(await card.findByText("owes me a favour")).toBeInTheDocument();

    await user.click(list.getByRole("button", { name: /Innkeeper Ida/ }));
    await waitFor(() => expect(card.queryByText("owes me a favour")).toBeNull());
    expect(panel.getByRole("combobox", { name: /attach to npc/i })).toHaveDisplayValue("Innkeeper Ida");

    await user.keyboard("{Alt>}4{/Alt}");
    const scene = within(await screen.findByRole("article", { name: "Scene Tavern Brawl" }));
    expect(await scene.findByText("owes me a favour")).toBeInTheDocument();

    // kind filter: pinned notes unaffected; the scratch note is stored in the shared notes collection
    expect(await listPinnedNotes(id)).toEqual([]);
    const rows = await (await getDb()).getAllFromIndex("notes", "byCampaign", id);
    expect(rows.map((r) => r.kind)).toEqual(["scratch"]);
  });

  it("can attach to nothing", async () => {
    const user = userEvent.setup();
    render(<App />);
    await seed(user);
    await user.keyboard("{Alt>}3{/Alt}");
    const panel = within(await screen.findByRole("region", { name: "Scratch notes" }));
    await user.type(panel.getByLabelText("New scratch note"), "loose");
    await user.click(panel.getByRole("button", { name: /add scratch note/i }));
    expect(await panel.findByText("loose")).toBeInTheDocument();
  });
});
