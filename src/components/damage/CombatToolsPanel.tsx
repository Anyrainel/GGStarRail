import { Loader2, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NumberField, SelectField } from "@/components/builds/BuildControls";
import { StatusBanner } from "@/components/builds/StatusBanner";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { AccountSnapshot } from "@/domain/account/schemas";
import type { SetPlan } from "@/domain/combat/optimize/relics";
import { CATALOG_RELIC_SLOT } from "@/domain/stats";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import type { BuildReferences } from "@/lib/buildReferences";
import {
  characterCatalogName,
  localizedName,
  localizedPropertyName,
} from "@/lib/catalogPresentation";
import { runCombatJob } from "@/lib/combat/client";
import type { WorkspaceSources } from "@/lib/combat/jobs";
import {
  formatChange,
  formatDamage,
  formatPercent,
} from "@/lib/combat/presentation";
import type { CombatJobResult } from "@/lib/combat/runJob";
import { formatGameText } from "@/lib/gameText";
import { cn } from "@/lib/utils";
import type { TeamPlan } from "@/stores/teamSchemas";

type Tool = "optimize" | "ideal" | "lightCones" | "setPlans" | "investment";

const TOOL_LABEL_KEYS = {
  optimize: "combat.tools.optimize",
  ideal: "combat.tools.ideal",
  lightCones: "combat.tools.lightCones",
  setPlans: "combat.tools.setPlans",
  investment: "combat.tools.investment",
} as const satisfies Record<Tool, MessageKey>;

type ToolResult =
  | { tool: "optimize"; result: CombatJobResult<"optimize"> }
  | { tool: "ideal"; result: CombatJobResult<"ideal"> }
  | { tool: "lightCones"; result: CombatJobResult<"compare"> }
  | { tool: "setPlans"; result: CombatJobResult<"compare"> }
  | { tool: "investment"; result: CombatJobResult<"investment"> };

interface CombatToolsPanelProps {
  team: TeamPlan;
  sources: WorkspaceSources;
  account: AccountSnapshot | null;
  references: BuildReferences;
}

function SetIcon({
  setId,
  references,
}: {
  setId: string;
  references: BuildReferences;
}) {
  const { locale } = useI18n();
  const set = references.relicSets.byId.get(setId);
  if (!set) return null;
  return (
    <ItemIcon
      kind="relic-set"
      id={set.id}
      sourcePath={set.icon_path}
      rarity={null}
      size="xs"
      alt={formatGameText(localizedName(set.name, locale, set.id))}
      title={formatGameText(localizedName(set.name, locale, set.id))}
    />
  );
}

function PlanIcons({
  plan,
  references,
}: {
  plan: SetPlan;
  references: BuildReferences;
}) {
  const cavern = plan.cavern
    ? "fourPiece" in plan.cavern
      ? [plan.cavern.fourPiece]
      : [...plan.cavern.twoPlusTwo]
    : [];
  return (
    <span className="flex shrink-0 items-center gap-1">
      {[...cavern, ...(plan.planar ? [plan.planar] : [])].map((id, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 2+2 may repeat a set
        <SetIcon key={`${id}:${index}`} setId={id} references={references} />
      ))}
    </span>
  );
}

function ResultRow({
  rank,
  children,
  damage,
  reference,
  highlight = false,
}: {
  rank: string;
  children: React.ReactNode;
  damage: number;
  reference: number;
  highlight?: boolean;
}) {
  const { locale } = useI18n();
  return (
    <li
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-md border border-border p-2",
        highlight && "border-primary bg-primary/10"
      )}
    >
      <span className="w-6 shrink-0 text-center text-xs text-muted-foreground">
        {rank}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {children}
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-medium tabular-nums">
          {formatDamage(damage, locale)}
        </div>
        <div className="text-xs tabular-nums text-muted-foreground">
          {formatChange(damage, reference, locale)}
        </div>
      </div>
    </li>
  );
}

export function CombatToolsPanel({
  team,
  sources,
  account,
  references,
}: CombatToolsPanelProps) {
  const { locale, t } = useI18n();
  const filledSlots = team.members.flatMap((member, slot) =>
    member ? [{ slot, characterId: member.characterId }] : []
  );
  const [tool, setTool] = useState<Tool>("ideal");
  const [slot, setSlot] = useState<number>(filledSlots[0]?.slot ?? 0);
  const [minSpeed, setMinSpeed] = useState(0);
  const [budget, setBudget] = useState<"realistic" | "perfect">("realistic");
  const [output, setOutput] = useState<ToolResult | null>(null);
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!filledSlots.some((entry) => entry.slot === slot))
      setSlot(filledSlots[0]?.slot ?? 0);
  }, [filledSlots, slot]);

  // A result describes the team as it was; edits invalidate it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on any change
  useEffect(() => {
    setOutput(null);
    setFailed(false);
  }, [team, sources, tool, slot]);

  const relicByKey = useMemo(
    () => new Map((account?.relics ?? []).map((relic) => [relic.key, relic])),
    [account]
  );

  const characterName = (characterId: string) => {
    const character = references.characters.byId.get(characterId);
    return character
      ? characterCatalogName(character, locale, t("terms.trailblazer"))
      : characterId;
  };
  const propertyName = (propertyId: string) =>
    localizedPropertyName(propertyId, references.properties, locale);
  const slotName = (slotId: string) =>
    localizedName(
      references.properties.relicSlotById.get(
        CATALOG_RELIC_SLOT[slotId as keyof typeof CATALOG_RELIC_SLOT]
      )?.name,
      locale,
      slotId
    );

  async function run() {
    const base = { team, sources, slot };
    const constraints = minSpeed > 0 ? { minSpeed } : undefined;
    setRunning(true);
    setFailed(false);
    try {
      let next: ToolResult;
      switch (tool) {
        case "optimize":
          next = {
            tool,
            result: await runCombatJob({
              kind: "optimize",
              request: { ...base, constraints },
            }),
          };
          break;
        case "ideal":
          next = {
            tool,
            result: await runCombatJob({
              kind: "ideal",
              request: { ...base, constraints, budget },
            }),
          };
          break;
        case "lightCones":
        case "setPlans":
          next = {
            tool,
            result: await runCombatJob({
              kind: "compare",
              request: { ...base, kind: tool, budget },
            }),
          };
          break;
        case "investment":
          next = {
            tool,
            result: await runCombatJob({ kind: "investment", request: base }),
          };
          break;
      }
      setOutput(next);
    } catch {
      setFailed(true);
    } finally {
      setRunning(false);
    }
  }

  const needsAccount = tool === "optimize" && !account?.relics.length;

  return (
    <Card className="min-w-0 bg-gradient-card" data-combat-tools>
      <CardHeader className="space-y-3 px-4 pb-2 pt-4">
        <div
          role="tablist"
          aria-label={t("combat.tools.title")}
          className="flex flex-wrap gap-1"
        >
          {(Object.keys(TOOL_LABEL_KEYS) as Tool[]).map((entry) => (
            <button
              key={entry}
              type="button"
              role="tab"
              aria-selected={entry === tool}
              className={cn(
                "rounded-md border border-border px-2.5 py-1 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                entry === tool
                  ? "border-primary bg-primary/20 text-primary"
                  : "text-muted-foreground hover:bg-accent"
              )}
              onClick={() => setTool(entry)}
            >
              {t(TOOL_LABEL_KEYS[entry])}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <SelectField
            className="w-44"
            label={t("combat.tools.member")}
            value={String(slot)}
            options={filledSlots.map((entry) => ({
              value: String(entry.slot),
              label: characterName(entry.characterId),
            }))}
            onChange={(value) => setSlot(Number(value))}
          />
          {(tool === "optimize" || tool === "ideal") && (
            <NumberField
              className="w-28"
              label={t("combat.tools.minSpeed")}
              value={minSpeed}
              min={0}
              max={300}
              onChange={setMinSpeed}
            />
          )}
          {(tool === "ideal" ||
            tool === "lightCones" ||
            tool === "setPlans") && (
            <SelectField
              className="w-32"
              label={t("combat.tools.budget")}
              value={budget}
              options={[
                {
                  value: "realistic",
                  label: t("combat.tools.budget.realistic"),
                },
                { value: "perfect", label: t("combat.tools.budget.perfect") },
              ]}
              onChange={(value) => setBudget(value as typeof budget)}
            />
          )}
          <Button
            onClick={run}
            disabled={running || filledSlots.length === 0 || needsAccount}
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4" aria-hidden="true" />
            )}
            {t("combat.tools.run")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4">
        {needsAccount && (
          <StatusBanner message={t("combat.tools.needsRelics")} />
        )}
        {failed && (
          <StatusBanner message={t("combat.tools.failed")} tone="error" />
        )}
        {output?.tool === "optimize" && (
          <ol className="space-y-2" aria-label={t("combat.tools.optimize")}>
            <ResultRow
              rank="—"
              damage={output.result.currentDamage}
              reference={output.result.currentDamage}
            >
              <span className="text-sm">{t("combat.tools.current")}</span>
            </ResultRow>
            {output.result.loadouts.map((loadout, index) => (
              <ResultRow
                // biome-ignore lint/suspicious/noArrayIndexKey: ranked list
                key={index}
                rank={String(index + 1)}
                damage={loadout.damage}
                reference={output.result.currentDamage}
                highlight={index === 0}
              >
                <PlanIcons plan={loadout.plan} references={references} />
                <span className="text-xs tabular-nums text-muted-foreground">
                  {t("stat.short.spd")} {loadout.speed.toFixed(1)}
                </span>
                <span className="flex w-full flex-wrap gap-x-3 gap-y-0.5 text-xs">
                  {Object.entries(loadout.relicKeys).map(([slotId, key]) => {
                    const relic = relicByKey.get(key);
                    return (
                      <span key={slotId} className="whitespace-nowrap">
                        <span className="text-muted-foreground">
                          {slotName(slotId)}
                        </span>{" "}
                        {relic ? propertyName(relic.mainStat.statId) : "—"}
                      </span>
                    );
                  })}
                </span>
              </ResultRow>
            ))}
            {output.result.loadouts.length === 0 && (
              <StatusBanner message={t("combat.tools.noResults")} />
            )}
          </ol>
        )}
        {output?.tool === "ideal" && (
          <div className="space-y-3">
            {!output.result.feasible && (
              <StatusBanner message={t("combat.tools.infeasible")} />
            )}
            <ol className="space-y-2">
              <ResultRow
                rank="—"
                damage={output.result.currentDamage}
                reference={output.result.currentDamage}
              >
                <span className="text-sm">{t("combat.tools.current")}</span>
              </ResultRow>
              <ResultRow
                rank="1"
                damage={output.result.damage}
                reference={output.result.currentDamage}
                highlight
              >
                <PlanIcons plan={output.result.plan} references={references} />
                <span className="text-xs tabular-nums text-muted-foreground">
                  {t("stat.short.spd")} {output.result.speed.toFixed(1)}
                </span>
              </ResultRow>
            </ol>
            <div className="grid gap-3 sm:grid-cols-3">
              <dl className="space-y-1 text-xs">
                <dt className="font-semibold text-muted-foreground">
                  {t("combat.tools.mainStats")}
                </dt>
                {Object.entries(output.result.mainStats).map(
                  ([slotId, propertyId]) => (
                    <dd key={slotId} className="flex justify-between gap-2">
                      <span className="text-muted-foreground">
                        {slotName(slotId)}
                      </span>
                      <span>{propertyName(propertyId)}</span>
                    </dd>
                  )
                )}
              </dl>
              <dl className="space-y-1 text-xs">
                <dt className="font-semibold text-muted-foreground">
                  {t("combat.tools.rolls")}
                </dt>
                {Object.entries(output.result.rolls)
                  .filter(([, rolls]) => rolls > 0)
                  .sort(([, left], [, right]) => right - left)
                  .map(([propertyId, rolls]) => (
                    <dd key={propertyId} className="flex justify-between gap-2">
                      <span>{propertyName(propertyId)}</span>
                      <span className="tabular-nums">{rolls}</span>
                    </dd>
                  ))}
              </dl>
              <dl className="space-y-1 text-xs">
                <dt className="font-semibold text-muted-foreground">
                  {t("combat.tools.weights")}
                </dt>
                {(() => {
                  const entries = Object.entries(output.result.weights).sort(
                    ([, left], [, right]) => right - left
                  );
                  const peak = Math.max(1e-9, entries[0]?.[1] ?? 0);
                  return entries
                    .filter(([, weight]) => weight > 0)
                    .map(([propertyId, weight]) => (
                      <dd
                        key={propertyId}
                        className="flex justify-between gap-2"
                      >
                        <span>{propertyName(propertyId)}</span>
                        <span className="tabular-nums">
                          {(weight / peak).toFixed(2)}
                        </span>
                      </dd>
                    ));
                })()}
              </dl>
            </div>
          </div>
        )}
        {(output?.tool === "lightCones" || output?.tool === "setPlans") && (
          <ol className="max-h-[32rem] space-y-2 overflow-y-auto">
            {output.result.slice(0, 30).map((entry, index) => {
              const lightCone = entry.lightCone
                ? references.lightCones.byId.get(entry.lightCone.id)
                : undefined;
              return (
                <ResultRow
                  key={
                    entry.lightCone?.id ?? JSON.stringify(entry.plan ?? index)
                  }
                  rank={String(index + 1)}
                  damage={entry.damage}
                  reference={output.result[0]?.damage ?? entry.damage}
                  highlight={index === 0}
                >
                  {lightCone && entry.lightCone && (
                    <>
                      <ItemIcon
                        kind="light-cone"
                        id={lightCone.id}
                        sourcePath={lightCone.icon_path}
                        rarity={lightCone.rarity}
                        badge={entry.lightCone.superimposition}
                        size="xs"
                        alt=""
                      />
                      <span className="min-w-0 truncate text-sm">
                        {formatGameText(
                          localizedName(lightCone.name, locale, lightCone.id)
                        )}
                      </span>
                    </>
                  )}
                  {entry.plan && (
                    <PlanIcons plan={entry.plan} references={references} />
                  )}
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {formatPercent(entry.relative, locale)}
                  </span>
                </ResultRow>
              );
            })}
          </ol>
        )}
        {output?.tool === "investment" && (
          <ol className="space-y-2">
            <ResultRow
              rank="—"
              damage={output.result.start}
              reference={output.result.start}
            >
              <span className="text-sm">{t("combat.tools.current")}</span>
            </ResultRow>
            {output.result.steps.map((step, index) => (
              <ResultRow
                key={`${step.kind}:${step.level}`}
                rank={String(index + 1)}
                damage={step.damage}
                reference={output.result.start}
              >
                <span className="text-sm font-medium">
                  {step.kind === "eidolon"
                    ? t("archive.eidolon", { value: step.level })
                    : t("combat.member.superimpositionShort", {
                        value: step.level,
                      })}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {formatChange(step.damage, step.damage - step.gain, locale)}
                </span>
              </ResultRow>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
