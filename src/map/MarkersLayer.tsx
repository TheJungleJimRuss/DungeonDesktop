import { useState } from "react";
import type { MapMarker } from "../storage/maps";
import { CELL } from "./lines";
import { MarkerGlyph } from "./icons";
import type { Pt } from "./geometry";

/** The Markers: an icon in a badge with the name below, drawn in on-screen pixels (--ui counter-scales with zoom). In the Select tool a Marker
 *  selects on press and drags freely (no snapping); the drag is shown live and saved on release. In other tools the Markers let clicks through. */
export function MarkersLayer({ markers, labelOf, selectedId, selectable, svgPoint, onSelect, onDrop }: {
  markers: MapMarker[]; labelOf: (m: MapMarker) => string; selectedId?: string; selectable: boolean;
  svgPoint: (e: { clientX: number; clientY: number }) => Pt | null; onSelect: (id: string) => void; onDrop: (id: string, at: Pt) => void;
}) {
  const [drag, setDrag] = useState<{ id: string; at: Pt; moved: boolean } | null>(null);
  return (
    <g className="map-markers">
      {markers.map((m) => {
        const at = drag?.id === m.id ? drag.at : m, label = labelOf(m), on = m.id === selectedId;
        return (
          <g key={m.id} className={"map-marker" + (on ? " selected" : "")} role="button" aria-label={`Marker ${label}`} aria-pressed={on} data-marker={m.id}
            tabIndex={selectable ? 0 : -1} pointerEvents={selectable ? undefined : "none"} transform={`translate(${at.x * CELL} ${at.y * CELL})`}
            onClick={() => onSelect(m.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(m.id); } }}
            onPointerDown={(e) => { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); onSelect(m.id); setDrag({ id: m.id, at: { x: m.x, y: m.y }, moved: false }); }}
            onPointerMove={(e) => { if (drag?.id === m.id) { const p = svgPoint(e); if (p) setDrag({ id: m.id, at: p, moved: true }); } }}
            onPointerUp={() => { if (drag?.id === m.id) { if (drag.moved) onDrop(m.id, drag.at); setDrag(null); } }}>
            <g className="map-marker-body" style={{ transform: "scale(var(--ui))" }}>
              <circle r={15} className="map-marker-badge" style={{ stroke: m.color, color: m.color }} />
              <g style={{ color: m.color }}><MarkerGlyph icon={m.icon} size={20} /></g>
              <text y={29} textAnchor="middle" className="map-marker-label" pointerEvents="none">{label}</text>
            </g>
            <title>{label}</title>
          </g>
        );
      })}
    </g>
  );
}
