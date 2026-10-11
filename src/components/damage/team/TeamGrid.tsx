import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS as DndCss } from "@dnd-kit/utilities";
import {
  ArrowUpDown,
  Plus,
  SearchX,
  Swords,
  Trash2,
  UserRoundCheck,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/builds/ConfirmDialog";
import { PageActionButton, PageActions } from "@/components/layout/PageActions";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { AssetImage } from "@/components/shared/AssetImage";
import { CategoryChip } from "@/components/shared/CategoryChip";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterChipGroup } from "@/components/shared/FilterChipGroup";
import { SearchInput } from "@/components/shared/SearchInput";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { canonicalCharacterId } from "@/domain/characterIdentity";
import { PRIORITY_TIERS } from "@/domain/tier-list/constants";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/catalogPresentation";
import { clearResultCache } from "@/lib/combat/resultCache";
import { compareReleaseVersionsDescending } from "@/lib/releaseVersion";
import { equippedSetSummary } from "@/lib/relicPresentation";
import { cn } from "@/lib/utils";
import { emptyTeam, type TeamPlan } from "@/stores/teamSchemas";
import { useCharacterPriorityStore } from "@/stores/useCharacterPriorityStore";
import { useTeamStore } from "@/stores/useTeamStore";
import {
  type GridViewState,
  gridViewState,
  ownedOnlyActive,
  releaseOwnedOnly,
  saveGridViewState,
} from "./gridView";
import { TeamCard, type TeamCardDrag } from "./TeamCard";
import { useTeamDmgData } from "./TeamDmgData";
import { teamDisplayName, teamIsEmpty } from "./teamNames";
import type { TeamDmgTab } from "./types";

const GHOST_TEAM: TeamPlan = emptyTeam("team:ghost");

function SortableTeamCard({
  team,
  dragEnabled,
  ...props
}: Omit<Parameters<typeof TeamCard>[0], "drag"> & { dragEnabled: boolean }) {
  const sortable = useSortable({ id: team.id, disabled: !dragEnabled });
  const drag: TeamCardDrag = {
    enabled: dragEnabled,
    setNodeRef: sortable.setNodeRef,
    setActivatorNodeRef: sortable.setActivatorNodeRef,
    attributes: sortable.attributes,
    listeners: sortable.listeners,
    style: {
      transform: DndCss.Transform.toString(sortable.transform),
      transition: sortable.transition,
    },
    dragging: sortable.isDragging,
  };
  return <TeamCard team={team} drag={drag} {...props} />;
}

/**
 * Every saved team as a card grid with search, Combat Type and Path chips,
 * owned-only and sort toggles, and New team at either end. Shared by all
 * three Team DMG tabs; a card's footer opens the tab's detail.
 */
export function TeamGrid({
  tab,
  onOpen,
}: {
  tab: TeamDmgTab;
  onOpen: (teamId: string) => void;
}) {
  const { locale, t } = useI18n();
  const { references, lookup, account, previewOf } = useTeamDmgData();
  const teams = useTeamStore((state) => state.teams);
  const createTeam = useTeamStore((state) => state.createTeam);
  const setMember = useTeamStore((state) => state.setMember);
  const moveTeam = useTeamStore((state) => state.moveTeam);
  const clearTeams = useTeamStore((state) => state.clearTeams);
  const assignments = useCharacterPriorityStore((state) => state.assignments);
  const [view, setView] = useState<GridViewState>(() => gridViewState(tab));
  const [revealed, setRevealed] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function updateView(patch: Partial<GridViewState>) {
    setView((current) => {
      const next = { ...current, ...patch };
      saveGridViewState(tab, next);
      return next;
    });
  }

  /** Keeps a team visible after the user picks an unowned Character into it. */
  function notePick(characterId: string) {
    if (releaseOwnedOnly(account, characterId)) setView(gridViewState(tab));
  }

  function clearFilters() {
    updateView({
      query: "",
      combatTypes: new Set(),
      paths: new Set(),
      ownedOnly: false,
    });
  }

  const ownedOnly = ownedOnlyActive(view, account);
  const { properties, characters } = references;

  const teamFacts = useMemo(
    () =>
      new Map(
        teams.map((team) => {
          const preview = previewOf(team);
          const members = [...preview.values()];
          const definitions = members.flatMap((member) => {
            const definition = characters.byId.get(member.characterId);
            return definition ? [definition] : [];
          });
          const names = [
            team.name ?? "",
            teamDisplayName(team, teams, t),
            ...members.flatMap((member) => {
              const character = lookup.characters.get(member.characterId);
              const lightCone = member.lightCone
                ? lookup.lightCones.get(member.lightCone.id)
                : undefined;
              const setIds =
                member.relicSource === "equipped"
                  ? (() => {
                      const summary = equippedSetSummary(member.equippedRelics);
                      return [
                        ...summary.cavern.map((entry) => entry.setId),
                        ...(summary.planar ? [summary.planar.setId] : []),
                      ];
                    })()
                  : [
                      ...member.plannedSets.cavern,
                      ...(member.plannedSets.planar
                        ? [member.plannedSets.planar]
                        : []),
                    ];
              return [
                character?.name ?? "",
                character?.searchText ?? "",
                lightCone?.name ?? "",
                lightCone?.searchText ?? "",
                ...setIds.flatMap((id) => {
                  const set = lookup.relicSets.get(id);
                  return set ? [set.name, set.searchText] : [];
                }),
              ];
            }),
          ];
          const tierRanks = members.map((member) => {
            const placement =
              assignments[canonicalCharacterId(member.characterId)] ??
              assignments[member.characterId];
            return placement
              ? PRIORITY_TIERS.indexOf(placement.tier) * 1000 +
                  placement.position
              : Number.POSITIVE_INFINITY;
          });
          const newest = definitions
            .map((definition) => definition.release_version)
            .sort(compareReleaseVersionsDescending)[0];
          return [
            team.id,
            {
              search: names.join(" ").toLocaleLowerCase(),
              combatTypes: new Set(
                definitions.map((entry) => entry.combat_type_id)
              ),
              paths: new Set(definitions.map((entry) => entry.path_id)),
              filled: members.length,
              allOwned: members.every((member) => member.owned),
              noneOwned:
                members.length > 0 && members.every((member) => !member.owned),
              tierRank: Math.min(...tierRanks, Number.POSITIVE_INFINITY),
              newest: newest ?? null,
            },
          ];
        })
      ),
    [teams, previewOf, characters, lookup, assignments, t]
  );

  const needle = view.query.trim().toLocaleLowerCase();
  const visibleIds = new Set(
    teams
      .filter((team) => {
        const facts = teamFacts.get(team.id);
        if (!facts) return true;
        if (needle && !facts.search.includes(needle)) return false;
        if (facts.filled === 0) return true;
        if (
          view.combatTypes.size &&
          ![...view.combatTypes].some((id) => facts.combatTypes.has(id))
        )
          return false;
        if (
          view.paths.size &&
          ![...view.paths].some((id) => facts.paths.has(id))
        )
          return false;
        if (ownedOnly && !facts.allOwned) return false;
        return true;
      })
      .map((team) => team.id)
  );
  const sortedIds =
    view.sort === "none"
      ? teams.map((team) => team.id)
      : [...teams]
          .map((team, index) => ({ team, index }))
          .sort((left, right) => {
            const a = teamFacts.get(left.team.id);
            const b = teamFacts.get(right.team.id);
            const difference =
              view.sort === "tier"
                ? (a?.tierRank ?? Number.POSITIVE_INFINITY) -
                  (b?.tierRank ?? Number.POSITIVE_INFINITY)
                : compareReleaseVersionsDescending(
                    a?.newest ?? null,
                    b?.newest ?? null
                  );
            return Number.isNaN(difference) || difference === 0
              ? left.index - right.index
              : difference;
          })
          .map(({ team }) => team.id);
  const orderOf = new Map(sortedIds.map((id, index) => [id, index]));
  const dragEnabled = view.sort === "none";

  const onlyTeam = teams.length === 1 ? teams[0] : undefined;
  const showEmpty =
    teams.length === 0 || (!revealed && onlyTeam && teamIsEmpty(onlyTeam));

  function scrollToTeam(id: string, position: "start" | "end") {
    requestAnimationFrame(() => {
      const body = bodyRef.current;
      if (!body) return;
      const card = [
        ...body.querySelectorAll<HTMLElement>("[data-team-card]"),
      ].find((element) => element.dataset.teamCard === id);
      if (card && typeof card.scrollIntoView === "function")
        card.scrollIntoView({ behavior: "smooth", block: "nearest" });
      else if (typeof body.scrollTo === "function")
        body.scrollTo({
          top: position === "start" ? 0 : body.scrollHeight,
          behavior: "smooth",
        });
    });
  }

  function addTeam(position: "start" | "end") {
    setRevealed(true);
    const edge = position === "start" ? teams[0] : teams[teams.length - 1];
    if (edge && teamIsEmpty(edge)) {
      scrollToTeam(edge.id, position);
      return;
    }
    const id = createTeam(position);
    if (view.sort !== "none") updateView({ sort: "none" });
    scrollToTeam(id, position);
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const target = teams.findIndex((team) => team.id === over.id);
    if (target >= 0) moveTeam(String(active.id), target);
  }

  const chipIcon = (kind: "combat-type" | "path", id: string) => {
    const entry =
      kind === "combat-type"
        ? properties.combatTypeById.get(id)
        : properties.pathById.get(id);
    return (
      <AssetImage
        kind={kind}
        id={id}
        sourcePath={entry?.icon_path}
        alt=""
        aria-hidden="true"
        className="h-4 w-4 object-contain"
      />
    );
  };
  const chipName = (kind: "combat-type" | "path", id: string) =>
    localizedName(
      (kind === "combat-type"
        ? properties.combatTypeById.get(id)
        : properties.pathById.get(id)
      )?.name,
      locale,
      id
    );

  const actions = (
    <PageActions
      primary={
        <PageActionButton
          icon={Plus}
          label={t("combat.team.new")}
          onClick={() => addTeam("end")}
        />
      }
      overflow={
        <>
          <DropdownMenuItem
            className="sm:hidden"
            onSelect={() => addTeam("end")}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t("combat.team.new")}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={teams.length === 0}
            className="text-destructive focus:text-destructive"
            onSelect={() => setConfirmClear(true)}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            {t("teamDmg.clearTeams")}
          </DropdownMenuItem>
        </>
      }
    />
  );
  const clearDialog = (
    <ConfirmDialog
      open={confirmClear}
      onOpenChange={setConfirmClear}
      title={t("teamDmg.clearTeams")}
      description={t("teamDmg.clearTeamsConfirm", { count: teams.length })}
      confirmLabel={t("teamDmg.clearTeams")}
      cancelLabel={t("common.cancel")}
      destructive
      onConfirm={() => {
        clearResultCache();
        clearTeams();
        setRevealed(false);
      }}
    />
  );

  if (showEmpty)
    return (
      <ScrollLayout bodyClassName="flex flex-col items-center">
        {actions}
        <EmptyState messageKey="teamDmg.empty.title" icon={Swords}>
          <Button className="h-10 gap-2 px-8" onClick={() => addTeam("end")}>
            <Plus className="h-4 w-4" aria-hidden />
            {t("combat.team.new")}
          </Button>
        </EmptyState>
        <div className="flex w-full justify-center py-2">
          <TeamCard
            team={onlyTeam ?? GHOST_TEAM}
            index={0}
            tab={tab}
            teams={onlyTeam ? teams : [GHOST_TEAM]}
            onOpen={onOpen}
            ghost={!onlyTeam}
            onGhostPick={(characterId) => {
              const id = createTeam("end");
              setMember(id, 0, characterId);
              notePick(characterId);
              setRevealed(true);
            }}
          />
        </div>
        {clearDialog}
      </ScrollLayout>
    );

  const header = (
    <div className="space-y-3" data-team-grid-toolbar>
      <SearchInput
        variant="prominent"
        value={view.query}
        onValueChange={(query) => updateView({ query })}
        label={t("teamDmg.search.label")}
        placeholder={t("teamDmg.search.placeholder")}
      />
      <div className="flex flex-wrap items-center justify-center gap-1 2xl:gap-2">
        <FilterChipGroup
          options={properties.combatTypes.map((entry) => entry.id)}
          selectedValues={view.combatTypes}
          onSelectedValuesChange={(combatTypes) => updateView({ combatTypes })}
          getKey={(id) => id}
          getIcon={(id) => chipIcon("combat-type", id)}
          getLabel={(id) => (
            <span className="hidden sm:inline">
              {chipName("combat-type", id)}
            </span>
          )}
          getTitle={(id) => chipName("combat-type", id)}
          className="contents"
        />
        <span aria-hidden className="mx-1 hidden h-5 w-px bg-border sm:block" />
        <FilterChipGroup
          options={properties.paths.map((entry) => entry.id)}
          selectedValues={view.paths}
          onSelectedValuesChange={(paths) => updateView({ paths })}
          getKey={(id) => id}
          getIcon={(id) => chipIcon("path", id)}
          getLabel={(id) => (
            <span className="hidden sm:inline">{chipName("path", id)}</span>
          )}
          getTitle={(id) => chipName("path", id)}
          className="contents"
        />
      </div>
      <div className="flex flex-wrap items-center gap-1 2xl:gap-2">
        {account && (
          <CategoryChip
            active={ownedOnly}
            onClick={() => updateView({ ownedOnly: !ownedOnly })}
            label={t("teamDmg.ownedOnly")}
            icon={<UserRoundCheck className="h-3.5 w-3.5" aria-hidden />}
          />
        )}
        <CategoryChip
          active={view.sort === "tier"}
          onClick={() =>
            updateView({ sort: view.sort === "tier" ? "none" : "tier" })
          }
          label={t("teamDmg.sort.tier")}
          icon={<ArrowUpDown className="h-3.5 w-3.5" aria-hidden />}
        />
        <CategoryChip
          active={view.sort === "release"}
          onClick={() =>
            updateView({ sort: view.sort === "release" ? "none" : "release" })
          }
          label={t("teamDmg.sort.release")}
          icon={<ArrowUpDown className="h-3.5 w-3.5" aria-hidden />}
        />
        <div className="flex-1" />
        <div className="flex items-center gap-1 2xl:gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-sm leading-none"
            aria-label={t("teamDmg.newTeamTop")}
            title={t("teamDmg.newTeamTop")}
            onClick={() => addTeam("start")}
          >
            <Plus className="h-3 w-3" aria-hidden />
            {t("combat.team.new")}
            <span className="text-muted-foreground" aria-hidden>
              ↑
            </span>
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 text-sm leading-none"
            aria-label={t("teamDmg.newTeamBottom")}
            title={t("teamDmg.newTeamBottom")}
            onClick={() => addTeam("end")}
          >
            <Plus className="h-3 w-3" aria-hidden />
            {t("combat.team.new")}
            <span className="opacity-70" aria-hidden>
              ↓
            </span>
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <ScrollLayout header={header} bodyRef={bodyRef} bodyClassName="py-2">
      {actions}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={teams.map((team) => team.id)}
          strategy={rectSortingStrategy}
        >
          <section
            aria-label={t("teamDmg.teams")}
            className={cn(
              "grid items-start justify-center gap-3 xl:gap-4",
              "[grid-template-columns:repeat(auto-fill,minmax(284px,1fr))] xl:[grid-template-columns:repeat(auto-fill,minmax(320px,1fr))]"
            )}
            data-team-grid
          >
            {teams.map((team, index) => {
              const facts = teamFacts.get(team.id);
              return (
                <SortableTeamCard
                  key={team.id}
                  team={team}
                  index={index}
                  tab={tab}
                  teams={teams}
                  onOpen={onOpen}
                  onMoveUp={
                    index > 0 ? () => moveTeam(team.id, index - 1) : undefined
                  }
                  onMoveDown={
                    index < teams.length - 1
                      ? () => moveTeam(team.id, index + 1)
                      : undefined
                  }
                  hidden={!visibleIds.has(team.id)}
                  order={orderOf.get(team.id)}
                  unowned={account !== null && (facts?.noneOwned ?? false)}
                  onCharacterPick={notePick}
                  dragEnabled={dragEnabled}
                />
              );
            })}
          </section>
        </SortableContext>
      </DndContext>
      {visibleIds.size === 0 && (
        <EmptyState
          variant="inline"
          messageKey="teamDmg.noMatches"
          icon={SearchX}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={clearFilters}
          >
            {t("filter.reset")}
          </Button>
        </EmptyState>
      )}
      {clearDialog}
    </ScrollLayout>
  );
}
