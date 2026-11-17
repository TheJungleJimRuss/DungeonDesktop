import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { requestRoll, resetRolls, setRng } from "./dice/roller";
import { seqRng } from "./dice/dice";
import { buildExpression } from "./panels/DiceRollerPanel";

async function openCombat(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), "Alpha");
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText("Alpha");
  await user.click(within(screen.getByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
  await user.keyboard("{Alt>}1{/Alt}");
  await screen.findByRole("heading", { name: /^combat$/i });
}

describe("Dice Roller panel", () => {
  afterEach(resetRolls);

  it("rolls the picked count, die and bonus into the history, shows advantage dice, rejects bad counts, and the shortcut focuses it", async () => {
    setRng(seqRng([0.5, 0.99, 0.0, 0.99]));
    const user = userEvent.setup();
    render(<App />);
    await openCombat(user);
    const count = screen.getByRole("spinbutton", { name: /number of dice/i });
    const die = screen.getByRole("combobox", { name: /die type/i });
    const bonus = screen.getByRole("spinbutton", { name: /bonus/i });
    const adv = screen.getByRole("combobox", { name: /advantage/i });
    expect(count).not.toHaveFocus();
    await user.keyboard("{Alt>}d{/Alt}");
    expect(count).toHaveFocus();

    await user.clear(count);
    await user.type(count, "2");
    await user.selectOptions(die, "d6");
    await user.clear(bonus);
    await user.type(bonus, "3");
    expect(adv).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /^roll$/i }));
    const history = screen.getByRole("list", { name: /roll history/i });
    expect(history).toHaveTextContent("2d6+3");
    expect(within(history).getByText("13")).toBeInTheDocument();
    expect(history).toHaveTextContent("[4, 6]");

    await user.clear(count);
    await user.type(count, "1");
    await user.selectOptions(die, "d20");
    await user.clear(bonus);
    await user.type(bonus, "5");
    expect(adv).toBeEnabled();
    await user.selectOptions(adv, "advantage");
    await user.click(screen.getByRole("button", { name: /^roll$/i }));
    expect(history).toHaveTextContent("[1, 20] advantage, kept 20");
    expect(within(history).getByText("25")).toBeInTheDocument();

    await user.clear(count);
    await user.type(count, "0");
    await user.click(screen.getByRole("button", { name: /^roll$/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/between 1 and 100 dice/i);
    expect(within(history).getAllByRole("listitem")).toHaveLength(2);
  });

  it("builds expressions with negative and zero bonuses", () => {
    expect(buildExpression(3, 8, -2)).toBe("3d8-2");
    expect(buildExpression(1, 100, 0)).toBe("1d100");
  });

  it("lets other panels request a roll through the shared interface", async () => {
    setRng(seqRng([0.99]));
    const user = userEvent.setup();
    render(<App />);
    await openCombat(user);
    requestRoll("1d8");
    expect(await screen.findByRole("list", { name: /roll history/i })).toHaveTextContent("8");
  });
});
