import { useCallback, useEffect, useState } from "react";
import { loadBuildPreset } from "@/services/builds/presets";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

export function useHydrateBuildPreset() {
  const presetId = useWorkspaceStore(
    (state) => state.buildPresetSubscription?.presetId
  );
  const hydrate = useWorkspaceStore((state) => state.hydrateBuildPreset);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  // Retry deliberately reruns the same request without changing the subscription.
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt is an explicit retry token.
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    if (presetId) {
      void loadBuildPreset(presetId)
        .then((snapshot) => {
          if (!cancelled) hydrate(presetId, snapshot);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [presetId, hydrate, attempt]);
  return { failed, retry };
}
