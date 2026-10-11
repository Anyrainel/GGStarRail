import { UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { CompactSelect } from "@/components/damage/team/Controls";
import { releaseOwnedOnly } from "@/components/damage/team/gridView";
import { useLightConeChoices } from "@/components/damage/team/lightConeChoices";
import { TeamCharacterGrid } from "@/components/damage/team/TeamCharacterGrid";
import { useTeamDmgData } from "@/components/damage/team/TeamDmgData";
import { TeamSectionCard } from "@/components/damage/team/TeamSectionCard";
import { firstEmptySlot } from "@/components/damage/team/teamNames";
import { CatalogHoverCard } from "@/components/shared/CatalogHoverCard";
import { ItemIcon, type ItemIconSize } from "@/components/shared/ItemIcon";
import { ItemPicker } from "@/components/shared/ItemPicker";
import { canonicalCharacterId } from "@/domain/characterIdentity";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useI18n } from "@/i18n/I18nContext";
import { VALUE_ORIGIN_LABEL_KEYS } from "@/lib/combat/presentation";
import type { MemberPreview } from "@/lib/combat/teamPreview";
import type { TeamMemberPlan, TeamPlan } from "@/stores/teamSchemas";
import { useTeamStore } from "@/stores/useTeamStore";
import { DEFAULT_LIMITS, type InvestmentLimits } from "./investmentModel";

const EIDOLONS = [0, 1, 2, 3, 4, 5, 6] as const;
const SUPERIMPOSITIONS = [1, 2, 3, 4, 5] as const;

/** Icon sizes by viewport: < 560, 560–1023, 1024–1279, from 1280. */
function useTileSizes(): { character: ItemIconSize; lightCone: ItemIconSize } {
  const narrow = useMediaQuery("(max-width: 559px)");
  const tablet = useMediaQuery("(min-width: 560px) and (max-width: 1023px)");
  const laptop = useMediaQuery("(min-width: 1024px) and (max-width: 1279px)");
  if (narrow) return { character: "xs", lightCone: "xs" };
  if (laptop) return { character: "md", lightCone: "sm" };
  if (tablet) return { character: "xl", lightCone: "lg" };
  return { character: "xl", lightCone: "lg" };
}

const SELECT_CLASS =
  "w-16 justify-center px-1 text-center md:w-20 md:px-1.5 lg:h-6 lg:w-16 lg:px-1 lg:text-xs xl:h-7 xl:w-20 xl:px-1.5 xl:text-sm [&>span]:flex-1 [&>span]:text-center";

/** A bordered "From" / "To" line: label, Eidolon select, Superimposition select. */
function BoundBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col rounded-md border border-border px-1 py-0.5 md:px-2 md:py-1 lg:px-1 lg:py-0.5 xl:px-2 xl:py-1">
      <div className="flex items-center justify-center gap-1">
        <span className="w-9 shrink-0 whitespace-nowrap text-right text-[10px] font-bold text-muted-foreground md:w-11 md:text-sm lg:w-9 lg:text-xs xl:w-11 xl:text-sm">
          {label}
        </span>
        {children}
      </div>
    </div>
  );
}

function InvestmentTile({
  team,
  slot,
  plan,
  member,
  limits,
  onLimitsChange,
}: {
  team: TeamPlan;
  slot: number;
  plan: TeamMemberPlan;
  member: MemberPreview;
  limits: InvestmentLimits;
  onLimitsChange: (limits: InvestmentLimits) => void;
}) {
  const { t } = useI18n();
  const { references, lookup } = useTeamDmgData();
  const updateMember = useTeamStore((state) => state.updateMember);
  const sizes = useTileSizes();
  const character = references.characters.byId.get(plan.characterId);
  const characterItem = lookup.characters.get(plan.characterId);
  const name = characterItem?.name ?? plan.characterId;
  const lightCone = member.lightCone;
  const lightConeItem = lightCone
    ? lookup.lightCones.get(lightCone.id)
    : undefined;
  const lightConeChoices = useLightConeChoices()(character?.path_id);
  const update = (patch: Partial<TeamMemberPlan>) =>
    updateMember(team.id, slot, patch);
  const eidolonLabel = (value: number) =>
    t("teamInvestment.eidolonShort", { value });
  const superimpositionLabel = (value: number) =>
    t("teamInvestment.superimpositionShort", { value });
  const toEidolon = Math.max(limits.eidolon, member.eidolon);
  const toSuperimposition = lightCone
    ? Math.max(limits.superimposition, lightCone.superimposition)
    : null;

  return (
    <article
      aria-label={name}
      data-investment-slot={slot}
      className="flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-background/20 p-1 xl:p-2"
    >
      <div className="flex min-w-0 items-end gap-0.5 md:gap-1.5 lg:gap-0.5 2xl:gap-1.5">
        <CatalogHoverCard kind="character" id={plan.characterId}>
          <span className="shrink-0 cursor-help">
            <ItemIcon
              kind="character"
              id={plan.characterId}
              sourcePath={characterItem?.iconPath}
              rarity={characterItem?.rarity ?? null}
              cornerAsset={characterItem?.cornerAsset}
              size={sizes.character}
              alt={name}
            />
          </span>
        </CatalogHoverCard>
        <ItemPicker
          kind="light-cone"
          square
          label={t("combat.member.lightCone")}
          triggerLabel={
            lightConeItem
              ? `${t("combat.member.lightCone")}: ${lightConeItem.name} · ${t(VALUE_ORIGIN_LABEL_KEYS[member.lightConeOrigin])}`
              : undefined
          }
          value={lightCone?.id ?? null}
          items={lightConeChoices.items}
          filters={lightConeChoices.filters}
          triggerSize={sizes.lightCone}
          onChange={(id) =>
            update({
              lightCone: {
                id,
                superimposition: lightCone?.superimposition ?? 1,
              },
            })
          }
          onClear={() => update({ lightCone: null })}
        />
      </div>

      <div className="flex min-w-0 items-baseline">
        <span
          className="min-w-0 truncate pl-1 text-xs font-bold md:text-base lg:text-sm xl:pl-1.5 xl:text-base"
          title={name}
        >
          {name}
        </span>
      </div>

      <BoundBox label={t("teamInvestment.from")}>
        <CompactSelect
          label={t("teamInvestment.fromEidolon")}
          value={plan.eidolon === undefined ? "auto" : String(plan.eidolon)}
          display={eidolonLabel(member.eidolon)}
          options={[
            {
              value: "auto",
              label: t("combat.member.automatic", {
                origin: t(
                  VALUE_ORIGIN_LABEL_KEYS[
                    member.accountEidolon === null ? "default" : "account"
                  ]
                ),
                value: eidolonLabel(member.accountEidolon ?? 0),
              }),
            },
            ...EIDOLONS.map((value) => ({
              value: String(value),
              label: eidolonLabel(value),
            })),
          ]}
          onValueChange={(value) =>
            update({ eidolon: value === "auto" ? undefined : Number(value) })
          }
          className={SELECT_CLASS}
        />
        {lightCone && (
          <CompactSelect
            label={t("teamInvestment.fromSuperimposition")}
            value={String(lightCone.superimposition)}
            display={superimpositionLabel(lightCone.superimposition)}
            options={SUPERIMPOSITIONS.map((value) => ({
              value: String(value),
              label: superimpositionLabel(value),
            }))}
            onValueChange={(value) =>
              update({
                lightCone: { id: lightCone.id, superimposition: Number(value) },
              })
            }
            className={SELECT_CLASS}
          />
        )}
      </BoundBox>

      <BoundBox label={t("teamInvestment.to")}>
        <CompactSelect
          label={t("teamInvestment.toEidolon")}
          value={String(toEidolon)}
          display={eidolonLabel(toEidolon)}
          options={EIDOLONS.map((value) => ({
            value: String(value),
            label: eidolonLabel(value),
            disabled: value < member.eidolon,
          }))}
          onValueChange={(value) =>
            onLimitsChange({ ...limits, eidolon: Number(value) })
          }
          className={SELECT_CLASS}
        />
        {lightCone && toSuperimposition !== null && (
          <CompactSelect
            label={t("teamInvestment.toSuperimposition")}
            value={String(toSuperimposition)}
            display={superimpositionLabel(toSuperimposition)}
            options={SUPERIMPOSITIONS.map((value) => ({
              value: String(value),
              label: superimpositionLabel(value),
              disabled: value < lightCone.superimposition,
            }))}
            onValueChange={(value) =>
              onLimitsChange({ ...limits, superimposition: Number(value) })
            }
            className={SELECT_CLASS}
          />
        )}
      </BoundBox>
    </article>
  );
}

function EmptySlot({
  team,
  slot,
  interactive,
}: {
  team: TeamPlan;
  slot: number;
  interactive: boolean;
}) {
  const { t } = useI18n();
  const { items, account } = useTeamDmgData();
  const setMember = useTeamStore((state) => state.setMember);
  if (!interactive)
    return (
      <div
        className="flex items-center justify-center py-4"
        data-investment-slot={slot}
        aria-hidden
      >
        <div className="h-14 w-14 rounded-full border-2 border-dashed border-border" />
      </div>
    );
  const onTeam = new Set(
    team.members.flatMap((entry) =>
      entry ? [canonicalCharacterId(entry.characterId)] : []
    )
  );
  return (
    <div
      className="flex min-h-[80px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border p-1 lg:min-h-[100px] lg:gap-2 lg:p-2"
      data-investment-slot={slot}
    >
      <ItemPicker
        kind="character"
        label={t("combat.slot.add")}
        value={null}
        items={items.characters.filter(
          (item) => !onTeam.has(canonicalCharacterId(item.id))
        )}
        triggerSize="md"
        onChange={(id) => {
          setMember(team.id, slot, id);
          releaseOwnedOnly(account, id);
        }}
      />
    </div>
  );
}

/** Key of a member's "To" limits: they follow the Character, not the slot. */
export function limitsKey(slot: number, characterId: string): string {
  return `${slot}:${characterId}`;
}

/**
 * The Investment roster: each member's Character and Light Cone, the state
 * the run starts from (team overrides) and the highest copies it may reach.
 */
export function InvestmentRoster({
  team,
  limits,
  onLimitsChange,
}: {
  team: TeamPlan;
  limits: Readonly<Record<string, InvestmentLimits>>;
  onLimitsChange: (key: string, limits: InvestmentLimits) => void;
}) {
  const { t } = useI18n();
  const { previewOf } = useTeamDmgData();
  const preview = previewOf(team);
  const firstEmpty = firstEmptySlot(team);
  return (
    <TeamSectionCard
      icon={UsersRound}
      title={t("teamDmg.roster.title")}
      data-section="investment-roster"
    >
      <TeamCharacterGrid>
        {team.members.map((plan, slot) => {
          const member = preview.get(slot);
          if (!plan || !member)
            return (
              <EmptySlot
                // biome-ignore lint/suspicious/noArrayIndexKey: slots are positional
                key={slot}
                team={team}
                slot={slot}
                interactive={slot === firstEmpty}
              />
            );
          const key = limitsKey(slot, plan.characterId);
          return (
            <InvestmentTile
              // biome-ignore lint/suspicious/noArrayIndexKey: slots are positional
              key={slot}
              team={team}
              slot={slot}
              plan={plan}
              member={member}
              limits={limits[key] ?? DEFAULT_LIMITS}
              onLimitsChange={(next) => onLimitsChange(key, next)}
            />
          );
        })}
      </TeamCharacterGrid>
    </TeamSectionCard>
  );
}
