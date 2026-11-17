import { applyUpdate, useUpdateAvailable } from "./updates";

export default function UpdatePrompt() {
  if (!useUpdateAvailable()) return null;
  return (
    <div className="update-prompt" role="status" aria-label="Update available">
      <span>A new version is ready.</span>
      <button type="button" onClick={applyUpdate}>Update now</button>
    </div>
  );
}
