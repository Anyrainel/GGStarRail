import { STORAGE_KEYS } from "@/config/identity";
import { createPriorityStore } from "./createPriorityStore";

export const useRelicPriorityStore = createPriorityStore(
  STORAGE_KEYS.relicPriority
);
