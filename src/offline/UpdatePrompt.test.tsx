import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UpdatePrompt from "./UpdatePrompt";
import { setWaitingWorker } from "./updates";

describe("UpdatePrompt", () => {
  it("is hidden until an update is waiting, then updates only on click", async () => {
    render(<UpdatePrompt />);
    expect(screen.queryByText(/new version/i)).toBeNull();
    const postMessage = vi.fn();
    act(() => setWaitingWorker({ postMessage } as unknown as ServiceWorker));
    expect(screen.getByText(/new version/i)).toBeVisible();
    expect(postMessage).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Update now" }));
    expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    act(() => setWaitingWorker(null));
  });
});
