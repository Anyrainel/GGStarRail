import {
  type DataBundleManifest,
  DataBundleManifestSchema,
} from "@/domain/provenance";

export function parseReferenceManifest(input: unknown): DataBundleManifest {
  return DataBundleManifestSchema.parse(input);
}
