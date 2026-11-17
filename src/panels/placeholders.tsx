import { registerPanel, type PanelProps } from "./registry";

function placeholder(id: string, title: string, hint: string) {
  return registerPanel({
    id,
    title,
    component: function Placeholder(_: PanelProps) {
      return <p className="muted">{hint}</p>;
    },
  });
}

placeholder("travel-log", "Travel", "Travel tracking arrives with the World Map.");
