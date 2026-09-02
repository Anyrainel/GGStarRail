import { STORAGE_KEYS } from "@/config/identity";
import { createPriorityStore } from "./createPriorityStore";

export const useCharacterPriorityStore = createPriorityStore(
  STORAGE_KEYS.characterPriority
);
