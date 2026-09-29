import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { reusableWebpAsset, sha256 } from "./crawl-common.mjs";
import {
  currencyWarAssetKinds,
  currencyWarAssetRequests,
  currencyWarIconUrl,
} from "./currency-war-assets.mjs";
import {
  achievementHeadings,
  characterMatches,
  crawlHoyolab,
  releasedPage,
} from "./hoyolab.mjs";
import { nanokaVersion } from "./nanoka.mjs";
import { trailblazerPortraitFrame } from "./trailblazer-assets.mjs";

for (const script of ["sync-hsr-reference.mjs", "sync-hsr-assets.mjs"])
  test(`${script} requires an explicit bundle instead of finding a producer`, () => {
    const result = spawnSync(
      process.execPath,
      [path.join(import.meta.dirname, script)],
      {
        cwd: os.tmpdir(),
        encoding: "utf8",
      }
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /--source is required/);
  });

for (const script of ["source-evidence.mjs", "publish-source-assets.mjs"])
  test(`${script} rejects missing input paths before acquisition`, () => {
    const result = spawnSync(
      process.execPath,
      [path.join(import.meta.dirname, script)],
      {
        cwd: os.tmpdir(),
        encoding: "utf8",
      }
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /--reference-root is required/);
  });

test("Trailblazer portraits select the audited gender frame including reversed Harmony order", () => {
  assert.equal(trailblazerPortraitFrame("8001"), 0);
  assert.equal(trailblazerPortraitFrame("8002"), 1);
  assert.equal(trailblazerPortraitFrame("8005"), 1);
  assert.equal(trailblazerPortraitFrame("8006"), 0);
  assert.equal(trailblazerPortraitFrame("8010"), 1);
  assert.equal(trailblazerPortraitFrame("1001"), undefined);
});

test("official page publication requires explicit non-beta status", () => {
  assert.equal(releasedPage({ status: "Online" }), false);
  assert.equal(releasedPage({ beta: false }), false);
  assert.equal(releasedPage({ status: "Online", beta: true }), false);
  assert.equal(releasedPage({ status: "Online", beta: false }), true);
});

test("March forms match explicit path and combat type rather than shared name", () => {
  const records = [
    {
      id: "1001",
      name: { en: { value: "March 7th" } },
      path_id: "Knight",
      combat_type_id: "Ice",
    },
    {
      id: "1224",
      name: { en: { value: "March 7th" } },
      path_id: "Rogue",
      combat_type_id: "Imaginary",
    },
  ];
  const entry = {
    name: "March 7th: The Hunt",
    filter_values: {
      character_paths: { value_types: [{ enum_string: "hunt" }] },
      character_combat_type: { value_types: [{ enum_string: "imaginary" }] },
    },
  };
  assert.deepEqual(characterMatches(entry, records, "en"), ["1224"]);
  assert.deepEqual(
    characterMatches({ ...entry, filter_values: {} }, records, "en"),
    []
  );
});

test("achievement evidence comes from visible headings, not arbitrary description mentions", () => {
  const page = {
    modules: [
      {
        components: [
          {
            data: JSON.stringify({
              data: "<h3><strong>【Hidden】A &amp; B</strong></h3><p>Future Achievement</p>",
            }),
          },
        ],
      },
      {
        is_hidden: true,
        components: [
          { data: JSON.stringify({ data: "<h3>Hidden module</h3>" }) },
        ],
      },
    ],
  };
  assert.deepEqual(achievementHeadings(page), ["A & B"]);
});

test("current reference collections produce bilingual release evidence offline", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ggsr-source-crawl-"));
  t.after(async () => {
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith("ggsr-source-crawl-"));
    await rm(directory, { recursive: true });
  });
  const referenceRoot = path.join(directory, "reference");
  await mkdir(referenceRoot);
  const names = {
    characters: [
      {
        id: "1001",
        name: { en: { value: "March 7th" }, "zh-CN": { value: "三月七" } },
        path_id: "Knight",
        combat_type_id: "Ice",
      },
    ],
    light_cones: [
      {
        id: "20000",
        name: { en: { value: "Arrows" }, "zh-CN": { value: "锋镝" } },
      },
    ],
    relic_sets: [
      {
        id: "101",
        name: { en: { value: "Test Set" }, "zh-CN": { value: "测试套装" } },
      },
    ],
    achievements: [
      {
        id: 4010101,
        name: { en: { value: "First Step" }, "zh-CN": { value: "第一步" } },
      },
    ],
    progression: {
      relic_main_affixes: [],
      relic_sub_affixes: [],
      relic_scoring: {},
    },
  };
  const files = {};
  for (const [name, value] of Object.entries(names)) {
    const filename = `${name}.json`;
    const bytes = JSON.stringify({ value });
    files[filename] = { sha256: sha256(bytes) };
    await writeFile(path.join(referenceRoot, filename), bytes);
  }
  await writeFile(
    path.join(referenceRoot, "manifest.json"),
    JSON.stringify({ source: { revision: "fixture-revision" }, files })
  );

  const menuNames = {
    104: "characters",
    107: "light_cones",
    108: "relic_sets",
    134: "achievements",
  };
  const pageIds = {
    characters: "1",
    light_cones: "2",
    relic_sets: "3",
    achievements: "4",
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const language = options.headers["x-rpc-language"];
    const chinese = language === "zh-cn";
    let data;
    if (String(url).endsWith("get_entry_page_list")) {
      const collection = menuNames[JSON.parse(options.body).menu_id];
      const record = names[collection][0];
      data = {
        total: 1,
        list: [
          {
            entry_page_id: pageIds[collection],
            name: record.name[chinese ? "zh-CN" : "en"].value,
            ...(collection === "characters"
              ? {
                  filter_values: {
                    character_combat_type: {
                      value_types: [{ enum_string: "ice" }],
                    },
                    character_paths: {
                      value_types: [{ enum_string: "preservation" }],
                    },
                  },
                }
              : {}),
          },
        ],
      };
    } else {
      const id = new URL(url).searchParams.get("entry_page_id");
      data = {
        page: {
          id,
          beta: false,
          status: "Online",
          modules:
            id === "4"
              ? [
                  {
                    components: [
                      {
                        data: JSON.stringify({
                          data: `<h3>${chinese ? "第一步" : "First Step"}</h3>`,
                        }),
                      },
                    ],
                  },
                ]
              : [],
        },
      };
    }
    return new Response(JSON.stringify({ retcode: 0, data }), { status: 200 });
  };
  try {
    const evidence = await crawlHoyolab({
      referenceRoot,
      output: path.join(directory, "evidence.json"),
      pageRoot: path.join(directory, "pages"),
      images: false,
    });
    assert.equal(evidence.source_revision, "fixture-revision");
    assert.deepEqual(
      evidence.entries.map((entry) => `${entry.collection}:${entry.id}`).sort(),
      [
        "achievements:4010101",
        "characters:1001",
        "light_cones:20000",
        "relic_sets:101",
      ]
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("incremental artwork reuse checks URL and cached bytes", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ggsr-image-cache-"));
  t.after(async () => {
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith("ggsr-image-cache-"));
    await rm(directory, { recursive: true });
  });
  const bytes = Buffer.from("verified WebP fixture");
  const hash = sha256(bytes);
  const asset = {
    source_url: "https://example.com/icon.webp",
    path: `webp/${hash}.webp`,
    sha256: hash,
    byte_count: bytes.length,
  };
  await mkdir(path.join(directory, "webp"));
  await writeFile(path.join(directory, asset.path), bytes);
  assert.deepEqual(
    await reusableWebpAsset(asset.source_url, undefined, asset, directory),
    asset
  );
  assert.equal(
    await reusableWebpAsset(
      "https://example.com/new.webp",
      undefined,
      asset,
      directory
    ),
    null
  );
  await writeFile(path.join(directory, asset.path), "corrupted");
  assert.equal(
    await reusableWebpAsset(asset.source_url, undefined, asset, directory),
    null
  );
});

test("Nanoka requires a version explicitly present in available snapshots", () => {
  assert.equal(
    nanokaVersion({ hsr: { latest: "4.5.52", available: ["4.5.52"] } }),
    "4.5.52"
  );
  assert.throws(() => nanokaVersion({ hsr: { latest: "../../data" } }));
  assert.throws(() =>
    nanokaVersion({ hsr: { latest: "4.5.52", available: [] } })
  );
});

test("Currency War artwork maps datamine namespaces without losing filename case", () => {
  const samples = [
    ["Equipment/350201", "equipment/350201"],
    ["GridItem/GridFight_WeaponBox1", "equipment/GridFight_WeaponBox1"],
    ["Portal/101", "portal/101"],
    ["AugmentBig/100101", "augmentbig/100101"],
    ["TraitIcon/Icon/1001", "icon/1001"],
  ];
  for (const [source, target] of samples)
    assert.equal(
      currencyWarIconUrl(`SpriteOutput/GridFight/${source}.png`),
      `https://static.nanoka.cc/assets/hsr/gridfight/${target}.webp`
    );
  for (const invalid of [
    null,
    "https://example.com/350201.png",
    "SpriteOutput/GridFight/Equipment/../Portal/101.png",
    "SpriteOutput/GridFight/Unknown/1001.png",
  ])
    assert.throws(() => currencyWarIconUrl(invalid));
});

test("Currency War artwork inventory validates source checksums and revision", async (t) => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "ggsr-currency-assets-")
  );
  t.after(async () => {
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith("ggsr-currency-assets-"));
    await rm(directory, { recursive: true });
  });
  const revision = "a".repeat(40);
  const files = {};
  for (const collection of Object.keys(currencyWarAssetKinds)) {
    const filename = `${collection}.json`;
    const bytes = JSON.stringify({
      collection,
      source_revision: revision,
      value: [
        {
          id: "1001",
          icon_path: "SpriteOutput/GridFight/Equipment/350201.png",
        },
      ],
    });
    files[filename] = { sha256: sha256(bytes) };
    await writeFile(path.join(directory, filename), bytes);
  }
  await writeFile(
    path.join(directory, "manifest.json"),
    JSON.stringify({ source: { revision }, files })
  );
  const result = await currencyWarAssetRequests(directory);
  assert.equal(result.source_revision, revision);
  assert.deepEqual(
    result.requests.map((entry) => entry.kind),
    Object.values(currencyWarAssetKinds)
  );

  const file = path.join(directory, "currency_war_bonds.json");
  const original = await readFile(file, "utf8");
  await writeFile(file, original.replace(revision, "b".repeat(40)));
  await assert.rejects(
    currencyWarAssetRequests(directory),
    /checksum mismatch/
  );
  files["currency_war_bonds.json"].sha256 = sha256(await readFile(file));
  await writeFile(
    path.join(directory, "manifest.json"),
    JSON.stringify({ source: { revision }, files })
  );
  await assert.rejects(
    currencyWarAssetRequests(directory),
    /Invalid Currency War reference/
  );
});
