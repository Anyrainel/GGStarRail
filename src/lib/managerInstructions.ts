import { z } from "zod";
import type {
  AccountSnapshot,
  Relic,
  RelicSlot,
} from "@/domain/account/schemas";
import type { RelicTriageEvaluation } from "@/domain/build/evaluation";
import { assertNoSensitiveFields } from "./security";

const SAFE_MANAGER_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

const ManagerStatMatcherSchema = z
  .object({
    key: z.string().min(1),
    value: z.number().finite(),
  })
  .strict();

export const ManagerRelicMatcherSchema = z
  .object({
    key: z.string().min(1),
    gameId: z.number().int().positive(),
    setKey: z.string().min(1),
    locationKey: z.string().min(1).nullable(),
    rarity: z.number().int().min(1).max(5),
    slot: z.enum(["Head", "Hands", "Body", "Feet", "PlanarSphere", "LinkRope"]),
    level: z.number().int().min(0).max(15),
    mainStat: ManagerStatMatcherSchema,
    substats: z.array(ManagerStatMatcherSchema).max(4),
  })
  .strict();

export const ManagerInstructionSchema = z
  .object({
    id: z.string().min(1).max(128).regex(SAFE_MANAGER_IDENTIFIER),
    matcher: ManagerRelicMatcherSchema,
    before: z
      .object({
        lock: z.boolean().nullable(),
        discard: z.boolean().nullable(),
      })
      .strict(),
    desired: z
      .object({
        lock: z.boolean().optional(),
        discard: z.boolean().optional(),
      })
      .strict()
      .refine(
        ({ lock, discard }) =>
          Number(lock !== undefined) + Number(discard !== undefined) === 1,
        "A manager instruction must request exactly one state change"
      ),
  })
  .strict();

export const ManagerInstructionEnvelopeSchema = z
  .object({
    schema: z.literal("goodscanner.hsr.manager-instructions"),
    schemaVersion: z.literal(1),
    requestId: z.string().min(1).max(128).regex(SAFE_MANAGER_IDENTIFIER),
    idempotencyKey: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    reference: z
      .object({
        schemaVersion: z.literal(1),
        provider: z.literal("gilore.ggstarrail-reference"),
        revision: z.string().min(1),
      })
      .strict(),
    privacy: z
      .object({
        accountIdentifiersIncluded: z.literal(false),
        rawPacketDataIncluded: z.literal(false),
        serverItemIdentifiersIncluded: z.literal(false),
      })
      .strict(),
    instructions: z.array(ManagerInstructionSchema),
  })
  .strict();

export type ManagerInstructionEnvelope = z.infer<
  typeof ManagerInstructionEnvelopeSchema
>;

export type ManagerPreviewOnlyReason =
  | "unknown-before"
  | "equipped"
  | "locked"
  | "ambiguous-matcher";

export interface ManagerInstructionActionability {
  instructionId: string;
  actionable: boolean;
  reasons: ManagerPreviewOnlyReason[];
}

export interface ManagerActionabilitySummary {
  instructions: ManagerInstructionActionability[];
  actionableCount: number;
  previewOnlyCount: number;
  reasonCounts: Record<ManagerPreviewOnlyReason, number>;
}

export interface ManagerInstructionPreview {
  envelope: ManagerInstructionEnvelope;
  actionability: ManagerActionabilitySummary;
  omittedInstructionIds: string[];
}

const MANAGER_SLOT: Record<
  RelicSlot,
  z.infer<typeof ManagerRelicMatcherSchema>["slot"]
> = {
  head: "Head",
  hands: "Hands",
  body: "Body",
  feet: "Feet",
  planarSphere: "PlanarSphere",
  linkRope: "LinkRope",
};

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function matcherForRelic(
  relic: Relic,
  locationKey: string | null
): z.infer<typeof ManagerRelicMatcherSchema> | null {
  const gameId = Number(relic.definitionId);
  if (!Number.isSafeInteger(gameId) || gameId <= 0) return null;
  return {
    key: relic.definitionId,
    gameId,
    setKey: relic.setId,
    locationKey,
    rarity: relic.rarity,
    slot: MANAGER_SLOT[relic.slot],
    level: relic.level,
    mainStat: {
      key: relic.mainStat.statId,
      value: relic.mainStat.value,
    },
    substats: relic.substats
      .map((stat) => ({ key: stat.statId, value: stat.value }))
      .sort(
        (left, right) =>
          left.key.localeCompare(right.key) || left.value - right.value
      ),
  };
}

function desiredStates(
  evaluation: RelicTriageEvaluation
): { lock?: boolean; discard?: boolean }[] {
  const { relic, result } = evaluation;
  if (result.decision === "keep") {
    return [
      ...(relic.locked !== true ? [{ lock: true }] : []),
      ...(relic.discarded === true ? [{ discard: false }] : []),
    ];
  }
  if (
    result.decision === "salvage-review" &&
    !relic.equippedCharacterKey &&
    relic.discarded !== true
  ) {
    return [{ discard: true }];
  }
  return [];
}

function isLockedDiscardInstruction(
  instruction: z.infer<typeof ManagerInstructionSchema>
): boolean {
  return (
    instruction.before.lock === true && instruction.desired.discard === true
  );
}

export async function createManagerInstructionPreview(
  account: AccountSnapshot,
  evaluations: readonly RelicTriageEvaluation[],
  referenceRevision: string,
  requestId: string = crypto.randomUUID()
): Promise<ManagerInstructionPreview> {
  const hasFreshScannerEvidence =
    account.source.provider === "scanner-export" &&
    account.source.coverage.relics === "complete";
  const characterDefinitionByKey = new Map(
    account.characters.map((character) => [
      character.key,
      character.definitionId,
    ])
  );
  const plans = evaluations
    .flatMap((evaluation) => {
      const locationKey = evaluation.relic.equippedCharacterKey
        ? (characterDefinitionByKey.get(
            evaluation.relic.equippedCharacterKey
          ) ?? null)
        : null;
      const matcher = matcherForRelic(evaluation.relic, locationKey);
      if (!matcher) return [];
      return desiredStates(evaluation).map((desired) => ({
        matcher,
        before: hasFreshScannerEvidence
          ? {
              lock: evaluation.relic.locked,
              discard: evaluation.relic.discarded,
            }
          : { lock: null, discard: null },
        desired,
      }));
    })
    .sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right))
    );
  const proposedInstructions = plans.map((plan, index) => ({
    id: `hsr-manager-${String(index + 1).padStart(4, "0")}-${"lock" in plan.desired ? "lock" : "discard"}`,
    ...plan,
  }));
  const actionability = summarizeInstructionActionability(proposedInstructions);
  const omittedInstructionIds = proposedInstructions
    .filter(isLockedDiscardInstruction)
    .map(({ id }) => id);
  const instructions = proposedInstructions.filter(
    (instruction) => !isLockedDiscardInstruction(instruction)
  );
  const semanticPayload = JSON.stringify({ referenceRevision, instructions });
  const idempotencyKey = `sha256:${await sha256(semanticPayload)}`;
  const envelope = ManagerInstructionEnvelopeSchema.parse({
    schema: "goodscanner.hsr.manager-instructions",
    schemaVersion: 1,
    requestId,
    idempotencyKey,
    reference: {
      schemaVersion: 1,
      provider: "gilore.ggstarrail-reference",
      revision: referenceRevision,
    },
    privacy: {
      accountIdentifiersIncluded: false,
      rawPacketDataIncluded: false,
      serverItemIdentifiersIncluded: false,
    },
    instructions,
  });
  assertNoSensitiveFields(envelope);
  return { envelope, actionability, omittedInstructionIds };
}

export async function createManagerInstructionEnvelope(
  account: AccountSnapshot,
  evaluations: readonly RelicTriageEvaluation[],
  referenceRevision: string,
  requestId: string = crypto.randomUUID()
): Promise<ManagerInstructionEnvelope> {
  return (
    await createManagerInstructionPreview(
      account,
      evaluations,
      referenceRevision,
      requestId
    )
  ).envelope;
}

export function serializeManagerInstructionEnvelope(
  envelope: ManagerInstructionEnvelope
): string {
  const parsed = ManagerInstructionEnvelopeSchema.parse(envelope);
  if (parsed.instructions.some(isLockedDiscardInstruction)) {
    throw new Error(
      "Locked Relics must be unlocked in a separate reviewed run before discard marking"
    );
  }
  assertNoSensitiveFields(parsed);
  return JSON.stringify(parsed, null, 2);
}

function summarizeInstructionActionability(
  candidateInstructions: readonly z.infer<typeof ManagerInstructionSchema>[]
): ManagerActionabilitySummary {
  const instructionsForReview = z
    .array(ManagerInstructionSchema)
    .parse(candidateInstructions);
  const matcherCounts = new Map<string, number>();
  for (const instruction of instructionsForReview) {
    const matcherKey = JSON.stringify(instruction.matcher);
    matcherCounts.set(matcherKey, (matcherCounts.get(matcherKey) ?? 0) + 1);
  }

  const instructions = instructionsForReview.map((instruction) => {
    const reasons: ManagerPreviewOnlyReason[] = [];
    if (
      instruction.before.lock === null ||
      instruction.before.discard === null
    ) {
      reasons.push("unknown-before");
    }
    if (instruction.matcher.locationKey !== null) reasons.push("equipped");
    if (
      instruction.desired.discard === true &&
      instruction.before.lock === true
    ) {
      reasons.push("locked");
    }
    if ((matcherCounts.get(JSON.stringify(instruction.matcher)) ?? 0) > 1) {
      reasons.push("ambiguous-matcher");
    }
    return {
      instructionId: instruction.id,
      actionable: reasons.length === 0,
      reasons,
    };
  });
  const reasonCounts: Record<ManagerPreviewOnlyReason, number> = {
    "unknown-before": 0,
    equipped: 0,
    locked: 0,
    "ambiguous-matcher": 0,
  };
  for (const instruction of instructions) {
    for (const reason of instruction.reasons) reasonCounts[reason] += 1;
  }
  const actionableCount = instructions.filter(
    ({ actionable }) => actionable
  ).length;
  return {
    instructions,
    actionableCount,
    previewOnlyCount: instructions.length - actionableCount,
    reasonCounts,
  };
}

export function summarizeManagerInstructionActionability(
  envelope: ManagerInstructionEnvelope
): ManagerActionabilitySummary {
  const parsed = ManagerInstructionEnvelopeSchema.parse(envelope);
  return summarizeInstructionActionability(parsed.instructions);
}
