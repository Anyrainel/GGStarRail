import type { AccountSnapshot } from "@/domain/account/schemas";

export type ImportProviderId =
  | "gilore-bundle"
  | "scanner-export"
  | "hoyolab-account";

export interface AccountImportDraft {
  account: AccountSnapshot;
  warnings: string[];
}

export interface ProviderDescriptor {
  id: ImportProviderId;
  status: "contract-ready" | "adapter-pending";
  acceptsCredentials: boolean;
}

export const PROVIDER_REGISTRY: readonly ProviderDescriptor[] = [
  {
    id: "gilore-bundle",
    status: "contract-ready",
    acceptsCredentials: false,
  },
  {
    id: "scanner-export",
    status: "contract-ready",
    acceptsCredentials: false,
  },
  {
    id: "hoyolab-account",
    status: "adapter-pending",
    acceptsCredentials: true,
  },
];
