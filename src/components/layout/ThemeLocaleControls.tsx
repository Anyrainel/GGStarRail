import { Languages, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheck,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { THEME_IDS, useTheme } from "@/contexts/ThemeContext";
import type { ThemeId } from "@/contexts/themeTypes";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import { getThemePrimaryColor } from "@/lib/themeGenerator";

const THEME_LABELS: Record<ThemeId, MessageKey> = {
  astral: "theme.astral",
  express: "theme.express",
  dreamscape: "theme.dreamscape",
  jarilo: "theme.jarilo",
  luofu: "theme.luofu",
  amphoreus: "theme.amphoreus",
};
export function ThemeChoices() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  return (
    <DropdownMenuRadioGroup value={theme}>
      {THEME_IDS.map((id) => (
        <DropdownMenuRadioItem
          key={id}
          value={id}
          onSelect={() => setTheme(id)}
        >
          <DropdownMenuCheck visible={theme === id} />
          <span
            className="h-3.5 w-3.5 shrink-0 rounded-full border border-foreground/30"
            style={{ backgroundColor: getThemePrimaryColor(id) }}
          />
          {t(THEME_LABELS[id])}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}

export function LocaleChoices() {
  const { locale, setLocale, t } = useI18n();
  return (
    <DropdownMenuRadioGroup value={locale}>
      <DropdownMenuRadioItem value="en" onSelect={() => setLocale("en")}>
        <DropdownMenuCheck visible={locale === "en"} />
        {t("app.locale.english")}
      </DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="zh-CN" onSelect={() => setLocale("zh-CN")}>
        <DropdownMenuCheck visible={locale === "zh-CN"} />
        {t("app.locale.chinese")}
      </DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  );
}

export function ThemeLocaleControls() {
  const { t } = useI18n();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-1.5 px-2">
            <Languages className="h-4 w-4" aria-hidden="true" />
            {t("app.locale")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <LocaleChoices />
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-1.5 px-2">
            <Palette className="h-4 w-4" aria-hidden="true" />
            {t("theme.label")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <ThemeChoices />
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
