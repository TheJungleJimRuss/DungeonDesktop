import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { setMonsterSource } from "./srd/monsters";
import { FIXTURE_MONSTERS } from "./srd/fixtures";
import { listCampaigns } from "./storage";
import { addPartyMember } from "./storage/party";

type User = ReturnType<typeof userEvent.setup>;
beforeEach(() => { localStorage.clear(); setMonsterSource(async () => FIXTURE_MONSTERS); });

async function openCombat(user: User) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), "Alpha");
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await user.click(within(await screen.findByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
  const id = (await listCampaigns())[0].id;
  for (const name of ["Thia", "Bram"]) await addPartyMember(id, { name, maxHp: 20 } as never);
  await user.keyboard("{Alt>}1{/Alt}");
  const p = await screen.findByRole("region", { name: "Initiative" });
  await user.click(within(p).getByRole("button", { name: /start encounter/i }));
  return p;
}
const row = (name: string) => screen.getByRole("listitem", { name });

describe("faster combat", () => {
  it("adds several copies of a monster at once", async () => {
    const user = userEvent.setup();
    render(<App />);
    const p = await openCombat(user);
    const count = within(p).getByRole("spinbutton", { name: "How many" });
    await user.clear(count);
    await user.type(count, "3");
    await user.type(within(p).getByRole("searchbox", { name: "Search monsters" }), "goblin");
    await user.click(await within(p).findByRole("button", { name: "Add Goblin Warrior" }));
    await waitFor(() => expect(within(p).getAllByRole("listitem", { name: /^Goblin Warrior \d$/ })).toHaveLength(3));
  });

  it("asks for missing party initiative and hides members already in the fight", async () => {
    const user = userEvent.setup();
    render(<App />);
    const p = await openCombat(user);
    await within(p).findByRole("option", { name: "Thia" });
    await user.selectOptions(within(p).getByRole("combobox", { name: "Add Party member" }), "Thia");
    const prompt = await within(p).findByRole("status", { name: "Missing initiative" });
    expect(prompt).toHaveTextContent("Thia");
    expect(within(p).queryByRole("option", { name: "Thia" })).not.toBeInTheDocument();
    expect(within(p).queryByRole("option", { name: /entire party/i })).not.toBeInTheDocument(); // only Bram left
    await user.click(within(prompt).getByRole("button", { name: "Thia" }));
    expect(screen.getByLabelText("Initiative Thia")).toHaveFocus();
    await user.type(screen.getByLabelText("Initiative Thia"), "14{Enter}");
    await waitFor(() => expect(within(p).queryByRole("status", { name: "Missing initiative" })).not.toBeInTheDocument());
  });

  it("shows HP on collapsed rows, and expanding one puts the cursor in its damage box", async () => {
    const user = userEvent.setup();
    render(<App />);
    const p = await openCombat(user);
    await user.type(within(p).getByLabelText("Ad-hoc name"), "Bandit");
    await user.type(within(p).getByLabelText("Ad-hoc initiative"), "20");
    await user.type(within(p).getByLabelText("Ad-hoc HP"), "11");
    await user.click(within(p).getByRole("button", { name: "Add ad-hoc" }));
    await user.type(within(p).getByLabelText("Ad-hoc name"), "Cultist");
    await user.type(within(p).getByLabelText("Ad-hoc initiative"), "5");
    await user.type(within(p).getByLabelText("Ad-hoc HP"), "9");
    await user.click(within(p).getByRole("button", { name: "Add ad-hoc" }));
    await waitFor(() => expect(row("Cultist")).toHaveClass("collapsed"));
    expect(row("Cultist")).toHaveTextContent("9/9 HP");
    expect(row("Bandit")).not.toHaveTextContent("11/11 HP"); // the open row shows the full controls instead
    await user.click(within(row("Cultist")).getByRole("button", { name: "Expand Cultist" }));
    expect(screen.getByLabelText("Amount Cultist")).toHaveFocus();
    await user.keyboard("4{Enter}");
    await waitFor(() => expect(screen.getByLabelText("HP Cultist")).toHaveTextContent("HP 5/9"));
  });
});
