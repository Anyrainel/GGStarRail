import { parseArgs } from "node:util";
import { crawlHoyolab } from "./hoyolab.mjs";
import { crawlNanoka } from "./nanoka.mjs";

const { values } = parseArgs({
  options: {
    "reference-root": { type: "string" },
    evidence: { type: "string" },
    "nanoka-root": { type: "string" },
  },
});
for (const name of ["reference-root", "evidence", "nanoka-root"])
  if (!values[name]) throw new Error(`--${name} is required`);

await crawlHoyolab({
  referenceRoot: values["reference-root"],
  output: values.evidence,
});
await crawlNanoka({
  evidencePath: values.evidence,
  outputRoot: values["nanoka-root"],
});
