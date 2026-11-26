import type { ReactNode } from "react";

/** Draws its children at a fixed on-screen size at the SVG point (x, y): children are laid out in screen pixels about that point.
 *  The scale is a transform by `--ui` (SVG units per screen pixel), never a font size times `--ui`: browsers cap font sizes (Chrome at
 *  5000 px), so text sized that way shrinks to nothing when zoomed far out. */
export function ScreenSized({ x, y, opacity, children }: { x: number; y: number; opacity?: number; children: ReactNode }) {
  return (
    <g transform={`translate(${x} ${y})`} opacity={opacity !== undefined && opacity < 1 ? opacity : undefined} pointerEvents="none">
      <g style={{ transform: "scale(var(--ui))" }}>{children}</g>
    </g>
  );
}
