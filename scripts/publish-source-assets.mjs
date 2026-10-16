import path from "node:path";
import { parseArgs } from "node:util";
import { root } from "./crawl-common.mjs";
import { publishCurrencyWarAssets } from "./currency-war-assets.mjs";
import { publishSourceAssets } from "./source-assets.mjs";

const { values } = parseArgs({
  options: {
    "reference-root": { type: "string" },
    evidence: { type: "string" },
    "nanoka-root": { type: "string" },
    cached: { type: "boolean", default: false },
  },
});
for (const name of ["reference-root", "evidence", "nanoka-root"])
  if (!values[name]) throw new Error(`--${name} is required`);

// The producer has already exported the website catalog, including partial
// Nanoka previews absent from its normalized primary-reference members.
await publishSourceAssets(
  path.join(root, "src/generated/catalog"),
  values.cached
);
await publishCurrencyWarAssets({
  referenceRoot: values["reference-root"],
  cached: values.cached,
});
