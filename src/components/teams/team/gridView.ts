import type { AccountSnapshot } from "@/domain/game-account/schemas";
import { ownedCharacter } from "@/services/combat/accountTeam";

export type GridSortMode = "none" | "tier" | "release";

export interface GridViewState {
  query: string;
  combatTypes: Set<string>;
  paths: Set<string>;
  /** Null follows the default: on when account data exists. */
  ownedOnly: boolean | null;
  sort: GridSortMode;
}

/** Workspace grid filters for this session (memory only, never persisted). */
let savedView: GridViewState | undefined;

export function gridViewState(): GridViewState {
  return (
    savedView ?? {
      query: "",
      combatTypes: new Set(),
      paths: new Set(),
      ownedOnly: null,
      sort: "none",
    }
  );
}

export function saveGridViewState(state: GridViewState) {
  savedView = state;
}

export function ownedOnlyActive(
  state: GridViewState,
  account: AccountSnapshot | null
): boolean {
  return account !== null && (state.ownedOnly ?? true);
}

/**
 * Turns Owned only off in the team grid when a pick adds an unowned
 * Character, so the team just edited stays visible in the workspace the user
 * opens next. Returns whether anything changed.
 */
export function releaseOwnedOnly(
  account: AccountSnapshot | null,
  characterId: string
): boolean {
  if (!account || ownedCharacter(account, characterId)) return false;
  const state = gridViewState();
  if (!ownedOnlyActive(state, account)) return false;
  savedView = { ...state, ownedOnly: false };
  return true;
}
