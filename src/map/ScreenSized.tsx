import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

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

/** The map's top-most group, last in the SVG: labels portal into it so they draw above everything else on the map.
 *  Its coordinates are the SVG root's, so a label must be placed in root (anchor-relative) units, not inside a parent transform. */
export const LabelLayer = createContext<SVGGElement | null>(null);

/** Renders its children into the LabelLayer when there is one (inline otherwise, e.g. a layer drawn on its own). */
export function OnTop({ children }: { children: ReactNode }) {
  const layer = useContext(LabelLayer);
  return layer ? createPortal(children, layer) : <>{children}</>;
}
