import { z } from "zod";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEYS } from "@/config/identity";

const GreetingSchema = z.object({
  buildPromptSeen: z.boolean(),
  lastSeenUpdate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
});

interface GreetingState {
  buildPromptSeen: boolean;
  lastSeenUpdate: string | null;
  dismissBuildPrompt: (date: string | null) => void;
  dismissUpdate: (date: string) => void;
}

/** Browser-local presentation preferences; game/account exports stay independent. */
export const useGreetingStore = create<GreetingState>()(
  persist(
    (set) => ({
      buildPromptSeen: false,
      lastSeenUpdate: null,
      dismissBuildPrompt: (date) =>
        set((state) => ({
          buildPromptSeen: true,
          lastSeenUpdate:
            date && date > (state.lastSeenUpdate ?? "")
              ? date
              : state.lastSeenUpdate,
        })),
      dismissUpdate: (date) =>
        set((state) => ({
          lastSeenUpdate:
            date > (state.lastSeenUpdate ?? "") ? date : state.lastSeenUpdate,
        })),
    }),
    {
      name: STORAGE_KEYS.greeting,
      version: 1,
      partialize: ({ buildPromptSeen, lastSeenUpdate }) => ({
        buildPromptSeen,
        lastSeenUpdate,
      }),
      merge: (persisted, current) => {
        const parsed = GreetingSchema.safeParse(persisted);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    }
  )
);
