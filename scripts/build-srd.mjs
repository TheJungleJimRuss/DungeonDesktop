#!/usr/bin/env node
// Rebuilds src/data/srd/*.json from the pinned upstream SRD 5.2 data. See docs/adr/0001-srd-data-source.md.
//   node scripts/build-srd.mjs            fetch the pinned files (build-time only), verify each hash, convert
//   node scripts/build-srd.mjs <dir>      convert local copies of the same upstream files (hashes still verified)
// The app itself never fetches this data from a third party; it imports the generated JSON.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  convertBackgrounds, convertClassFeatures, convertClassLevels, convertClasses, convertConditions, convertEquipments, convertFeats, convertMagicItems, convertMonsters, convertRules, convertSpecies, convertSubclasses, convertSpells, convertSubspeciesList, convertTraits,
} from "./srd-convert.mjs";

const REPO = "5e-bits/5e-database";
const COMMIT = "6f6299e75b4fa56ed882bfb1429f6dc6b4c65330";
const SOURCES = [
  { file: "5e-SRD-Monsters.json", sha256: "34ec39f2b384a5e1ed11ac6d9e17601a19579ed67fd1775d21588d186714346f", out: "monsters", convert: convertMonsters },
  { file: "5e-SRD-Spells.json", sha256: "16aa8e47a84c6b21ccc101c1ee7ab5b8a026da940985bc826b6b58aa1fe0b6bc", out: "spells", convert: convertSpells },
  { file: "5e-SRD-Magic-Items.json", sha256: "c97abb7d570656f9329007f17d5bb4fddbe0d65d62abd141f66c1ff3b9c39d2f", out: "magic-items", convert: convertMagicItems },
  { file: "5e-SRD-Equipment.json", sha256: "4219c83f945f2c1a9a0029ee1bd8ff492d70d1eefd8d42546630ef6b5eef4f22", out: "equipment", convert: convertEquipments },
  { file: "5e-SRD-Conditions.json", sha256: "8c1d49897efa0f8cfd366f36f8cee62ed10b1bff051d3c6ce5827dfbb02a737a", out: "conditions", convert: convertConditions },
  { file: "5e-SRD-Feats.json", sha256: "f80bf64d46b4addb5d991c6b4b1e05e8c0f9209ffbae297222c5439022abcbc3", out: "feats", convert: convertFeats },
  { file: "5e-SRD-Backgrounds.json", sha256: "8cf80b14ddbfb82e596d51fb9b4d5ece0627297251cb1e99f56d89f5059da7c2", out: "backgrounds", convert: convertBackgrounds },
  { file: "5e-SRD-Species.json", sha256: "bfb1beb2a61925a496b6d4c9bfe37bf58c735e2c6e6b8e4ad7310b44b4cb1d70", out: "species", convert: convertSpecies },
  { file: "5e-SRD-Subspecies.json", sha256: "c3d758e9ae42ddb2de71a6ad23863f785266843337c52b386d250781a92cc159", out: "subspecies", convert: convertSubspeciesList },
  { file: "5e-SRD-Traits.json", sha256: "acbe77b03e08959b6d8901b10d7d9eaad57a2624af121c4ef72157c708bf9427", out: "traits", convert: convertTraits },
  { file: "5e-SRD-Classes.json", sha256: "0f3bd5dd5931a561a9c5da6bdec1ba2279ad03261ac2dbe7dae23a11273f678e", out: "classes", convert: convertClasses },
  { file: "5e-SRD-Levels.json", sha256: "963a7b1c597e51f2d6e22068940344193fbb78bf2f0a81274777dec06b3a3fb1", out: "class-levels", convert: convertClassLevels },
  { file: "5e-SRD-Subclasses.json", sha256: "eac4c9f975490f0953e389eeae28bc655527f6ed277146eff6757a9fe1953178", out: "subclasses", convert: convertSubclasses },
  { file: "5e-SRD-Features.json", sha256: "6390b3a1ad2ae68ad21516c38309799f610f893cb008cd3ad920d0eed89f8249", out: "class-features", convert: convertClassFeatures },
  // Several files may share one `out`: their converted lists are concatenated in this order (rules.json holds all seven kinds).
  { file: "5e-SRD-Skills.json", sha256: "f3aa1afd9c2f132882cbb17f72a41482f7578d167e72d166259d1455c4b73887", out: "rules", convert: convertRules("skill") },
  { file: "5e-SRD-Languages.json", sha256: "56c0577430418d3cb6993f8e475ab9e60db8b0cc154fff9d0cbaf988a0ff92d5", out: "rules", convert: convertRules("language") },
  { file: "5e-SRD-Damage-Types.json", sha256: "83f074f17afe6ec272b09eab6ac4305171e93cecf77584bd32b21f2e0123321f", out: "rules", convert: convertRules("damage-type") },
  { file: "5e-SRD-Weapon-Properties.json", sha256: "a881e9fd8de5e332483871aa9a4e66756cef305582f96a5ff26198477a833db2", out: "rules", convert: convertRules("weapon-property") },
  { file: "5e-SRD-Weapon-Mastery-Properties.json", sha256: "0932ec552adfc63fdf87d8e5c3fad4035a728092c78e1c8a32a8712c4ce6d969", out: "rules", convert: convertRules("weapon-mastery") },
  { file: "5e-SRD-Alignments.json", sha256: "9dddd583e53ba11cef7f377384d5bd78e050fbaf67b093eed811ac41a65e5ba5", out: "rules", convert: convertRules("alignment") },
  { file: "5e-SRD-Ability-Scores.json", sha256: "27f117bcef477273774f8e1c6554ac6a4d2e43551d5a2cb6d4277fb0945e0a6e", out: "rules", convert: convertRules("ability-score") },
];
const outDir = fileURLToPath(new URL("../src/data/srd/", import.meta.url));
const localDir = process.argv[2];

await mkdir(outDir, { recursive: true });
const outputs = new Map();
for (const s of SOURCES) {
  const url = `https://raw.githubusercontent.com/${REPO}/${COMMIT}/src/2024/en/${s.file}`;
  const bytes = localDir ? await readFile(`${localDir.replace(/\/$/, "")}/${s.file}`) : Buffer.from(await (await fetch(url)).arrayBuffer());
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== s.sha256) throw new Error(`${s.file}: source hash mismatch: got ${hash}, expected ${s.sha256}`);
  outputs.set(s.out, [...(outputs.get(s.out) ?? []), ...s.convert(JSON.parse(bytes.toString("utf8")))]);
}
for (const [out, list] of outputs) {
  await writeFile(`${outDir}${out}.json`, JSON.stringify(list) + "\n");
  console.log(`Wrote ${list.length} entries to src/data/srd/${out}.json`);
}
