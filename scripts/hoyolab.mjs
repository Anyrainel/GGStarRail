import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  crawlRoot,
  exactNameIndex,
  fetchBytes,
  mapConcurrent,
  plainName,
  referenceDocuments,
  root,
  saveJson,
  sha256,
  webpAsset,
} from "./crawl-common.mjs";

const api = "https://sg-wiki-api.hoyolab.com/hoyowiki/hsr/wapi";
const headers = {
  "x-rpc-wiki_app": "hsr",
  Origin: "https://wiki.hoyolab.com",
  Referer: "https://wiki.hoyolab.com/",
  "Content-Type": "application/json",
};
const menus = {
  characters: "104",
  light_cones: "107",
  relic_sets: "108",
  "progression.items": "110",
  achievements: "134",
};

async function request(endpoint, locale, body) {
  const bytes = await fetchBytes(`${api}/${endpoint}`, {
    headers: { ...headers, "x-rpc-language": locale },
    ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
  });
  const response = JSON.parse(bytes);
  if (response.retcode !== 0 || !response.data)
    throw new Error(
      `HoYoWiki ${endpoint}: ${response.retcode} ${response.message}`
    );
  return { data: response.data, sha256: sha256(bytes) };
}

export function releasedPage(page) {
  return page.beta === false && page.status === "Online";
}

export function characterMatches(item, records, locale) {
  const paths = {
    Warrior: "destruction",
    Knight: "preservation",
    Rogue: "hunt",
    Mage: "erudition",
    Shaman: "harmony",
    Warlock: "nihility",
    Priest: "abundance",
    Memory: "memory",
    Elation: "elation",
  };
  const combat =
    item.filter_values?.character_combat_type?.value_types?.map(
      (v) => v.enum_string
    ) ?? [];
  const pathValues =
    item.filter_values?.character_paths?.value_types?.map(
      (v) => v.enum_string
    ) ?? [];
  const name = plainName(item.name);
  const trailblazer = /^(Trailblazer|开拓者)(?:\s|[-:·（(]|$)/.test(name);
  return records
    .filter((record) => {
      const expected = plainName(record.name[locale].value);
      const nameMatches = trailblazer
        ? expected === "{NICKNAME}"
        : name === expected ||
          (expected === "March 7th" && name.startsWith("March 7th:")) ||
          (expected === "三月七" && /^三月七[·：（(]/.test(name));
      const element =
        record.combat_type_id === "Thunder"
          ? "lightning"
          : record.combat_type_id.toLowerCase();
      return (
        nameMatches &&
        combat.includes(element) &&
        pathValues.includes(paths[record.path_id])
      );
    })
    .map((record) => String(record.id));
}

export function achievementHeadings(page) {
  const result = [];
  for (const module of page.modules ?? []) {
    if (module.is_hidden) continue;
    for (const component of module.components ?? []) {
      const data = JSON.parse(component.data);
      if (typeof data.data !== "string") continue;
      for (const match of data.data.matchAll(
        /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/g
      )) {
        const name = plainName(match[1])
          .replace(/^【(?:Hidden|隐藏)】\s*/, "")
          .replace(/&amp;/g, "&")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&nbsp;/g, " ");
        if (name) result.push(name);
      }
    }
  }
  return result;
}

export async function crawlHoyolab({
  referenceRoot,
  output = path.join(crawlRoot, "hoyolab.json"),
  images = true,
} = {}) {
  const { manifest, documents } = await referenceDocuments(referenceRoot);
  const entries = [];
  const unmatched = [];
  for (const [collection, menu] of Object.entries(menus)) {
    const records =
      collection === "progression.items"
        ? documents.progression.items
        : documents[collection];
    const index = exactNameIndex(records);
    const candidates = new Map();
    for (const [language, locale] of [
      ["en-us", "en"],
      ["zh-cn", "zh-CN"],
    ]) {
      let total = Infinity;
      let seen = 0;
      for (let number = 1; seen < total; number++) {
        const { data } = await request("get_entry_page_list", language, {
          filters: [],
          menu_id: menu,
          page_num: number,
          page_size: 30,
          use_es: true,
        });
        if (!Array.isArray(data.list) || !Number.isFinite(Number(data.total)))
          throw new Error(
            `Invalid HoYoWiki pagination: ${collection}/${language}`
          );
        total = Number(data.total);
        if (!data.list.length && seen < total)
          throw new Error(
            `Truncated HoYoWiki pagination: ${collection}/${language}`
          );
        seen += data.list.length;
        for (const item of data.list) {
          if (collection === "achievements") {
            const response = await request(
              `entry_page?entry_page_id=${item.entry_page_id}`,
              language
            );
            const page = response.data.page;
            if (!releasedPage(page)) continue;
            for (const name of achievementHeadings(page)) {
              const matches = index.get(`${locale}:${name}`);
              if (matches?.size !== 1) continue;
              const id = [...matches][0];
              if (
                !entries.some(
                  (entry) => entry.collection === collection && entry.id === id
                )
              )
                entries.push({
                  collection,
                  id,
                  source: "hoyolab",
                  url: `https://wiki.hoyolab.com/pc/hsr/entry/${item.entry_page_id}`,
                  sha256: response.sha256,
                  beta: false,
                  status: "Online",
                });
            }
            await saveJson(
              path.join(
                crawlRoot,
                "hoyolab-pages",
                `${item.entry_page_id}-${locale}.json`
              ),
              response.data
            );
            continue;
          }
          const ids =
            collection === "characters"
              ? new Set(characterMatches(item, records, locale))
              : index.get(`${locale}:${plainName(item.name)}`);
          const protagonistPair =
            collection === "characters" &&
            ids?.size === 2 &&
            [...ids].every(
              (id) =>
                records.find((record) => record.id === id)?.name.en.value ===
                "{NICKNAME}"
            );
          if (ids?.size !== 1 && !protagonistPair) {
            unmatched.push({
              collection,
              locale,
              page_id: item.entry_page_id,
              reason: ids?.size ? "ambiguous-name" : "not-in-reference",
            });
            continue;
          }
          for (const id of ids) {
            const previous = candidates.get(id);
            if (previous && previous.page_id !== item.entry_page_id)
              throw new Error(
                `Conflicting HoYoWiki pages for ${collection}:${id}`
              );
            candidates.set(id, {
              id,
              page_id: item.entry_page_id,
              locale: language,
            });
          }
        }
      }
    }
    const found = await mapConcurrent(
      [...candidates.values()],
      async (candidate) => {
        const endpoint = `entry_page?entry_page_id=${encodeURIComponent(candidate.page_id)}`;
        const response = await request(endpoint, candidate.locale);
        const page = response.data.page;
        if (!page || String(page.id) !== String(candidate.page_id))
          throw new Error(
            `HoYoWiki page identity mismatch: ${candidate.page_id}`
          );
        const entry = {
          collection,
          id: candidate.id,
          source: "hoyolab",
          url: `https://wiki.hoyolab.com/pc/hsr/entry/${candidate.page_id}`,
          sha256: response.sha256,
          beta: page.beta,
          status: page.status,
        };
        await saveJson(
          path.join(
            crawlRoot,
            "hoyolab-pages",
            `${candidate.page_id}-${candidate.id}.json`
          ),
          response.data
        );
        if (images && releasedPage(page) && page.icon_url)
          entry.asset = await webpAsset(page.icon_url);
        return entry;
      }
    );
    entries.push(...found);
    console.log(
      `HoYoWiki ${collection}: ${entries.filter((entry) => entry.collection === collection && releasedPage(entry)).length} explicit non-beta records, ${records.length} normalized records`
    );
  }
  entries.sort((a, b) =>
    `${a.collection}:${a.id}`.localeCompare(`${b.collection}:${b.id}`, "en")
  );
  const evidence = {
    schema_version: "1.0.0",
    source_revision: manifest.source.revision,
    entries,
    unmatched,
  };
  await saveJson(output, evidence);
  return evidence;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const args = process.argv.slice(2);
  const sourceIndex = args.indexOf("--reference-root");
  const referenceRoot =
    sourceIndex < 0
      ? path.resolve(root, "../GIlore/data/reference/honkai_star_rail/v1")
      : args[sourceIndex + 1];
  if (args.includes("--help")) {
    console.log(
      "node scripts/hoyolab.mjs [--reference-root DIR] [--no-images]"
    );
  } else {
    await crawlHoyolab({
      referenceRoot,
      images: !args.includes("--no-images"),
    });
  }
}
