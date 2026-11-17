import { useState } from "react";
import CampaignPicker from "./ui/CampaignPicker";
import Dashboard from "./ui/Dashboard";
import type { Campaign } from "./storage";

export default function App() {
  const [open, setOpen] = useState<Campaign | null>(null);
  return open ? (
    <Dashboard campaign={open} onExit={() => setOpen(null)} />
  ) : (
    <CampaignPicker onOpen={setOpen} />
  );
}
