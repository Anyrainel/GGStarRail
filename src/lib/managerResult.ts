import {
  type AccountSnapshot,
  AccountSnapshotSchema,
} from "@/domain/account/schemas";
import {
  type ManagerInstructionEnvelope,
  matcherForRelic,
} from "./managerInstructions";
import type { ScannerResult } from "./scannerManager";

/** Update only positively verified changes for the unchanged submitting account.
 * This is a state patch, never an inventory replacement or an identity merge. */
export function reconcileManagerResult(
  account: AccountSnapshot,
  envelope: ManagerInstructionEnvelope,
  result: ScannerResult
): AccountSnapshot {
  const definitions = new Map(
    account.characters.map((character) => [
      character.key,
      character.definitionId,
    ])
  );
  const relics = [...account.relics];
  for (const entry of result.entries) {
    if (entry.status !== "verified") continue;
    const instruction = envelope.instructions.find(
      (item) => item.id === entry.instructionId
    );
    if (
      !instruction ||
      instruction.desired[entry.change.field] !== entry.change.desired ||
      instruction.before[entry.change.field] !== entry.change.before
    )
      continue;
    const matches = account.relics.flatMap((relic, index) => {
      const location = relic.equippedCharacterKey
        ? (definitions.get(relic.equippedCharacterKey) ?? null)
        : null;
      return JSON.stringify(matcherForRelic(relic, location)) ===
        JSON.stringify(instruction.matcher)
        ? [index]
        : [];
    });
    if (matches.length !== 1) continue;
    const index = matches[0];
    const before = account.relics[index];
    if (
      before.equippedCharacterKey ||
      before.locked !== instruction.before.lock ||
      before.discarded !== instruction.before.discard
    )
      continue;
    relics[index] = {
      ...relics[index],
      [entry.change.field === "lock" ? "locked" : "discarded"]:
        entry.change.desired,
    };
  }
  return AccountSnapshotSchema.parse({ ...account, relics });
}
