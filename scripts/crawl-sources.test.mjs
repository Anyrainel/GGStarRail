import assert from "node:assert/strict";
import test from "node:test";
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
