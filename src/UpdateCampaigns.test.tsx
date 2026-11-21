import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { getDb } from "./storage/db";
import { EXPORT_FORMAT, EXPORT_VERSION } from "./storage/portability";

const file = (id: string, name: string, exportedAt: number) =>
  new File(
    [JSON.stringify({ format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt, campaign: { id, name, createdAt: 1, updatedAt: 1 }, collections: {} })],
    `${name}.dungeon.json`,
    { type: "application/json" },
  );

describe("Update campaigns from files", () => {
  it("updates newer files, leaves older ones and skips unknown ids", async () => {
    const user = userEvent.setup();
    render(<App />);
    const db = await getDb();
    const now = Date.now();
    await db.put("campaigns", { id: "a", name: "Old A", createdAt: 1, updatedAt: now - 1000 });
    await db.put("campaigns", { id: "b", name: "Keep B", createdAt: 1, updatedAt: now + 100000 });
    await user.click(await screen.findByRole("button", { name: /update campaigns from files/i }));
    await user.upload(screen.getByLabelText(/update campaign files/i), [
      file("a", "New A", now),
      file("b", "Stale B", now),
      file("zzz", "Ghost", now),
    ]);
    expect(await screen.findByText(/Updated 1: New A/)).toBeInTheDocument();
    expect(screen.getByText(/Already up to date: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Skipped Ghost.dungeon.json/)).toBeInTheDocument();
    expect(await screen.findByText("New A")).toBeInTheDocument();
    expect(screen.getByText("Keep B")).toBeInTheDocument();
  });
});
