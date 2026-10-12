import { z } from "zod";

export const ANALYSIS_MODES = [
  "relics",
  "builds",
  "investment",
  "characters",
  "rotation",
] as const;
export const AnalysisModeSchema = z.enum(ANALYSIS_MODES);
export type AnalysisMode = z.infer<typeof AnalysisModeSchema>;
