import { useState } from "react";
import { registerPanel, type PanelProps } from "./registry";
import { useLocations } from "../storage/locations";
import { useEdges } from "../storage/edges";
import { setPartyLocation } from "../storage/campaigns";
import { PACES, formatDays } from "../travel/travel";
import { neighbours, routeTotals, shortestRoute } from "../travel/route";

function RoutePanel({ campaign }: PanelProps) {
  const locations = useLocations(campaign.id);
  const edges = useEdges(campaign.id);
  const [path, setPath] = useState<string[]>([]);
  const [next, setNext] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");

  if (!locations) return <p className="muted">Loading...</p>;
  const name = (id: string) => locations.find((l) => l.id === id)?.name ?? "?";
  // drop nodes that no longer exist (deleted locations)
  const live = path.every((id) => locations.some((l) => l.id === id)) ? path : [];
  const last = live[live.length - 1];
  const nameOf = (id: string) => locations.find((l) => l.id === id)?.name ?? "";
  const options = (last ? neighbours(edges, last).filter((id) => locations.some((l) => l.id === id)) : locations.map((l) => l.id))
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  const totals = live.length > 1 ? routeTotals(edges, live) : null;

  const add = () => { if (next) { setPath([...live, next]); setNext(""); setNote(""); } };
  const suggest = () => {
    const r = from && to ? shortestRoute(edges, from, to) : null;
    if (!r) { setNote(from && to ? "No route joins those places." : "Pick both places."); return; }
    setPath(r.path); setNote("");
  };

  return (
    <div className="route-panel">
      <div className="row">
        <select aria-label="Suggest from" value={from} onChange={(e) => setFrom(e.target.value)}>
          <option value="">From…</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select aria-label="Suggest to" value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">To…</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <button onClick={suggest}>Suggest shortest route</button>
      </div>
      {note && <p role="alert" className="import-error">{note}</p>}
      <div className="row">
        <select aria-label={last ? "Next node" : "Start node"} value={next} onChange={(e) => setNext(e.target.value)}>
          <option value="">{last ? "Next stop…" : "Start at…"}</option>
          {options.map((id) => <option key={id} value={id}>{name(id)}</option>)}
        </select>
        <button onClick={add} disabled={!next}>{last ? "Add stop" : "Start route"}</button>
        <button onClick={() => setPath(live.slice(0, -1))} disabled={live.length === 0}>Remove last</button>
        <button onClick={() => { setPath([]); setNote(""); }} disabled={live.length === 0}>Clear route</button>
      </div>
      {live.length > 0 && <p aria-label="Route">{live.map(name).join(" → ")}</p>}
      {totals && (
        <p aria-label="Route totals">
          Total {totals.miles} mi — {PACES.map((p) => `${p} ${formatDays(totals.days[p])}`).join(", ")}
        </p>
      )}
      {live.length > 0 && (
        <button className="primary" onClick={() => void setPartyLocation(campaign.id, last)}>Move Party along route</button>
      )}
    </div>
  );
}

export default registerPanel({ id: "route", title: "Route", component: RoutePanel });
