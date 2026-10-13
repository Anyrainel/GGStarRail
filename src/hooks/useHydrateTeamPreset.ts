import { useEffect, useState } from "react";
import { loadBuildReferences } from "@/services/catalog/buildReferences";
import { clearResultCache } from "@/services/combat/resultCache";
import {
  assertTeamPresetReferences,
  loadTeamPreset,
} from "@/services/teams/presets";
import { useTeamStore } from "@/stores/useTeamStore";

/** Runs at app startup, including direct team-detail links. A failed load keeps
 * the last resolved plans; switching subscription invalidates in-flight work. */
export function useHydrateTeamPreset(): { failed: boolean; retry: () => void } {
  const presetId = useTeamStore(
    (state) => state.presetSubscription?.presetId ?? null
  );
  const hydratePreset = useTeamStore((state) => state.hydratePreset);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: retry deliberately reloads the same file.
  useEffect(() => {
    let active = true;
    setFailed(false);
    if (presetId) {
      Promise.all([loadTeamPreset(presetId), loadBuildReferences()])
        .then(([preset, references]) => {
          if (!active) return;
          assertTeamPresetReferences(preset.teams, references);
          if (useTeamStore.getState().presetSubscription?.presetId !== presetId)
            return;
          clearResultCache();
          hydratePreset(presetId, preset.teams);
        })
        .catch(() => {
          if (active) setFailed(true);
        });
    }
    return () => {
      active = false;
    };
  }, [presetId, hydratePreset, attempt]);
  return { failed, retry: () => setAttempt((value) => value + 1) };
}
