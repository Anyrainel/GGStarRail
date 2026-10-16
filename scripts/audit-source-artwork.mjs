import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const { values } = parseArgs({
  options: {
    output: { type: "string", default: "test-results/artwork-audit" },
  },
});
const output = path.resolve(root, values.output);
const directory = path.join(root, "data/source-assets");
const manifest = JSON.parse(
  await readFile(path.join(directory, "manifest.json"), "utf8")
);
const groups = new Map();
const entries = [];
const unavailable = [];
for (const entry of manifest.entries) {
  if (entry.availability === "unavailable") {
    unavailable.push(entry);
    continue;
  }
  const source = path.join(directory, entry.path);
  const bytes = await readFile(source);
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== entry.sha256)
    throw new Error(`Artwork checksum mismatch: ${entry.kind}:${entry.id}`);
  const metadata = await sharp(bytes).metadata();
  const key = `${entry.kind}:${entry.variant ?? "default"}`;
  const group = groups.get(key) ?? {
    count: 0,
    bytes: 0,
    dimensions: {},
    hosts: {},
  };
  const dimensions = `${metadata.width}×${metadata.height}`;
  const host = new URL(entry.source_url).hostname;
  group.count++;
  group.bytes += bytes.length;
  group.dimensions[dimensions] = (group.dimensions[dimensions] ?? 0) + 1;
  group.hosts[host] = (group.hosts[host] ?? 0) + 1;
  groups.set(key, group);
  entries.push({
    kind: entry.kind,
    id: entry.id,
    variant: entry.variant ?? "default",
    width: metadata.width,
    height: metadata.height,
    alpha: metadata.hasAlpha,
    bytes: bytes.length,
    source_url: entry.source_url,
    path: entry.path,
  });
}
await mkdir(output, { recursive: true });
const summary = {
  sourceRevision: manifest.source_revision,
  groups: Object.fromEntries(groups),
  entries,
  unavailable,
};
await writeFile(
  path.join(output, "dimensions.json"),
  `${JSON.stringify(summary, null, 2)}\n`
);
const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
const url = (entry) =>
  path
    .relative(output, path.join(directory, entry.path))
    .split(path.sep)
    .join("/");
const image = (entry, className = "") =>
  entry
    ? `<img class="${className}" src="${escapeHtml(url(entry))}" alt="${entry.id} ${entry.variant}">`
    : "—";
const find = (kind, id, variant) =>
  entries.find(
    (entry) =>
      entry.kind === kind && entry.id === id && entry.variant === variant
  );
const ids = ["1001", "1207", "1215", "1317", "1401", "8005", "8006", "1511"];
const characterRows = ids
  .map((id) => {
    const avatar = find("character", id, "avatar");
    const round = find("character", id, "round");
    if (!avatar) return "";
    return `<tr><th>${id}<small>${avatar.width}×${avatar.height}</small></th><td>${image(avatar, "native")}</td><td><div class="frame aligned">${image(avatar, "cover")}</div></td><td><div class="frame square">${image(avatar, "cover")}</div></td><td>${image(round, "round")}</td></tr>`;
  })
  .join("");
const cones = ["20000", "21000", "23001", "22009", "23065"]
  .map((id) => {
    const portrait = find("light-cone", id, "portrait");
    const icon = find("light-cone", id, "icon");
    if (!portrait) return "";
    return `<tr><th>${id}<small>${portrait.width}×${portrait.height}</small></th><td>${image(portrait, "native")}</td><td><div class="frame aligned cone-aligned">${image(portrait)}</div></td><td><div class="frame square cone-square">${image(portrait)}</div></td><td>${image(icon, "native")}<small>${icon ? `${icon.width}×${icon.height}` : ""}</small></td></tr>`;
  })
  .join("");
const table = (rows, last) =>
  `<table><thead><tr><th>ID / source pixels</th><th>Native, width 80</th><th>Aligned, 80×94</th><th>Square, 80×80</th><th>${last}</th></tr></thead><tbody>${rows}</tbody></table>`;
const document = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Nanoka artwork review</title><style>
body{font:16px system-ui;margin:24px;background:#192731;color:#e8edf1}h1{font-size:24px}table{border-collapse:collapse;width:100%;max-width:960px;margin-bottom:32px}th,td{border:1px solid #64727c;text-align:center;padding:12px}td{width:160px}small{display:block;color:#b2bec7;font-size:12px;margin-top:4px}img{display:block;margin:auto}img.native{width:80px;height:auto}.frame{position:relative;overflow:hidden;border-radius:10px;background:linear-gradient(#a35d55,#d0aa6e);margin:auto;width:80px}.aligned{height:94px}.square{height:80px}.cover{width:100%;height:100%;object-fit:cover;object-position:center}.cone-aligned img{width:auto;height:100%}.cone-square img{position:absolute;width:90%;height:auto;max-width:none;left:50%;top:50%;transform:translate(-50%,-50%)}img.round{width:80px;height:80px;object-fit:contain}
</style><h1>Nanoka original assets and proposed display modes</h1><p>All frames use the same 80px width. Character aligned ratio follows 160×188. Source WebPs are displayed directly.</p>${table(characterRows, "Native Round Icon")}${table(cones, "Native tilted Icon")}</html>`;
await writeFile(path.join(output, "index.html"), document);
await writeFile(
  path.join(output, "overview.html"),
  document
    .replace(characterRows, `${characterRows.split("</tr>")[0]}</tr>`)
    .replace(cones, `${cones.split("</tr>")[2]}</tr>`)
);
console.log(JSON.stringify({ output, groups: summary.groups }, null, 2));
