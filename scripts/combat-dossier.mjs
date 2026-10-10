#!/usr/bin/env node
// Translation dossier for combat kits: game text with resolved parameters,
// catalog IDs, per-skill combat facts, the current kit file, and tracker
// items. Run `npm run data:restore` first.
//
//   node scripts/combat-dossier.mjs C 1102     Character
//   node scripts/combat-dossier.mjs L 23001    Light Cone
//   node scripts/combat-dossier.mjs R 108      Relic set
//   node scripts/combat-dossier.mjs list C|L|R [--missing]
//
// Toughness, Energy, and Skill Point facts come from TurnBasedGameData at
// the revision pinned in data-bundle.lock.json, cached under .cache/.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gameDir = path.join(root, "src/data/game");
const implDir = path.join(root, "src/domain/combat/impl");
const trackerDir = path.join(root, "docs/combat/tracker");
const KIT_DIRS = { C: "characters", L: "lightCones", R: "relicSets" };

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function member(name) {
  const stats = readJson(path.join(gameDir, `${name}_stats.json`)).value;
  const en = readJson(path.join(gameDir, `${name}_en.json`));
  const zh = readJson(path.join(gameDir, `${name}_zh.json`));
  const text = (map, pointer) => {
    const value = map[pointer];
    return typeof value === "object" && value !== null ? value.value : value;
  };
  const resolve = (value) => {
    if (Array.isArray(value)) return value.map(resolve);
    if (value && typeof value === "object") {
      if ("$text" in value) {
        return { en: text(en, value.$text), zh: text(zh, value.$text) };
      }
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, resolve(entry)])
      );
    }
    return value;
  };
  return resolve(stats);
}

function clean(textValue) {
  return (textValue ?? "")
    .replace(/<\/?(color|u|unbreak|i|b)[^>]*>/g, "")
    .replaceAll("\\n", " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatParam(value, format) {
  if (value === undefined) return "?";
  if (format.startsWith("f"))
    return (value * 100).toFixed(Number(format.slice(1)));
  return Number.isInteger(value)
    ? String(value)
    : String(Number(value.toFixed(4)));
}

/** "#2[i]%" → "#2[i]% (=25%)" using the given parameter row. */
function annotate(textValue, parameters) {
  return clean(textValue).replace(
    /#(\d+)\[(\w+)\](%?)/g,
    (match, index, format, percent) => {
      const value = parameters?.[Number(index) - 1];
      if (value === undefined) return match;
      const shown = percent
        ? `${formatParam(value * 100, format.startsWith("f") ? "i" : "i")}%`
        : formatParam(value, format);
      return `${match}(=${percent ? `${Number((value * 100).toFixed(2))}%` : shown})`;
    }
  );
}

function slug(name) {
  return (name ?? "unknown")
    .normalize("NFKD")
    .replace(/<[^>]+>/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

function kitFile(kind, id) {
  const dir = path.join(implDir, KIT_DIRS[kind]);
  if (!existsSync(dir)) return null;
  const file = readdirSync(dir).find((entry) => entry.startsWith(`${id}-`));
  return file ? path.join(dir, file) : null;
}

async function combatFacts() {
  const lock = readJson(path.join(root, "data-bundle.lock.json"));
  const revision = lock.sourceRevision;
  const cacheDir = path.join(root, ".cache/combat-facts", revision);
  mkdirSync(cacheDir, { recursive: true });
  const facts = new Map();
  for (const table of ["AvatarSkillConfig", "AvatarServantSkillConfig"]) {
    const file = path.join(cacheDir, `${table}.json`);
    if (!existsSync(file)) {
      const url = `https://raw.githubusercontent.com/DimbreathBot/TurnBasedGameData/${revision}/ExcelOutput/${table}.json`;
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(String(response.status));
        writeFileSync(file, await response.text());
      } catch (error) {
        console.error(`(combat facts unavailable: ${table} ${error.message})`);
        continue;
      }
    }
    for (const row of readJson(file)) {
      if (row.Level !== 1) continue;
      const stance = (row.ShowStanceList ?? []).map(
        (entry) => (entry.Value ?? 0) / 3
      );
      facts.set(String(row.SkillID), {
        attackType: row.AttackType ?? null,
        effect: row.SkillEffect ?? null,
        energy: row.SPBase?.Value ?? 0,
        skillPointCost: Math.max(0, row.BPNeed?.Value ?? 0),
        skillPointGain: row.BPAdd?.Value ?? 0,
        ultimateCost: row.SPNeed?.Value ?? null,
        toughness: {
          main: stance[0] ?? 0,
          each: stance[1] ?? 0,
          adjacent: stance[2] ?? 0,
        },
      });
    }
  }
  return facts;
}

function trackerItems(entity) {
  if (!existsSync(trackerDir)) return [];
  const items = [];
  for (const file of readdirSync(trackerDir).filter((entry) =>
    entry.endsWith(".yaml")
  )) {
    const content = readFileSync(path.join(trackerDir, file), "utf8");
    for (const block of content.split(/\n(?=- id:)/)) {
      if (new RegExp(`^\\s*entity: "?${entity}"?\\s*$`, "m").test(block)) {
        items.push(`${file}:\n${block.trim()}`);
      }
    }
  }
  return items;
}

const LEVELED = {
  "001": 6,
  "002": 10,
  "003": 10,
  "004": 10,
  301: 6,
  302: 6,
  420: 10,
};
const TRACE_KIND = {
  "001": "basic",
  "002": "skill",
  "003": "ultimate",
  "004": "talent",
  "007": "technique",
  301: "memospriteSkill",
  302: "memospriteTalent",
  420: "elationSkill",
};

async function character(id) {
  const data = member("characters").find((entry) => entry.id === id);
  if (!data) throw new Error(`Unknown Character ${id}`);
  const facts = await combatFacts();
  const out = [];
  out.push(`# Character ${id} — ${data.name.en} / ${data.name.zh}`);
  out.push(
    `${data.rarity}★ ${data.path_id} ${data.combat_type_id} · max Energy ${data.max_energy} · release ${data.release_version}`
  );
  const kit = kitFile("C", id);
  out.push(
    `Kit file: ${kit ? path.relative(root, kit) : `(none) src/domain/combat/impl/characters/${id}-${slug(data.name.en)}.ts`}`
  );
  out.push(
    `Trace stats (applied from data): ${JSON.stringify(data.trace_stats)}`
  );
  const kindBySkill = new Map();
  for (const trace of data.traces) {
    const suffix = trace.id.slice(id.length);
    for (const skillId of trace.skill_ids)
      kindBySkill.set(skillId, {
        kind: TRACE_KIND[suffix] ?? `trace${suffix}`,
        suffix,
      });
  }
  const skills = [
    ...data.skills,
    ...data.servants.flatMap((servant) =>
      servant.skills.map((skill) => ({ ...skill, servant: servant.id }))
    ),
  ];
  out.push(
    "\n## Abilities (param(skillId, n) reads #n at the effective level)"
  );
  for (const skill of skills) {
    if (
      skill.name?.en === "Attack" &&
      !skill.levels.some((row) => row.parameters.length)
    )
      continue;
    const mapped = kindBySkill.get(skill.id);
    const normal = LEVELED[mapped?.suffix] ?? 1;
    const levels = skill.levels;
    const at = (level) =>
      levels[Math.min(level, levels.length) - 1]?.parameters ?? [];
    out.push(
      `\n### ${skill.id} · ${mapped?.kind ?? "unmapped"}${skill.servant ? ` (servant ${skill.servant})` : ""} · ${skill.type_description?.en ?? "-"} | ${skill.tag?.en ?? "-"} · ${skill.name?.en} / ${skill.name?.zh}`
    );
    out.push(`levels 1..${levels.length}; normal max ${normal}`);
    out.push(
      `EN@L${Math.min(normal, levels.length)}: ${annotate(skill.description?.en, at(normal))}`
    );
    out.push(`ZH: ${clean(skill.description?.zh)}`);
    out.push(
      `params L${Math.min(normal, levels.length)}: ${JSON.stringify(at(normal))}`
    );
    if (levels.length > normal) {
      out.push(
        `params L${levels.length} (Eidolon-boosted max): ${JSON.stringify(at(levels.length))}`
      );
    }
    const fact = facts.get(skill.id);
    if (fact) {
      const t = fact.toughness;
      out.push(
        `facts: type=${fact.attackType} shape=${fact.effect} energy=${fact.energy} SP-cost=${fact.skillPointCost} SP-gain=${fact.skillPointGain}${fact.ultimateCost ? ` ult-cost=${fact.ultimateCost}` : ""} toughness main=${t.main} each=${t.each} adjacent=${t.adjacent}`
      );
    }
  }
  out.push("\n## Bonus Abilities (k.a(n), k.traceParam(n, i))");
  data.traces
    .filter((trace) => trace.point_type === 3)
    .forEach((trace, index) => {
      const parameters = trace.levels[0]?.parameters ?? [];
      out.push(
        `A${(index + 1) * 2} (n=${index + 1}) ${trace.id} ${trace.name?.en} / ${trace.name?.zh}`
      );
      out.push(`  EN: ${annotate(trace.description?.en, parameters)}`);
      out.push(`  ZH: ${clean(trace.description?.zh)}`);
    });
  out.push("\n## Eidolons (k.e(n), k.rankParam(n, i))");
  for (const rank of data.ranks) {
    out.push(`E${rank.rank} ${rank.name?.en} / ${rank.name?.zh}`);
    out.push(`  EN: ${annotate(rank.description?.en, rank.parameters)}`);
    out.push(`  ZH: ${clean(rank.description?.zh)}`);
  }
  appendCommon(out, id, kit);
  return out.join("\n");
}

function lightCone(id) {
  const data = member("light_cones").find((entry) => entry.id === id);
  if (!data) throw new Error(`Unknown Light Cone ${id}`);
  const out = [`# Light Cone ${id} — ${data.name.en} / ${data.name.zh}`];
  out.push(`${data.rarity}★ ${data.path_id} · release ${data.release_version}`);
  const kit = kitFile("L", id);
  out.push(
    `Kit file: ${kit ? path.relative(root, kit) : `(none) src/domain/combat/impl/lightCones/${id}-${slug(data.name.en)}.ts`}`
  );
  const effect = data.effect;
  out.push(
    `\n## ${effect.name.en} / ${effect.name.zh} (k.s(i) reads #i at the Superimposition)`
  );
  out.push(
    `EN@S1: ${annotate(effect.description.en, effect.superimpositions[0]?.parameters)}`
  );
  out.push(`ZH: ${clean(effect.description.zh)}`);
  for (const row of effect.superimpositions) {
    out.push(
      `S${row.level}: params ${JSON.stringify(row.parameters)} · properties (applied from data) ${JSON.stringify(row.properties)}`
    );
  }
  appendCommon(out, id, kit);
  return out.join("\n");
}

function relicSet(id) {
  const data = member("relic_sets").find((entry) => entry.id === id);
  if (!data) throw new Error(`Unknown Relic set ${id}`);
  const out = [
    `# Relic set ${id} — ${data.name.en} / ${data.name.zh} (${data.kind})`,
  ];
  const kit = kitFile("R", id);
  out.push(
    `Kit file: ${kit ? path.relative(root, kit) : `(none) src/domain/combat/impl/relicSets/${id}-${slug(data.name.en)}.ts`}`
  );
  for (const bonus of data.bonuses) {
    out.push(`\n## ${bonus.required_pieces}-piece (k.param(i))`);
    out.push(`EN: ${annotate(bonus.description.en, bonus.parameters)}`);
    out.push(`ZH: ${clean(bonus.description.zh)}`);
    out.push(
      `params ${JSON.stringify(bonus.parameters)} · properties (applied from data) ${JSON.stringify(bonus.properties)}`
    );
  }
  appendCommon(out, id, kit);
  return out.join("\n");
}

function appendCommon(out, id, kit) {
  const items = trackerItems(id);
  out.push(`\n## Tracker items (${items.length})`);
  for (const item of items) out.push(item);
  if (kit) {
    out.push(`\n## Current implementation (${path.relative(root, kit)})`);
    out.push(readFileSync(kit, "utf8"));
  }
}

function list(kind, missingOnly) {
  const name = { C: "characters", L: "light_cones", R: "relic_sets" }[kind];
  const rows = member(name);
  const lines = [];
  let implemented = 0;
  for (const row of rows) {
    const kit = kitFile(kind, row.id);
    if (kit) implemented += 1;
    if (missingOnly && kit) continue;
    const extra =
      kind === "C"
        ? `${row.rarity}★ ${row.path_id} ${row.combat_type_id} v${row.release_version}`
        : kind === "L"
          ? `${row.rarity}★ ${row.path_id}`
          : row.kind;
    lines.push(`${kit ? "✔" : "·"} ${row.id} ${row.name.en} — ${extra}`);
  }
  lines.push(`\n${implemented}/${rows.length} implemented`);
  return lines.join("\n");
}

const [mode, id, flag] = process.argv.slice(2);
try {
  if (mode === "list") console.log(list(id, flag === "--missing"));
  else if (mode === "C") console.log(await character(id));
  else if (mode === "L") console.log(lightCone(id));
  else if (mode === "R") console.log(relicSet(id));
  else {
    console.error(
      "Usage: combat-dossier.mjs C|L|R <id> | list C|L|R [--missing]"
    );
    process.exit(2);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
