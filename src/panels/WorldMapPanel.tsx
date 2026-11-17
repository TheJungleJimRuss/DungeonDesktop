import { useRef, useState } from "react";
import { registerPanel, type PanelProps } from "./registry";
import { selectLocation, setLocationPosition, useLocations, type Location } from "../storage/locations";
import { setPartyLocation, usePartyLocation } from "../storage/campaigns";
import { MILES_PER_DAY, PACES, PACE_REMINDERS, formatDays, travelDays, type Pace } from "../travel/travel";
import { createEdge, deleteEdge, updateEdge, useEdges } from "../storage/edges";
import { Loading, EmptyState } from "../ui/PanelStates";

const W = 800, H = 500, STEP = 10;
const clamp = (v: number, max: number) => Math.min(max, Math.max(0, v));
/** Unplaced locations get a tidy default spot until the DM drags them. */
const defaultPos = (i: number) => ({ x: 80 + (i % 5) * 150, y: 80 + Math.floor(i / 5) * 120 });

function WorldMapPanel({ campaign }: PanelProps) {
  const locations = useLocations(campaign.id);
  const edges = useEdges(campaign.id);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const latest = useRef(new Map<string, { x: number; y: number }>()); // survives key repeats between renders
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [miles, setMiles] = useState("");
  const [terrain, setTerrain] = useState("");
  const [error, setError] = useState("");
  const partyAt = usePartyLocation(campaign.id);
  const [pace, setPace] = useState<Pace>("normal");

  if (!locations) return <Loading />;
  const pos = (l: Location, i: number) =>
    drag?.id === l.id ? drag : { x: l.x ?? defaultPos(i).x, y: l.y ?? defaultPos(i).y };
  const where = new Map(locations.map((l, i) => [l.id, pos(l, i)]));
  const nameOf = (id: string) => locations.find((l) => l.id === id)?.name ?? "?";

  const toSvg = (e: React.PointerEvent) => {
    const el = svg.current;
    const m = el?.getScreenCTM?.();
    if (!el || !m) return null;
    const pt = el.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(m.inverse());
    return { x: clamp(Math.round(p.x), W), y: clamp(Math.round(p.y), H) };
  };
  const nudge = (l: Location, i: number, e: React.KeyboardEvent) => {
    const d = { ArrowLeft: [-STEP, 0], ArrowRight: [STEP, 0], ArrowUp: [0, -STEP], ArrowDown: [0, STEP] }[e.key];
    if (!d) return;
    e.preventDefault();
    const p = latest.current.get(l.id) ?? pos(l, i);
    const next = { x: clamp(p.x + d[0], W), y: clamp(p.y + d[1], H) };
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
        <EmptyState goTo="prep">No locations yet. Add some in the Locations panel (Prep) to place them here.</EmptyState>
      ) : (
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="map-canvas" role="group" aria-label="World map">
          {edges.map((e) => {
            const a = where.get(e.fromId), b = where.get(e.toId);
            if (!a || !b) return null;
            return (
              <g key={e.id}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="map-edge" />
                <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4} textAnchor="middle" className="map-edge-label">
                  {e.miles} mi{e.terrain ? ` · ${e.terrain}` : ""}
                </text>
              </g>
            );
          })}
          {locations.map((l, i) => {
            const p = pos(l, i);
            return (
              <g key={l.id} className="map-node" tabIndex={0} role="button" aria-label={`Location ${l.name}`}
                transform={`translate(${p.x} ${p.y})`}
                data-x={p.x} data-y={p.y}
                onKeyDown={(e) => nudge(l, i, e)}
                onFocus={() => selectLocation(campaign.id, l.id)}
                onClick={() => selectLocation(campaign.id, l.id)}
                onPointerDown={(e) => { latest.current.delete(l.id); (e.currentTarget as Element).setPointerCapture?.(e.pointerId); setDrag({ id: l.id, ...p }); }}
                onPointerMove={(e) => { if (drag?.id === l.id) { const q = toSvg(e); if (q) setDrag({ id: l.id, ...q }); } }}
                onPointerUp={() => { if (drag?.id === l.id) { void setLocationPosition(l.id, drag.x, drag.y); setDrag(null); } }}>
                <circle r={14} />
                {partyAt === l.id && <text y={-20} textAnchor="middle" className="map-party" aria-label="Party is here">★ Party</text>}
                <text y={30} textAnchor="middle">{l.name}</text>
              </g>
            );
          })}
        </svg>
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
