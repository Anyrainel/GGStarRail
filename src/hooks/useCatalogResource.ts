import { useEffect, useState } from "react";

interface CatalogResource<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

export function useCatalogResource<T>(
  loader: () => Promise<T>
): CatalogResource<T> {
  const [resource, setResource] = useState<CatalogResource<T>>({
    data: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    let active = true;
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
        setResource({ data: null, error, loading: false });
      }
    );
    return () => {
      active = false;
    };
  }, [loader]);

  return resource;
}
