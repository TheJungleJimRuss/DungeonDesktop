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
  return p;
}
const row = (name: string) => screen.getByRole("listitem", { name });

beforeEach(() => { localStorage.clear(); setMonsterSource(async () => FIXTURE_MONSTERS); });
afterEach(() => setMonsterSource(null));

describe("concentration, legendary and lair actions", () => {
  it("reminds of the concentration save DC after damage and clears on dismiss", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCombat(user);
    await user.type(await screen.findByLabelText("Ad-hoc name"), "Mage");
    await user.type(screen.getByLabelText("Ad-hoc HP"), "40");
    await user.click(screen.getByRole("button", { name: /add ad-hoc/i }));
    await user.type(await screen.findByLabelText("Concentration spell Mage"), "Bless");
    await user.click(screen.getByRole("button", { name: "Concentrate Mage" }));
    expect(await within(row("Mage")).findByText(/Concentrating: Bless/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Amount Mage"), "30");
    await user.click(screen.getByRole("button", { name: "Damage Mage" }));
    expect(await within(row("Mage")).findByRole("alert")).toHaveTextContent("DC 15");
    await user.click(screen.getByRole("button", { name: "Dismiss concentration save Mage" }));
    await waitFor(() => expect(within(row("Mage")).queryByRole("alert")).toBeNull());
    expect(within(row("Mage")).getByText(/Concentrating: Bless/)).toBeInTheDocument();
  });

  it("tracks legendary uses (reset on its turn) and the initiative-20 lair entry, across a reload", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await openCombat(user);
    await user.type(await screen.findByRole("searchbox", { name: "Search monsters" }), "Wyrm");
    await user.click(await screen.findByRole("button", { name: "Add Ancient Test Wyrm" }));
    const lair = await screen.findByRole("listitem", { name: /Lair actions/ });
    expect(within(lair).getByLabelText(/Initiative/)).toHaveValue(20);
    await user.click(await screen.findByRole("button", { name: "Expand Ancient Test Wyrm" }));
    expect(await screen.findByLabelText("Legendary uses Ancient Test Wyrm")).toHaveTextContent("3/3");
    await user.click(screen.getByRole("button", { name: "Use legendary action Ancient Test Wyrm" }));
    await waitFor(() => expect(screen.getByLabelText("Legendary uses Ancient Test Wyrm")).toHaveTextContent("2/3"));
    await user.click(within(lair).getByRole("button", { name: /Use lair action/ }));
    expect(await within(lair).findByText("Used this round")).toBeInTheDocument();

    unmount();
    render(<App />);
    await user.click(within(await screen.findByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
    await user.click(await screen.findByRole("button", { name: /continue in combat/i }));
    await user.click(await screen.findByRole("button", { name: "Expand Ancient Test Wyrm" }));
    expect(await screen.findByLabelText("Legendary uses Ancient Test Wyrm")).toHaveTextContent("2/3");
    // Wyrm is second (lair at 20 is first; wyrm unrolled): advance to its turn.
    const p = screen.getByRole("region", { name: "Initiative" });
    await user.click(within(p).getByRole("button", { name: "Next turn" }));
    await waitFor(() => expect(screen.getByLabelText("Legendary uses Ancient Test Wyrm")).toHaveTextContent("3/3"));
    await user.click(screen.getByRole("button", { name: /Expand Lair actions/ }));
    await user.click(screen.getByRole("button", { name: /Dismiss lair action/ }));
    await waitFor(() => expect(screen.queryByRole("listitem", { name: /Lair actions/ })).toBeNull());
  });
});
