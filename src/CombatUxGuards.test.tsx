import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { addPartyMember } from "./storage/party";
import { listCampaigns } from "./storage";

type User = ReturnType<typeof userEvent.setup>;
const THIA = { name: "Thia", class: "Fighter", level: 3, ac: 16, maxHp: 28, passivePerception: 12, notes: "" };

async function openCombatWithThia(user: User) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), "Alpha");
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText("Alpha");
  const id = (await listCampaigns()).find((c) => c.name === "Alpha")!.id;
  await addPartyMember(id, THIA);
  await user.click(within(screen.getByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
  await user.keyboard("{Alt>}1{/Alt}");
  const p = await screen.findByRole("region", { name: "Initiative" });
  await user.click(within(p).getByRole("button", { name: /start encounter/i }));
  await within(p).findByRole("option", { name: "Thia" });
  await user.selectOptions(within(p).getByRole("combobox", { name: "Add Party member" }), "Thia");
  await screen.findByRole("listitem", { name: "Thia" });
  return p;
}
const row = (name: string) => screen.getByRole("listitem", { name });

beforeEach(() => localStorage.clear());

describe("End encounter asks first", () => {
  it("keeps the fight when the DM backs out, ends it on Yes", async () => {
    const user = userEvent.setup();
    render(<App />);
    const p = await openCombatWithThia(user);
    await user.click(within(p).getByRole("button", { name: /end encounter/i }));
    await user.click(within(p).getByRole("button", { name: /keep fighting/i }));
    expect(row("Thia")).toBeInTheDocument();
    await user.click(within(p).getByRole("button", { name: /end encounter/i }));
    await user.click(within(p).getByRole("button", { name: /yes, end it/i }));
    expect(await within(p).findByText(/no encounter in progress/i)).toBeInTheDocument();
  });
});

describe("A PC at 0 HP", () => {
  it("is Dying with death saves, survives 'remove defeated', and dies on three failures", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCombatWithThia(user);
    await user.click(screen.getByRole("checkbox", { name: /remove defeated/i }));
    await user.type(screen.getByLabelText("Amount Thia"), "40");
    await user.click(screen.getByRole("button", { name: "Damage Thia" }));
    await waitFor(() => expect(within(row("Thia")).getByText("Dying")).toBeInTheDocument());
    expect(row("Thia")).toHaveClass("dying");
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole("button", { name: "Death save failure Thia" }));
    await waitFor(() => expect(within(row("Thia")).getByText("Dead")).toBeInTheDocument());
  });

  it("stabilises on three successes and clears the saves when healed", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCombatWithThia(user);
    await user.type(screen.getByLabelText("Amount Thia"), "40");
    await user.click(screen.getByRole("button", { name: "Damage Thia" }));
    await user.click(await screen.findByRole("button", { name: "Death save success Thia" }));
    await waitFor(() => expect(within(row("Thia")).getByLabelText("Death save successes Thia")).toHaveTextContent("1/3"));
    await user.click(screen.getByRole("button", { name: "Death save success Thia" }));
    await user.click(screen.getByRole("button", { name: "Death save success Thia" }));
    await waitFor(() => expect(within(row("Thia")).getByText("Stable")).toBeInTheDocument());
    await user.type(screen.getByLabelText("Amount Thia"), "5");
    await user.click(screen.getByRole("button", { name: "Heal Thia" }));
    await waitFor(() => expect(within(row("Thia")).getByLabelText("HP Thia")).toHaveTextContent("HP 5/28"));
    expect(within(row("Thia")).queryByText(/Stable|Dying/)).toBeNull();
  });
});
