import { useEffect, useState } from "react";
import { useChangeVersion } from "../sync/changeBus";
import { getDb, type CollectionRecord } from "./db";

/** Notes share one store; `kind` says which feature owns a record. */
export const PINNED = "pinned";

export type PinnedNote = CollectionRecord & {
  kind: typeof PINNED;
  text: string;
  /** Position within the Campaign's pinned notes (ascending). */
  order: number;
};

const isPinned = (r: CollectionRecord): r is PinnedNote => r.kind === PINNED;

export async function listPinnedNotes(campaignId: string): Promise<PinnedNote[]> {
  const rows = await (await getDb()).getAllFromIndex("notes", "byCampaign", campaignId);
  return rows.filter(isPinned).sort((a, b) => a.order - b.order);
}

export async function addPinnedNote(campaignId: string, text: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("notes", "readwrite");
  const rows = (await tx.store.index("byCampaign").getAll(campaignId)).filter(isPinned);
  const order = rows.reduce((m, r) => Math.max(m, r.order), -1) + 1;
  const note: PinnedNote = { id: crypto.randomUUID(), campaignId, kind: PINNED, text: text.trim(), order };
  await tx.store.add(note);
  await tx.done;
}

export async function updatePinnedNote(id: string, text: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("notes", "readwrite");
  const row = await tx.store.get(id);
  if (row && isPinned(row)) await tx.store.put({ ...row, text: text.trim() });
  await tx.done;
}

export async function removePinnedNote(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("notes", "readwrite");
  const row = await tx.store.get(id);
  if (row && isPinned(row)) await tx.store.delete(id);
  await tx.done;
}

/** Moves a note one step (-1 up, +1 down) and renumbers the list. */
export async function movePinnedNote(campaignId: string, id: string, delta: -1 | 1): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("notes", "readwrite");
  const rows = (await tx.store.index("byCampaign").getAll(campaignId)).filter(isPinned).sort((a, b) => a.order - b.order);
  const i = rows.findIndex((r) => r.id === id);
  const j = i + delta;
  if (i >= 0 && j >= 0 && j < rows.length) {
    [rows[i], rows[j]] = [rows[j], rows[i]];
    for (const [order, r] of rows.entries()) await tx.store.put({ ...r, order });
  }
  await tx.done;
}

/* ---- Scratch notes: quick notes during a conversation, optionally attached to an NPC and/or a scene. ---- */
export const SCRATCH = "scratch";

export type ScratchNote = CollectionRecord & {
  kind: typeof SCRATCH;
  text: string;
  /** Creation order (ms timestamp, made strictly increasing); newest first in the UI. */
  createdAt: number;
  npcId?: string;
  /** Scene attachment; sceneId lives inside the Session sessionId. */
  sessionId?: string;
  sceneId?: string;
};

export interface ScratchAttachment { npcId?: string; sessionId?: string; sceneId?: string }

const isScratch = (r: CollectionRecord): r is ScratchNote => r.kind === SCRATCH;

export async function listScratchNotes(campaignId: string): Promise<ScratchNote[]> {
  const rows = await (await getDb()).getAllFromIndex("notes", "byCampaign", campaignId);
  return rows.filter(isScratch).sort((a, b) => b.createdAt - a.createdAt);
}

export async function addScratchNote(campaignId: string, text: string, attach: ScratchAttachment = {}): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("notes", "readwrite");
  const rows = (await tx.store.index("byCampaign").getAll(campaignId)).filter(isScratch);
  const createdAt = rows.reduce((m, r) => Math.max(m, r.createdAt + 1), Date.now());
  const note: ScratchNote = { id: crypto.randomUUID(), campaignId, kind: SCRATCH, text: text.trim(), createdAt, ...attach };
  await tx.store.add(note);
  await tx.done;
}

/** Replaces the text and the attachment (an omitted attachment field clears it). */
export async function updateScratchNote(id: string, text: string, attach: ScratchAttachment): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("notes", "readwrite");
  const row = await tx.store.get(id);
  if (row && isScratch(row)) {
    const { npcId: _n, sessionId: _s, sceneId: _c, ...rest } = row;
    await tx.store.put({ ...rest, text: text.trim(), ...attach });
  }
  await tx.done;
}

export async function removeScratchNote(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("notes", "readwrite");
  const row = await tx.store.get(id);
  if (row && isScratch(row)) await tx.store.delete(id);
  await tx.done;
}

/** Live list of a Campaign's scratch notes, newest first. `undefined` while loading. */
export function useScratchNotes(campaignId: string): ScratchNote[] | undefined {
  const [rows, setRows] = useState<ScratchNote[]>();
  const version = useChangeVersion("notes");
  useEffect(() => {
    let live = true;
    void listScratchNotes(campaignId).then((r) => live && setRows(r));
    return () => { live = false; };
  }, [campaignId, version]);
  return rows;
}
