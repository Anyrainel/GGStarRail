import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { sha256 } from "./crawl-common.mjs";
import {
  currencyWarAssetKinds,
  currencyWarAssetRequests,
  currencyWarIconUrl,
} from "./currency-war-assets.mjs";
import {
  achievementHeadings,
  characterMatches,
  releasedPage,
} from "./hoyolab.mjs";
import { nanokaVersion } from "./nanoka.mjs";

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
