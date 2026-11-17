import { createContext, useContext, type ReactNode } from "react";
import { getMode, type ModeId } from "../modes/modes";

/**
 * Placeholder while a panel's data loads. Screen readers hear the label; sighted users see
 * skeleton bars that only fade in after a short delay (CSS), so fast loads never flash.
 */
export function Loading({ label = "Loading…", lines = 3 }: { label?: string; lines?: number }) {
  return (
    <div className="loading" role="status">
      <span className="visually-hidden">{label}</span>
      {Array.from({ length: lines }, (_, i) => <span key={i} className="skeleton-line" aria-hidden="true" />)}
    </div>
  );
}

/** Switches the Campaign screen to a Mode; provided by the Dashboard. Null outside it (tests, drawers). */
export const ModeSwitchContext = createContext<((id: ModeId) => void) | null>(null);

/** Friendly "nothing here yet" block, with an optional action and an optional jump to another Mode. */
export function EmptyState({ children, action, goTo }: { children: ReactNode; action?: ReactNode; goTo?: ModeId }) {
  const switchTo = useContext(ModeSwitchContext);
  const target = goTo && switchTo ? getMode(goTo) : undefined;
  return (
    <div className="empty-state">
      <p className="muted">{children}</p>
      {(action || target) && (
        <div className="row">
          {action}
          {target && <button onClick={() => switchTo!(target.id)}>Go to {target.label}</button>}
        </div>
      )}
    </div>
  );
}
