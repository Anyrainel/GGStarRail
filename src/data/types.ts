import type { LocalizedText } from "@/providers/gilore/types";

export interface BetaPreviewSection {
  id: string;
  title: LocalizedText;
  description: LocalizedText | null;
  parameters: number[][];
}

/** Partial source content is not a complete Character/Light Cone definition. */
export interface BetaPreview {
  id: string;
  name: LocalizedText;
  rarity: number | null;
  path_id: string | null;
  combat_type_id: string | null;
  image_path: string | null;
  sections: BetaPreviewSection[];
  stats: Record<string, number[]>;
  source_url: string;
  source_version: string;
}
