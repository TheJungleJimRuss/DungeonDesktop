import { createContext, useContext } from "react";
import type { ModeId } from "../modes/modes";

/** The Mode whose layout a panel is shown in; undefined on the Dashboard (and anywhere outside a Mode). */
export const PanelModeContext = createContext<ModeId | undefined>(undefined);
export const usePanelMode = () => useContext(PanelModeContext);
