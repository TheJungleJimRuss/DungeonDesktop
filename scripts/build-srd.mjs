#!/usr/bin/env node
// Rebuilds src/data/srd/*.json from the pinned upstream SRD 5.2 data. See docs/adr/0001-srd-data-source.md.
//   node scripts/build-srd.mjs            fetch the pinned files (build-time only), verify each hash, convert
//   node scripts/build-srd.mjs <dir>      convert local copies of the same upstream files (hashes still verified)
// The app itself never fetches this data from a third party; it imports the generated JSON.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { convertConditions, convertEquipments, convertMagicItems, convertMonsters, convertSpells } from "./srd-convert.mjs";

const REPO = "5e-bits/5e-database";
const COMMIT = "6f6299e75b4fa56ed882bfb1429f6dc6b4c65330";
const SOURCES = [
  { file: "5e-SRD-Monsters.json", sha256: "34ec39f2b384a5e1ed11ac6d9e17601a19579ed67fd1775d21588d186714346f", out: "monsters", convert: convertMonsters },
  { file: "5e-SRD-Spells.json", sha256: "16aa8e47a84c6b21ccc101c1ee7ab5b8a026da940985bc826b6b58aa1fe0b6bc", out: "spells", convert: convertSpells },
  { file: "5e-SRD-Magic-Items.json", sha256: "c97abb7d570656f9329007f17d5bb4fddbe0d65d62abd141f66c1ff3b9c39d2f", out: "magic-items", convert: convertMagicItems },
  { file: "5e-SRD-Equipment.json", sha256: "4219c83f945f2c1a9a0029ee1bd8ff492d70d1eefd8d42546630ef6b5eef4f22", out: "equipment", convert: convertEquipments },
  { file: "5e-SRD-Conditions.json", sha256: "8c1d49897efa0f8cfd366f36f8cee62ed10b1bff051d3c6ce5827dfbb02a737a", out: "conditions", convert: convertConditions },
];
const outDir = fileURLToPath(new URL("../src/data/srd/", import.meta.url));
const localDir = process.argv[2];

await mkdir(outDir, { recursive: true });
for (const s of SOURCES) {
  const url = `https://raw.githubusercontent.com/${REPO}/${COMMIT}/src/2024/en/${s.file}`;
  const bytes = localDir ? await readFile(`${localDir.replace(/\/$/, "")}/${s.file}`) : Buffer.from(await (await fetch(url)).arrayBuffer());
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== s.sha256) throw new Error(`${s.file}: source hash mismatch: got ${hash}, expected ${s.sha256}`);
  const list = s.convert(JSON.parse(bytes.toString("utf8")));
  await writeFile(`${outDir}${s.out}.json`, JSON.stringify(list) + "\n");
  console.log(`Wrote ${list.length} entries to src/data/srd/${s.out}.json`);
}
