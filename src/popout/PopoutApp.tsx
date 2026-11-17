import { useEffect, useState } from "react";
import { getCampaign, type Campaign } from "../storage";
import { PopoutWindowProvider, usePopout } from "./PopoutContext";
import { useShortcutListener } from "../shortcuts/shortcuts";
import { PanelFrame } from "../ui/ModeLayout";

function Panels({ campaign }: { campaign: Campaign }) {
  const api = usePopout()!;
  const ids = [...api.popped];
  return (
    <main className="popout-area">
      {ids.length === 0 ? (
        <p className="muted">No panels are popped out. Send one from the main window.</p>
      ) : ids.map((id) => <PanelFrame key={id} panelId={id} campaign={campaign} />)}
    </main>
  );
}

/** The Pop-out Window route (`?popout=<campaignId>`): only PanelFrames, no navigation. */
export default function PopoutApp({ campaignId }: { campaignId: string }) {
  useShortcutListener();
  const [campaign, setCampaign] = useState<Campaign | null | undefined>();
  useEffect(() => { void getCampaign(campaignId).then((c) => setCampaign(c ?? null)); }, [campaignId]);
  useEffect(() => {
    if (campaign) document.title = `${campaign.name} - Pop-out`;
  }, [campaign]);
  if (campaign === undefined) return null;
  if (campaign === null) return <p className="muted popout-area">That campaign no longer exists.</p>;
  return <PopoutWindowProvider campaign={campaign}><Panels campaign={campaign} /></PopoutWindowProvider>;
}
