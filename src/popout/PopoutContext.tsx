import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Campaign } from "../storage";
import { getPoppedPanels, parsePanels, setPoppedPanels, usePoppedPanelsRaw } from "./popoutState";

export const POPOUT_PARAM = "popout";
export const popoutUrl = (campaignId: string) =>
  `${window.location.pathname}?${POPOUT_PARAM}=${encodeURIComponent(campaignId)}`;
const windowName = (campaignId: string) => `dungeon-desktop-popout-${campaignId}`;
const POLL_MS = 250;

export interface PopoutApi {
  /** "main": panels can be sent out. "popout": panels can be sent back. */
  role: "main" | "popout";
  popped: ReadonlySet<string>;
  windowOpen: boolean;
  blocked: boolean;
  popOut(panelId: string): void;
  bringBack(panelId: string): void;
  bringBackAll(): void;
  reopen(): void;
}

const Ctx = createContext<PopoutApi | null>(null);
export const usePopout = () => useContext(Ctx);

/** Main window: owns the Pop-out Window handle and the remembered panel list. */
export function MainPopoutProvider({ campaign, children }: { campaign: Campaign; children: ReactNode }) {
  const raw = usePoppedPanelsRaw(campaign.id);
  const popped = useMemo(() => new Set(parsePanels(raw)), [raw]);
  const win = useRef<Window | null>(null);
  const [windowOpen, setWindowOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const openWindow = useCallback((): boolean => {
    if (win.current && !win.current.closed) { win.current.focus?.(); return true; }
    const w = window.open(popoutUrl(campaign.id), windowName(campaign.id), "popup,width=900,height=800");
    if (!w) { setBlocked(true); return false; }
    setBlocked(false);
    win.current = w;
    setWindowOpen(true);
    return true;
  }, [campaign.id]);

  const popOut = useCallback((panelId: string) => {
    if (openWindow()) setPoppedPanels(campaign.id, [...getPoppedPanels(campaign.id), panelId]);
  }, [campaign.id, openWindow]);

  const bringBack = useCallback((panelId: string) => {
    const rest = getPoppedPanels(campaign.id).filter((p) => p !== panelId);
    setPoppedPanels(campaign.id, rest);
    if (rest.length === 0) win.current?.close();
  }, [campaign.id]);

  const bringBackAll = useCallback(() => {
    setPoppedPanels(campaign.id, []);
    win.current?.close();
  }, [campaign.id]);

  // Window closed by the DM: its panels return to the main window.
  useEffect(() => {
    if (!windowOpen) return;
    const id = setInterval(() => {
      if (!win.current || win.current.closed) {
        win.current = null;
        setWindowOpen(false);
        setPoppedPanels(campaign.id, []);
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [windowOpen, campaign.id]);

  // Leaving the Campaign closes the window but keeps the remembered panels.
  useEffect(() => () => { win.current?.close(); win.current = null; }, []);

  const api = useMemo<PopoutApi>(() => ({
    role: "main", popped, windowOpen, blocked, popOut, bringBack, bringBackAll, reopen: () => void openWindow(),
  }), [popped, windowOpen, blocked, popOut, bringBack, bringBackAll, openWindow]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

/** Pop-out Window: shows exactly the remembered panels; sending one back removes it. */
export function PopoutWindowProvider({ campaign, children }: { campaign: Campaign; children: ReactNode }) {
  const raw = usePoppedPanelsRaw(campaign.id);
  const popped = useMemo(() => new Set(parsePanels(raw)), [raw]);
  const bringBack = useCallback((panelId: string) => {
    const rest = getPoppedPanels(campaign.id).filter((p) => p !== panelId);
    setPoppedPanels(campaign.id, rest);
    if (rest.length === 0) window.close();
  }, [campaign.id]);
  const api = useMemo<PopoutApi>(() => ({
    role: "popout", popped, windowOpen: true, blocked: false,
    popOut: () => {}, bringBack,
    bringBackAll: () => { setPoppedPanels(campaign.id, []); window.close(); },
    reopen: () => {},
  }), [popped, bringBack, campaign.id]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
