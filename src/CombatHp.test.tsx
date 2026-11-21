import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { resetRolls, setRng } from "./dice/roller";
import { seqRng } from "./dice/dice";
import { setMonsterSource } from "./srd/monsters";
import { FIXTURE_MONSTERS } from "./srd/fixtures";

type User = ReturnType<typeof userEvent.setup>;

async function openCombat(user: User) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), "Alpha");
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText("Alpha");
  await user.click(within(screen.getByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
  await user.keyboard("{Alt>}1{/Alt}");
  await screen.findByRole("heading", { name: /^combat$/i });
  const p = await screen.findByRole("region", { name: "Initiative" });
  await user.click(within(p).getByRole("button", { name: /start encounter/i }));
  return p;
}
async function addAdhoc(user: User, name: string, hp: string) {
  await user.type(await screen.findByLabelText("Ad-hoc name"), name);
  await user.type(screen.getByLabelText("Ad-hoc HP"), hp);
  await user.click(screen.getByRole("button", { name: /add ad-hoc/i }));
}
const row = (name: string) => screen.getByRole("listitem", { name });
const hp = (name: string, text: string) => waitFor(() => expect(within(row(name)).getByLabelText(`HP ${name}`)).toHaveTextContent(text));

beforeEach(() => { localStorage.clear(); setMonsterSource(async () => FIXTURE_MONSTERS); });
afterEach(() => { setMonsterSource(null); resetRolls(); });

describe("HP and defeat", () => {
  it("applies damage, temp HP, healing, bloodied and defeated states, and survives a reload", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await openCombat(user);
    await addAdhoc(user, "Bandit", "10");
    await hp("Bandit", "HP 10/10");

    await user.type(screen.getByLabelText("Amount Bandit"), "4");
    await user.click(screen.getByRole("button", { name: "Set temp HP Bandit" }));
    await hp("Bandit", "HP 10/10 (+4 temp)");

    await user.type(screen.getByLabelText("Amount Bandit"), "7");
    await user.click(screen.getByRole("button", { name: "Damage Bandit" }));
    await hp("Bandit", "HP 7/10");
    expect(within(row("Bandit")).queryByText("Bloodied")).toBeNull();

    await user.type(screen.getByLabelText("Amount Bandit"), "2");
    await user.click(screen.getByRole("button", { name: "Damage Bandit" }));
    await hp("Bandit", "HP 5/10");
    expect(within(row("Bandit")).getByText("Bloodied")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Amount Bandit"), "40");
    await user.click(screen.getByRole("button", { name: "Amount plus 5 Bandit" }));
    await user.click(screen.getByRole("button", { name: "Amount plus 5 Bandit" }));
    await user.click(screen.getByRole("button", { name: "Amount minus 5 Bandit" }));
    expect(screen.getByLabelText("Amount Bandit")).toHaveValue(45);
    await user.click(screen.getByRole("button", { name: "Heal Bandit" }));
    await hp("Bandit", "HP 10/10");

    await user.type(screen.getByLabelText("Amount Bandit"), "99");
    await user.click(screen.getByRole("button", { name: "Damage Bandit" }));
    await hp("Bandit", "HP 0/10");
    expect(within(row("Bandit")).getByText("Defeated")).toBeInTheDocument();
    expect(row("Bandit")).toHaveClass("defeated");

    unmount();
    render(<App />);
    await user.click(within(await screen.findByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
    await user.click(await screen.findByRole("button", { name: /continue in combat/i }));
    await waitFor(() => expect(within(row("Bandit")).getByLabelText("HP Bandit")).toHaveTextContent("HP 0/10"));
  });

  it("removes defeated combatants when the Encounter is set to remove", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCombat(user);
    await addAdhoc(user, "Bandit", "3");
    await user.click(screen.getByRole("checkbox", { name: /remove defeated/i }));
    await user.type(screen.getByLabelText("Amount Bandit"), "5");
    await user.click(screen.getByRole("button", { name: "Damage Bandit" }));
    await waitFor(() => expect(screen.queryByRole("listitem", { name: "Bandit" })).toBeNull());
  });

  it("overrides monster max HP by hand or by rolling its hit dice", async () => {
    setRng(seqRng([0.0, 0.99])); // 2d6: 0.0 -> 1, 0.99 -> 6
    const user = userEvent.setup();
    render(<App />);
    await openCombat(user);
    await user.type(screen.getByRole("searchbox", { name: /search monsters/i }), "goblin");
    await user.click(await screen.findByRole("button", { name: "Add Goblin Warrior" }));
    await hp("Goblin Warrior", "HP 7/7");

    await user.clear(screen.getByLabelText("Max HP Goblin Warrior"));
    await user.type(screen.getByLabelText("Max HP Goblin Warrior"), "12{Enter}");
    await hp("Goblin Warrior", "HP 12/12");

    await user.click(await screen.findByRole("button", { name: "Roll HP Goblin Warrior" }));
    await hp("Goblin Warrior", "HP 7/7");
  });
});
