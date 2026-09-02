import type { ThemeId } from "@/contexts/themeTypes";

const THEME_VARS: Record<ThemeId, Readonly<Record<string, string>>> = {
  astral: {
    background: "229 22% 7%",
    foreground: "0 0% 95%",
    card: "229 22% 8%",
    "card-foreground": "0 0% 95%",
    popover: "229 24% 9%",
    "popover-foreground": "0 0% 95%",
    primary: "223 62% 48%",
    "primary-foreground": "0 0% 98%",
    secondary: "229 24% 13%",
    "secondary-foreground": "0 0% 95%",
    muted: "229 20% 10%",
    "muted-foreground": "225 12% 62%",
    accent: "224 48% 34%",
    "accent-foreground": "0 0% 98%",
    border: "228 19% 22%",
    input: "229 20% 10%",
    ring: "223 62% 52%",
    "gradient-page":
      "radial-gradient(ellipse 85% 75% at 50% 50%, hsl(221 39% 25%) 0%, transparent 92%), radial-gradient(ellipse 170% 60% at 50% 50%, hsl(245 31% 20%) 0%, transparent 94%), radial-gradient(ellipse 60% 165% at 50% 50%, hsl(247 28% 14%) 0%, transparent 92%), radial-gradient(circle at 50% 50%, hsl(229 22% 7%) 0%, hsl(229 22% 7%) 100%)",
    "gradient-card":
      "linear-gradient(135deg, hsl(227 29% 16%) 0%, hsl(234 30% 14%) 50%, hsl(242 25% 10%) 100%)",
    "gradient-select":
      "linear-gradient(135deg, hsl(242 25% 10%) 0%, hsl(234 30% 14%) 50%, hsl(227 29% 16%) 100%)",
  },
  express: {
    background: "221 25% 7%",
    foreground: "42 25% 95%",
    card: "221 23% 8%",
    "card-foreground": "42 25% 95%",
    popover: "221 24% 9%",
    "popover-foreground": "42 25% 95%",
    primary: "42 76% 52%",
    "primary-foreground": "222 30% 8%",
    secondary: "221 20% 14%",
    "secondary-foreground": "42 20% 94%",
    muted: "221 19% 10%",
    "muted-foreground": "218 12% 64%",
    accent: "191 45% 30%",
    "accent-foreground": "0 0% 98%",
    border: "221 17% 22%",
    input: "221 19% 10%",
    ring: "42 76% 52%",
    "gradient-page":
      "radial-gradient(ellipse 85% 75% at 50% 50%, hsl(194 38% 22%) 0%, transparent 92%), radial-gradient(ellipse 170% 60% at 50% 50%, hsl(40 31% 17%) 0%, transparent 94%), radial-gradient(ellipse 60% 165% at 50% 50%, hsl(36 24% 12%) 0%, transparent 92%), radial-gradient(circle at 50% 50%, hsl(221 25% 7%) 0%, hsl(221 25% 7%) 100%)",
    "gradient-card":
      "linear-gradient(135deg, hsl(211 27% 15%) 0%, hsl(202 28% 13%) 50%, hsl(223 22% 9%) 100%)",
    "gradient-select":
      "linear-gradient(135deg, hsl(223 22% 9%) 0%, hsl(202 28% 13%) 50%, hsl(211 27% 15%) 100%)",
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

export function applyThemeVars(theme: ThemeId): void {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(THEME_VARS[theme])) {
    root.style.setProperty(`--${name}`, value);
  }
}
