import type { MapLine, SegmentKind } from "../storage/maps";

const KINDS: [SegmentKind, string][] = [["plain", "Plain"], ["wall", "Wall"], ["door", "Door"]];

/** Under the canvas: set each segment of the selected Line to plain, Wall or Door, or delete it. */
export function LineEditor({ line, label, length, onKind, onDelete }: { line: MapLine; label: string; length?: string; onKind: (index: number, kind: SegmentKind) => void; onDelete: () => void }) {
  return (
    <div className="row map-line-editor" role="group" aria-label={`Edit ${label}`}>
      <strong>{label}</strong>
      {line.route && <span>{length}</span>}
      {!line.route && line.segments.map((k, i) => (
        <label key={i}>{i + 1}{" "}
          <select aria-label={`Segment ${i + 1} type`} value={k} onChange={(e) => onKind(i, e.target.value as SegmentKind)}>
            {KINDS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
      ))}
      <button className="danger" aria-label={`Delete ${label}`} onClick={onDelete}>Delete</button>
    </div>
  );
}
