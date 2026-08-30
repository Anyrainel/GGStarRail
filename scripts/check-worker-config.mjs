import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(root, "wrangler.jsonc");
const source = fs.readFileSync(configPath, "utf8");

const requiredSnippets = [
  '"name": "ggstarrail-worker"',
  '"main": "worker/index.ts"',
  '"APP_ID": "ggstarrail-local"',
];
const missing = requiredSnippets.filter((snippet) => !source.includes(snippet));
if (missing.length > 0) {
  throw new Error(
    `Worker placeholder config is incomplete: ${missing.join(", ")}`
  );
}

const forbiddenProperty =
  /"(account_id|database_id|bucket_name|d1_databases|r2_buckets|kv_namespaces|routes?|secrets?)"\s*:/i;
if (forbiddenProperty.test(source)) {
  throw new Error(
    "Worker config must not contain live resource or secret fields"
  );
}

console.log("Worker placeholder config is independent and resource-free.");
