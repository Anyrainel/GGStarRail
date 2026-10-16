import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import {
  loadCharacters,
  loadLightCones,
  loadPropertyTables,
  loadRelicPieces,
  loadRelicSets,
} from "@/providers/reference/catalog";
import { loadBuildReferences } from "@/services/catalog/buildReferences";

async function loadCharacterReferences() {
  const [characters, properties] = await Promise.all([
    loadCharacters(),
    loadPropertyTables(),
  ]);
  return { characters, properties };
}

async function loadLightConeReferences() {
  const [lightCones, properties] = await Promise.all([
    loadLightCones(),
    loadPropertyTables(),
  ]);
  return { lightCones, properties };
}

async function loadRelicReferences() {
  const [relicPieces, relicSets, properties] = await Promise.all([
    loadRelicPieces(),
    loadRelicSets(),
    loadPropertyTables(),
  ]);
  return { relicPieces, relicSets, properties };
}

interface CatalogLoadState<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
}

function useCatalogLoad<T>(loader: () => Promise<T>): CatalogLoadState<T> {
  const { locale } = useI18n();
  const [loadedLocale, setLoadedLocale] = useState(locale);
  const [state, setState] = useState<CatalogLoadState<T>>({
    data: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    let active = true;
    setLoadedLocale(locale);
    setState({ data: null, error: null, loading: true });
    loader().then(
      (data) => {
        if (active) setState({ data, error: null, loading: false });
      },
      (error: unknown) => {
        if (active) setState({ data: null, error, loading: false });
      }
    );
    return () => {
      active = false;
    };
  }, [loader, locale]);

  return loadedLocale === locale
    ? state
    : { data: null, error: null, loading: true };
}

export function useCharacterReferences() {
  return useCatalogLoad(loadCharacterReferences);
}

export function useLightConeReferences() {
  return useCatalogLoad(loadLightConeReferences);
}

export function useRelicReferences() {
  return useCatalogLoad(loadRelicReferences);
}

export function useBuildReferences() {
  return useCatalogLoad(loadBuildReferences);
}
