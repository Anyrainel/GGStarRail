/** HoYoWiki text palette supplied for the UI; distinct from DamageType.color. */
export const COMBAT_TYPE_RGB: Readonly<
  Record<string, readonly [number, number, number]>
> = {
  Physical: [255, 255, 255],
  Fire: [248, 78, 54],
  Ice: [71, 199, 253],
  Thunder: [223, 83, 255],
  Wind: [70, 222, 156],
  Quantum: [135, 128, 255],
  Imaginary: [255, 235, 97],
};

/** Copied unchanged from GenshinTools' tier palette, including the pool. */
export const TIER_COLORS = {
  S: { header: "#b92f3a", background: "#2e0c0f" },
  A: { header: "#dd8559", background: "#372116" },
  B: { header: "#e6b44d", background: "#3a2d13" },
  C: { header: "#43ad8b", background: "#112b23" },
  D: { header: "#4a85cd", background: "#132133" },
  Pool: { header: "#757575", background: "#1d1d1d" },
} as const;
