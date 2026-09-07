import type { ThemeId } from "@/contexts/themeTypes";

const THEME_VARS: Record<ThemeId, Readonly<Record<string, string>>> = {
  jarilo: destinationPalette(211, 198, 65, 62),
  luofu: destinationPalette(172, 164, 48, 48),
  amphoreus: destinationPalette(35, 39, 72, 62),
  astral: {
    background: "229 22% 7%",
    foreground: "0 0% 95%",
    card: "229 22% 8%",
    "card-foreground": "0 0% 95%",
    popover: "229 24% 9%",
    "popover-foreground": "0 0% 95%",
    primary: "242 62% 63%",
    "primary-foreground": "0 0% 98%",
    secondary: "229 24% 13%",
    "secondary-foreground": "0 0% 95%",
    muted: "229 20% 10%",
    "muted-foreground": "225 12% 62%",
    accent: "242 48% 34%",
    "accent-foreground": "0 0% 98%",
    border: "228 19% 22%",
    input: "229 20% 10%",
    ring: "242 62% 67%",
    "gradient-page":
      "radial-gradient(ellipse 85% 75% at 50% 50%, hsl(221 39% 25%) 0%, transparent 92%), radial-gradient(ellipse 170% 60% at 50% 50%, hsl(245 31% 20%) 0%, transparent 94%), radial-gradient(ellipse 60% 165% at 50% 50%, hsl(247 28% 14%) 0%, transparent 92%), radial-gradient(circle at 50% 50%, hsl(229 22% 7%) 0%, hsl(229 22% 7%) 100%)",
    "gradient-card":
      "linear-gradient(135deg, hsl(227 29% 16%) 0%, hsl(234 30% 14%) 50%, hsl(242 25% 10%) 100%)",
    "gradient-select":
      "linear-gradient(135deg, hsl(242 25% 10%) 0%, hsl(234 30% 14%) 50%, hsl(227 29% 16%) 100%)",
  },
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
  dreamscape: {
    background: "273 22% 7%",
    foreground: "0 0% 96%",
    card: "273 22% 8%",
    "card-foreground": "0 0% 96%",
    popover: "273 24% 9%",
    "popover-foreground": "0 0% 96%",
    primary: "304 52% 50%",
    "primary-foreground": "0 0% 98%",
    secondary: "273 24% 14%",
    "secondary-foreground": "0 0% 95%",
    muted: "273 19% 10%",
    "muted-foreground": "276 11% 65%",
    accent: "302 40% 34%",
    "accent-foreground": "0 0% 98%",
    border: "273 18% 23%",
    input: "273 19% 10%",
    ring: "304 52% 50%",
    "gradient-page":
      "radial-gradient(ellipse 85% 75% at 50% 50%, hsl(298 36% 24%) 0%, transparent 92%), radial-gradient(ellipse 170% 60% at 50% 50%, hsl(263 34% 20%) 0%, transparent 94%), radial-gradient(ellipse 60% 165% at 50% 50%, hsl(247 29% 14%) 0%, transparent 92%), radial-gradient(circle at 50% 50%, hsl(273 22% 7%) 0%, hsl(273 22% 7%) 100%)",
    "gradient-card":
      "linear-gradient(135deg, hsl(290 29% 16%) 0%, hsl(277 31% 14%) 50%, hsl(257 25% 10%) 100%)",
    "gradient-select":
      "linear-gradient(135deg, hsl(257 25% 10%) 0%, hsl(277 31% 14%) 50%, hsl(290 29% 16%) 100%)",
  },
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
  lightness: number
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
    "gradient-page": `radial-gradient(ellipse 85% 75% at 50% 50%, hsl(${hue} 34% 23%) 0%, transparent 92%), linear-gradient(135deg, hsl(${base} 24% 8%), hsl(${base} 22% 7%))`,
    "gradient-card": `linear-gradient(135deg, hsl(${base} 29% 16%), hsl(${hue} 28% 11%))`,
    "gradient-select": `linear-gradient(135deg, hsl(${hue} 28% 11%), hsl(${base} 29% 16%))`,
  };
}
