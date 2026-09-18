import { z } from "zod";
import { StableIdSchema } from "@/domain/account/schemas";

export const CharacterLightConeChoicesSchema = z.record(
  StableIdSchema,
  z
    .array(StableIdSchema)
    .max(5)
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "Light Cone choices must be unique"
    )
);

export type CharacterLightConeChoices = z.infer<
  typeof CharacterLightConeChoicesSchema
>;
