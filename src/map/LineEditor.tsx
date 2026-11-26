import type { MapLine, SegmentKind } from "../storage/maps";

const KINDS: [SegmentKind, string][] = [["plain", "Plain"], ["wall", "Wall"], ["door", "Door"]];

/** Under the canvas: one type for the whole Line (plain, Wall or Door), or, once a segment is clicked on the canvas, that segment's type alone.
 *  A Route has no types: it shows its length, and a clicked segment can be split. An open Line can be made a Route (Make route), and back
 *  (Unmake route; its segment types were kept). */
export function LineEditor({ line, label, length, segment, onSegment, onSplit, onKind, onRoute, onDelete }: {
  line: MapLine; label: string; length?: string; segment: number | null; onSegment: (index: number | null) => void;
  /** Add a point in the middle of segment `index`. */
  onSplit: (index: number) => void;
  /** `index` null = every segment. */
  onKind: (index: number | null, kind: SegmentKind) => void;
  /** Make the open Line a Route (true) or a plain Line again (false). */
  onRoute: (route: boolean) => void; onDelete: () => void;
}) {
  const kinds = new Set(line.segments);
  const options = KINDS.map(([v, t]) => <option key={v} value={v}>{t}</option>);
  const one = segment !== null && segment < line.segments.length ? segment : null;
  return (
    <div className="row map-line-editor" role="group" aria-label={`Edit ${label}`}>
      <strong>{label}</strong>
      {line.route && <span>{length}</span>}
      {line.route && one === null && <span className="muted">Click a segment on the map to pick it; double-click it to add a point.</span>}
      {line.route && one !== null && <>
        <span>Segment {one + 1}</span>
        <button onClick={() => onSplit(one)}>Split segment</button>
        <button onClick={() => onSegment(null)}>Deselect segment</button>
      </>}
      {!line.route && one === null && <>
        <label>All segments{" "}
          <select aria-label={`${label} type`} value={kinds.size === 1 ? line.segments[0] : "mixed"} onChange={(e) => onKind(null, e.target.value as SegmentKind)}>
            {kinds.size > 1 && <option value="mixed" disabled>Mixed</option>}
            {options}
          </select>
        </label>
        <span className="muted">Click a segment on the map to change just that one; double-click it to add a point.</span>
      </>}
      {!line.route && one !== null && <>
        <label>Segment {one + 1}{" "}
          <select aria-label={`Segment ${one + 1} type`} value={line.segments[one]} onChange={(e) => onKind(one, e.target.value as SegmentKind)}>{options}</select>
        </label>
        <button onClick={() => onSplit(one)}>Split segment</button>
        <button onClick={() => onSegment(null)}>All segments</button>
      </>}
      {!line.closed && <button onClick={() => onRoute(!line.route)} title={line.route ? "Turn this Route back into a Line" : "Turn this Line into a Route that shows its length"}>{line.route ? "Unmake route" : "Make route"}</button>}
      <button className="danger" aria-label={`Delete ${label}`} onClick={onDelete}>Delete</button>
    </div>
  );
}
