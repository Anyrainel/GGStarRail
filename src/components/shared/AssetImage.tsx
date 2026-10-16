import {
  type ImgHTMLAttributes,
  type ReactElement,
  useMemo,
  useState,
} from "react";
import type { CatalogAssetRef } from "@/domain/assets";
import { resolveCatalogAsset } from "@/lib/assets/urls";

export interface AssetImageProps
  extends CatalogAssetRef,
    Omit<ImgHTMLAttributes<HTMLImageElement>, "id" | "onError" | "src"> {}

export function AssetImage({
  kind,
  id,
  sourcePath,
  variant,
  alt,
  loading = "lazy",
  decoding = "async",
  ...imageProps
}: AssetImageProps): ReactElement {
  const resolved = useMemo(
    () => resolveCatalogAsset({ kind, id, sourcePath, variant }),
    [id, kind, sourcePath, variant]
  );
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const usesFallback =
    resolved.startsWithFallback || failedSrc === resolved.src;

  return (
    <img
      {...imageProps}
      alt={alt}
      decoding={decoding}
      loading={loading}
      src={usesFallback ? resolved.fallbackSrc : resolved.src}
      data-asset-source={usesFallback ? "generated-fallback" : "local-cache"}
      onError={() => setFailedSrc(resolved.src)}
    />
  );
}
