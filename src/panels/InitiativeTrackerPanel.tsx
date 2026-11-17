import { useEffect, useMemo, useState, type FormEvent } from "react";
import { registerPanel, type PanelProps } from "./registry";
import { requestRoll } from "../dice/roller";
import { loadMonsters, type Monster } from "../srd/monsters";
import { buildIndex, search } from "../srd/search";
import { currentHpOf, listParty, writeBackPartyHp, type PartyMember } from "../storage/party";
import { monsterFromEntry, useCustomEntries } from "../storage/customEntries";
import { endEncounter, saveEncounter, useActiveEncounter } from "../storage/encounters";
import { DefeatModeToggle, HpControls, rowStateClass, useHpRolls } from "./HpControls";
import { useChangeVersion } from "../sync/changeBus";
import { CombatExtras, LairRow, monsterCombatants } from "./CombatExtras";
import { ConditionControls, ConditionNotices } from "./ConditionControls";
import { advanceTurnWithConditions } from "../combat/conditions";
import AddNpcCombatants from "./AddNpcCombatants";
import AddSelect from "./AddSelect";
import { pickCombatant, useCombatPick } from "../combat/combatSelection";
import { SaveEncounterControl, SavedEncounterList } from "./SavedEncounters";
import {
  abilityMod, addCombatant, moveTie, newEncounter, removeCombatant, rewindTurn, setInitiative,
  type Encounter, type NewCombatant,
} from "../combat/rules";

/** Initiative field: a draft that commits on Enter or blur, so the order does not jump while typing. */
function InitiativeInput({ name, value, onCommit }: { name: string; value?: number; onCommit: (v: number | undefined) => void }) {
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));
  useEffect(() => setDraft(value === undefined ? "" : String(value)), [value]);
  const commit = () => {
    const n = draft.trim() === "" ? undefined : Number(draft);
    if (n === undefined || Number.isFinite(n)) { if (n !== value) onCommit(n); }
  };
  return (
    <input className="init-input" type="number" aria-label={`Initiative ${name}`} value={draft}
      onChange={(e) => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }} />
  );
}

const ALL_PARTY = "__all__";
const partyCombatant = (m: PartyMember): NewCombatant =>
  ({ kind: "party", name: m.name, hp: currentHpOf(m), maxHp: m.maxHp, dexMod: 0, partyId: m.id });

function AddCombatants({ campaign, onAdd }: { campaign: PanelProps["campaign"]; onAdd: (c: NewCombatant[]) => void }) {
  const [party, setParty] = useState<PartyMember[]>([]);
  const partyVersion = useChangeVersion("party");
  useEffect(() => { void listParty(campaign.id).then(setParty); }, [campaign.id, partyVersion]);
  const [srd, setSrd] = useState<Monster[]>([]);
  useEffect(() => { void loadMonsters().then(setSrd); }, []);
  const customs = useCustomEntries(campaign.id);
  const index = useMemo(
    () => buildIndex([...srd, ...(customs ?? []).filter((e) => e.kind === "monster").map(monsterFromEntry)]),
    [srd, customs],
  );
  const [query, setQuery] = useState("");
  const hits = useMemo(() => search(index, query, 8), [index, query]);
  const [adhoc, setAdhoc] = useState({ name: "", hp: "", init: "" });

  const addMonster = (m: Monster) =>
    onAdd(monsterCombatants(m, { kind: "monster", name: m.name, hp: m.hp, dexMod: abilityMod(m.abilities.dex), monsterId: m.id }));
  const submitAdhoc = (e: FormEvent) => {
    e.preventDefault();
    if (!adhoc.name.trim()) return;
    const init = adhoc.init.trim() === "" ? undefined : Number(adhoc.init);
    onAdd([{ kind: "adhoc", name: adhoc.name.trim(), hp: Number(adhoc.hp) || 0, dexMod: 0, initiative: Number.isFinite(init) ? init : undefined }]);
    setAdhoc({ name: "", hp: "", init: "" });
  };

  return (
    <div className="init-add">
      <div className="row" aria-label="Add players">
        <AddSelect label="Add Party member" prompt="Add player…" options={party.map((m) => ({ value: m.id, label: m.name }))}
          extra={party.length > 1 ? [{ value: ALL_PARTY, label: "Entire Party" }] : undefined}
          onPick={(id) => onAdd(party.filter((m) => id === ALL_PARTY || m.id === id).map(partyCombatant))} />
        <AddNpcCombatants campaignId={campaign.id} onAdd={onAdd} />
      </div>
      <label>Search monsters
        <input type="search" aria-label="Search monsters" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Goblin" />
      </label>
      {hits.length > 0 && (
        <ul className="init-hits" aria-label="Monster results">
          {hits.map((m) => (
            <li key={m.id}><button onClick={() => addMonster(m)} aria-label={`Add ${m.name}`}>{m.name}</button>{" "}
              <span className="muted">CR {m.cr} · HP {m.hp}</span></li>
          ))}
        </ul>
      )}
      <form className="row" onSubmit={submitAdhoc} aria-label="Add ad-hoc combatant">
        <input aria-label="Ad-hoc name" placeholder="Name" value={adhoc.name} onChange={(e) => setAdhoc({ ...adhoc, name: e.target.value })} />
        <input aria-label="Ad-hoc initiative" type="number" placeholder="Init" value={adhoc.init} onChange={(e) => setAdhoc({ ...adhoc, init: e.target.value })} />
        <input aria-label="Ad-hoc HP" type="number" placeholder="HP" value={adhoc.hp} onChange={(e) => setAdhoc({ ...adhoc, hp: e.target.value })} />
        <button type="submit">Add ad-hoc</button>
      </form>
    </div>
  );
}

function InitiativeTracker({ campaign }: PanelProps) {
  const enc = useActiveEncounter(campaign.id);
  if (enc === undefined) return null;
  if (enc === null) {
    return (
      <div className="initiative">
        <p className="muted">No Encounter in progress.</p>
        <button className="primary" onClick={() => void saveEncounter(newEncounter(campaign.id))}>Start encounter</button>
        <SavedEncounterList campaignId={campaign.id} />
      </div>
    );
  }
  return <Tracker campaign={campaign} enc={enc} />;
}

function Tracker({ campaign, enc }: { campaign: PanelProps["campaign"]; enc: Encounter }) {
  const update = (fn: (e: Encounter) => Encounter) => void saveEncounter(fn(enc));
  const rollMonsters = () => update((e) => e.combatants.reduce((acc, c) => {
    if (c.kind !== "monster") return acc;
    const r = requestRoll(`1d20${c.dexMod < 0 ? "-" : "+"}${Math.abs(c.dexMod)}`);
    return r.ok ? setInitiative(acc, c.id, r.total) : acc;
  }, e));
  const addAll = (list: NewCombatant[]) => update((e) => list.reduce(addCombatant, e));
  const n = enc.combatants.length;
  const hpRolls = useHpRolls(campaign.id);
  const pick = useCombatPick(campaign.id);
  const selectedId = pick && pick.activeId === enc.activeId ? pick.combatantId : undefined;
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const toggleOpen = (id: string) => setOpened((o) => { const x = new Set(o); if (!x.delete(id)) x.add(id); return x; });

  return (
    <div className="initiative">
      <div className="row init-head">
        <strong aria-live="polite">Round {enc.round}</strong>
        <button onClick={() => update(rewindTurn)} disabled={!n}>Previous turn</button>
        <button className="primary" onClick={() => update(advanceTurnWithConditions)} disabled={!n}>Next turn</button>
        <button onClick={rollMonsters} disabled={!enc.combatants.some((c) => c.kind === "monster")}>Roll monster initiative</button>
        <DefeatModeToggle enc={enc} update={update} />
        <button className="danger" onClick={() => void writeBackPartyHp(enc.combatants).then(() => endEncounter(campaign.id))}>End encounter</button>
      </div>
      <ConditionNotices enc={enc} update={update} />
      {n === 0 && <p className="muted">Add combatants below.</p>}
      <ol className="init-list" aria-label="Initiative order">
        {enc.combatants.map((c, i) => {
          const active = c.id === enc.activeId;
          const collapsed = enc.activeId !== undefined && !active && !opened.has(c.id);
          const tieUp = i > 0 && c.initiative !== undefined && enc.combatants[i - 1].initiative === c.initiative;
          const tieDown = i < n - 1 && c.initiative !== undefined && enc.combatants[i + 1].initiative === c.initiative;
          return (
            <li key={c.id} aria-label={c.name} aria-current={active ? "true" : undefined} className={(active ? "init-row active" : "init-row") + (collapsed ? " collapsed" : "") + (c.id === selectedId ? " selected" : "") + rowStateClass(c)}>
              <div className="init-top">
                <InitiativeInput name={c.name} value={c.initiative} onCommit={(v) => update((e) => setInitiative(e, c.id, v))} />
                <span className="name">{c.name}</span>
                <span className="init-tools">
                  <button aria-label={`Move ${c.name} up`} disabled={!tieUp} onClick={() => update((e) => moveTie(e, c.id, "up"))}>↑</button>
                  <button aria-label={`Move ${c.name} down`} disabled={!tieDown} onClick={() => update((e) => moveTie(e, c.id, "down"))}>↓</button>
                  {enc.activeId !== undefined && !active && <button aria-label={`${collapsed ? "Expand" : "Collapse"} ${c.name}`} aria-expanded={!collapsed} onClick={() => toggleOpen(c.id)}>{collapsed ? "▸" : "▾"}</button>}
                </span>
                <span className="init-meta">
                  <span className={"init-kind kind-" + c.kind}>{c.kind === "party" ? "Party" : c.kind === "monster" ? "Monster" : c.kind === "lair" ? "Lair" : "Ad-hoc"}</span>
                  {active && <span className="init-turn">Active turn</span>}
                  {c.id === selectedId && <span className="init-selected">Selected</span>}
                  <span className="init-spacer" />
                  <button aria-label={`Show ${c.name} Stat Block`} onClick={() => pickCombatant(campaign.id, { combatantId: c.id, activeId: enc.activeId })}>Stat Block</button>
                </span>
              </div>
              <div className="init-details" hidden={collapsed}>
                {c.kind === "lair" ? <LairRow c={c} round={enc.round} update={update} /> : (<>
                  <HpControls c={c} update={update} hpRoll={c.monsterId ? hpRolls[c.monsterId] : undefined} />
                  <CombatExtras c={c} update={update} />
                </>)}
                <ConditionControls c={c} update={update} />
                <div className="init-actions">
                  <button className="danger" aria-label={`Remove ${c.name}`} onClick={() => update((e) => removeCombatant(e, c.id))}>Remove</button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="init-side">
        <AddCombatants campaign={campaign} onAdd={addAll} />
        <SaveEncounterControl campaignId={campaign.id} enc={enc} />
      </div>
    </div>
  );
}

registerPanel({ id: "initiative-tracker", title: "Initiative", component: InitiativeTracker });
