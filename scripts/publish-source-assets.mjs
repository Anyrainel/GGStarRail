import { parseArgs } from "node:util";
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

if (!values.cached)
  await publishSourceAssets(values["nanoka-root"], values.evidence);
await publishCurrencyWarAssets({
  referenceRoot: values["reference-root"],
  cached: values.cached,
});
