import { Dices, Hammer, type LucideIcon, TrendingUp } from "lucide-react";
import type {
  ResourceActionKind,
  ResourceSuggestionPriority,
} from "@/domain/resources/schemas";
import type { MessageKey } from "@/i18n/messages.en";

export const RESOURCE_ACTIONS: readonly ResourceActionKind[] = [
  "level-up",
  "synthesize",
  "reroll",
];

export const RESOURCE_PRIORITIES: readonly ResourceSuggestionPriority[] = [
  "high",
  "medium",
  "low",
];

export interface ResourceActionPresentation {
  icon: LucideIcon;
  labelKey: MessageKey;
  /** The verb used on suggestion rows ("Level Up", "Synthesize", "Reroll"). */
  shortLabelKey: MessageKey;
  helpKey: MessageKey;
}

export const RESOURCE_ACTION: Readonly<
  Record<ResourceActionKind, ResourceActionPresentation>
> = {
  "level-up": {
    icon: TrendingUp,
    labelKey: "resource.action.levelUp",
    shortLabelKey: "resource.short.levelUp",
    helpKey: "resource.help.levelUp",
  },
  synthesize: {
    icon: Hammer,
    labelKey: "resource.action.synthesize",
    shortLabelKey: "resource.short.synthesize",
    helpKey: "resource.help.synthesize",
  },
  reroll: {
    icon: Dices,
    labelKey: "resource.action.reroll",
    shortLabelKey: "resource.short.reroll",
    helpKey: "resource.help.reroll",
  },
};

export const RESOURCE_PRIORITY_LABEL: Readonly<
  Record<ResourceSuggestionPriority, MessageKey>
> = {
  high: "resource.priority.high",
  medium: "resource.priority.medium",
  low: "resource.priority.low",
};
