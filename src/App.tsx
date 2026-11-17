import { useState } from "react";
import CampaignPicker from "./ui/CampaignPicker";
import Dashboard from "./ui/Dashboard";
import PopoutApp from "./popout/PopoutApp";
import { POPOUT_PARAM } from "./popout/PopoutContext";
import type { Campaign } from "./storage";

/** `search` defaults to the page's query string; `?popout=<campaignId>` selects the Pop-out Window route. */
export default function App({ search = window.location.search }: { search?: string }) {
  const [open, setOpen] = useState<Campaign | null>(null);
  const popoutId = new URLSearchParams(search).get(POPOUT_PARAM);
  if (popoutId) return <PopoutApp campaignId={popoutId} />;
  return open ? (
    <Dashboard campaign={open} onExit={() => setOpen(null)} />
  ) : (
    <CampaignPicker onOpen={setOpen} />
  );
}
