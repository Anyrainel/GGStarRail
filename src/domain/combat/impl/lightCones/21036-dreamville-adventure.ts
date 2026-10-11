import { defineLightCone } from "../../kit/equipment";
import type { AbilityKind, StatusDef } from "../../kit/model";

/** Dreamville Adventure — Harmony. */
export default defineLightCone("21036", (k) => {
  const kinds = ["basic", "skill", "ultimate"] as const;
  const childishness = new Map<AbilityKind, StatusDef>(
    kinds.map((kind) => [
      kind,
      k.status({
        id: `childishness-${kind}`,
        origin: "lightCone",
        modifiers: [
          { stat: "dmgBoost", value: k.s(1), filter: { tags: [kind] } },
        ],
        unique: true,
      }),
    ])
  );
  k.on("actionEnd", "lightCone", { abilityKinds: kinds }, (ctx, event) => {
    const current = event.abilityKind && childishness.get(event.abilityKind);
    if (!current) return;
    for (const ally of ctx.allies) {
      for (const status of childishness.values()) {
        if (status !== current) ctx.removeStatus(ally, status);
      }
      ctx.applyStatus(ally, current);
    }
  });
});
