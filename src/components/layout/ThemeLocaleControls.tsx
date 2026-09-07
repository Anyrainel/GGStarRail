import { Languages, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheck,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { THEME_IDS, useTheme } from "@/contexts/ThemeContext";
import type { ThemeId } from "@/contexts/themeTypes";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";

const THEME_LABELS: Record<ThemeId, MessageKey> = {
  astral: "theme.astral",
  express: "theme.express",
  dreamscape: "theme.dreamscape",
  jarilo: "theme.jarilo",
  luofu: "theme.luofu",
  amphoreus: "theme.amphoreus",
};
const THEME_COLORS: Record<ThemeId, string> = {
  astral: "223 62% 48%",
  express: "42 76% 52%",
  dreamscape: "304 52% 50%",
  jarilo: "198 65% 62%",
  luofu: "164 48% 48%",
  amphoreus: "39 72% 62%",
};

export function ThemeChoices() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  return THEME_IDS.map((id) => (
    <DropdownMenuItem
      key={id}
      onSelect={() => setTheme(id)}
      role="menuitemradio"
      aria-checked={theme === id}
    >
      <DropdownMenuCheck visible={theme === id} />
      <span
        className="h-3.5 w-3.5 shrink-0 rounded-full border border-foreground/30"
        style={{ backgroundColor: `hsl(${THEME_COLORS[id]})` }}
      />
      {t(THEME_LABELS[id])}
    </DropdownMenuItem>
  ));
}

export function LocaleChoices() {
  const { locale, setLocale, t } = useI18n();
  return (
    <>
      <DropdownMenuItem
        onSelect={() => setLocale("en")}
        role="menuitemradio"
        aria-checked={locale === "en"}
      >
        <DropdownMenuCheck visible={locale === "en"} />
        {t("app.locale.english")}
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={() => setLocale("zh-CN")}
        role="menuitemradio"
        aria-checked={locale === "zh-CN"}
      >
        <DropdownMenuCheck visible={locale === "zh-CN"} />
        {t("app.locale.chinese")}
      </DropdownMenuItem>
    </>
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
