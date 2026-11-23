import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { addPartyMember, currentHpOf, listParty } from "./storage/party";
import { listCampaigns } from "./storage";
import { exportCampaign } from "./storage/portability";

type User = ReturnType<typeof userEvent.setup>;
const THIA = { name: "Thia", class: "Fighter", level: 3, ac: 16, maxHp: 28, passivePerception: 12, notes: "" };

async function createAndOpen(user: User, name: string) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), name);
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText(name);
  const id = (await listCampaigns()).find((c) => c.name === name)!.id;
  return id;
}
async function open(user: User, name: string) {
  await user.click(within(screen.getByRole("listitem", { name })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
}
const party = () => screen.getByRole("region", { name: /player card/i });
const row = (name: string) => screen.getByRole("listitem", { name });

beforeEach(() => localStorage.clear());

describe("Party HP and end combat", () => {
  it("defaults current HP to max for records without it", async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = await createAndOpen(user, "Alpha");
    await addPartyMember(id, THIA);
    expect(currentHpOf((await listParty(id))[0])).toBe(28);
    await open(user, "Alpha");
    expect(await within(party()).findByRole("article", { name: /thia player card/i })).toHaveTextContent("HP 28/28");
  });

  it("starts combat from it, and writes remaining HP back on End encounter", async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = await createAndOpen(user, "Alpha");
    await addPartyMember(id, { ...THIA, currentHp: 20 });
    await open(user, "Alpha");
    expect(await within(party()).findByRole("article", { name: /thia player card/i })).toHaveTextContent("HP 20/28");

    await user.keyboard("{Alt>}1{/Alt}");
    const p = await screen.findByRole("region", { name: "Initiative" });
    await user.click(within(p).getByRole("button", { name: /start encounter/i }));
    await within(p).findByRole("option", { name: "Thia" });
    await user.selectOptions(within(p).getByRole("combobox", { name: "Add Party member" }), "Thia");
    await waitFor(() => expect(within(row("Thia")).getByLabelText("HP Thia")).toHaveTextContent("HP 20/28"));

    await user.type(within(p).getByLabelText("Amount Thia"), "8");
    await user.click(within(p).getByRole("button", { name: "Damage Thia" }));
    await waitFor(() => expect(within(row("Thia")).getByLabelText("HP Thia")).toHaveTextContent("HP 12/28"));
    // sheet is untouched until the encounter ends
    expect(currentHpOf((await listParty(id))[0])).toBe(20);

    await user.click(within(p).getByRole("button", { name: /end encounter/i }));
    await user.click(await screen.findByRole("button", { name: /yes, end it/i }));
    await user.click(await screen.findByRole("button", { name: /end without xp/i }));
    await waitFor(async () => expect(currentHpOf((await listParty(id))[0])).toBe(12));

    await user.keyboard("{Escape}");
    await screen.findByRole("heading", { name: /dashboard/i });
    expect(await within(party()).findByRole("article", { name: /thia player card/i })).toHaveTextContent("HP 12/28");
  });

  it("includes current HP in the export", async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = await createAndOpen(user, "Alpha");
    await addPartyMember(id, { ...THIA, currentHp: 5 });
    const data = await exportCampaign(id);
    expect(JSON.stringify(data)).toContain('"currentHp":5');
  });
});
