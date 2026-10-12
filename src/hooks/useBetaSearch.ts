import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { maybeHandleBetaMagic } from "@/services/catalog/betaMode";

export function useBetaSearch(onChange: (value: string) => void) {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  function changeSearch(value: string) {
    setError(null);
    try {
      onChange(maybeHandleBetaMagic(value) ? "" : value);
    } catch {
      setError(t("beta.storageError"));
    }
  }
  return { changeSearch, error };
}
