import { useEffect, useState, useSyncExternalStore } from "react";
import { getDb, type CollectionRecord } from "./db";
import { notifyChange, useChangeVersion } from "../sync/changeBus";

/** A secret or clue that can be ticked off during play. */
export interface SceneItem {
  id: string;
  text: string;
  done: boolean;
}

/** One scene of a Session. Stored inside the Session record (`scenes` array, in play order),
 *  so export/import carries it with no extra collection. Links are ids; a link whose target
 *  was deleted is shown as "deleted" by the UI and otherwise ignored. */
export interface Scene {
  id: string;
  title: string;
  goal: string;
  notes: string;
  secrets: SceneItem[];
  clues: SceneItem[];
  played: boolean;
  locationId?: string;
  npcIds: string[];
}
export type SceneDraft = Omit<Scene, "id" | "played"> & { played?: boolean };

/** A Session, stored in the `sessions` collection. At most one per Campaign is `current`. */
export interface Session extends CollectionRecord {
  title: string;
  summary: string;
  log: string;
  current: boolean;
  scenes: Scene[];
  createdAt: number;
  updatedAt: number;
}

export const emptySceneDraft = (): SceneDraft => ({
  title: "", goal: "", notes: "", secrets: [], clues: [], npcIds: [],
});

const newId = () => crypto.randomUUID();

/** Every session write ends here, so the change notification lives in one place. The db
 *  wrapper (storage/db.ts) already announces "sessions" on the change bus for every
 *  put/add/delete; this adds in-process selection updates. */
const selectionListeners = new Set<() => void>();
function notifySessions(): void {
  notifyChange("sessions");
}

export async function listSessions(campaignId: string): Promise<Session[]> {
  const rows = (await (await getDb()).getAllFromIndex("sessions", "byCampaign", campaignId)) as Session[];
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function createSession(campaignId: string, draft: { title: string; summary?: string }): Promise<Session> {
  const db = await getDb();
  const tx = db.transaction("sessions", "readwrite");
  const existing = (await tx.store.index("byCampaign").getAll(campaignId)) as Session[];
  const now = Date.now();
  const session: Session = {
    id: newId(), campaignId, title: draft.title, summary: draft.summary ?? "", log: "",
    current: !existing.some((s) => s.current), scenes: [],
    createdAt: Math.max(now, ...existing.map((s) => s.createdAt + 1)), updatedAt: now,
  };
  await tx.store.add(session);
  await tx.done;
  notifySessions();
  return session;
}

async function mutate(id: string, fn: (s: Session) => Session | void): Promise<void> {
  const tx = (await getDb()).transaction("sessions", "readwrite");
  const existing = (await tx.store.get(id)) as Session | undefined;
  if (existing) {
    const draft = structuredClone(existing);
    const next = fn(draft) ?? draft;
    await tx.store.put({ ...next, updatedAt: Date.now() });
  }
  await tx.done;
  notifySessions();
}

export const updateSession = (id: string, patch: Partial<Pick<Session, "title" | "summary" | "log">>) =>
  mutate(id, (s) => ({ ...s, ...patch }));

export async function deleteSession(id: string): Promise<void> {
  await (await getDb()).delete("sessions", id);
  notifySessions();
}

/** Marks one Session current and clears the flag on the Campaign's others. */
export async function setCurrentSession(campaignId: string, id: string): Promise<void> {
  const tx = (await getDb()).transaction("sessions", "readwrite");
  for (const s of (await tx.store.index("byCampaign").getAll(campaignId)) as Session[]) {
    if (s.current !== (s.id === id)) await tx.store.put({ ...s, current: s.id === id, updatedAt: Date.now() });
  }
  await tx.done;
  notifySessions();
}

/* ---- Scenes ---- */
export const addScene = (sessionId: string, draft: SceneDraft) =>
  mutate(sessionId, (s) => { s.scenes.push({ ...draft, played: draft.played ?? false, id: newId() }); });

export const updateScene = (sessionId: string, sceneId: string, patch: Partial<Omit<Scene, "id">>) =>
  mutate(sessionId, (s) => {
    s.scenes = s.scenes.map((sc) => {
      if (sc.id !== sceneId) return sc;
      const next = { ...sc, ...patch };
      if (next.locationId === undefined) delete next.locationId;
      return next;
    });
  });

export const deleteScene = (sessionId: string, sceneId: string) =>
  mutate(sessionId, (s) => { s.scenes = s.scenes.filter((sc) => sc.id !== sceneId); });

export const setScenePlayed = (sessionId: string, sceneId: string, played: boolean) =>
  updateScene(sessionId, sceneId, { played });

export const tickItem = (sessionId: string, sceneId: string, kind: "secrets" | "clues", itemId: string, done: boolean) =>
  mutate(sessionId, (s) => {
    const sc = s.scenes.find((x) => x.id === sceneId);
    const it = sc?.[kind].find((x) => x.id === itemId);
    if (it) it.done = done;
  });

/** Pure: move the element at `from` to index `to`. */
export function reorder<T>(xs: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= xs.length || to >= xs.length) return xs;
  const next = [...xs];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

export const moveScene = (sessionId: string, from: number, to: number) =>
  mutate(sessionId, (s) => { s.scenes = reorder(s.scenes, from, to); });

export const newItem = (text: string): SceneItem => ({ id: newId(), text, done: false });

/** Pure carry-over plan. Every unplayed scene moves as it is (ticked items stay ticked).
 *  The unticked secrets and clues left in PLAYED scenes are gathered, unticked, into one
 *  extra scene "Carried over from <title>" appended after the moved scenes (only if any).
 *  The source keeps its played scenes, minus those gathered items. */
export function planCarryOver(source: Session): { keep: Scene[]; carried: Scene[] } {
  const keep: Scene[] = [];
  const carried: Scene[] = [];
  const secrets: SceneItem[] = [];
  const clues: SceneItem[] = [];
  for (const sc of source.scenes) {
    if (!sc.played) { carried.push(sc); continue; }
    secrets.push(...sc.secrets.filter((i) => !i.done));
    clues.push(...sc.clues.filter((i) => !i.done));
    keep.push({ ...sc, secrets: sc.secrets.filter((i) => i.done), clues: sc.clues.filter((i) => i.done) });
  }
  if (secrets.length || clues.length) {
    carried.push({ id: newId(), title: `Carried over from ${source.title}`, goal: "", notes: "", secrets, clues, played: false, npcIds: [] });
  }
  return { keep, carried };
}

/** Creates the next Session (made current) holding what the source did not use; returns it. */
export async function carryOverToNextSession(campaignId: string, sourceId: string): Promise<Session | null> {
  const tx = (await getDb()).transaction("sessions", "readwrite");
  const all = (await tx.store.index("byCampaign").getAll(campaignId)) as Session[];
  const source = all.find((s) => s.id === sourceId);
  if (!source) { await tx.done; return null; }
  const { keep, carried } = planCarryOver(source);
  const now = Date.now();
  for (const s of all) {
    if (s.id === sourceId) await tx.store.put({ ...s, scenes: keep, current: false, updatedAt: now });
    else if (s.current) await tx.store.put({ ...s, current: false, updatedAt: now });
  }
  const next: Session = {
    id: newId(), campaignId, title: `Next after ${source.title}`, summary: "", log: "", current: true,
    scenes: carried, createdAt: Math.max(now, ...all.map((s) => s.createdAt + 1)), updatedAt: now,
  };
  await tx.store.add(next);
  await tx.done;
  notifySessions();
  return next;
}

/** What is left in a Session: unplayed scenes and unticked secrets/clues (across all scenes). */
export function sessionRemaining(s: Session) {
  const items = s.scenes.flatMap((sc) => [...sc.secrets, ...sc.clues]);
  return { unplayedScenes: s.scenes.filter((sc) => !sc.played).length, unticked: items.filter((i) => !i.done).length };
}

/** Live list of a Campaign's Sessions, oldest first. `undefined` while loading. */
export function useSessions(campaignId: string): Session[] | undefined {
  const [rows, setRows] = useState<Session[]>();
  const version = useChangeVersion("sessions");
  useEffect(() => {
    let live = true;
    void listSessions(campaignId).then((r) => live && setRows(r));
    return () => { live = false; };
  }, [campaignId, version]);
  return rows;
}

/* ---- Selection: which Session the editor and scene panels show (per Campaign). ---- */
const selKey = (campaignId: string) => `dungeon-desktop:session-selection:${campaignId}`;
const readSel = (campaignId: string): string | null => {
  try { return localStorage.getItem(selKey(campaignId)); } catch { return null; }
};
const memory = new Map<string, string | null>();

export function selectSession(campaignId: string, id: string | null): void {
  memory.set(campaignId, id);
  try {
    if (id) localStorage.setItem(selKey(campaignId), id); else localStorage.removeItem(selKey(campaignId));
  } catch { /* in-memory only */ }
  selectionListeners.forEach((l) => l());
  notifyChange(`session-selection:${campaignId}`);
}

export function useSelectedSessionId(campaignId: string): string | null {
  const subscribe = (cb: () => void) => {
    const onStorage = (e: StorageEvent) => { if (e.key === selKey(campaignId)) cb(); };
    selectionListeners.add(cb);
    window.addEventListener("storage", onStorage);
    return () => { selectionListeners.delete(cb); window.removeEventListener("storage", onStorage); };
  };
  return useSyncExternalStore(subscribe, () => readSel(campaignId) ?? memory.get(campaignId) ?? null);
}

/** The Session the panels show: the selected one, else the current one, else the first. */
export function resolveSession(sessions: Session[], selected: string | null): Session | undefined {
  return sessions.find((s) => s.id === selected) ?? sessions.find((s) => s.current) ?? sessions[0];
}
