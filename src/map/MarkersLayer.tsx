import { Fragment, useState } from "react";
import { OnTop, ScreenSized } from "./ScreenSized";
import type { MapMarker } from "../storage/maps";
import { unitsPerSquare } from "./lines";
import { MarkerGlyph } from "./icons";
import { markerOpacity, type Pt } from "./geometry";
import { BATTLE_PX_PER_SQUARE } from "./scale";

const DRAG_SLOP_PX = 3; // a press that moves less than this selects the Marker without moving it

/** The Markers: an icon in a badge with the name below, drawn in on-screen pixels (--ui counter-scales with zoom). In the Select tool a Marker
 *  selects on press and drags freely (no snapping); the drag is shown live and saved on release. In other tools the Markers let clicks through. */
export function MarkersLayer({ markers, labelOf, pxPerSquare, selectedId, selectable, svgPoint, onSelect, onDrop }: {
  markers: MapMarker[]; labelOf: (m: MapMarker) => string; pxPerSquare: number; selectedId?: string; selectable: boolean;
  svgPoint: (e: { clientX: number; clientY: number }) => Pt | null; onSelect: (id: string) => void; onDrop: (id: string, at: Pt) => void;
}) {
  const [drag, setDrag] = useState<{ id: string; at: Pt; moved: boolean; sx: number; sy: number } | null>(null);
  const U = unitsPerSquare(pxPerSquare);
  return (
    <g className="map-markers">
      {markers.map((m) => {
        const at = drag?.id === m.id ? drag.at : m, label = labelOf(m), on = m.id === selectedId;
        // Fades with zoom out; the selected or dragged one stays at full opacity. At 0 it is neither drawn nor hit.
        const opacity = on || drag?.id === m.id ? 1 : markerOpacity(m.placedAt ?? BATTLE_PX_PER_SQUARE, pxPerSquare, m.priority ?? "normal");
        if (opacity <= 0) return null;
        return (
          <Fragment key={m.id}>
          <g className={"map-marker" + (on ? " selected" : "")} role="button" aria-label={`Marker ${label}`} aria-pressed={on} data-marker={m.id}
            tabIndex={selectable ? 0 : -1} pointerEvents={selectable ? undefined : "none"} transform={`translate(${at.x * U} ${at.y * U})`} opacity={opacity < 1 ? opacity : undefined}
            onClick={() => onSelect(m.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(m.id); } }}
            onPointerDown={(e) => { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); onSelect(m.id); setDrag({ id: m.id, at: { x: m.x, y: m.y }, moved: false, sx: e.clientX, sy: e.clientY }); }}
            onPointerMove={(e) => { if (drag?.id === m.id) { if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < DRAG_SLOP_PX) return; const p = svgPoint(e); if (p) setDrag({ ...drag, at: p, moved: true }); } }}
            onPointerUp={() => { if (drag?.id === m.id) { if (drag.moved) onDrop(m.id, drag.at); setDrag(null); } }}>
            <g className="map-marker-body" style={{ transform: "scale(var(--ui))" }}>
              <circle r={10} className="map-marker-badge" style={{ stroke: m.color, color: m.color }} />
              <g style={{ color: m.color }}><MarkerGlyph icon={m.icon} size={14} /></g>
            </g>
            <title>{label}</title>
          </g>
          <OnTop><ScreenSized x={at.x * U} y={at.y * U} opacity={opacity}><text y={20} textAnchor="middle" className="map-marker-label" pointerEvents="none">{label}</text></ScreenSized></OnTop>
          </Fragment>
        );
      })}
    </g>
  );
}
