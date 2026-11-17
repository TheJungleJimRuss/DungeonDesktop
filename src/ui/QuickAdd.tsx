import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Campaign } from "../storage";
import { createLocation, selectLocation } from "../storage/locations";
import { createNpc, emptyNpcDraft, selectNpc } from "../storage/npcs";
import { createCustomEntry, emptyData } from "../storage/customEntries";
import { addPartyMember } from "../storage/party";

type Kind = "location" | "npc" | "spell" | "monster" | "player";

const KINDS: { id: Kind; label: string }[] = [
  { id: "location", label: "Location" },
  { id: "npc", label: "NPC" },
  { id: "spell", label: "Spell" },
  { id: "monster", label: "Monster" },
  { id: "player", label: "Player" },
];

async function create(campaign: Campaign, kind: Kind, name: string): Promise<void> {
  switch (kind) {
    case "location": {
      const l = await createLocation(campaign.id, { name, notes: "" });
      selectLocation(campaign.id, l.id);
      return;
    }
    case "npc": {
      const n = await createNpc(campaign.id, { ...emptyNpcDraft(), name });
      selectNpc(campaign.id, n.id);
      return;
    }
    case "spell":
    case "monster":
      await createCustomEntry(campaign.id, kind, name, emptyData(kind));
      return;
    case "player":
      await addPartyMember(campaign.id, { name, class: "", level: 1, ac: 10, maxHp: 1, passivePerception: 10, notes: "" });
  }
}

/** Top-bar "Add" button: a small dialog that creates a Location, NPC, Spell, Monster or Player by name. */
export default function QuickAdd({ campaign }: { campaign: Campaign }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("npc");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const close = () => { setOpen(false); setStatus(""); };

  useEffect(() => {
    if (!open) return;
    nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); close(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const label = KINDS.find((k) => k.id === kind)!.label;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    await create(campaign, kind, n);
    setName("");
    setStatus(`Added ${label} "${n}".`);
    nameRef.current?.focus();
  };

  return (
    <>
      <button className="primary" onClick={() => setOpen(true)} aria-haspopup="dialog">+ Add</button>
      {open && (
        <div className="backdrop" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="qa-title" className="dialog">
            <h2 id="qa-title">Add to {campaign.name}</h2>
            <form onSubmit={submit}>
              <div role="radiogroup" aria-label="What to add" className="row quick-add-kinds">
                {KINDS.map((k) => (
                  <button key={k.id} type="button" role="radio" aria-checked={kind === k.id}
                    onClick={() => { setKind(k.id); setStatus(""); nameRef.current?.focus(); }}>{k.label}</button>
                ))}
              </div>
              <label className="quick-add-name">
                <span>{label} name</span>
                <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <p role="status" className="muted">{status}</p>
              <div className="row end">
                <button type="button" onClick={close}>Done</button>
                <button type="submit" className="primary">Add {label}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
