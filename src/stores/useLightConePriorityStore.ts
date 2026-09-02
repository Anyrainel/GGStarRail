import { STORAGE_KEYS } from "@/config/identity";
import { createPriorityStore } from "./createPriorityStore";

export const useLightConePriorityStore = createPriorityStore(
  STORAGE_KEYS.lightConePriority
);
