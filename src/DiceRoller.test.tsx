import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { requestRoll, resetRolls, setRng } from "./dice/roller";
import { seqRng } from "./dice/dice";

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

  it("rolls an expression into the history, shows advantage dice, rejects bad input, and the shortcut focuses it", async () => {
    setRng(seqRng([0.5, 0.99, 0.0, 0.99]));
    const user = userEvent.setup();
    render(<App />);
    await openCombat(user);
    const input = screen.getByRole("textbox", { name: /dice expression/i });
    expect(input).not.toHaveFocus();
    await user.keyboard("{Alt>}d{/Alt}");
    expect(input).toHaveFocus();

    await user.type(input, "2d6+3{Enter}");
    const history = screen.getByRole("list", { name: /roll history/i });
    expect(within(history).getByText("13")).toBeInTheDocument();
    expect(history).toHaveTextContent("[4, 6]");

    await user.clear(input);
    await user.type(input, "1d20+5");
    await user.selectOptions(screen.getByLabelText(/advantage/i), "advantage");
    await user.click(screen.getByRole("button", { name: /^roll$/i }));
    expect(history).toHaveTextContent("[1, 20] advantage, kept 20");
    expect(within(history).getByText("25")).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "banana{Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent(/not a valid dice expression/i);
    expect(within(history).getAllByRole("listitem")).toHaveLength(2);
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
