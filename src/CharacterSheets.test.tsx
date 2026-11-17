import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

async function openCampaign(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), name);
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText(name);
  await user.click(within(screen.getByRole("listitem", { name })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: "Dashboard" });
}

describe("Party tab and character sheets", () => {
  it("builds a full sheet and shows derived numbers", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Sheets");
    await user.click(screen.getByRole("button", { name: /^party/i }));
    const panel = await screen.findByRole("region", { name: /character sheets/i });
    const p = within(panel);
    await user.click(p.getByRole("button", { name: /add character/i }));
    await user.type(p.getByLabelText("Name"), "Mira");
    await user.type(p.getByLabelText("Class"), "Wizard");
    await user.clear(p.getByLabelText("Level")); await user.type(p.getByLabelText("Level"), "5");
    await user.clear(p.getByLabelText("INT score")); await user.type(p.getByLabelText("INT score"), "18");
    await user.click(p.getByLabelText("Intelligence save"));
    await user.selectOptions(p.getByLabelText(/^Arcana/), "expertise");
    await user.selectOptions(p.getByLabelText("Spellcasting ability"), "int");
    await user.clear(p.getByLabelText("Level 1 slots")); await user.type(p.getByLabelText("Level 1 slots"), "4");
    await user.type(p.getByLabelText("Attack name"), "Dagger");
    await user.click(p.getByRole("button", { name: "Add attack" }));
    await user.type(p.getByLabelText("Attack name"), "Fire Bolt");
    await user.clear(p.getByLabelText("Quantity")); await user.type(p.getByLabelText("Quantity"), "3");
    await user.clear(p.getByLabelText("Dice count")); await user.type(p.getByLabelText("Dice count"), "2");
    await user.selectOptions(p.getByLabelText("Dice"), "10");
    await user.clear(p.getByLabelText("Damage bonus")); await user.type(p.getByLabelText("Damage bonus"), "3");
    await user.selectOptions(p.getByLabelText("Damage type"), "fire");
    await user.click(p.getByRole("button", { name: "Add attack" }));
    await user.click(p.getByRole("button", { name: "Remove attack Dagger" }));
    await user.type(p.getByLabelText("New item"), "Spellbook");
    await user.click(p.getByRole("button", { name: "Add item" }));
    await user.type(p.getByLabelText("New item"), "Scholar's Pack");
    await user.click(p.getByRole("button", { name: "Add pack" }));
    await user.type(p.getByLabelText("New item in Scholar's Pack"), "Ink{Enter}");
    await user.type(p.getByLabelText("New item in Scholar's Pack"), "Parchment{Enter}");
    await user.click(p.getByRole("button", { name: "Remove Ink from Scholar's Pack" }));
    await user.type(p.getByLabelText("New trait"), "Arcane Recovery{Enter}");
    await user.type(p.getByLabelText("New proficiency"), "Daggers{Enter}");
    await user.type(p.getByLabelText("Backstory"), "Fled the academy.");
    await user.click(p.getByRole("button", { name: /save member/i }));

    const sheet = await p.findByRole("article", { name: /mira character sheet/i });
    const s = within(sheet);
    expect(s.getByRole("button", { name: "Roll Intelligence save" })).toHaveTextContent("+7");
    expect(s.getByRole("button", { name: "Roll Arcana" })).toHaveTextContent("+10");
    expect(s.getByText(/spell save dc 15/i)).toBeInTheDocument();
    for (const t of ["Spellbook", "Arcane Recovery", "Daggers"]) expect(s.getByText(t).tagName).toBe("LI");
    expect(s.getByText("Fire Bolt ×3 — 2d10+3 fire")).toBeInTheDocument();
    const pack = within(s.getByRole("list", { name: "Scholar's Pack contents" }));
    expect(pack.getByText("Parchment")).toBeInTheDocument();
    expect(pack.queryByText("Ink")).not.toBeInTheDocument();
    expect(s.queryByText(/^Dagger —/)).not.toBeInTheDocument();
    await user.click(s.getByRole("button", { name: "Roll Fire Bolt damage" }));
    expect(await p.findByLabelText("Last roll")).toHaveTextContent(/Mira Fire Bolt damage: \d+/);
    expect(s.getByText("Fled the academy.")).toBeInTheDocument();

    await user.click(s.getByRole("button", { name: /use level 1 slot/i }));
    expect(await s.findByText("3/4")).toBeInTheDocument();
    await user.click(s.getByRole("button", { name: "Roll Arcana" }));
    expect(await p.findByLabelText("Last roll")).toHaveTextContent(/Mira Arcana: \d+/);
  });
});
