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
import { isLocale, type Locale } from "./locales";
import { type MessageKey, messagesEn } from "./messages.en";
import { messagesZhCn } from "./messages.zh-CN";

const catalogs: Record<Locale, Record<MessageKey, string>> = {
  en: messagesEn,
  "zh-CN": messagesZhCn,
};

type MessageVariables = Record<string, string | number>;

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, variables?: MessageVariables) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function initialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.locale);
    if (isLocale(stored)) return stored;
  } catch {
    // Storage can be unavailable in hardened browser contexts.
  }
  return navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

function formatMessage(
  message: string,
  variables: MessageVariables | undefined
): string {
  if (!variables) return message;
  return message.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (token, name) => {
    const value = variables[name];
    return value === undefined ? token : String(value);
  });
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    try {
      localStorage.setItem(STORAGE_KEYS.locale, nextLocale);
    } catch {
      // Locale still applies for this tab when persistence is unavailable.
    }
  }, []);

  const t = useCallback(
    (key: MessageKey, variables?: MessageVariables) =>
      formatMessage(catalogs[locale][key], variables),
    [locale]
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("I18nProvider is missing");
  return value;
}
