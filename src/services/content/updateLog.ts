import type { Locale } from "@/i18n/locales";

interface UpdateSection {
  category: "features" | "fixes";
  items: string[];
}

interface UpdateHistory {
  roadmap: string[];
  entries: { date: string; sections: UpdateSection[] }[];
}

export function parseUpdateLog(raw: string): UpdateHistory {
  const history: UpdateHistory = { roadmap: [], entries: [] };
  let roadmap = false;
  let entry: UpdateHistory["entries"][number] | undefined;
  let section: UpdateSection | undefined;
  for (const rawLine of raw.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line === "## roadmap") {
      roadmap = true;
      entry = undefined;
      section = undefined;
    } else if (/^## \d{4}-\d{2}-\d{2}$/.test(line)) {
      roadmap = false;
      entry = { date: line.slice(3), sections: [] };
      history.entries.push(entry);
      section = undefined;
    } else if (line === "### features" || line === "### fixes") {
      if (!entry) throw new Error("Update section requires a dated entry");
      section = {
        category: line === "### features" ? "features" : "fixes",
        items: [],
      };
      entry.sections.push(section);
    } else if (line.startsWith("- ")) {
      if (roadmap) history.roadmap.push(line.slice(2));
      else if (section) section.items.push(line.slice(2));
      else throw new Error("Update bullet requires a section");
    } else {
      throw new Error(`Invalid update log line: ${line}`);
    }
  }
  return history;
}

// Entries are added after editorial approval. An absent first log is expected.
const files = import.meta.glob<string>("../../content/updatelog/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

export const updateLogs: Record<Locale, UpdateHistory> = {
  en: parseUpdateLog(files["../../content/updatelog/en.md"] ?? ""),
  "zh-CN": parseUpdateLog(files["../../content/updatelog/zh-CN.md"] ?? ""),
};
