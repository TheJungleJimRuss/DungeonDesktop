import type { MapLine, SegmentKind } from "../storage/maps";

const KINDS: [SegmentKind, string][] = [["plain", "Plain"], ["wall", "Wall"], ["door", "Door"]];

/** Under the canvas: one type for the whole Line (plain, Wall or Door), or, once a segment is clicked on the canvas, that segment's type alone. */
export function LineEditor({ line, label, length, segment, onSegment, onKind, onDelete }: {
  line: MapLine; label: string; length?: string; segment: number | null; onSegment: (index: number | null) => void;
  /** `index` null = every segment. */
  onKind: (index: number | null, kind: SegmentKind) => void; onDelete: () => void;
}) {
  const kinds = new Set(line.segments);
  const options = KINDS.map(([v, t]) => <option key={v} value={v}>{t}</option>);
  const one = segment !== null && segment < line.segments.length ? segment : null;
  return (
    <div className="row map-line-editor" role="group" aria-label={`Edit ${label}`}>
      <strong>{label}</strong>
      {line.route && <span>{length}</span>}
      {!line.route && one === null && <>
        <label>All segments{" "}
          <select aria-label={`${label} type`} value={kinds.size === 1 ? line.segments[0] : "mixed"} onChange={(e) => onKind(null, e.target.value as SegmentKind)}>
            {kinds.size > 1 && <option value="mixed" disabled>Mixed</option>}
            {options}
          </select>
        </label>
        <span className="muted">Click a segment on the map to change just that one.</span>
      </>}
      {!line.route && one !== null && <>
        <label>Segment {one + 1}{" "}
          <select aria-label={`Segment ${one + 1} type`} value={line.segments[one]} onChange={(e) => onKind(one, e.target.value as SegmentKind)}>{options}</select>
        </label>
        <button onClick={() => onSegment(null)}>All segments</button>
      </>}
      <button className="danger" aria-label={`Delete ${label}`} onClick={onDelete}>Delete</button>
    </div>
  );
}
