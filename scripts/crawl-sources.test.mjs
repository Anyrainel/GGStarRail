import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { encodeArtwork, validateEncodedArtwork } from "./artwork-encoding.mjs";
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
import {
  acquireHoyowikiAvatarFallback,
  validateHoyowikiAvatarFallback,
  validateHoyowikiAvatarSource,
} from "./hoyowiki-avatar-fallback.mjs";
import { nanokaVersion } from "./nanoka.mjs";
import {
  cachedUnavailableArtwork,
  nanokaArtworkRequests,
  publishNanokaArtwork,
} from "./nanoka-assets.mjs";
import { sourceAssetVariant } from "./source-assets.mjs";

test("artwork compression bounds each image kind without losing alpha or upscaling", async () => {
  for (const [kind, variant, width, height, expectedWidth, expectedHeight] of [
    ["character", "avatar", 320, 376, 160, 188],
    ["character", "round", 256, 256, 128, 128],
    ["light-cone", "portrait", 904, 1260, 256, 357],
    ["light-cone", "icon", 348, 408, 256, 300],
    ["relic-piece", undefined, 512, 512, 256, 256],
    ["relic-set", undefined, 128, 128, 128, 128],
  ]) {
    const original = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 20, g: 100, b: 140, alpha: 0.5 },
      },
    })
      .png()
      .toBuffer();
    const result = await encodeArtwork(original, kind, variant);
    const entry = { kind, variant, id: "1001", ...result.fields };
    await validateEncodedArtwork(entry, result.bytes);
    assert.equal(entry.width, expectedWidth);
    assert.equal(entry.height, expectedHeight);
    assert.equal(entry.source_sha256, sha256(original));
    const stats = await sharp(result.bytes).stats();
    assert.equal(stats.channels[3].min, 128);
    assert.equal(stats.channels[3].max, 128);
    await assert.rejects(
      validateEncodedArtwork(
        { ...entry, encoding: "old-policy" },
        result.bytes
      ),
      /Invalid optimized artwork/
    );
  }
});

test("cached optimized Relic art preserves separate rarity IDs sharing one source", async (t) => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "ggsr-artwork-cache-")
  );
  t.after(async () => {
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    await rm(directory, { recursive: true });
  });
  const catalogRoot = path.join(directory, "catalog");
  const outputDirectory = path.join(directory, "artwork");
  await mkdir(catalogRoot);
  await mkdir(path.join(outputDirectory, "webp"), { recursive: true });
  const records = [
    {
      id: "31011",
      icon_path: "SpriteOutput/ItemIcon/RelicIcons/IconRelic_101_1.png",
    },
    {
      id: "41011",
      icon_path: "SpriteOutput/ItemIcon/RelicIcons/IconRelic_101_1.png",
    },
  ];
  const files = {};
  for (const collection of [
    "characters",
    "light_cones",
    "relic_sets",
    "relic_pieces",
  ]) {
    const bytes = Buffer.from(
      JSON.stringify({ value: collection === "relic_pieces" ? records : [] })
    );
    files[`${collection}.json`] = { sha256: sha256(bytes) };
    await writeFile(path.join(catalogRoot, `${collection}.json`), bytes);
  }
  await writeFile(
    path.join(catalogRoot, "manifest.json"),
    JSON.stringify({ source: { revision: "a".repeat(40) }, files })
  );
  const original = await sharp({
    create: { width: 32, height: 32, channels: 4, background: "transparent" },
  })
    .png()
    .toBuffer();
  const encoded = await encodeArtwork(original, "relic-piece");
  const assetPath = `webp/${encoded.fields.sha256}.webp`;
  await writeFile(path.join(outputDirectory, assetPath), encoded.bytes);
  const entries = nanokaArtworkRequests("relic_pieces", records).map(
    (request) => ({ ...request, ...encoded.fields, path: assetPath })
  );
  await writeFile(
    path.join(outputDirectory, "manifest.json"),
    JSON.stringify({ schema_version: "3.0.0", entries })
  );
  const result = await publishNanokaArtwork({
    catalogRoot,
    outputDirectory,
    cached: true,
  });
  assert.deepEqual(
    result.map((entry) => entry.id),
    ["31011", "41011"]
  );
  assert.equal(result[0].path, result[1].path);
});

for (const format of ["png", "webp"])
  test(`HoYoWiki fallback optimizes 160×188 ${format} with provenance`, async (t) => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "ggsr-avatar-fallback-")
    );
    t.after(async () => {
      assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
      await rm(directory, { recursive: true });
    });
    const original = await sharp({
      create: {
        width: 160,
        height: 188,
        channels: 4,
        background: { r: 13, g: 128, b: 211, alpha: 0.7 },
      },
    })
      .toFormat(format)
      .toBuffer();
    const request = nanokaArtworkRequests("characters", [{ id: "1507" }])[0];
    const page = {
      retcode: 0,
      data: {
        page: {
          id: "5217",
          name: "Mortenax Blade",
          beta: false,
          status: "Online",
          icon_url:
            "https://act-upload.hoyoverse.com/event-ugc-hoyowiki/avatar.png",
        },
      },
    };
    const fetchSource = async (url) =>
      url.includes("entry_page?")
        ? Buffer.from(JSON.stringify(page))
        : original;
    const asset = await acquireHoyowikiAvatarFallback(
      request,
      directory,
      fetchSource
    );
    assert.equal(asset.primary_source_url, request.source_url);
    assert.equal(asset.source_sha256, sha256(original));
    await validateHoyowikiAvatarFallback(asset, directory);
    const output = await readFile(path.join(directory, asset.path));
    assert.equal(asset.original_path, undefined);
    assert.deepEqual(
      await sharp(output)
        .ensureAlpha()
        .extractChannel("alpha")
        .raw()
        .toBuffer(),
      await sharp(original)
        .ensureAlpha()
        .extractChannel("alpha")
        .raw()
        .toBuffer()
    );
    assert.throws(
      () => validateHoyowikiAvatarSource({ ...asset, id: "1511" }),
      /Invalid HoYoWiki/
    );
    assert.throws(
      () => validateHoyowikiAvatarSource({ ...asset, width: 118 }),
      /Invalid HoYoWiki/
    );
    assert.throws(
      () =>
        validateHoyowikiAvatarSource({
          ...asset,
          source_url: "https://example.com/avatar.png",
        }),
      /Invalid HoYoWiki/
    );
    await writeFile(path.join(directory, asset.path), "corrupted");
    await assert.rejects(
      validateHoyowikiAvatarFallback(asset, directory),
      /Invalid optimized artwork|unsupported image format/
    );
  });

test("HoYoWiki fallback rejects mismatched portraits and leaves nonstandard Aha unavailable", async (t) => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "ggsr-avatar-fallback-")
  );
  t.after(async () => {
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    await rm(directory, { recursive: true });
  });
  const request = nanokaArtworkRequests("characters", [{ id: "1512" }])[0];
  const page = {
    retcode: 0,
    data: {
      page: {
        id: "6565",
        name: "Robin • Summeretto",
        beta: false,
        status: "Online",
        icon_url:
          "https://act-upload.hoyoverse.com/event-ugc-hoyowiki/avatar.png",
      },
    },
  };
  const wrongCrop = await sharp({
    create: { width: 118, height: 130, channels: 4, background: "transparent" },
  })
    .png()
    .toBuffer();
  await assert.rejects(
    acquireHoyowikiAvatarFallback(request, directory, async (url) =>
      url.includes("entry_page?")
        ? Buffer.from(JSON.stringify(page))
        : wrongCrop
    ),
    /must be 160×188/
  );
  page.data.page.name = "Robin";
  await assert.rejects(
    acquireHoyowikiAvatarFallback(request, directory, async () =>
      Buffer.from(JSON.stringify(page))
    ),
    /identity mismatch/
  );
  assert.equal(
    await acquireHoyowikiAvatarFallback(
      nanokaArtworkRequests("characters", [{ id: "1511" }])[0],
      directory,
      async () => {
        throw new Error("Must not fetch");
      }
    ),
    null
  );
});

test("Nanoka gallery variants keep distinct character and Light Cone artwork", () => {
  const character = nanokaArtworkRequests("characters", [{ id: "8005" }]);
  assert.deepEqual(
    character.map((entry) => [entry.variant, entry.source_url]),
    [
      [
        "avatar",
        "https://static.nanoka.cc/assets/hsr/avataricon/avatar/8005.webp",
      ],
      [
        "round",
        "https://static.nanoka.cc/assets/hsr/avatarroundicon/8005.webp",
      ],
    ]
  );
  const cone = nanokaArtworkRequests("light_cones", [{ id: "23001" }]);
  assert.deepEqual(
    cone.map((entry) => [entry.variant, entry.source_url]),
    [
      [
        "portrait",
        "https://static.nanoka.cc/assets/hsr/lightconemaxfigures/23001.webp",
      ],
      [
        "icon",
        "https://static.nanoka.cc/assets/hsr/lightconemediumicon/23001.webp",
      ],
    ]
  );
  const ornament = nanokaArtworkRequests("relic_pieces", [
    {
      id: "63015",
      icon_path: "SpriteOutput/ItemIcon/RelicIcons/IconRelic_301_5.png",
    },
  ]);
  assert.equal(
    ornament[0].source_url,
    "https://static.nanoka.cc/assets/hsr/relicfigures/IconRelic_301_5.webp"
  );
  assert.throws(() => nanokaArtworkRequests("characters", [{ id: "../1001" }]));
  assert.throws(() =>
    sourceAssetVariant({ kind: "character", id: "1001", variant: "portrait" })
  );
  assert.throws(() =>
    sourceAssetVariant({ kind: "relic-piece", id: "31011", variant: "icon" })
  );
});

test("cached Nanoka absence preserves only the same explicit unavailable variant", () => {
  const request = nanokaArtworkRequests("characters", [{ id: "1511" }])[0];
  const previous = {
    ...request,
    availability: "unavailable",
    source_http_status: 404,
  };
  assert.deepEqual(cachedUnavailableArtwork(request, previous, true), {
    availability: "unavailable",
    source_http_status: 404,
  });
  assert.equal(cachedUnavailableArtwork(request, previous, false), null);
  assert.throws(() =>
    cachedUnavailableArtwork(request, { ...previous, variant: "round" }, true)
  );
  assert.throws(() =>
    cachedUnavailableArtwork(
      request,
      { ...previous, source_url: "https://example.com/avatar.webp" },
      true
    )
  );
  assert.throws(() =>
    cachedUnavailableArtwork(
      request,
      { ...previous, path: "webp/unexpected.webp" },
      true
    )
  );
});

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
