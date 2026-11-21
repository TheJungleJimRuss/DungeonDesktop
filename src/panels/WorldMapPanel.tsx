import { useEffect, useRef, useState } from "react";
import { registerPanel, type PanelProps } from "./registry";
import {
  LOCATION_TYPES, locationSizeOf, locationTypeOf, selectLocation, setLocationPosition, setLocationStarred, useLocations, useSelectedLocationId, type Location,
} from "../storage/locations";
import { setPartyLocation, usePartyLocation } from "../storage/campaigns";
import { MILES_PER_DAY, PACES, PACE_REMINDERS, formatDays, travelDays, type Pace } from "../travel/travel";
import { createEdge, deleteEdge, updateEdge, useEdges } from "../storage/edges";
import { Loading, EmptyState } from "../ui/PanelStates";

const ZOOM_STEP = 1.5; // each click multiplies/divides the zoom; there is no upper or lower limit
const SELECTED_MIN_PX = 14; // the selected place stays big enough to drag and read at any zoom
const MIN_PX = 6; // smallest on-screen radius of a marker, so it stays clickable
const HIT_PX = 12; // minimum on-screen radius of the clickable area, so a place is never too small to grab
const HIDE_BELOW = 10; // a place whose on-screen radius (size x pixels per unit) is under this loses its name and star button
const W = 800, H = 500, STEP = 10;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
/** Unplaced locations get a tidy default spot until the DM drags them. */
const defaultPos = (i: number) => ({ x: 80 + (i % 5) * 150, y: 80 + Math.floor(i / 5) * 120 });

const viewKey = (campaignId: string) => `dungeon-desktop:world-map-view:${campaignId}`;
/** The saved zoom and centre for a Campaign's map (this device only), or the default fit view. */
function readView(campaignId: string): { zoom: number; centre: { x: number; y: number } } {
  try {
    const v = JSON.parse(localStorage.getItem(viewKey(campaignId)) ?? "null");
    if ([v?.zoom, v?.x, v?.y].every((n) => typeof n === "number" && Number.isFinite(n)) && v.zoom > 0) {
      return { zoom: v.zoom, centre: { x: v.x, y: v.y } };
    }
  } catch { /* no saved view */ }
  return { zoom: 1, centre: { x: W / 2, y: H / 2 } };
}

function WorldMapPanel({ campaign }: PanelProps) {
  const locations = useLocations(campaign.id);
  const edges = useEdges(campaign.id);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  // A dropped place stays where it was dropped until the saved position reaches the list (no flash back to the old spot).
  const [dropped, setDropped] = useState<Record<string, { x: number; y: number }>>({});
  const svg = useRef<SVGSVGElement>(null);
  const latest = useRef(new Map<string, { x: number; y: number }>()); // survives key repeats between renders
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [miles, setMiles] = useState("");
  const [terrain, setTerrain] = useState("");
  const [error, setError] = useState("");
  const selected = useSelectedLocationId(campaign.id);
  const partyAt = usePartyLocation(campaign.id);
  const [view] = useState(() => readView(campaign.id));
  const [zoom, setZoom] = useState(view.zoom);
  const [width, setWidth] = useState(W); // the canvas's real width in pixels (jsdom has none: assume 1 unit = 1 px)
  const hasMap = !!locations?.length;
  useEffect(() => {
    const el = svg.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || W));
    ro.observe(el);
    setWidth(el.clientWidth || W);
    return () => ro.disconnect();
  }, [hasMap]);
  const [centre, setCentre] = useState(view.centre); // what the canvas is centred on (drag the background to pan)
  useEffect(() => {
    try { localStorage.setItem(viewKey(campaign.id), JSON.stringify({ zoom, x: centre.x, y: centre.y })); } catch { /* not saved */ }
  }, [campaign.id, zoom, centre]);
  const panning = useRef<{ x: number; y: number } | null>(null);
  const panMoved = useRef(false); // a background press that never moved is a click: deselect
  const [pace, setPace] = useState<Pace>("normal");

  useEffect(() => {
    if (!locations) return;
    setDropped((d) => {
      const left = Object.entries(d).filter(([id, q]) => { const l = locations.find((x) => x.id === id); return l && (l.x !== q.x || l.y !== q.y); });
      return left.length === Object.keys(d).length ? d : Object.fromEntries(left);
    });
  }, [locations]);

  if (!locations) return <Loading />;
  const pos = (l: Location, i: number) =>
    drag?.id === l.id ? drag : dropped[l.id] ?? { x: l.x ?? defaultPos(i).x, y: l.y ?? defaultPos(i).y };
  // Real pixels per map unit (the canvas is scaled to fit its pane, then zoomed); u is its inverse.
  const ppu = (width / W) * zoom, u = 1 / ppu;
  const tooSmall = (l: Location) => locationSizeOf(l) * ppu < HIDE_BELOW && !l.starred && selected !== l.id;
  // Zoom scales everything on the canvas as one: the viewBox shrinks (zoom in) or widens (zoom out)
  // around `centre`. Text and strokes counter-scale (--ui) so they stay readable at any zoom.
  const vw = W / zoom, vh = H / zoom;
  const box = { x: centre.x - vw / 2, y: centre.y - vh / 2, w: vw, h: vh };
  const lo = { x: Math.min(0, box.x), y: Math.min(0, box.y) }, hi = { x: Math.max(W, box.x + vw), y: Math.max(H, box.y + vh) };
  const where = new Map(locations.map((l, i) => [l.id, pos(l, i)]));
  const nameOf = (id: string) => locations.find((l) => l.id === id)?.name ?? "?";

  const toSvg = (e: React.PointerEvent) => {
    const el = svg.current;
    const m = el?.getScreenCTM?.();
    if (!el || !m) return null;
    const pt = el.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(m.inverse());
    return { x: clamp(Math.round(p.x), lo.x, hi.x), y: clamp(Math.round(p.y), lo.y, hi.y) };
  };
  const nudge = (l: Location, i: number, e: React.KeyboardEvent) => {
    const d = { ArrowLeft: [-STEP, 0], ArrowRight: [STEP, 0], ArrowUp: [0, -STEP], ArrowDown: [0, STEP] }[e.key];
    if (!d) return;
    e.preventDefault();
    const p = latest.current.get(l.id) ?? pos(l, i);
    const next = { x: clamp(p.x + d[0], lo.x, hi.x), y: clamp(p.y + d[1], lo.y, hi.y) };
    latest.current.set(l.id, next);
    void setLocationPosition(l.id, next.x, next.y);
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    void createEdge(campaign.id, { fromId: from, toId: to, miles: Number(miles), terrain }).then((err) => {
      setError(err ?? "");
      if (!err) { setMiles(""); setTerrain(""); }
    });
  };

  return (
    <div className="world-map">
      {locations.length === 0 ? (
        <EmptyState goTo="prep">No locations yet. Add some in the Locations panel to place them here.</EmptyState>
      ) : (
        <>
        <div className="row map-zoom" role="group" aria-label="Map zoom">
          <button aria-label="Zoom out" onClick={() => setZoom(zoom / ZOOM_STEP)}>−</button>
          <span className="muted" aria-live="polite">{Math.round(zoom * 100)}%</span>
          <button aria-label="Zoom in" onClick={() => setZoom(zoom * ZOOM_STEP)}>+</button>
          <button aria-label="Fit map" disabled={zoom === 1 && centre.x === W / 2 && centre.y === H / 2} onClick={() => { setZoom(1); setCentre({ x: W / 2, y: H / 2 }); }}>Fit</button>
        </div>
        <div className="map-scroll">
        <svg ref={svg} viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} className="map-canvas" role="group" aria-label="World map"
          style={{ "--ui": u } as React.CSSProperties}>
          <rect x={box.x} y={box.y} width={box.w} height={box.h} className="map-bg"
            onPointerDown={(e) => { panMoved.current = false; panning.current = { x: e.clientX, y: e.clientY }; (e.currentTarget as Element).setPointerCapture?.(e.pointerId); }}
            onPointerMove={(e) => {
              const last = panning.current, el = svg.current;
              if (!last || !el || !el.clientWidth) return;
              if (Math.abs(e.clientX - last.x) + Math.abs(e.clientY - last.y) > 0) panMoved.current = true;
              const k = box.w / el.clientWidth;
              setCentre((c) => ({ x: c.x - (e.clientX - last.x) * k, y: c.y - (e.clientY - last.y) * k }));
              panning.current = { x: e.clientX, y: e.clientY };
            }}
            onPointerUp={() => { panning.current = null; if (!panMoved.current) selectLocation(campaign.id, null); }} />
          {edges.map((e) => {
            const a = where.get(e.fromId), b = where.get(e.toId);
            if (!a || !b) return null;
            // Turn the label to run along the line (never upside down) and lift it clear of the line.
            let angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
            if (angle > 90 || angle < -90) angle += 180;
            const label = `${e.miles} mi${e.terrain ? ` · ${e.terrain}` : ""}`;
            // Hide the label when the line is too short on screen to carry it (about 6.5 px per character).
            const fits = Math.hypot(b.x - a.x, b.y - a.y) * ppu >= label.length * 6.5 + 40;
            return (
              <g key={e.id}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="map-edge" />
                {fits && <text transform={`translate(${(a.x + b.x) / 2} ${(a.y + b.y) / 2}) rotate(${angle})`} y={-7 * u}
                  textAnchor="middle" className="map-edge-label">
                  {label}
                </text>}
              </g>
            );
          })}
          {locations.map((l, i) => {
            const p = pos(l, i);
            const type = locationTypeOf(l);
            const point = tooSmall(l); // far out: no name until starred or clicked
            const r = Math.max(locationSizeOf(l), (selected === l.id ? SELECTED_MIN_PX : MIN_PX) * u); // never smaller than the minimum on screen; the selected place gets a bigger one
            return (
              <g key={l.id} className="map-node" data-type={type.id} tabIndex={0} role="button" aria-label={`Location ${l.name}`}
                transform={`translate(${p.x} ${p.y})`}
                data-x={p.x} data-y={p.y}
                onKeyDown={(e) => nudge(l, i, e)}
                onFocus={() => selectLocation(campaign.id, l.id)}
                onClick={() => selectLocation(campaign.id, l.id)}
                onPointerDown={(e) => { latest.current.delete(l.id); (e.currentTarget as Element).setPointerCapture?.(e.pointerId); setDrag({ id: l.id, ...p }); }}
                onPointerMove={(e) => { if (drag?.id === l.id) { const q = toSvg(e); if (q) setDrag({ id: l.id, ...q }); } }}
                onPointerUp={() => { if (drag?.id === l.id) { setDropped((d) => ({ ...d, [l.id]: { x: drag.x, y: drag.y } })); void setLocationPosition(l.id, drag.x, drag.y); setDrag(null); } }}>
                <title>{`${l.name} (${type.label})`}</title>
                <circle r={HIT_PX * u} className="map-hit" />
                <circle r={r} style={{ fill: type.color, fillOpacity: 0.35, stroke: type.color }} />
                {partyAt === l.id && <text y={-r - 6 * u} textAnchor="middle" className="map-party" aria-label="Party is here">★ Party</text>}
                {!point && <text y={r + 18 * u} textAnchor="middle" className="map-label">{l.name}</text>}
              </g>
            );
          })}
          {locations.map((l, i) => {
            const p = pos(l, i);
            if (tooSmall(l)) return null; // too small: click the place first
            const toggle = () => void setLocationStarred(l.id, !l.starred);
            return (
              <g key={l.id} className={`map-star${l.starred ? " on" : ""}`} transform={`translate(${p.x + Math.max(locationSizeOf(l), (selected === l.id ? SELECTED_MIN_PX : MIN_PX) * u) + u} ${p.y - Math.max(locationSizeOf(l), (selected === l.id ? SELECTED_MIN_PX : MIN_PX) * u) - u})`}
                tabIndex={0} role="button" aria-pressed={!!l.starred} aria-label={`${l.starred ? "Unstar" : "Star"} ${l.name}`}
                onClick={toggle}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}>
                <circle r={HIT_PX * u} className="map-star-hit" />
                <text textAnchor="middle" y={5 * u}>{l.starred ? "★" : "☆"}</text>
              </g>
            );
          })}
        </svg>
        </div>
        </>
      )}
      {locations.length > 0 && (
        <ul className="map-legend" aria-label="Location types">
          {LOCATION_TYPES.map((t) => (
            <li key={t.id}><span className="swatch" style={{ background: t.color }} aria-hidden="true" />{t.label}</li>
          ))}
          <li><span className="star-key" aria-hidden="true">★</span>Starred</li>
        </ul>
      )}
      {locations.length >= 2 && (
        <form className="row" onSubmit={add} aria-label="Add edge">
          <select aria-label="Edge from" value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="">From…</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select aria-label="Edge to" value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">To…</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <input aria-label="Edge miles" type="number" min="0" step="any" placeholder="Miles" value={miles} onChange={(e) => setMiles(e.target.value)} />
          <input aria-label="Edge terrain" placeholder="Terrain" value={terrain} onChange={(e) => setTerrain(e.target.value)} />
          <button type="submit" className="primary">Add edge</button>
        </form>
      )}
      {error && <p role="alert" className="import-error">{error}</p>}
      {locations.length > 0 && (
        <div className="row">
          <label>Party location{" "}
            <select aria-label="Party location" value={locations.some((l) => l.id === partyAt) ? partyAt! : ""}
              onChange={(e) => void setPartyLocation(campaign.id, e.target.value || null)}>
              <option value="">Not set</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
          <label>Pace{" "}
            <select aria-label="Travel pace" value={pace} onChange={(e) => setPace(e.target.value as Pace)}>
              {PACES.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)} ({MILES_PER_DAY[p]} mi/day)</option>)}
            </select>
          </label>
        </div>
      )}
      {locations.length > 0 && <p className="muted" aria-label="Pace reminder">{PACE_REMINDERS[pace]}</p>}
      {partyAt && edges.some((e) => e.fromId === partyAt || e.toId === partyAt) && (
        <ul className="npc-items" aria-label="Travel from party location">
          {edges.filter((e) => e.fromId === partyAt || e.toId === partyAt).map((e) => {
            const dest = nameOf(e.fromId === partyAt ? e.toId : e.fromId);
            return (
              <li key={e.id} aria-label={`Travel to ${dest}`}>
                To {dest}: {e.miles} mi{e.terrain ? ` (${e.terrain})` : ""} — {PACES.map((p) => `${p} ${formatDays(travelDays(e.miles, p, e.terrain))}`).join(", ")}
              </li>
            );
          })}
        </ul>
      )}
      {edges.length > 0 && (
        <ul className="npc-items" aria-label="Edges">
          {edges.map((e) => (
            <li key={e.id} aria-label={`${nameOf(e.fromId)} to ${nameOf(e.toId)}`} className="row">
              <span className="grow">{nameOf(e.fromId)} ↔ {nameOf(e.toId)}</span>
              <input aria-label={`Miles ${nameOf(e.fromId)} to ${nameOf(e.toId)}`} type="number" min="0" step="any" defaultValue={e.miles}
                onBlur={(ev) => void updateEdge(e.id, { miles: Number(ev.target.value) })} />
              <input aria-label={`Terrain ${nameOf(e.fromId)} to ${nameOf(e.toId)}`} defaultValue={e.terrain}
                onBlur={(ev) => void updateEdge(e.id, { terrain: ev.target.value })} />
              <button aria-label={`Delete edge ${nameOf(e.fromId)} to ${nameOf(e.toId)}`} onClick={() => void deleteEdge(e.id)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default registerPanel({ id: "world-map", title: "World Map", component: WorldMapPanel });
