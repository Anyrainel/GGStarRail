import type { ThemeId } from "@/contexts/themeTypes";

const THEME_VARS: Record<ThemeId, Readonly<Record<string, string>>> = {
  jarilo: destinationPalette(198, 194, 48, 65),
  luofu: destinationPalette(158, 158, 34, 60, 48),
  amphoreus: destinationPalette(48, 48, 56, 70),
  // Emblem hues: silver-blue, ice cyan, jade/gold, lilac/periwinkle, pale gold.
  astral: destinationPalette(210, 210, 24, 72),
  express: {
    background: "355 24% 7%",
    foreground: "35 20% 95%",
    card: "355 25% 9%",
    "card-foreground": "35 20% 95%",
    popover: "355 25% 10%",
    "popover-foreground": "35 20% 95%",
    primary: "8 68% 51%",
    "primary-foreground": "0 0% 98%",
    secondary: "355 24% 15%",
    "secondary-foreground": "35 20% 95%",
    muted: "355 20% 11%",
    "muted-foreground": "15 12% 66%",
    accent: "8 46% 28%",
    "accent-foreground": "0 0% 98%",
    border: "355 20% 24%",
    input: "355 20% 11%",
    ring: "8 68% 58%",
    "gradient-page":
      "radial-gradient(ellipse 85% 75% at 50% 50%, hsl(355 42% 23%) 0%, transparent 92%), radial-gradient(ellipse 170% 60% at 50% 50%, hsl(28 28% 15%) 0%, transparent 94%), linear-gradient(135deg, hsl(355 24% 7%), hsl(345 22% 7%))",
    "gradient-card":
      "linear-gradient(135deg, hsl(355 30% 17%) 0%, hsl(5 28% 13%) 50%, hsl(345 22% 9%) 100%)",
    "gradient-select":
      "linear-gradient(135deg, hsl(345 22% 9%) 0%, hsl(5 28% 13%) 50%, hsl(355 30% 17%) 100%)",
  },
  dreamscape: destinationPalette(232, 270, 62, 72),
};

export function getThemePrimaryColor(theme: ThemeId): string {
  return `hsl(${THEME_VARS[theme].primary})`;
}

export function applyThemeVars(theme: ThemeId): void {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(THEME_VARS[theme])) {
    root.style.setProperty(`--${name}`, value);
  }
}

// Destination-inspired palettes share the same contrast and surface hierarchy.
function destinationPalette(
  base: number,
  hue: number,
  saturation: number,
  lightness: number,
  highlightHue: number = hue
): Readonly<Record<string, string>> {
  const primary = `${hue} ${saturation}% ${lightness}%`;
  return {
    background: `${base} 22% 7%`,
    foreground: "0 0% 96%",
    card: `${base} 22% 9%`,
    "card-foreground": "0 0% 96%",
    popover: `${base} 24% 10%`,
    "popover-foreground": "0 0% 96%",
    primary,
    "primary-foreground": `${base} 30% 8%`,
    secondary: `${base} 24% 15%`,
    "secondary-foreground": "0 0% 96%",
    muted: `${base} 19% 11%`,
    "muted-foreground": `${base} 12% 66%`,
    accent: `${hue} 35% 30%`,
    "accent-foreground": "0 0% 98%",
    border: `${base} 19% 24%`,
    input: `${base} 20% 11%`,
    ring: primary,
    "gradient-page": `radial-gradient(ellipse 85% 75% at 50% 50%, hsl(${hue} 34% 23%) 0%, transparent 92%), radial-gradient(ellipse 110% 65% at 80% 15%, hsl(${highlightHue} 24% 16%) 0%, transparent 85%), linear-gradient(135deg, hsl(${base} 24% 8%), hsl(${base} 22% 7%))`,
    "gradient-card": `linear-gradient(135deg, hsl(${base} 29% 16%), hsl(${hue} 28% 11%))`,
    "gradient-select": `linear-gradient(135deg, hsl(${hue} 28% 11%), hsl(${base} 29% 16%))`,
  };
}
