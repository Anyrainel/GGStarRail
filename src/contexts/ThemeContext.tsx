import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { STORAGE_KEYS } from "@/config/identity";
import type { ThemeId } from "@/contexts/themeTypes";
import { applyThemeVars } from "@/lib/themeGenerator";

export const THEME_IDS: readonly ThemeId[] = [
  "astral",
  "express",
  "dreamscape",
];

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.theme);
      if (stored && THEME_IDS.includes(stored as ThemeId)) {
        return stored as ThemeId;
      }
    } catch {
      // The default remains available when browser storage is unavailable.
    }
    return "astral";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    applyThemeVars(theme);
  }, [theme]);

  const setTheme = useCallback((nextTheme: ThemeId) => {
    setThemeState(nextTheme);
    try {
      localStorage.setItem(STORAGE_KEYS.theme, nextTheme);
    } catch {
      // Theme selection still applies for the current session.
    }
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [setTheme, theme]);
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("ThemeProvider is missing");
  return value;
}
