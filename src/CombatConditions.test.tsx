import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
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
  await screen.findByRole("button", { name: /end encounter/i });
  return p;
}
async function addAdhoc(user: User, name: string, init: string) {
  await user.type(await screen.findByLabelText("Ad-hoc name"), name);
  await user.type(screen.getByLabelText("Ad-hoc initiative"), init);
  await user.type(screen.getByLabelText("Ad-hoc HP"), "10");
  await user.click(screen.getByRole("button", { name: /add ad-hoc/i }));
}
const row = (name: string) => screen.getByRole("listitem", { name });

beforeEach(() => { localStorage.clear(); setMonsterSource(async () => FIXTURE_MONSTERS); });
afterEach(() => setMonsterSource(null));

describe("Conditions in the tracker", () => {
  it("applies with a duration, shows rules on click, counts down with a warning, and survives a reload", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await openCombat(user);
    await addAdhoc(user, "Bandit", "15");
    await addAdhoc(user, "Cleric", "5");

    const b = () => within(row("Bandit"));
    await waitFor(() => expect(b().getByLabelText("Condition to apply to Bandit").querySelectorAll("option").length).toBeGreaterThan(5));
    await user.selectOptions(b().getByLabelText("Condition to apply to Bandit"), "Prone");
    await user.click(b().getByRole("button", { name: "Apply condition to Bandit" }));
    await user.selectOptions(b().getByLabelText("Condition to apply to Bandit"), "Stunned");
    await user.type(b().getByLabelText("Condition rounds Bandit"), "1");
    await user.click(b().getByRole("button", { name: "Apply condition to Bandit" }));

    expect(await b().findByRole("button", { name: "Condition Prone on Bandit" })).toBeInTheDocument();
    expect(await b().findByRole("button", { name: "Condition Stunned on Bandit" })).toHaveTextContent("Stunned (1)");

    await user.click(b().getByRole("button", { name: "Condition Prone on Bandit" }));
    expect(b().getByRole("note", { name: "Prone rules" })).toHaveTextContent(/crawl|Disadvantage/i);

    unmount();
    render(<App />);
    await user.click(within(await screen.findByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
    await user.click(await screen.findByRole("button", { name: /continue in combat/i }));
    await screen.findByRole("button", { name: "Condition Stunned on Bandit" });

    await user.click(screen.getByRole("button", { name: /next turn/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Stunned on Bandit has ended.");
    await user.click(screen.getByRole("button", { name: "Expand Bandit" }));
    expect(screen.queryByRole("button", { name: "Condition Stunned on Bandit" })).toBeNull();
    expect(screen.getByRole("button", { name: "Condition Prone on Bandit" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());

    await user.click(screen.getByRole("button", { name: "Remove Prone from Bandit" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Condition Prone on Bandit" })).toBeNull());
  });
});
