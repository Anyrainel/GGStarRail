import type { MessageKey } from "./messages.en";

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
