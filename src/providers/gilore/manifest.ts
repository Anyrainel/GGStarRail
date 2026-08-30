import {
  type DataBundleManifest,
  DataBundleManifestSchema,
} from "@/domain/provenance";

export function parseGIloreManifest(input: unknown): DataBundleManifest {
  return DataBundleManifestSchema.parse(input);
}
