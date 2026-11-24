/** The fixed Marker icon set: simple line art on a 24 x 24 grid, drawn inline (no files, no network, so it works offline). */
export const MARKER_ICONS = {
  pin: <><path d="M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10z" /><circle cx="12" cy="11" r="2" /></>,
  city: <path d="M3 20h18M4 20V10h5v10M9 20V5h6v15M15 20v-8h5v8" />,
  camp: <path d="M2 20 12 4l10 16zM12 12l-3 8M12 12l3 8" />,
  cave: <path d="M3 20c0-9 3-14 9-14s9 5 9 14M8 20c0-4 1.5-6 4-6s4 2 4 6" />,
  skull: <><path d="M12 3a7 7 0 0 0-5 12v3h10v-3a7 7 0 0 0-5-12z" /><circle cx="9" cy="11" r="1.3" /><circle cx="15" cy="11" r="1.3" /><path d="M10 18v2M14 18v2" /></>,
  chest: <path d="M3 10a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10H3zM3 12h18M12 12v3" />,
  door: <path d="M6 21V4h12v17M3 21h18M15 12.5v.01" />,
  tower: <path d="M7 21V8h10v13M6 8V4h2v2h2V4h4v2h2V4h2v4M12 21v-5M3 21h18" />,
  temple: <path d="m3 9 9-5 9 5zM5 9v10M9 9v10M15 9v10M19 9v10M3 20h18" />,
  tavern: <path d="M6 8h9v11H6zM15 10h3a2 2 0 0 1 0 5h-3M8 5c0-1 1-1 1-2M12 5c0-1 1-1 1-2" />,
  ship: <path d="M3 15h18l-3 5H6zM12 15V3l6 9h-6M10 6l-4 7h4" />,
  star: <path d="m12 3 2.7 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17.3l-5.6 3 1.2-6.3L3 9.6l6.3-.8z" />,
} as const;

export type MarkerIcon = keyof typeof MARKER_ICONS;
export const MARKER_ICON_IDS = Object.keys(MARKER_ICONS) as MarkerIcon[];

/** One icon, centred on (0, 0), `size` px across, drawn in the current color. An unknown id falls back to the pin. */
export function MarkerGlyph({ icon, size }: { icon: string; size: number }) {
  const k = size / 24;
  return (
    <g transform={`translate(${-12 * k} ${-12 * k}) scale(${k})`} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" aria-hidden="true">
      {MARKER_ICONS[icon as MarkerIcon] ?? MARKER_ICONS.pin}
    </g>
  );
}
