import type { FormEvent, SyntheticEvent } from "react";

/** Unsaved-edit guard. An editor form opts in with `{...GUARD}`; any input inside it marks it dirty
 *  until it submits or unmounts. Leaving the screen (Esc, a Mode button, All campaigns) asks first. */
export const GUARD = { "data-guard-unsaved": "" } as const;

const dirtyForm = (e: SyntheticEvent) => (e.target as HTMLInputElement).form?.closest("form[data-guard-unsaved]") as HTMLFormElement | null;

/** Capture handlers for the element that holds the panels. */
export const trackUnsaved = {
  onInputCapture: (e: FormEvent) => { const f = dirtyForm(e); if (f) f.dataset.dirty = "true"; },
  onChangeCapture: (e: FormEvent) => { const f = dirtyForm(e); if (f) f.dataset.dirty = "true"; },
  onSubmitCapture: (e: FormEvent) => { delete (e.target as HTMLFormElement).dataset.dirty; },
};

export const hasUnsavedChanges = () => !!document.querySelector("form[data-guard-unsaved][data-dirty]");

/** True when it is fine to leave: nothing unsaved, or the DM agreed to discard it. */
export const confirmLeave = () => !hasUnsavedChanges() || window.confirm("You have unsaved changes. Discard them?");
