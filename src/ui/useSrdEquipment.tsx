import { useEffect, useId, useState, type ReactElement } from "react";
import { loadReference, type EquipmentItem } from "../srd/reference";

/** SRD equipment (undefined while loading or if it fails) plus a <datalist> of its names for an item box. */
export function useSrdEquipment(): { items: EquipmentItem[] | undefined; listId: string; datalist: ReactElement } {
  const [items, setItems] = useState<EquipmentItem[]>();
  const listId = useId();
  useEffect(() => {
    let live = true;
    loadReference().then((d) => { if (live) setItems(d.equipment); }, () => {});
    return () => { live = false; };
  }, []);
  const names = [...new Set((items ?? []).map((e) => e.name))].sort((a, b) => a.localeCompare(b));
  return { items, listId, datalist: <datalist id={listId}>{names.map((n) => <option key={n} value={n} />)}</datalist> };
}
