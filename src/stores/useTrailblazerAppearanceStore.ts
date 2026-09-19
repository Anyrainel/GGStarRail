import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEYS } from "@/config/identity";
import type { TrailblazerAppearance } from "@/domain/characterIdentity";

interface AppearanceState {
  appearance: TrailblazerAppearance;
  setAppearance: (appearance: TrailblazerAppearance) => void;
}

export const useTrailblazerAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      appearance: "caelus",
      setAppearance: (appearance) => set({ appearance }),
    }),
    {
      name: STORAGE_KEYS.trailblazerAppearance,
      version: 1,
      partialize: ({ appearance }) => ({ appearance }),
      merge: (persisted, current) => {
        const appearance =
          persisted &&
          typeof persisted === "object" &&
          "appearance" in persisted
            ? persisted.appearance
            : undefined;
        return appearance === "caelus" || appearance === "stelle"
          ? { ...current, appearance }
          : current;
      },
    }
  )
);
