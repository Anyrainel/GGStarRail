import type { ItemIconSize } from "@/components/shared/ItemIcon";
import {
  CavernPlanPicker,
  PlanarSetPicker,
} from "@/components/shared/relic/CavernPlanPicker";
import {
  CavernBonusIcon,
  PlanarSetIcon,
  type SetRef,
} from "@/components/shared/relic/SetPlanIcon";
import type { TeamPlan } from "@/domain/team/schemas";
import { useI18n } from "@/i18n/I18nContext";
import { equippedSetSummary } from "@/services/catalog/relicPresentation";
import { VALUE_ORIGIN_LABEL_KEYS } from "@/services/combat/presentation";
import type { MemberPreview } from "@/services/combat/teamPreview";
import { useTeamStore } from "@/stores/useTeamStore";
import { useTeamDmgData } from "./TeamDmgData";
import type { MemberItemLookup } from "./types";

interface SetCellProps {
  team: TeamPlan;
  slot: number;
  /** The slot's preview; absent for an empty slot. */
  member: MemberPreview | undefined;
  size: ItemIconSize;
  lookup: MemberItemLookup;
  disabled?: boolean;
}

function setRef(lookup: MemberItemLookup, setId: string): SetRef {
  const item = lookup.relicSets.get(setId);
  return {
    id: setId,
    name: item?.name ?? setId,
    rarity: item?.rarity ?? null,
    iconPath: item?.iconPath ?? null,
  };
}

function useOriginTitle(member: MemberPreview | undefined): string | undefined {
  const { t } = useI18n();
  if (!member) return undefined;
  return member.relicSource === "equipped"
    ? `${t("teamDmg.member.equippedSets")} · ${t(VALUE_ORIGIN_LABEL_KEYS.account)}`
    : t("teamDmg.member.relicOrigin", {
        origin: t(VALUE_ORIGIN_LABEL_KEYS[member.setPlanOrigin]),
      });
}

/**
 * The member's Cavern Relic plan: a picker (4-piece or 2+2) for ideal Relics,
 * the bonuses equipped Relics activate (a lone 2-piece included) for equipped
 * Relics, disabled for an empty slot.
 */
export function CavernCell({
  team,
  slot,
  member,
  size,
  lookup,
  disabled,
}: SetCellProps) {
  const { t } = useI18n();
  const { items } = useTeamDmgData();
  const updateMember = useTeamStore((state) => state.updateMember);
  const title = useOriginTitle(member);
  if (member?.relicSource === "equipped") {
    const summary = equippedSetSummary(member.equippedRelics);
    return (
      <span title={title} className="inline-flex">
        <CavernBonusIcon
          bonuses={summary.cavern.map((entry) => ({
            set: setRef(lookup, entry.setId),
            tier: entry.tier,
          }))}
          size={size}
        />
      </span>
    );
  }
  const planned = member?.plannedSets;
  return (
    <CavernPlanPicker
      label={t("combat.member.cavernSet")}
      value={planned?.cavern ?? []}
      items={items.cavernSets}
      triggerSize={size}
      disabled={disabled || !member}
      onChange={(next) =>
        updateMember(team.id, slot, {
          setPlan: { cavern: [...next], planar: planned?.planar ?? null },
        })
      }
      onClear={() =>
        updateMember(team.id, slot, {
          setPlan: { cavern: [], planar: planned?.planar ?? null },
        })
      }
      title={title}
    />
  );
}

/** The member's Planar Ornament set, like {@link CavernCell}. */
export function PlanarCell({
  team,
  slot,
  member,
  size,
  lookup,
  disabled,
}: SetCellProps) {
  const { t } = useI18n();
  const { items } = useTeamDmgData();
  const updateMember = useTeamStore((state) => state.updateMember);
  const title = useOriginTitle(member);
  if (member?.relicSource === "equipped") {
    const summary = equippedSetSummary(member.equippedRelics);
    return (
      <span title={title} className="inline-flex">
        <PlanarSetIcon
          set={summary.planar ? setRef(lookup, summary.planar.setId) : null}
          size={size}
        />
      </span>
    );
  }
  const planned = member?.plannedSets;
  return (
    <PlanarSetPicker
      label={t("combat.member.planarSet")}
      value={planned?.planar ?? null}
      items={items.planarSets}
      triggerSize={size}
      disabled={disabled || !member}
      onChange={(id) =>
        updateMember(team.id, slot, {
          setPlan: { cavern: [...(planned?.cavern ?? [])], planar: id },
        })
      }
      onClear={() =>
        updateMember(team.id, slot, {
          setPlan: { cavern: [...(planned?.cavern ?? [])], planar: null },
        })
      }
      title={title}
    />
  );
}
