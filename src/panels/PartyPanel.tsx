import { useCallback, useEffect, useState, type FormEvent } from "react";
import { registerPanel, type PanelProps } from "./registry";
import { useChangeVersion } from "../sync/changeBus";
import { addPartyMember, currentHpOf, listParty, removePartyMember, updatePartyMember, type PartyMember, type PartyMemberInput } from "../storage/party";

const EMPTY: PartyMemberInput = { name: "", class: "", level: 1, ac: 10, maxHp: 1, passivePerception: 10, notes: "" };

function MemberForm({ initial, onSave, onCancel }: { initial: PartyMemberInput; onSave: (v: PartyMemberInput) => void; onCancel: () => void }) {
  const [v, setV] = useState(initial);
  const num = (k: "level" | "ac" | "maxHp" | "currentHp" | "passivePerception", label: string) => (
    <label>{label}
      <input type="number" value={Number.isNaN(v[k]) ? "" : (v[k] ?? v.maxHp)} onChange={(e) => setV({ ...v, [k]: e.target.valueAsNumber })} />
    </label>
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!v.name.trim()) return;
    onSave({ ...v, name: v.name.trim(), level: v.level || 1, ac: v.ac || 0, maxHp: v.maxHp || 0, currentHp: Math.min(Number.isNaN(v.currentHp ?? 0) ? v.maxHp : (v.currentHp ?? v.maxHp), v.maxHp || 0), passivePerception: v.passivePerception || 0 });
  };
  return (
    <form className="party-form" onSubmit={submit}>
      <label>Name<input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>
      <label>Class<input value={v.class} onChange={(e) => setV({ ...v, class: e.target.value })} /></label>
      {num("level", "Level")}
      {num("ac", "AC")}
      {num("maxHp", "Max HP")}
      {num("currentHp", "Current HP")}
      {num("passivePerception", "Passive Perception")}
      <label>Notes<input value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></label>
      <div className="row">
        <button type="submit" className="primary">Save member</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function PartyPanel({ campaign }: PanelProps) {
  const [members, setMembers] = useState<PartyMember[] | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(null);

  const reload = useCallback(async () => setMembers(await listParty(campaign.id)), [campaign.id]);
  const version = useChangeVersion("party");
  useEffect(() => { void reload(); }, [reload, version]);

  const save = async (input: PartyMemberInput) => {
    if (editing === "new") await addPartyMember(campaign.id, input);
    else if (editing) await updatePartyMember(editing, input);
    setEditing(null);
    await reload();
  };
  const remove = async (id: string) => { await removePartyMember(id); await reload(); };

  if (!members) return null;
  const editingMember = members.find((m) => m.id === editing);

  return (
    <div className="party">
      {members.length === 0 && editing !== "new" && <p className="muted">No party members yet.</p>}
      <ul className="party-list">
        {members.map((m) => editing === m.id && editingMember ? (
          <li key={m.id}><MemberForm initial={editingMember} onSave={save} onCancel={() => setEditing(null)} /></li>
        ) : (
          <li key={m.id} aria-label={m.name} className="party-member">
            <div><span className="name">{m.name}</span> <span className="muted">{m.class} {m.level}</span></div>
            <div className="party-stats">
              <span>AC {m.ac}</span><span>HP {currentHpOf(m)}/{m.maxHp}</span><span>PP {m.passivePerception}</span>
            </div>
            {m.notes && <div className="muted">{m.notes}</div>}
            <div className="row">
              <button onClick={() => setEditing(m.id)} aria-label={`Edit ${m.name}`}>Edit</button>
              <button className="danger" onClick={() => remove(m.id)} aria-label={`Remove ${m.name}`}>Remove</button>
            </div>
          </li>
        ))}
      </ul>
      {editing === "new"
        ? <MemberForm initial={EMPTY} onSave={save} onCancel={() => setEditing(null)} />
        : <button onClick={() => setEditing("new")}>Add member</button>}
    </div>
  );
}

registerPanel({ id: "party-glance", title: "Party at a glance", component: PartyPanel });
