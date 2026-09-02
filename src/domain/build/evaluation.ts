import type {
  AccountSnapshot,
  Relic,
  RelicCategory,
  RelicSlot,
} from "@/domain/account/schemas";
import { relicCategory } from "@/domain/account/schemas";
import {
  type BuildRelicFilter,
  deriveBuildFilters,
  evaluateBuildFilter,
} from "./filters";
import type { BuildConfiguration, ScoreProfile, TriageRules } from "./schemas";
import {
  type RelicScore,
  type RelicScoringContext,
  scoreRelic,
} from "./scoring";
import { type TriageResult, triageRelic } from "./triage";

export const BUILD_SLOT_ORDER: readonly RelicSlot[] = [
  "head",
  "hands",
  "body",
  "feet",
  "planarSphere",
  "linkRope",
];

const CAVERN_SLOTS = BUILD_SLOT_ORDER.slice(0, 4);
const PLANAR_SLOTS = BUILD_SLOT_ORDER.slice(4);

export interface ScoredRelic {
  relic: Relic;
  score: RelicScore;
}

export interface BuildLoadoutResult {
  buildId: string;
  selected: Partial<Record<RelicSlot, ScoredRelic>>;
  missingSlots: readonly RelicSlot[];
  averageScore: number | null;
  complete: boolean;
}

export interface EquippedBuildResult extends BuildLoadoutResult {
  characterKey: string | null;
  cavernSetComplete: boolean;
  planarSetComplete: boolean;
  mainStatsComplete: boolean;
  filterCriteriaComplete: boolean;
}

export interface RelicTriageEvaluation {
  relic: Relic;
  score: number;
  grade: RelicScore["grade"];
  matchingBuildIds: readonly string[];
  result: TriageResult;
}

export interface AccountTriageSummary {
  total: number;
  decisions: Record<TriageResult["decision"], number>;
  categories: Record<RelicCategory, number>;
}

const TRIAGE_DECISION_ORDER: Record<TriageResult["decision"], number> = {
  keep: 0,
  review: 1,
  "salvage-review": 2,
};

function round(value: number): number {
  return Number(value.toFixed(2));
}

function averageSelected(
  selected: Partial<Record<RelicSlot, ScoredRelic>>
): number | null {
  const values = Object.values(selected).map(({ score }) => score.total);
  if (values.length === 0) return null;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function bestCandidate(
  relics: readonly Relic[],
  filter: BuildRelicFilter,
  setId: string,
  build: BuildConfiguration,
  profile: ScoreProfile,
  context: RelicScoringContext
): ScoredRelic | undefined {
  return relics
    .filter(
      (relic) =>
        relic.slot === filter.slot &&
        relic.setId === setId &&
        filter.mainStatIds.includes(relic.mainStat.statId)
    )
    .map((relic) => ({
      relic,
      score: scoreRelic(relic, profile, context, build),
    }))
    .filter(
      ({ relic, score }) =>
        score.grade !== null &&
        evaluateBuildFilter(relic, filter, score.total).matches
    )
    .sort(
      (left, right) =>
        right.score.total - left.score.total ||
        left.relic.key.localeCompare(right.relic.key)
    )[0];
}

function selectForAssignment(
  relics: readonly Relic[],
  filters: readonly BuildRelicFilter[],
  assignment: ReadonlyMap<RelicSlot, string>,
  build: BuildConfiguration,
  profile: ScoreProfile,
  context: RelicScoringContext
): Partial<Record<RelicSlot, ScoredRelic>> {
  const selected: Partial<Record<RelicSlot, ScoredRelic>> = {};
  for (const filter of filters) {
    const setId = assignment.get(filter.slot);
    if (!setId) continue;
    const candidate = bestCandidate(
      relics,
      filter,
      setId,
      build,
      profile,
      context
    );
    if (candidate) selected[filter.slot] = candidate;
  }
  return selected;
}

function assignmentScore(
  selected: Partial<Record<RelicSlot, ScoredRelic>>
): [number, number] {
  const pieces = Object.values(selected);
  return [
    pieces.length,
    pieces.reduce((sum, candidate) => sum + candidate.score.total, 0),
  ];
}

function twoPlusTwoAssignments(
  slots: readonly RelicSlot[],
  firstSetId: string,
  secondSetId: string
): ReadonlyMap<RelicSlot, string>[] {
  const assignments: ReadonlyMap<RelicSlot, string>[] = [];
  for (let first = 0; first < slots.length; first += 1) {
    for (let second = first + 1; second < slots.length; second += 1) {
      assignments.push(
        new Map(
          slots.map((slot, index) => [
            slot,
            index === first || index === second ? firstSetId : secondSetId,
          ])
        )
      );
    }
  }
  return assignments;
}

export function recommendBuildLoadout(
  account: AccountSnapshot,
  build: BuildConfiguration,
  profile: ScoreProfile,
  context: RelicScoringContext
): BuildLoadoutResult {
  const filters = deriveBuildFilters(build, profile);
  const cavernFilters = filters.filter((filter) =>
    CAVERN_SLOTS.includes(filter.slot)
  );
  const planarFilters = filters.filter((filter) =>
    PLANAR_SLOTS.includes(filter.slot)
  );
  const cavernPlan = build.cavern;
  const cavernAssignments =
    cavernPlan.mode === "four-piece"
      ? [new Map(CAVERN_SLOTS.map((slot) => [slot, cavernPlan.setId]))]
      : twoPlusTwoAssignments(
          CAVERN_SLOTS,
          cavernPlan.setIds[0],
          cavernPlan.setIds[1]
        );
  const selectedCavern = cavernAssignments
    .map((assignment) =>
      selectForAssignment(
        account.relics,
        cavernFilters,
        assignment,
        build,
        profile,
        context
      )
    )
    .sort((left, right) => {
      const [leftCount, leftScore] = assignmentScore(left);
      const [rightCount, rightScore] = assignmentScore(right);
      return rightCount - leftCount || rightScore - leftScore;
    })[0];
  const selectedPlanar = selectForAssignment(
    account.relics,
    planarFilters,
    new Map(PLANAR_SLOTS.map((slot) => [slot, build.planarSetId])),
    build,
    profile,
    context
  );
  const selected = { ...selectedCavern, ...selectedPlanar };
  const missingSlots = BUILD_SLOT_ORDER.filter((slot) => !selected[slot]);
  return {
    buildId: build.id,
    selected,
    missingSlots,
    averageScore: averageSelected(selected),
    complete: missingSlots.length === 0,
  };
}

function setPlanComplete(
  relics: readonly Relic[],
  build: BuildConfiguration,
  kind: "cavern" | "planar"
): boolean {
  const relevant = relics.filter((relic) =>
    kind === "planar"
      ? PLANAR_SLOTS.includes(relic.slot)
      : CAVERN_SLOTS.includes(relic.slot)
  );
  if (kind === "planar") {
    return (
      relevant.filter((relic) => relic.setId === build.planarSetId).length >= 2
    );
  }
  const cavernPlan = build.cavern;
  if (cavernPlan.mode === "four-piece") {
    return (
      relevant.filter((relic) => relic.setId === cavernPlan.setId).length >= 4
    );
  }
  return cavernPlan.setIds.every(
    (setId) => relevant.filter((relic) => relic.setId === setId).length >= 2
  );
}

export function evaluateEquippedBuild(
  account: AccountSnapshot,
  build: BuildConfiguration,
  profile: ScoreProfile,
  context: RelicScoringContext
): EquippedBuildResult {
  const filters = deriveBuildFilters(build, profile);
  const character = account.characters.find(
    (candidate) => candidate.definitionId === build.characterDefinitionId
  );
  const equipped = character
    ? account.relics.filter(
        (relic) => relic.equippedCharacterKey === character.key
      )
    : [];
  const selected: Partial<Record<RelicSlot, ScoredRelic>> = {};
  for (const relic of equipped) {
    selected[relic.slot] = {
      relic,
      score: scoreRelic(relic, profile, context, build),
    };
  }
  const missingSlots = BUILD_SLOT_ORDER.filter((slot) => !selected[slot]);
  const filterCriteriaComplete =
    missingSlots.length === 0 &&
    filters.every((filter) => {
      const equippedRelic = selected[filter.slot];
      return (
        equippedRelic !== undefined &&
        evaluateBuildFilter(
          equippedRelic.relic,
          filter,
          equippedRelic.score.total
        ).matches
      );
    });
  return {
    buildId: build.id,
    characterKey: character?.key ?? null,
    selected,
    missingSlots,
    averageScore: averageSelected(selected),
    complete: missingSlots.length === 0,
    cavernSetComplete: setPlanComplete(equipped, build, "cavern"),
    planarSetComplete: setPlanComplete(equipped, build, "planar"),
    mainStatsComplete: Object.values(selected).every(
      ({ score }) => score.mainStatAccepted
    ),
    filterCriteriaComplete,
  };
}

export function evaluateAccountTriage(
  account: AccountSnapshot,
  builds: readonly BuildConfiguration[],
  profiles: readonly ScoreProfile[],
  rules: TriageRules,
  context: RelicScoringContext
): RelicTriageEvaluation[] {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const buildInputs = builds.flatMap((build) => {
    const profile = profileById.get(build.scoreProfileId);
    return profile
      ? [{ build, profile, filters: deriveBuildFilters(build, profile) }]
      : [];
  });
  return account.relics
    .map((relic) => {
      const matches = buildInputs.flatMap(({ build, profile, filters }) => {
        const filter = filters.find(
          (candidate) => candidate.slot === relic.slot
        );
        if (!filter) return [];
        const score = scoreRelic(relic, profile, context, build);
        if (!evaluateBuildFilter(relic, filter, score.total).matches) return [];
        return [
          {
            buildId: build.id,
            score,
          },
        ];
      });
      const best = matches.sort(
        (left, right) => right.score.total - left.score.total
      )[0];
      const result = triageRelic(
        {
          score: best?.score.total ?? 0,
          locked: relic.locked,
          equipped: Boolean(relic.equippedCharacterKey),
          configuredBuildCount: buildInputs.length,
          matchingBuildCount: matches.length,
        },
        rules
      );
      return {
        relic,
        score: best?.score.total ?? 0,
        grade: best?.score.grade ?? null,
        matchingBuildIds: matches.map(({ buildId }) => buildId),
        result,
      };
    })
    .sort(
      (left, right) =>
        TRIAGE_DECISION_ORDER[left.result.decision] -
          TRIAGE_DECISION_ORDER[right.result.decision] ||
        right.score - left.score ||
        left.relic.key.localeCompare(right.relic.key)
    );
}

export function summarizeAccountTriage(
  evaluations: readonly RelicTriageEvaluation[]
): AccountTriageSummary {
  const summary: AccountTriageSummary = {
    total: evaluations.length,
    decisions: { keep: 0, review: 0, "salvage-review": 0 },
    categories: { cavern: 0, planar: 0 },
  };
  for (const evaluation of evaluations) {
    summary.decisions[evaluation.result.decision] += 1;
    summary.categories[relicCategory(evaluation.relic.slot)] += 1;
  }
  return summary;
}
