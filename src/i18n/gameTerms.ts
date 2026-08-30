import type { Locale } from "./locales";
import type { MessageKey } from "./messages.en";
import { messagesEn } from "./messages.en";
import { messagesZhCn } from "./messages.zh-CN";

export const TRAILBLAZER_TERMS = {
  en: messagesEn["terms.trailblazer"],
  "zh-CN": messagesZhCn["terms.trailblazer"],
} as const satisfies Record<Locale, string>;

export const KNOWN_PATH_MESSAGE_KEYS = {
  destruction: "terms.path.destruction",
  hunt: "terms.path.hunt",
  erudition: "terms.path.erudition",
  harmony: "terms.path.harmony",
  nihility: "terms.path.nihility",
  preservation: "terms.path.preservation",
  abundance: "terms.path.abundance",
  remembrance: "terms.path.remembrance",
  elation: "terms.path.elation",
} as const satisfies Record<string, MessageKey>;
