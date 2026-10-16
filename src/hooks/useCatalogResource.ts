import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

interface CatalogResource<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

export function useCatalogResource<T>(
  loader: () => Promise<T>
): CatalogResource<T> {
  const { locale } = useI18n();
  const [loadedLocale, setLoadedLocale] = useState(locale);
  const [resource, setResource] = useState<CatalogResource<T>>({
    data: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    let active = true;
    setLoadedLocale(locale);
    setResource({ data: null, error: null, loading: true });
    loader().then(
      (data) => {
        if (active) setResource({ data, error: null, loading: false });
      },
      (reason: unknown) => {
        if (!active) return;
        const error =
          reason instanceof Error
            ? reason
            : new Error("Reference catalog could not be loaded");
        console.error("Archive catalog loading failed", error);
        setResource({ data: null, error, loading: false });
      }
    );
    return () => {
      active = false;
    };
  }, [loader, locale]);

  return loadedLocale === locale
    ? resource
    : { data: null, error: null, loading: true };
}
