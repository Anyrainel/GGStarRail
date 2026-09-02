import { useEffect, useState } from "react";
import { loadBuildReferences } from "@/lib/buildReferences";
import {
  loadCharacters,
  loadLightCones,
  loadPropertyTables,
  loadRelicPieces,
  loadRelicSets,
} from "@/providers/gilore/catalog";

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
  const [state, setState] = useState<CatalogLoadState<T>>({
    data: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    let active = true;
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
  }, [loader]);

  return state;
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
