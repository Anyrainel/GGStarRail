import { z } from "zod";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEYS } from "@/config/identity";
import {
  type TierDocument,
  TierDocumentSchema,
} from "@/domain/tier-list/document";

const LibrarySchema = z
  .object({
    documents: z.record(z.string(), TierDocumentSchema),
    active: z.partialRecord(
      z.enum(["character", "light-cone", "relic-set"]),
      z.string()
    ),
  })
  .strict();

type Library = z.infer<typeof LibrarySchema>;
interface LibraryActions {
  save: (id: string, document: TierDocument) => void;
  activate: (category: TierDocument["category"], id: string) => void;
  remove: (id: string) => void;
}

/** Additional named lists; existing priority stores remain the active ranking source. */
export const useTierLibraryStore = create<Library & LibraryActions>()(
  persist(
    (set) => ({
      documents: {},
      active: {},
      save: (id, document) =>
        set((state) =>
          JSON.stringify(state.documents[id]) === JSON.stringify(document)
            ? state
            : { documents: { ...state.documents, [id]: document } }
        ),
      activate: (category, id) =>
        set((state) => ({ active: { ...state.active, [category]: id } })),
      remove: (id) =>
        set((state) => {
          const documents = { ...state.documents };
          const active = { ...state.active };
          delete documents[id];
          for (const category of [
            "character",
            "light-cone",
            "relic-set",
          ] as const) {
            if (active[category] === id) delete active[category];
          }
          return { documents, active };
        }),
    }),
    {
      name: STORAGE_KEYS.tierLibrary,
      version: 1,
      partialize: ({ documents, active }) => ({ documents, active }),
      merge: (persisted, current) => {
        const parsed = LibrarySchema.safeParse(persisted);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    }
  )
);
