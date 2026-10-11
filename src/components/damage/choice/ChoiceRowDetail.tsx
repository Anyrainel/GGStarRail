import { Check } from "lucide-react";
import { ItemIcon } from "@/components/shared/ItemIcon";
import type { PickerItem } from "@/components/shared/ItemPicker";
import {
  CavernBonusIcon,
  PlanarSetIcon,
} from "@/components/shared/relic/SetPlanIcon";
import { Button } from "@/components/ui/button";
import { CATALOG_RELIC_SLOT } from "@/domain/stats";
import { useI18n } from "@/i18n/I18nContext";
import {
  localizedName,
  localizedPropertyName,
} from "@/lib/catalogPresentation";
import type { CompareEntry } from "@/lib/combat/jobs";
import { formatDamage } from "@/lib/combat/presentation";
import type { MemberPreview } from "@/lib/combat/teamPreview";
import { type RelicSlotId, shortStatKey } from "@/lib/relicPresentation";
import { cn } from "@/lib/utils";
import { useTeamDmgData } from "../team/TeamDmgData";
import { currentBonuses, entryBonuses, type SetBonuses } from "./choiceModel";

/** Head and Hands have fixed main stats; these four vary. */
const VARIABLE_SLOTS = [
  "body",
  "feet",
  "planarSphere",
  "linkRope",
] as const satisfies readonly RelicSlotId[];

function useStatLabels() {
  const { locale, t } = useI18n();
  const { references } = useTeamDmgData();
  return {
    slot: (slot: RelicSlotId) =>
      localizedName(
        references.properties.relicSlotById.get(CATALOG_RELIC_SLOT[slot])?.name,
        locale,
        slot
      ),
    stat: (propertyId: string) => {
      const key = shortStatKey(propertyId);
      return key
        ? t(key)
        : localizedPropertyName(propertyId, references.properties, locale);
    },
  };
}

function LightConeTile({
  lightCone,
  item,
}: {
  lightCone: { id: string; superimposition: number };
  item: PickerItem | undefined;
}) {
  return (
    <ItemIcon
      kind="light-cone"
      id={lightCone.id}
      sourcePath={item?.iconPath}
      rarity={item?.rarity ?? null}
      size="xs"
      square
      badge={lightCone.superimposition}
      alt={item?.name ?? lightCone.id}
    />
  );
}

/** A set plan's Cavern bonuses and Planar set, as two tiles. */
function PlanTiles({ bonuses }: { bonuses: SetBonuses }) {
  const { lookup } = useTeamDmgData();
  const ref = (id: string) => {
    const item = lookup.relicSets.get(id);
    return {
      id,
      name: item?.name ?? id,
      rarity: item?.rarity ?? null,
      iconPath: item?.iconPath ?? null,
    };
  };
  return (
    <div className="flex shrink-0 items-center gap-0.5" data-set-plan-icons>
      <CavernBonusIcon
        bonuses={bonuses.cavern.map((bonus) => ({
          set: ref(bonus.setId),
          tier: bonus.tier,
        }))}
        size="xs"
      />
      <PlanarSetIcon
        set={bonuses.planar ? ref(bonuses.planar) : null}
        size="xs"
      />
    </div>
  );
}

/**
 * A ranked candidate: its art beside what the member uses now, the total
 * damage, and the ideal Relics behind the score (main stats of the four
 * variable slots and substat rolls).
 */
export function ChoiceDetailContent({
  entry,
  member,
  label,
  percent,
  current,
  onUse,
  className,
  headerClassName,
  mainStatsClassName = "grid-cols-2",
}: {
  entry: CompareEntry;
  member: MemberPreview;
  label: string;
  percent: string;
  current: boolean;
  /** Applies the candidate to the member (omitted for the current one). */
  onUse?: () => void;
  className?: string;
  /** E.g. room for a dialog's close button. */
  headerClassName?: string;
  /** Columns of the main-stat grid (four fit in a dialog, not a hover card). */
  mainStatsClassName?: string;
}) {
  const { locale, t } = useI18n();
  const { lookup } = useTeamDmgData();
  const labels = useStatLabels();
  const ideal = entry.ideal;
  const bonuses = entryBonuses(entry);
  const rolls = ideal
    ? Object.entries(ideal.rolls)
        .filter(([, count]) => count > 0)
        .sort(([, left], [, right]) => right - left)
    : [];

  const candidate = entry.lightCone ? (
    <LightConeTile
      lightCone={entry.lightCone}
      item={lookup.lightCones.get(entry.lightCone.id)}
    />
  ) : bonuses ? (
    <PlanTiles bonuses={bonuses} />
  ) : null;
  const now = entry.lightCone ? (
    member.lightCone ? (
      <LightConeTile
        lightCone={member.lightCone}
        item={lookup.lightCones.get(member.lightCone.id)}
      />
    ) : null
  ) : (
    <PlanTiles bonuses={currentBonuses(member)} />
  );

  const title = (
    <div className="min-w-0 flex-1" data-choice-title>
      <div className="text-sm font-bold leading-tight">{label}</div>
      <div className="mt-0.5 flex items-center gap-1.5">
        <span className="font-mono font-bold tabular-nums">{percent}</span>
        {current && (
          <span className="rounded-full border border-primary/40 bg-primary/10 px-1.5 text-[10px] font-semibold leading-4">
            {t("combat.tools.current")}
          </span>
        )}
      </div>
    </div>
  );
  const nowBlock =
    !current && now ? (
      <div
        className="flex shrink-0 flex-col items-center gap-0.5"
        data-choice-now
      >
        <span className="text-[10px] font-semibold text-muted-foreground">
          {t("combat.tools.current")}
        </span>
        {now}
      </div>
    ) : null;

  return (
    <div className={cn("space-y-2 text-xs", className)} data-choice-detail>
      {entry.lightCone ? (
        <div className={cn("flex items-center gap-2", headerClassName)}>
          {candidate}
          {title}
          {nowBlock}
        </div>
      ) : (
        // A set plan is two tiles a side: art row first, then the name.
        <div className={cn("space-y-1.5", headerClassName)}>
          <div className="flex items-end justify-between gap-2" data-choice-art>
            {candidate}
            {nowBlock}
          </div>
          {title}
        </div>
      )}

      <div className="flex justify-between gap-2 border-t border-border pt-1.5">
        <span className="text-muted-foreground">
          {t("teamChoice.totalDamage")}
        </span>
        <span className="font-mono font-bold tabular-nums">
          {formatDamage(entry.damage, locale)}
        </span>
      </div>

      {ideal && (
        <section className="border-t border-border pt-1.5">
          <h4 className="mb-1 font-semibold text-muted-foreground">
            {t("combat.tools.mainStats")}
          </h4>
          <dl
            className={cn("grid gap-1 text-center", mainStatsClassName)}
            data-choice-main-stats
          >
            {VARIABLE_SLOTS.map((slot) => {
              const stat = ideal.mainStats[slot];
              return (
                <div key={slot} className="min-w-0" data-slot={slot}>
                  <dt className="text-[10px] leading-tight text-muted-foreground">
                    {labels.slot(slot)}
                  </dt>
                  <dd className="break-words font-semibold leading-tight">
                    {stat ? labels.stat(stat) : "—"}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      )}

      {rolls.length > 0 && (
        <section className="border-t border-border pt-1.5">
          <h4 className="mb-1 font-semibold text-muted-foreground">
            {t("combat.tools.rolls")}
          </h4>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5" data-choice-rolls>
            {rolls.map(([propertyId, count]) => (
              <div
                key={propertyId}
                className="flex min-w-0 justify-between gap-2"
              >
                <dt className="truncate text-muted-foreground">
                  {labels.stat(propertyId)}
                </dt>
                <dd className="font-mono font-bold tabular-nums">{count}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {onUse && !current && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 w-full gap-1.5 text-xs font-semibold"
          onClick={onUse}
        >
          <Check className="h-3.5 w-3.5" aria-hidden />
          {t(
            entry.lightCone ? "teamChoice.useLightCone" : "teamChoice.useSets"
          )}
        </Button>
      )}
    </div>
  );
}
