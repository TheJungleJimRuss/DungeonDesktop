import { useEffect, useState } from "react";
import { getDb, type CollectionRecord } from "./db";
import { useChangeVersion } from "../sync/changeBus";

/** A route segment between two Locations on the World Map. Undirected: one edge covers both ways. */
export interface Edge { id: string; campaignId: string; fromId: string; toId: string; miles: number; terrain: string; }
export interface EdgeDraft { fromId: string; toId: string; miles: number; terrain: string; }

export async function listEdges(campaignId: string): Promise<Edge[]> {
  return (await (await getDb()).getAllFromIndex("edges", "byCampaign", campaignId)) as unknown as Edge[];
}

/** Returns an error message, or null when the edge was created. */
export async function createEdge(campaignId: string, d: EdgeDraft): Promise<string | null> {
  if (d.fromId === d.toId) return "Pick two different locations.";
  if (!(d.miles > 0)) return "Miles must be more than 0.";
  const existing = await listEdges(campaignId);
  if (existing.some((e) => (e.fromId === d.fromId && e.toId === d.toId) || (e.fromId === d.toId && e.toId === d.fromId))) {
    return "Those locations are already joined.";
  }
  const row: Edge = { ...d, id: crypto.randomUUID(), campaignId, terrain: d.terrain.trim() };
  await (await getDb()).add("edges", row as unknown as CollectionRecord);
  return null;
}

export async function updateEdge(id: string, patch: { miles?: number; terrain?: string }): Promise<void> {
  const db = await getDb();
  const row = await db.get("edges", id);
  if (!row) return;
  const next = { ...row, ...(patch.miles !== undefined && patch.miles > 0 ? { miles: patch.miles } : {}), ...(patch.terrain !== undefined ? { terrain: patch.terrain.trim() } : {}) };
  await db.put("edges", next);
}

export async function deleteEdge(id: string): Promise<void> {
  await (await getDb()).delete("edges", id);
}

export function useEdges(campaignId: string): Edge[] {
  const version = useChangeVersion("edges");
  const [rows, setRows] = useState<Edge[]>([]);
  useEffect(() => {
    let live = true;
    void listEdges(campaignId).then((r) => live && setRows(r));
    return () => { live = false; };
  }, [campaignId, version]);
  return rows;
}
