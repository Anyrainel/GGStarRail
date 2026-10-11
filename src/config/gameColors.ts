/** HoYoWiki text palette supplied for the UI; distinct from DamageType.color. */
export const COMBAT_TYPE_RGB = {
  Physical: [255, 255, 255],
  Fire: [248, 78, 54],
  Ice: [71, 199, 253],
  Thunder: [223, 83, 255],
  Wind: [70, 222, 156],
  Quantum: [135, 128, 255],
  Imaginary: [255, 235, 97],
} as const satisfies Readonly<
  Record<string, readonly [number, number, number]>
>;

/** Copied unchanged from GenshinTools' tier palette, including the pool. */
export const TIER_COLORS = {
  S: { header: "#b92f3a", background: "#2e0c0f" },
  A: { header: "#dd8559", background: "#372116" },
  B: { header: "#e6b44d", background: "#3a2d13" },
  C: { header: "#43ad8b", background: "#112b23" },
  D: { header: "#4a85cd", background: "#132133" },
  Pool: { header: "#757575", background: "#1d1d1d" },
} as const;

/** Solid accent / readable text; independent from the item artwork gradient. */
export const RARITY_TOKENS = {
  1: { DEFAULT: "#6b7280", foreground: "#9ca3af" },
  2: { DEFAULT: "#10b981", foreground: "#34d399" },
  3: { DEFAULT: "#3b82f6", foreground: "#60a5fa" },
  4: { DEFAULT: "#a855f7", foreground: "#c084fc" },
  5: { DEFAULT: "#f59e0b", foreground: "#fbbf24" },
} as const;

/** Item chrome preserves its own palette, independently of rarity accents. */
export const ITEM_TOKENS = {
  badge: { DEFAULT: "#4a3b2a", foreground: "#f3d88c" },
  level: { DEFAULT: "#f5f0e6", foreground: "#3d3d3d" },
} as const;

export const RARITY_GRADIENTS = {
  "rarity-gradient-1": "linear-gradient(180deg, #3e404e, #88888e)",
  "rarity-gradient-2": "linear-gradient(180deg, #374760, #44908c)",
  "rarity-gradient-3": "linear-gradient(180deg, #3a3b62, #4c86c9)",
  "rarity-gradient-4": "linear-gradient(180deg, #3f4064, #9c65d7)",
  "rarity-gradient-5": "linear-gradient(180deg, #a35d55, #d0aa6e)",
  "rarity-gradient-neutral":
    "linear-gradient(180deg, hsl(var(--muted)), hsl(var(--secondary)))",
} as const;

/** Identical dimming formula to the former inline header helper. */
export const COMBAT_TYPE_HEADER_RGB = Object.fromEntries(
  Object.entries(COMBAT_TYPE_RGB).map(([id, rgb]) => {
    const grey = (Math.max(...rgb) + Math.min(...rgb)) / 2;
    return [
      id,
      rgb.map((value) => Math.round((value * 0.65 + grey * 0.35) * 0.42)),
    ];
  })
);

export const COMBAT_TYPE_TOKENS = Object.fromEntries(
  Object.entries(COMBAT_TYPE_RGB).map(([id, rgb]) => [
    id.toLowerCase(),
    {
      DEFAULT: `rgb(${rgb.join(" ")} / <alpha-value>)`,
      header: `rgb(${COMBAT_TYPE_HEADER_RGB[id].join(" ")} / <alpha-value>)`,
    },
  ])
);

export const TIER_TOKENS = Object.fromEntries(
  Object.entries(TIER_COLORS).map(([tier, colors]) => [
    tier.toLowerCase(),
    {
      DEFAULT: colors.header,
      background: colors.background,
    },
  ])
);
