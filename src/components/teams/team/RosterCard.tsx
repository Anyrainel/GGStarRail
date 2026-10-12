import { CircleSlash, MoreVertical, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { ItemIcon, type ItemIconSize } from "@/components/shared/ItemIcon";
import { ItemPicker } from "@/components/shared/ItemPicker";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { canonicalCharacterId } from "@/domain/characterIdentity";
import type { TeamMemberPlan, TeamPlan } from "@/domain/team/schemas";
import { useElementWidth } from "@/hooks/useElementWidth";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import { cn } from "@/lib/utils";
import { ownedCharacter } from "@/services/combat/accountTeam";
import type { MemberOutcome } from "@/services/combat/jobs";
import { VALUE_ORIGIN_LABEL_KEYS } from "@/services/combat/presentation";
import type { MemberPreview } from "@/services/combat/teamPreview";
import { useTeamStore } from "@/stores/useTeamStore";
import { MemberOptions } from "../MemberOptions";
import { CompactSelect } from "./Controls";
import { releaseOwnedOnly } from "./gridView";
import { useLightConeChoices } from "./lightConeChoices";
import { CavernCell, PlanarCell } from "./MemberSetCells";
import { TeamCharacterGrid } from "./TeamCharacterGrid";
import { useTeamDmgData } from "./TeamDmgData";
import { TeamSectionCard } from "./TeamSectionCard";
import { firstEmptySlot } from "./teamNames";

const SKILL_USAGE_KEYS = {
  kit: "combat.member.skillUsage.kit",
  prefer: "combat.member.skillUsage.prefer",
  avoid: "combat.member.skillUsage.avoid",
} as const satisfies Record<TeamMemberPlan["skill"], MessageKey>;

const ICON_WIDTH: Record<ItemIconSize, number> = {
  xs: 40,
  sm: 48,
  md: 56,
  lg: 64,
  xl: 80,
};
const SIZE_ORDER: readonly ItemIconSize[] = ["xs", "sm", "md", "lg", "xl"];

function smaller(size: ItemIconSize): ItemIconSize {
  return SIZE_ORDER[Math.max(0, SIZE_ORDER.indexOf(size) - 1)] ?? "xs";
}

/**
 * Icon sizes for a tile's row of four icons: by viewport (< 560, < 1024,
 * desktop), then stepped down until the row fits the measured tile.
 */
function useRowSizes(width: number | null): {
  character: ItemIconSize;
  gear: ItemIconSize;
} {
  const narrow = useMediaQuery("(max-width: 559px)");
  const compact = useMediaQuery("(max-width: 1023px)");
  const tablet = useMediaQuery("(min-width: 768px)");
  let character: ItemIconSize = narrow ? "sm" : compact ? "md" : "xl";
  let gear: ItemIconSize = narrow ? "xs" : compact ? "sm" : "lg";
  if (width === null) return { character, gear };
  const gap = tablet ? 6 : 2;
  const fits = () =>
    ICON_WIDTH[character] + 3 * ICON_WIDTH[gear] + 3 * gap <= width;
  while (!fits() && gear !== "xs") gear = smaller(gear);
  while (!fits() && character !== "xs") character = smaller(character);
  return { character, gear };
}

function SelectCell({
  children,
  divided = false,
}: {
  children: ReactNode;
  divided?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center justify-center",
        divided && "border-l border-border pl-0.5 lg:pl-1"
      )}
    >
      {children}
    </div>
  );
}

const CELL_SELECT =
  "h-6 w-full justify-center border-0 bg-transparent px-1 text-center text-xs font-bold shadow-none hover:bg-accent/40 lg:h-7 lg:px-1.5 lg:text-sm md:h-6 md:text-xs";

function MemberTile({
  team,
  slot,
  plan,
  member,
  outcome,
}: {
  team: TeamPlan;
  slot: number;
  plan: TeamMemberPlan;
  member: MemberPreview;
  outcome: MemberOutcome | undefined;
}) {
  const { t } = useI18n();
  const { references, items, lookup, account } = useTeamDmgData();
  const setMember = useTeamStore((state) => state.setMember);
  const updateMember = useTeamStore((state) => state.updateMember);
  const removeMember = useTeamStore((state) => state.removeMember);
  const [rowRef, rowWidth] = useElementWidth<HTMLDivElement>();
  const sizes = useRowSizes(rowWidth);
  const character = references.characters.byId.get(plan.characterId);
  const characterItem = lookup.characters.get(plan.characterId);
  const name = characterItem?.name ?? plan.characterId;
  const others = new Set(
    team.members.flatMap((entry, index) =>
      entry && index !== slot ? [canonicalCharacterId(entry.characterId)] : []
    )
  );
  const characterItems = items.characters.filter(
    (item) => !others.has(canonicalCharacterId(item.id))
  );
  const lightConeChoices = useLightConeChoices()(character?.path_id);
  const lightCone = member.lightCone;
  const lightConeItem = lightCone
    ? lookup.lightCones.get(lightCone.id)
    : undefined;
  const notModeled = t("combat.member.notModeled");
  const characterNotModeled = outcome?.implemented.character === false;
  const lightConeNotModeled = outcome?.implemented.lightCone === false;
  const update = (patch: Partial<TeamMemberPlan>) =>
    updateMember(team.id, slot, patch);
  const origin = (value: keyof typeof VALUE_ORIGIN_LABEL_KEYS) =>
    t(VALUE_ORIGIN_LABEL_KEYS[value]);
  const eidolonValue = t("combat.member.eidolonShort", {
    value: member.eidolon,
  });

  return (
    <article
      aria-label={name}
      data-roster-slot={slot}
      className="flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-background/20 p-1 xl:p-2"
    >
      <div ref={rowRef} className="flex min-w-0 items-end gap-0.5 md:gap-1.5">
        <ItemPicker
          kind="character"
          label={t("teamDmg.member.character")}
          value={plan.characterId}
          items={characterItems}
          triggerSize={sizes.character}
          badge={member.eidolon}
          iconMuted={account !== null && !member.owned}
          onChange={(id) => {
            if (id === plan.characterId) return;
            setMember(team.id, slot, id);
            releaseOwnedOnly(account, id);
          }}
          renderTrigger={
            characterNotModeled && characterItem
              ? () => (
                  <ItemIcon
                    kind="character"
                    id={characterItem.id}
                    sourcePath={characterItem.iconPath}
                    rarity={characterItem.rarity}
                    cornerAsset={characterItem.cornerAsset}
                    size={sizes.character}
                    marker={{ icon: CircleSlash, label: notModeled }}
                    alt=""
                    aria-hidden="true"
                  />
                )
              : undefined
          }
        />
        <ItemPicker
          kind="light-cone"
          square
          label={t("combat.member.lightCone")}
          triggerLabel={
            lightConeItem
              ? `${t("combat.member.lightCone")}: ${lightConeItem.name} · ${origin(member.lightConeOrigin)}`
              : undefined
          }
          value={lightCone?.id ?? null}
          items={lightConeChoices.items}
          filters={lightConeChoices.filters}
          triggerSize={sizes.gear}
          badge={lightCone?.superimposition}
          iconMuted={
            account !== null &&
            !!lightCone &&
            !account.lightCones.some(
              (copy) => copy.definitionId === lightCone.id
            )
          }
          onChange={(id) =>
            update({
              lightCone: {
                id,
              },
            })
          }
          onClear={() => update({ lightCone: null })}
          renderTrigger={
            lightConeNotModeled && lightConeItem
              ? () => (
                  <ItemIcon
                    kind="light-cone"
                    square
                    id={lightConeItem.id}
                    sourcePath={lightConeItem.iconPath}
                    rarity={lightConeItem.rarity}
                    size={sizes.gear}
                    marker={{ icon: CircleSlash, label: notModeled }}
                    alt=""
                    aria-hidden="true"
                  />
                )
              : undefined
          }
        />
        <CavernCell
          team={team}
          slot={slot}
          member={member}
          size={sizes.gear}
          lookup={lookup}
        />
        <PlanarCell
          team={team}
          slot={slot}
          member={member}
          size={sizes.gear}
          lookup={lookup}
        />
      </div>

      <div className="flex min-w-0 items-center gap-1">
        <span className="min-w-0 flex-1 truncate text-xs font-bold md:text-base lg:text-sm xl:text-base">
          {name}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 p-0 xl:h-7 xl:w-7"
              aria-label={`${t("teamDmg.member.actions")}: ${name}`}
            >
              <MoreVertical className="h-4 w-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-w-72">
            <DropdownMenuLabel className="space-y-0.5 text-xs font-normal text-muted-foreground">
              <span className="block">
                {t("teamDmg.member.lightConeOrigin", {
                  origin: origin(member.lightConeOrigin),
                })}
              </span>
              <span className="block">
                {t("teamDmg.member.relicOrigin", {
                  origin:
                    member.relicSource === "equipped"
                      ? `${t("combat.member.relicsEquipped")} · ${origin("account")}`
                      : origin(member.setPlanOrigin),
                })}
              </span>
              <span className="block">
                {t("teamDmg.member.eidolonOrigin", {
                  origin: origin(member.eidolonOrigin),
                })}
              </span>
            </DropdownMenuLabel>
            {plan.lightCone !== undefined && (
              <DropdownMenuItem
                onSelect={() => update({ lightCone: undefined })}
              >
                {t("teamDmg.member.useDefaultLightCone")}
              </DropdownMenuItem>
            )}
            {plan.setPlan !== undefined && (
              <DropdownMenuItem onSelect={() => update({ setPlan: undefined })}>
                {t("teamDmg.member.useDefaultSets")}
              </DropdownMenuItem>
            )}
            {plan.eidolon !== undefined && (
              <DropdownMenuItem onSelect={() => update({ eidolon: undefined })}>
                {t("teamDmg.member.useAccountEidolon")}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => removeMember(team.id, slot)}
            >
              {t("combat.member.remove")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-col rounded-md border border-border px-1 py-0.5 lg:px-2 lg:py-1">
        <div className="flex min-w-0 items-center">
          <SelectCell>
            <span className="text-xs font-bold tabular-nums lg:text-sm">
              {t("teamDmg.level", { value: member.level })}
            </span>
          </SelectCell>
          <SelectCell divided>
            <CompactSelect
              label={t("combat.member.eidolon")}
              value={plan.eidolon === undefined ? "auto" : String(plan.eidolon)}
              display={eidolonValue}
              options={[
                {
                  value: "auto",
                  label: t("combat.member.automatic", {
                    origin: origin(
                      member.accountEidolon === null ? "default" : "account"
                    ),
                    value: t("combat.member.eidolonShort", {
                      value: member.accountEidolon ?? 0,
                    }),
                  }),
                },
                ...[0, 1, 2, 3, 4, 5, 6].map((value) => ({
                  value: String(value),
                  label: t("combat.member.eidolonShort", { value }),
                })),
              ]}
              onValueChange={(value) =>
                update({
                  eidolon: value === "auto" ? undefined : Number(value),
                })
              }
              className={CELL_SELECT}
            />
          </SelectCell>
          <SelectCell divided>
            {lightCone ? (
              <CompactSelect
                label={t("combat.member.superimposition")}
                value={String(lightCone.superimposition)}
                options={[1, 2, 3, 4, 5].map((value) => ({
                  value: String(value),
                  label: t("combat.member.superimpositionShort", { value }),
                }))}
                onValueChange={(value) =>
                  update({
                    lightCone: {
                      id: lightCone.id,
                      superimposition: Number(value),
                    },
                  })
                }
                className={CELL_SELECT}
              />
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </SelectCell>
        </div>
        <div className="flex min-w-0 items-center border-t border-border pt-0.5 md:pt-1">
          <SelectCell>
            <CompactSelect
              label={t("combat.member.relics")}
              value={member.relicSource}
              options={[
                {
                  value: "equipped",
                  label: t("combat.member.relicsEquipped"),
                  disabled: !member.owned,
                },
                { value: "ideal", label: t("combat.member.relicsIdeal") },
              ]}
              onValueChange={(value) =>
                update({ relics: value as "equipped" | "ideal" })
              }
              className={CELL_SELECT}
            />
          </SelectCell>
          <SelectCell divided>
            <CompactSelect
              label={t("combat.member.skillUsage")}
              value={plan.skill}
              options={(
                Object.keys(SKILL_USAGE_KEYS) as TeamMemberPlan["skill"][]
              ).map((value) => ({ value, label: t(SKILL_USAGE_KEYS[value]) }))}
              onValueChange={(value) =>
                update({ skill: value as TeamMemberPlan["skill"] })
              }
              className={CELL_SELECT}
            />
          </SelectCell>
        </div>
      </div>

      {character && outcome && outcome.optionGroups.length > 0 && (
        <MemberOptions
          character={character}
          references={references}
          groups={outcome.optionGroups}
          values={plan.options}
          onChange={(options) => update({ options })}
        />
      )}
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
        className="hidden items-center justify-center py-4 sm:flex"
        data-roster-slot={slot}
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
      data-roster-slot={slot}
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

/**
 * The team's four members as tiles: gear icons, value sources, Eidolon,
 * Superimposition, Relic source, Skill use and kit conditions.
 */
export function RosterCard({
  team,
  outcomes,
}: {
  team: TeamPlan;
  outcomes: readonly MemberOutcome[] | null;
}) {
  const { t } = useI18n();
  const { previewOf, account, references } = useTeamDmgData();
  const updateMember = useTeamStore((state) => state.updateMember);
  const preview = previewOf(team);
  const firstEmpty = firstEmptySlot(team);
  return (
    <TeamSectionCard
      icon={UsersRound}
      title={t("teamDmg.roster.title")}
      data-section="roster"
      headerClassName="flex-wrap sm:flex-nowrap"
      action={
        <div className="flex w-full flex-wrap justify-end gap-1 sm:w-auto">
          <Button
            variant="ghost"
            size="sm"
            className="h-auto min-h-7 px-2 text-xs"
            onClick={() =>
              team.members.forEach((plan, slot) => {
                if (!plan) return;
                const owned = ownedCharacter(account, plan.characterId);
                const cone = preview.get(slot)?.lightCone;
                updateMember(team.id, slot, {
                  level: owned?.level ?? 80,
                  eidolon: owned?.eidolon ?? 0,
                  ...(cone ? { lightCone: { id: cone.id } } : {}),
                });
              })
            }
          >
            {t("teamAnalysis.useAccount")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto min-h-7 px-2 text-xs"
            onClick={() =>
              team.members.forEach((plan, slot) => {
                if (!plan) return;
                const cone = preview.get(slot)?.lightCone;
                updateMember(team.id, slot, {
                  ...(references.characters.byId.get(plan.characterId)
                    ?.rarity === 5
                    ? { eidolon: 0 }
                    : {}),
                  ...(cone &&
                  references.lightCones.byId.get(cone.id)?.rarity === 5
                    ? { lightCone: { id: cone.id, superimposition: 1 } }
                    : {}),
                });
              })
            }
          >
            {t("teamAnalysis.resetFive")}
          </Button>
        </div>
      }
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
          return (
            <MemberTile
              // biome-ignore lint/suspicious/noArrayIndexKey: slots are positional
              key={slot}
              team={team}
              slot={slot}
              plan={plan}
              member={member}
              outcome={outcomes?.find(
                (entry) =>
                  entry.slot === slot && entry.characterId === plan.characterId
              )}
            />
          );
        })}
      </TeamCharacterGrid>
    </TeamSectionCard>
  );
}
