import type { ReactNode } from "react";

/** SRD rules text is light Markdown: paragraphs, **bold**, *italic*, "- " bullets and pipe tables. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) =>
    part.startsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong>
    : part.startsWith("*") && part.length > 2 ? <em key={i}>{part.slice(1, -1)}</em> : part);
}

export function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        if (!/^\|[\s:|-]+\|?$/.test(lines[i])) rows.push(lines[i].replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
        i++;
      }
      i--;
      const [head, ...body] = rows;
      blocks.push(
        <table key={i} className="ref-table"><thead><tr>{head.map((c, j) => <th key={j}>{inline(c)}</th>)}</tr></thead>
          <tbody>{body.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k}>{inline(c)}</td>)}</tr>)}</tbody></table>,
      );
    } else if (/^[-*] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) items.push(lines[i++].slice(2));
      i--;
      blocks.push(<ul key={i}>{items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ul>);
    } else blocks.push(<p key={i}>{inline(line)}</p>);
  }
  return <>{blocks}</>;
}

export function Line({ label, value }: { label: string; value?: string | number }) {
  return value === undefined || value === "" ? null : <p className="sb-line"><strong>{label}</strong> {value}</p>;
}
