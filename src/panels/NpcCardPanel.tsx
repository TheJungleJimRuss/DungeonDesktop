import { useEffect, useState, type ReactNode } from "react";
import { usePopout } from "../popout/PopoutContext";
import { setPoppedPanels, getPoppedPanels } from "../popout/popoutState";
import { PINNED_NPC_PANEL, pinNpc, unpinNpc, usePinnedNpcIds } from "../popout/pinnedNpc";
import StatBlock from "../srd/StatBlock";
import StatBlockPicker from "../srd/StatBlockPicker";
import { resolveNpcStatBlock, type NpcStatBlock } from "../srd/npcStatBlock";
import { useCustomEntries } from "../storage/customEntries";
import { useLocations } from "../storage/locations";
import { useScratchNotes } from "../storage/notes";
import { registerPanel, type PanelProps } from "./registry";
import {
  NEW_NPC, createNpc, deleteNpc, emptyNpcDraft, selectNpc, updateNpc, useNpcs, useSelectedNpcId,
  type Npc, type NpcDraft,
} from "../storage/npcs";

const FIELDS = [
  ["name", "Name"], ["role", "Role"], ["appearance", "Appearance"], ["motivation", "Motivation"],
  ["notes", "Notes"], ["factionTag", "Faction"],
] as const;
const LEGACY = "__legacy__";
const LONG = new Set(["appearance", "motivation", "notes"]);

function NpcForm({ campaignId, initial, onSave, onCancel }: { campaignId: string; initial: NpcDraft; onSave: (d: NpcDraft) => void; onCancel: () => void }) {
  const [d, setD] = useState<NpcDraft>(initial);
  const [secret, setSecret] = useState("");
  const locations = useLocations(campaignId) ?? [];
  const linked = d.locationId && locations.some((l) => l.id === d.locationId);
  const legacy = !linked && d.locationTag.trim() ? d.locationTag : null;
  const chooseLocation = (v: string) => {
    if (v === LEGACY) return;
    const loc = locations.find((l) => l.id === v);
    setD((x) => ({ ...x, locationId: loc?.id, locationTag: loc ? loc.name : "" }));
  };
  const addSecret = () => {
    const text = secret.trim();
    if (!text) return;
    setD((x) => ({ ...x, secrets: [...x.secrets, { id: crypto.randomUUID(), text, revealed: false }] }));
    setSecret("");
  };
  return (
    <form className="npc-form" onSubmit={(e) => { e.preventDefault(); onSave(d); }}>
      {FIELDS.map(([key, label]) => (
        <label key={key}>
          <span className="muted">{label}</span>
          {LONG.has(key) ? (
            <textarea rows={2} value={d[key]} onChange={(e) => setD({ ...d, [key]: e.target.value })} />
          ) : (
            <input value={d[key]} onChange={(e) => setD({ ...d, [key]: e.target.value })} />
          )}
        </label>
      ))}
      <label>
        <span className="muted">Location</span>
        <select value={linked ? d.locationId : legacy !== null ? LEGACY : ""} onChange={(e) => chooseLocation(e.target.value)}>
          <option value="">No location</option>
          {legacy !== null && <option value={LEGACY}>{legacy} (free text)</option>}
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </label>
      <fieldset>
        <legend className="muted">Secrets</legend>
        <ul className="npc-secrets">
          {d.secrets.map((s) => (
            <li key={s.id} className="row">
              <span className="grow">{s.text}</span>
              <button type="button" aria-label={`Remove secret ${s.text}`}
                onClick={() => setD({ ...d, secrets: d.secrets.filter((x) => x.id !== s.id) })}>Remove</button>
            </li>
          ))}
        </ul>
        <div className="row">
          <input className="grow" aria-label="New secret" value={secret} onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSecret(); } }} />
          <button type="button" onClick={addSecret}>Add secret</button>
        </div>
      </fieldset>
      <div className="row end">
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="submit" className="primary">Save</button>
      </div>
    </form>
  );
}

function NpcStatBlockLink({ campaignId, npc }: { campaignId: string; npc: Npc }) {
  const customs = useCustomEntries(campaignId);
  const [picking, setPicking] = useState(false);
  const [shown, setShown] = useState(false);
  const [resolved, setRes] = useState<NpcStatBlock>({ status: "none" });
  const res: NpcStatBlock = npc.statBlockId ? resolved : { status: "none" };
  useEffect(() => {
    let live = true;
    if (customs) void resolveNpcStatBlock(npc, customs).then((r) => live && setRes(r));
    return () => { live = false; };
  }, [npc, customs]);
  return (
    <section aria-label="Linked Stat Block">
      <h4>Stat Block</h4>
      {npc.statBlockId && res.status === "missing" && (
        <p className="muted">Stat Block missing: the linked entry no longer exists.</p>
      )}
      {res.status === "ok" && (
        <>
          <p>{res.sourceName} <span className="muted">AC {res.monster.ac}, HP {res.monster.hp}</span></p>
          <button onClick={() => setShown(!shown)}>{shown ? "Hide Stat Block" : "Show Stat Block"}</button>
          {shown && <StatBlock monster={res.monster} />}
        </>
      )}
      <div className="row">
        <button onClick={() => setPicking(true)}>{npc.statBlockId ? "Change Stat Block" : "Link Stat Block"}</button>
        {npc.statBlockId && <button onClick={() => void updateNpc(npc.id, { statBlockId: undefined })}>Unlink Stat Block</button>}
      </div>
      {picking && (
        <StatBlockPicker campaignId={campaignId} onClose={() => setPicking(false)}
          onPick={(id) => { setPicking(false); void updateNpc(npc.id, { statBlockId: id }); }} />
      )}
    </section>
  );
}

function AttachedScratchNotes({ campaignId, npcId }: { campaignId: string; npcId: string }) {
  const notes = (useScratchNotes(campaignId) ?? []).filter((n) => n.npcId === npcId);
  if (notes.length === 0) return null;
  return (
    <section aria-label="Scratch notes for this NPC">
      <h4>Scratch notes</h4>
      <ul className="note-list">{notes.map((n) => <li key={n.id}>{n.text}</li>)}</ul>
    </section>
  );
}

export function NpcView({ campaignId, npc, onEdit, onDelete, actions }: { campaignId: string; npc: Npc; onEdit?: () => void; onDelete?: () => void; actions?: ReactNode }) {
  const toggle = (id: string) =>
    void updateNpc(npc.id, { secrets: npc.secrets.map((s) => (s.id === id ? { ...s, revealed: !s.revealed } : s)) });
  const facts: [string, string][] = [
    ["Role", npc.role], ["Faction", npc.factionTag], ["Location", npc.locationTag],
    ["Appearance", npc.appearance], ["Motivation", npc.motivation], ["Notes", npc.notes],
  ];
  return (
    <article className="npc-view">
      <div className="row">
        <h3 className="grow">{npc.name || "Unnamed"}</h3>
        {actions}
        {onEdit && <button onClick={onEdit}>Edit</button>}
        {onDelete && <button className="danger" onClick={onDelete}>Delete</button>}
      </div>
      <dl>
        {facts.filter(([, v]) => v.trim()).map(([k, v]) => (
          <div key={k}><dt className="muted">{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
      <NpcStatBlockLink campaignId={campaignId} npc={npc} />
      <AttachedScratchNotes campaignId={campaignId} npcId={npc.id} />
      <h4>Secrets</h4>
      {npc.secrets.length === 0 ? <p className="muted">No secrets.</p> : (
        <ul className="npc-secrets">
          {npc.secrets.map((s) => (
            <li key={s.id} className="row">
              <input type="checkbox" aria-label={s.text} checked={s.revealed} onChange={() => toggle(s.id)} />
              <span className="grow">{s.text}</span>
              <span className={s.revealed ? "revealed" : "muted"}>{s.revealed ? "Revealed" : "Hidden"}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function NpcCardPanel({ campaign }: PanelProps) {
  const npcs = useNpcs(campaign.id);
  const selected = useSelectedNpcId(campaign.id);
  const [editing, setEditing] = useState<string | null>(null); // npc id being edited
  const [confirming, setConfirming] = useState(false);
  const popout = usePopout();
  const pinnedIds = usePinnedNpcIds(campaign.id);
  const pinPanelShown = popout?.popped.has(PINNED_NPC_PANEL) ?? false;

  if (!npcs) return <p className="muted">Loading...</p>;
  if (selected === NEW_NPC) {
    return (
      <NpcForm
        campaignId={campaign.id}
        initial={emptyNpcDraft()}
        onCancel={() => selectNpc(campaign.id, null)}
        onSave={(d) => void createNpc(campaign.id, d).then((n) => selectNpc(campaign.id, n.id))}
      />
    );
  }
  const npc = npcs.find((n) => n.id === selected);
  if (!npc) return <p className="muted">Select an NPC, or create a new one.</p>;
  if (editing === npc.id) {
    const { name, role, appearance, motivation, notes, secrets, factionTag, locationTag, locationId, statBlockId } = npc;
    return (
      <NpcForm
        campaignId={campaign.id}
        initial={{ name, role, appearance, motivation, notes, secrets, factionTag, locationTag, locationId, statBlockId }}
        onCancel={() => setEditing(null)}
        onSave={(d) => void updateNpc(npc.id, d).then(() => setEditing(null))}
      />
    );
  }
  const isPinned = pinnedIds.includes(npc.id) && pinPanelShown;
  const pin = () => {
    pinNpc(campaign.id, npc.id);
    if (pinPanelShown) return; // the panel is already in the Pop-out Window; the new NPC joins its stack
    if (popout?.role === "main") popout.popOut(PINNED_NPC_PANEL);
    else setPoppedPanels(campaign.id, [...getPoppedPanels(campaign.id), PINNED_NPC_PANEL]);
  };
  const pinButton = isPinned
    ? <button onClick={() => unpinNpc(campaign.id, npc.id)}>Unpin from Pop-out</button>
    : <button onClick={pin}>Pin to Pop-out</button>;
  return (
    <>
      <NpcView campaignId={campaign.id} npc={npc} actions={pinButton} onEdit={() => setEditing(npc.id)} onDelete={() => setConfirming(true)} />
      {confirming && (
        <div className="backdrop">
          <div role="dialog" aria-modal="true" aria-labelledby="del-npc-title" className="dialog">
            <h2 id="del-npc-title">Delete "{npc.name}"?</h2>
            <p>This permanently removes the NPC and its secrets.</p>
            <div className="row end">
              <button onClick={() => setConfirming(false)}>Cancel</button>
              <button className="danger" onClick={() => {
                setConfirming(false);
                selectNpc(campaign.id, null);
                void deleteNpc(npc.id);
              }}>Delete NPC</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default registerPanel({ id: "npc-card", title: "NPC card", component: NpcCardPanel });
