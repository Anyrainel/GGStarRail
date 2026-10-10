import { RotateCcw, X } from "lucide-react";
import type { ReactNode } from "react";
import { SelectField } from "@/components/builds/BuildControls";
import { ItemPicker, type PickerItem } from "@/components/shared/ItemPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { SetPlan } from "@/domain/combat/optimize/relics";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import type { BuildReferences } from "@/lib/buildReferences";
import { characterCatalogName } from "@/lib/catalogPresentation";
import type { MemberOutcome } from "@/lib/combat/jobs";
import { VALUE_ORIGIN_LABEL_KEYS } from "@/lib/combat/presentation";
import type { ValueOrigin } from "@/lib/combat/resolve";
import { cn } from "@/lib/utils";
import type { TeamMemberPlan } from "@/stores/teamSchemas";
import { MemberOptions } from "./MemberOptions";
import { MemberStats } from "./MemberStats";

export interface MemberPickerItems {
  readonly characters: readonly PickerItem[];
  readonly lightCones: readonly PickerItem[];
  readonly relicSets: readonly PickerItem[];
}

interface TeamMemberCardProps {
  slot: number;
  plan: TeamMemberPlan | null;
  outcome: MemberOutcome | undefined;
  /** Eidolon on the imported account, when the Character is owned. */
  accountEidolon: number | null;
  references: BuildReferences;
  items: MemberPickerItems;
  onCharacterChange: (characterId: string | null) => void;
  onChange: (patch: Partial<TeamMemberPlan>) => void;
}

const SKILL_USAGE_KEYS = {
  kit: "combat.member.skillUsage.kit",
  prefer: "combat.member.skillUsage.prefer",
  avoid: "combat.member.skillUsage.avoid",
} as const satisfies Record<TeamMemberPlan["skill"], MessageKey>;

function OriginBadge({ origin }: { origin: ValueOrigin }) {
  const { t } = useI18n();
  return (
    <Badge
      variant={origin === "override" ? "default" : "outline"}
      className="shrink-0 whitespace-nowrap"
    >
      {t(VALUE_ORIGIN_LABEL_KEYS[origin])}
    </Badge>
  );
}

function ResetButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0"
      aria-label={t("combat.member.reset")}
      title={t("combat.member.reset")}
      onClick={onClick}
    >
      <RotateCcw className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="w-20 shrink-0 text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {children}
      </div>
    </div>
  );
}

function planSets(plan: SetPlan): {
  cavern: [string | null, string | null];
  planar: string | null;
} {
  const cavern = plan.cavern;
  return {
    cavern: !cavern
      ? [null, null]
      : "fourPiece" in cavern
        ? [cavern.fourPiece, null]
        : [cavern.twoPlusTwo[0], cavern.twoPlusTwo[1]],
    planar: plan.planar,
  };
}

export function TeamMemberCard({
  slot,
  plan,
  outcome,
  accountEidolon,
  references,
  items,
  onCharacterChange,
  onChange,
}: TeamMemberCardProps) {
  const { locale, t } = useI18n();
  const character = plan
    ? references.characters.byId.get(plan.characterId)
    : undefined;
  const characterPicker = (
    <ItemPicker
      kind="character"
      label={t("combat.slot.add")}
      value={plan?.characterId ?? null}
      items={items.characters}
      triggerSize="md"
      badge={outcome ? outcome.eidolon : undefined}
      onChange={(id) => onCharacterChange(id)}
    />
  );

  if (!plan || !character) {
    return (
      <Card
        className="flex min-h-40 items-center justify-center bg-gradient-card"
        data-team-slot={slot}
        aria-label={t("combat.slot.label", { index: slot + 1 })}
      >
        <div className="flex flex-col items-center gap-2 p-4">
          {characterPicker}
          <span className="text-sm text-muted-foreground">
            {t("combat.slot.add")}
          </span>
        </div>
      </Card>
    );
  }

  const lightConeItems = items.lightCones.filter((item) =>
    item.tags?.includes(character.path_id)
  );
  const cavernItems = items.relicSets.filter((item) =>
    item.tags?.includes("cavern_relic")
  );
  const planarItems = items.relicSets.filter((item) =>
    item.tags?.includes("planar_ornament")
  );
  const lightCone = outcome?.lightCone ?? null;
  const sets = outcome ? planSets(outcome.setPlan) : null;
  const notModeled = outcome?.implemented.character === false;

  function changeSets(next: {
    cavern: [string | null, string | null];
    planar: string | null;
  }) {
    const cavern = next.cavern.filter((id): id is string => id !== null);
    onChange({
      setPlan: {
        cavern: cavern[0] === cavern[1] ? cavern.slice(0, 1) : cavern,
        planar: next.planar,
      },
    });
  }

  return (
    <Card
      role="article"
      className="min-w-0 overflow-hidden bg-gradient-card"
      data-team-slot={slot}
      aria-label={t("combat.slot.label", { index: slot + 1 })}
    >
      <CardHeader className="flex items-center gap-3 space-y-0 px-3 pb-2 pt-3">
        {characterPicker}
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="truncate text-base font-semibold">
            {characterCatalogName(character, locale, t("terms.trailblazer"))}
          </h3>
          {notModeled && (
            <Badge variant="outline">{t("combat.member.notModeled")}</Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 self-start"
          aria-label={t("combat.member.remove")}
          title={t("combat.member.remove")}
          onClick={() => onCharacterChange(null)}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 px-3 pb-3">
        <div className="grid grid-cols-2 gap-2">
          <SelectField
            label={t("combat.member.eidolon")}
            value={plan.eidolon === undefined ? "auto" : String(plan.eidolon)}
            options={[
              {
                value: "auto",
                label: t("combat.member.automatic", {
                  origin: t(
                    VALUE_ORIGIN_LABEL_KEYS[
                      accountEidolon === null ? "default" : "account"
                    ]
                  ),
                  value: t("archive.eidolon", { value: accountEidolon ?? 0 }),
                }),
              },
              ...[0, 1, 2, 3, 4, 5, 6].map((value) => ({
                value: String(value),
                label: t("archive.eidolon", { value }),
              })),
            ]}
            onChange={(value) =>
              onChange({
                eidolon: value === "auto" ? undefined : Number(value),
              })
            }
          />
          <SelectField
            label={t("combat.member.skillUsage")}
            value={plan.skill}
            options={(
              Object.keys(SKILL_USAGE_KEYS) as TeamMemberPlan["skill"][]
            ).map((value) => ({ value, label: t(SKILL_USAGE_KEYS[value]) }))}
            onChange={(value) =>
              onChange({ skill: value as TeamMemberPlan["skill"] })
            }
          />
        </div>

        <Row label={t("combat.member.lightCone")}>
          <ItemPicker
            kind="light-cone"
            label={t("combat.member.lightCone")}
            value={lightCone?.id ?? null}
            items={lightConeItems}
            triggerSize="sm"
            badge={lightCone?.superimposition}
            onChange={(id) =>
              onChange({
                lightCone: {
                  id,
                  superimposition: lightCone?.superimposition ?? 1,
                },
              })
            }
            onClear={() => onChange({ lightCone: null })}
          />
          {lightCone && (
            <select
              aria-label={t("combat.member.superimposition")}
              value={lightCone.superimposition}
              className="h-8 rounded-md border border-border bg-background/70 px-2 text-sm"
              onChange={(event) =>
                onChange({
                  lightCone: {
                    id: lightCone.id,
                    superimposition: Number(event.target.value),
                  },
                })
              }
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {t("combat.member.superimpositionShort", { value })}
                </option>
              ))}
            </select>
          )}
          {outcome && <OriginBadge origin={outcome.lightConeOrigin} />}
          {outcome?.implemented.lightCone === false && (
            <Badge variant="outline">{t("combat.member.notModeled")}</Badge>
          )}
          {plan.lightCone !== undefined && (
            <ResetButton onClick={() => onChange({ lightCone: undefined })} />
          )}
        </Row>

        <Row label={t("combat.member.relics")}>
          <fieldset
            aria-label={t("combat.member.relics")}
            className="inline-flex rounded-md border border-border p-0.5"
          >
            {(["equipped", "ideal"] as const).map((source) => {
              const active = (outcome?.relicSource ?? plan.relics) === source;
              const disabled = source === "equipped" && accountEidolon === null;
              return (
                <button
                  key={source}
                  type="button"
                  aria-pressed={active}
                  disabled={disabled}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent"
                  )}
                  onClick={() => onChange({ relics: source })}
                >
                  {t(
                    source === "equipped"
                      ? "combat.member.relicsEquipped"
                      : "combat.member.relicsIdeal"
                  )}
                </button>
              );
            })}
          </fieldset>
        </Row>

        {outcome?.relicSource === "ideal" && sets && (
          <Row label={t("combat.member.sets")}>
            <ItemPicker
              kind="relic-set"
              label={t("combat.member.cavernSet")}
              value={sets.cavern[0]}
              items={cavernItems}
              triggerSize="sm"
              onChange={(id) =>
                changeSets({ ...sets, cavern: [id, sets.cavern[1]] })
              }
              onClear={() =>
                changeSets({ ...sets, cavern: [sets.cavern[1], null] })
              }
            />
            <ItemPicker
              kind="relic-set"
              label={t("combat.member.secondCavernSet")}
              value={sets.cavern[1]}
              items={cavernItems}
              triggerSize="sm"
              disabled={sets.cavern[0] === null}
              onChange={(id) =>
                changeSets({ ...sets, cavern: [sets.cavern[0], id] })
              }
              onClear={() =>
                changeSets({ ...sets, cavern: [sets.cavern[0], null] })
              }
            />
            <ItemPicker
              kind="relic-set"
              label={t("combat.member.planarSet")}
              value={sets.planar}
              items={planarItems}
              triggerSize="sm"
              onChange={(id) => changeSets({ ...sets, planar: id })}
              onClear={() => changeSets({ ...sets, planar: null })}
            />
            <OriginBadge origin={outcome.setPlanOrigin} />
            {plan.setPlan !== undefined && (
              <ResetButton onClick={() => onChange({ setPlan: undefined })} />
            )}
          </Row>
        )}

        {outcome && <MemberStats panel={outcome.panel} />}
        {outcome && outcome.optionGroups.length > 0 && (
          <MemberOptions
            character={character}
            references={references}
            groups={outcome.optionGroups}
            values={plan.options}
            onChange={(options) => onChange({ options })}
          />
        )}
      </CardContent>
    </Card>
  );
}
