import type { MapMarker } from "../storage/maps";

export const DEFAULT_MARKER_COLOR = "#e67e22", DEFAULT_MARKER_ICON = "pin";

/** A Marker at a free (unsnapped) point, named "Marker N" with the first number not already used. */
export function newMarker(at: { x: number; y: number }, existing: MapMarker[]): MapMarker {
  const taken = new Set(existing.map((m) => m.name));
  let n = existing.length + 1;
  while (taken.has(`Marker ${n}`)) n++;
  return { id: crypto.randomUUID(), x: at.x, y: at.y, name: `Marker ${n}`, color: DEFAULT_MARKER_COLOR, icon: DEFAULT_MARKER_ICON, note: "" };
}

/** What a Marker is called on the Map: the linked Location's live name, else its own name. */
export const markerLabel = (m: Pick<MapMarker, "name">, locationName?: string): string => locationName?.trim() || m.name;

/** Markers linked to a deleted Location become unlinked and keep the old name as their own. Returns the same array when nothing links. */
export function unlinkLocationFromMarkers(markers: MapMarker[], locationId: string, oldName: string): MapMarker[] {
  if (!markers.some((m) => m.locationId === locationId)) return markers;
  return markers.map((m) => {
    if (m.locationId !== locationId) return m;
    const { locationId: _gone, ...rest } = m;
    return { ...rest, name: oldName };
  });
}
