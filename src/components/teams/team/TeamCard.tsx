import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from "@dnd-kit/core";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Gem,
  GripVertical,
  MoreVertical,
  Orbit,
  Trash2,
  UserRound,
  WandSparkles,
} from "lucide-react";
import { type CSSProperties, type Ref, useEffect, useState } from "react";
import { AssetImage } from "@/components/shared/AssetImage";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ItemPicker } from "@/components/shared/ItemPicker";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { canonicalCharacterId } from "@/domain/characterIdentity";
import type { TeamPlan } from "@/domain/team/schemas";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";
import { localizedName } from "@/services/catalog/presentation";
import { forgetTeamResults } from "@/services/combat/resultCache";
import { useTeamStore } from "@/stores/useTeamStore";
import { useLightConeChoices } from "./lightConeChoices";
import { CavernCell, PlanarCell } from "./MemberSetCells";
import { useTeamDmgData } from "./TeamDmgData";
import {
  firstEmptySlot,
  lastFilledSlot,
  teamDisplayName,
  teamPlaceholderName,
} from "./teamNames";
import { TEAM_DMG_TABS, type TeamDmgTab } from "./types";

export interface TeamCardDrag {
  readonly enabled: boolean;
  readonly setNodeRef: Ref<HTMLElement>;
  readonly setActivatorNodeRef: Ref<HTMLButtonElement>;
  readonly attributes: DraggableAttributes;
  readonly listeners: DraggableSyntheticListeners;
  readonly style: CSSProperties;
  readonly dragging: boolean;
}

interface TeamCardProps {
  team: TeamPlan;
  /** Position in the full list (1-based in the UI). */
  index: number;
  tab: TeamDmgTab;
  /** Every saved team, for "Team {n}" placeholders. */
  teams: readonly TeamPlan[];
  onOpen: (teamId: string) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  /** A virtual card shown before any team exists; picks create the team. */
  ghost?: boolean;
  /** Ghost only: the first Character pick. */
  onGhostPick?: (characterId: string) => void;
  hidden?: boolean;
  order?: number;
  /** All filled members are unowned (with an account): shown faded. */
  unowned?: boolean;
  /** After a Character is picked into the team. */
  onCharacterPick?: (characterId: string) => void;
  drag?: TeamCardDrag;
}

const ROW_ICON = "h-3 w-3 text-muted-foreground xl:h-3.5 xl:w-3.5";

function TeamNameInput({
  team,
  teams,
  disabled,
}: {
  team: TeamPlan;
  teams: readonly TeamPlan[];
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const renameTeam = useTeamStore((state) => state.renameTeam);
  const [draft, setDraft] = useState(team.name ?? "");
  useEffect(() => setDraft(team.name ?? ""), [team.name]);
  return (
    <input
      value={draft}
      maxLength={80}
      disabled={disabled}
      aria-label={t("teamDmg.teamName")}
      placeholder={teamPlaceholderName(team, teams, t)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if ((team.name ?? "") !== draft.trim()) renameTeam(team.id, draft);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(team.name ?? "");
          event.currentTarget.blur();
        }
      }}
      className="h-6 min-w-0 flex-1 rounded-md border-0 bg-transparent px-1.5 text-xs font-semibold outline-hidden placeholder:text-muted-foreground hover:bg-accent/40 focus-visible:bg-background/40 focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-default xl:h-7 xl:px-2 xl:text-sm"
    />
  );
}

/**
 * A team in the grid: name, a 4-column icon grid (Combat Type, Character,
 * Light Cone, Cavern Relic plan, Planar Ornament set) and the button that
 * opens the tab's detail.
 */
export function TeamCard({
  team,
  index,
  tab,
  teams,
  onOpen,
  onMoveUp,
  onMoveDown,
  ghost = false,
  onGhostPick,
  hidden = false,
  order,
  unowned = false,
  onCharacterPick,
  drag,
}: TeamCardProps) {
  const { locale, t } = useI18n();
  const { references, items, lookup, previewOf } = useTeamDmgData();
  const lightConeChoices = useLightConeChoices();
  const setMember = useTeamStore((state) => state.setMember);
  const updateMember = useTeamStore((state) => state.updateMember);
  const removeMember = useTeamStore((state) => state.removeMember);
  const duplicateTeam = useTeamStore((state) => state.duplicateTeam);
  const removeTeam = useTeamStore((state) => state.removeTeam);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const preview = previewOf(team);
  const meta = TEAM_DMG_TABS[tab];
  const FooterIcon = meta.icon;
  const firstEmpty = firstEmptySlot(team);
  const lastFilled = lastFilledSlot(team);
  const hasMember = lastFilled >= 0;
  /** Characters for one slot: everyone not already on another slot. */
  const characterItemsFor = (slot: number) => {
    const others = new Set(
      team.members.flatMap((member, index) =>
        member && index !== slot
          ? [canonicalCharacterId(member.characterId)]
          : []
      )
    );
    return items.characters.filter(
      (item) => !others.has(canonicalCharacterId(item.id))
    );
  };
  const slots = [0, 1, 2, 3] as const;
  const characterOf = (slot: number) => {
    const plan = team.members[slot];
    return plan ? references.characters.byId.get(plan.characterId) : undefined;
  };

  function pickCharacter(slot: number, characterId: string) {
    if (ghost) {
      onGhostPick?.(characterId);
      return;
    }
    const target = team.members[slot] ? slot : Math.max(0, firstEmpty);
    setMember(team.id, target, characterId);
    onCharacterPick?.(characterId);
  }

  return (
    <Card asChild className="shadow-none">
      <article
        ref={drag?.setNodeRef}
        style={{ ...drag?.style, order }}
        hidden={hidden}
        aria-label={teamDisplayName(team, teams, t)}
        data-team-card={ghost ? "ghost" : team.id}
        className={cn(
          "group mx-auto w-full max-w-[23.5rem] rounded-xl border xl:max-w-[24.5rem] border-border bg-card/40 backdrop-blur-md transition-colors hover:border-primary/40",
          unowned &&
            "opacity-50 grayscale transition-[filter,opacity] focus-within:opacity-100 focus-within:grayscale-0 hover:opacity-100 hover:grayscale-0",
          drag?.dragging && "z-20 shadow-2xl"
        )}
      >
        <CardHeader className="flex-row items-center gap-1 px-2 pb-0.5 pt-2 xl:gap-1.5 xl:px-3 xl:pb-1 xl:pt-3">
          {drag?.enabled ? (
            <button
              type="button"
              ref={drag.setActivatorNodeRef}
              {...drag.attributes}
              {...drag.listeners}
              aria-label={t("teamDmg.dragHandle")}
              title={t("teamDmg.dragHandle")}
              className="flex w-4 shrink-0 cursor-grab touch-none items-center justify-center rounded-sm text-muted-foreground outline-hidden hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing xl:w-5"
            >
              <GripVertical className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : (
            <span
              className="w-4 shrink-0 text-center text-[11px] font-bold tabular-nums text-muted-foreground xl:w-5 xl:text-xs"
              aria-hidden
            >
              {ghost ? 1 : index + 1}
            </span>
          )}
          <TeamNameInput team={team} teams={teams} disabled={ghost} />
          {!ghost && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 p-0 xl:h-7 xl:w-7"
                  aria-label={t("teamDmg.teamActions")}
                >
                  <MoreVertical className="h-4 w-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled={!onMoveUp} onSelect={onMoveUp}>
                  <ArrowUp className="h-4 w-4" aria-hidden />
                  {t("teamDmg.moveUp")}
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!onMoveDown} onSelect={onMoveDown}>
                  <ArrowDown className="h-4 w-4" aria-hidden />
                  {t("teamDmg.moveDown")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => duplicateTeam(team.id)}>
                  <Copy className="h-4 w-4" aria-hidden />
                  {t("combat.team.duplicate")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  {t("combat.team.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </CardHeader>

        <CardContent className="px-2 py-1.5 xl:px-3 xl:py-2">
          <div className="mx-auto grid w-fit grid-cols-[auto_repeat(4,auto)] items-center justify-items-center gap-1.5 pr-1 xl:gap-3 xl:pr-2">
            <span aria-hidden />
            {slots.map((slot) => {
              const character = characterOf(slot);
              const combatType = character
                ? references.properties.combatTypeById.get(
                    character.combat_type_id
                  )
                : undefined;
              return combatType ? (
                <AssetImage
                  key={`type-${slot}`}
                  kind="combat-type"
                  id={combatType.id}
                  sourcePath={combatType.icon_path}
                  alt={localizedName(combatType.name, locale, combatType.id)}
                  title={localizedName(combatType.name, locale, combatType.id)}
                  draggable={false}
                  className="h-4 w-4 object-contain xl:h-5 xl:w-5"
                />
              ) : (
                <span key={`type-${slot}`} className="h-4 w-4 xl:h-5 xl:w-5" />
              );
            })}

            <span title={t("teamDmg.row.characters")}>
              <UserRound className={ROW_ICON} aria-hidden />
            </span>
            {slots.map((slot) => {
              const plan = team.members[slot];
              const member = preview.get(slot);
              return (
                <ItemPicker
                  key={`character-${slot}`}
                  kind="character"
                  label={t("combat.slot.add")}
                  value={plan?.characterId ?? null}
                  items={characterItemsFor(slot)}
                  triggerSize="md"
                  badge={member?.eidolon}
                  onChange={(id) => pickCharacter(slot, id)}
                  onClear={
                    !ghost && plan && slot === lastFilled
                      ? () => removeMember(team.id, slot)
                      : undefined
                  }
                />
              );
            })}

            <span title={t("teamDmg.row.lightCones")}>
              <WandSparkles className={ROW_ICON} aria-hidden />
            </span>
            {slots.map((slot) => {
              const character = characterOf(slot);
              const member = preview.get(slot);
              return (
                <ItemPicker
                  key={`light-cone-${slot}`}
                  kind="light-cone"
                  square
                  label={t("combat.member.lightCone")}
                  value={member?.lightCone?.id ?? null}
                  {...lightConeChoices(character?.path_id)}
                  triggerSize="md"
                  badge={member?.lightCone?.superimposition}
                  disabled={!character || ghost}
                  onChange={(id) =>
                    updateMember(team.id, slot, {
                      lightCone: {
                        id,
                        superimposition:
                          member?.lightCone?.superimposition ?? 1,
                      },
                    })
                  }
                  onClear={() =>
                    updateMember(team.id, slot, { lightCone: null })
                  }
                />
              );
            })}

            <span title={t("teamDmg.row.cavern")}>
              <Gem className={ROW_ICON} aria-hidden />
            </span>
            {slots.map((slot) => (
              <CavernCell
                key={`cavern-${slot}`}
                team={team}
                slot={slot}
                member={preview.get(slot)}
                size="md"
                disabled={ghost}
                lookup={lookup}
              />
            ))}

            <span title={t("teamDmg.row.planar")}>
              <Orbit className={ROW_ICON} aria-hidden />
            </span>
            {slots.map((slot) => (
              <PlanarCell
                key={`planar-${slot}`}
                team={team}
                slot={slot}
                member={preview.get(slot)}
                size="md"
                disabled={ghost}
                lookup={lookup}
              />
            ))}
          </div>
        </CardContent>

        <CardFooter className="px-2 pb-2 pt-1.5 xl:px-3 xl:pb-3 xl:pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={!hasMember || ghost}
            onClick={() => onOpen(team.id)}
            className="h-8 w-full gap-1.5 text-xs font-semibold xl:h-9 xl:gap-2 xl:text-sm"
          >
            <FooterIcon className="h-3.5 w-3.5 xl:h-4 xl:w-4" aria-hidden />
            {t(meta.labelKey)}
          </Button>
        </CardFooter>

        {!ghost && (
          <ConfirmDialog
            open={confirmDelete}
            onOpenChange={setConfirmDelete}
            title={t("combat.team.delete")}
            description={t("combat.team.deleteConfirm", {
              name: teamDisplayName(team, teams, t),
            })}
            confirmLabel={t("combat.team.delete")}
            cancelLabel={t("common.cancel")}
            destructive
            onConfirm={() => {
              forgetTeamResults(team.id);
              removeTeam(team.id);
            }}
          />
        )}
      </article>
    </Card>
  );
}
