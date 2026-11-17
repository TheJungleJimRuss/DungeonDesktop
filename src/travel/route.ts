import { PACES, travelDays, type Pace } from "./travel";

/** The bits of a World Map edge that route maths needs. Edges are undirected. */
export interface RouteEdge { fromId: string; toId: string; miles: number; terrain: string; }

export interface ShortestRoute { path: string[]; miles: number; }

/** Edge joining a and b (either direction), or undefined. */
export function findEdge<E extends RouteEdge>(edges: E[], a: string, b: string): E | undefined {
  return edges.find((e) => (e.fromId === a && e.toId === b) || (e.fromId === b && e.toId === a));
}

/** Ids directly joined to `id`. */
export function neighbours(edges: RouteEdge[], id: string): string[] {
  return edges.flatMap((e) => (e.fromId === id ? [e.toId] : e.toId === id ? [e.fromId] : []));
}

/** Dijkstra by miles. Returns null when no route exists; from === to is a zero-mile route of one node. */
export function shortestRoute(edges: RouteEdge[], from: string, to: string): ShortestRoute | null {
  if (from === to) return { path: [from], miles: 0 };
  const dist = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, string>();
  const done = new Set<string>();
  for (;;) {
    let cur: string | null = null;
    for (const [id, d] of dist) if (!done.has(id) && (cur === null || d < dist.get(cur)!)) cur = id;
    if (cur === null) return null;
    if (cur === to) break;
    done.add(cur);
    for (const e of edges) {
      const other = e.fromId === cur ? e.toId : e.toId === cur ? e.fromId : null;
      if (other === null || done.has(other)) continue;
      const nd = dist.get(cur)! + e.miles;
      if (nd < (dist.get(other) ?? Infinity)) { dist.set(other, nd); prev.set(other, cur); }
    }
  }
  const path = [to];
  while (path[0] !== from) path.unshift(prev.get(path[0])!);
  return { path, miles: dist.get(to)! };
}

export interface RouteTotals { miles: number; days: Record<Pace, number>; }

/** Total miles and days per pace along consecutive nodes; each leg uses its own terrain. Unjoined pairs are skipped. */
export function routeTotals(edges: RouteEdge[], path: string[]): RouteTotals {
  const days: Record<Pace, number> = { slow: 0, normal: 0, fast: 0 };
  let miles = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const e = findEdge(edges, path[i], path[i + 1]);
    if (!e) continue;
    miles += e.miles;
    for (const p of PACES) days[p] += travelDays(e.miles, p, e.terrain);
  }
  for (const p of PACES) days[p] = Math.round(days[p] * 100) / 100;
  return { miles: Math.round(miles * 100) / 100, days };
}
