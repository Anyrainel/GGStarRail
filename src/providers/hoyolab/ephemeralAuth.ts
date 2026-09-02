import type { AccountImportCatalog } from "@/providers/importCatalog";
import { loadAccountImportCatalog } from "@/providers/importCatalog";
import type { AccountImportDraft } from "../types";
import { normalizeHoYoLabAvatarInfo } from "./schema";

export type HoYoLabRegion = "os" | "cn";

export interface HoYoLabCredentialFields {
  cookie_token_v2?: string;
  account_mid_v2?: string;
  account_id_v2?: string;
  ltoken_v2?: string;
  ltmid_v2?: string;
  ltuid_v2?: string;
}

export type HoYoLabCredentialInput =
  | { kind: "raw-cookie"; rawCookie: string }
  | { kind: "fields"; fields: HoYoLabCredentialFields };

const HOYOLAB_COOKIE_NAMES = new Set([
  "cookie_token_v2",
  "account_mid_v2",
  "account_id_v2",
  "ltoken_v2",
  "ltmid_v2",
  "ltuid_v2",
]);

export interface HoYoLabDeviceIdentity {
  deviceId: string;
  deviceFp: string;
}

export interface HoYoLabTransientAuthValues {
  credentials: HoYoLabCredentialInput;
  device: HoYoLabDeviceIdentity;
}

function validateSensitiveMaterial(
  name: string,
  value: unknown,
  maximumLength: number
): string {
  if (typeof value !== "string" || !value) {
    throw new Error("HOYOLAB_CONFIGURATION_REQUIRED");
  }
  const unsafe = [...value].some((character) => {
    const code = character.charCodeAt(0);
    return (
      code <= 0x20 || code === 0x7f || character === ";" || character === ","
    );
  });
  if (value.length > maximumLength || unsafe) {
    throw new Error(`HOYOLAB_INVALID_${name}`);
  }
  return value;
}

function validateCredentialInput(
  input: HoYoLabCredentialInput
): HoYoLabCredentialInput {
  if (!input || typeof input !== "object") {
    throw new Error("HOYOLAB_CONFIGURATION_REQUIRED");
  }
  if (input.kind === "raw-cookie") {
    if (
      !input.rawCookie ||
      input.rawCookie.length > 12 * 1024 ||
      input.rawCookie.includes("\r") ||
      input.rawCookie.includes("\n") ||
      input.rawCookie.includes(String.fromCharCode(0))
    ) {
      throw new Error(
        input.rawCookie
          ? "HOYOLAB_INVALID_COOKIE"
          : "HOYOLAB_CONFIGURATION_REQUIRED"
      );
    }
    return { kind: "raw-cookie", rawCookie: input.rawCookie };
  }
  if (
    input.kind !== "fields" ||
    !input.fields ||
    typeof input.fields !== "object"
  ) {
    throw new Error("HOYOLAB_CONFIGURATION_REQUIRED");
  }
  const entries = Object.entries(input.fields);
  if (entries.some(([name]) => !HOYOLAB_COOKIE_NAMES.has(name))) {
    throw new Error("HOYOLAB_INVALID_COOKIE_FIELDS");
  }
  const fields = Object.fromEntries(
    entries.map(([name, field]) => [
      name,
      validateSensitiveMaterial(name.toUpperCase(), field, 4096),
    ])
  ) as HoYoLabCredentialFields;
  if (Object.keys(fields).length === 0) {
    throw new Error("HOYOLAB_CONFIGURATION_REQUIRED");
  }
  return { kind: "fields", fields };
}

function copyCredentialInput(
  input: HoYoLabCredentialInput
): HoYoLabCredentialInput {
  return input.kind === "raw-cookie"
    ? { kind: "raw-cookie", rawCookie: input.rawCookie }
    : { kind: "fields", fields: { ...input.fields } };
}

export class EphemeralAuthMaterial {
  #value: HoYoLabTransientAuthValues;
  #cleared = false;

  public constructor(value: HoYoLabTransientAuthValues) {
    if (!value || typeof value !== "object" || !value.device) {
      throw new Error("HOYOLAB_CONFIGURATION_REQUIRED");
    }
    this.#value = {
      credentials: validateCredentialInput(value.credentials),
      device: {
        deviceId: validateSensitiveMaterial(
          "DEVICE_ID",
          value.device.deviceId,
          128
        ),
        deviceFp: validateSensitiveMaterial(
          "DEVICE_FP",
          value.device.deviceFp,
          128
        ),
      },
    };
  }

  public async consumeOnce<T>(
    consumer: (value: Readonly<HoYoLabTransientAuthValues>) => Promise<T>
  ): Promise<T> {
    if (this.#cleared) throw new Error("Authentication material was cleared");
    try {
      return await consumer({
        credentials: copyCredentialInput(this.#value.credentials),
        device: { ...this.#value.device },
      });
    } finally {
      this.clear();
    }
  }

  public clear(): void {
    this.#value = {
      credentials: { kind: "raw-cookie", rawCookie: "" },
      device: { deviceId: "", deviceFp: "" },
    };
    this.#cleared = true;
  }

  public toString(): string {
    return "[REDACTED]";
  }

  public toJSON(): string {
    return "[REDACTED]";
  }
}

export interface HoYoLabImportInput {
  uid: string;
  region: HoYoLabRegion;
  auth: EphemeralAuthMaterial;
}

export interface HoYoLabProxyRequest {
  uid: string;
  region: HoYoLabRegion;
  credentials: Readonly<HoYoLabCredentialInput>;
  device: Readonly<HoYoLabDeviceIdentity>;
}

export type HoYoLabTransport = (
  request: HoYoLabProxyRequest
) => Promise<unknown>;

const SAFE_PROXY_ERRORS = new Set([
  "HOYOLAB_AUTH_REQUIRED",
  "HOYOLAB_CONFIGURATION_REQUIRED",
  "HOYOLAB_RISK_BLOCKED",
  "HOYOLAB_SECURITY_VERIFICATION_REQUIRED",
  "HOYOLAB_RATE_LIMITED",
  "HOYOLAB_UPSTREAM_HTTP",
  "HOYOLAB_UPSTREAM_REJECTED",
  "HOYOLAB_UPSTREAM_INVALID_RESPONSE",
  "REQUEST_TOO_LARGE",
  "INVALID_REQUEST",
  "INVALID_REGION",
  "ORIGIN_NOT_ALLOWED",
]);

async function defaultHoYoLabTransport(
  request: HoYoLabProxyRequest
): Promise<unknown> {
  const response = await fetch(`/api/hoyolab/${request.region}/avatar/info`, {
    method: "POST",
    credentials: "omit",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      uid: request.uid,
      credentials: request.credentials,
      device: request.device,
    }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: unknown;
    } | null;
    if (typeof body?.error === "string" && SAFE_PROXY_ERRORS.has(body.error)) {
      throw new Error(body.error);
    }
    throw new Error(`HOYOLAB_IMPORT_HTTP_${response.status}`);
  }
  return response.json();
}

export async function importFromHoYoLab(
  input: HoYoLabImportInput,
  options: {
    transport?: HoYoLabTransport;
    catalog?: AccountImportCatalog;
    now?: Date;
  } = {}
): Promise<AccountImportDraft> {
  try {
    return await input.auth.consumeOnce(async (auth) => {
      const transport = options.transport ?? defaultHoYoLabTransport;
      const [response, catalog] = await Promise.all([
        transport({
          uid: input.uid,
          region: input.region,
          credentials: auth.credentials,
          device: auth.device,
        }),
        options.catalog ?? loadAccountImportCatalog(),
      ]);
      return normalizeHoYoLabAvatarInfo(
        response,
        { uid: input.uid, region: input.region },
        catalog,
        options.now ?? new Date()
      );
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (/^HOYOLAB_(?:AUTH_REQUIRED|CONFIGURATION_REQUIRED|RISK_BLOCKED|SECURITY_VERIFICATION_REQUIRED|RATE_LIMITED|UPSTREAM_HTTP|UPSTREAM_REJECTED|UPSTREAM_INVALID_RESPONSE|IMPORT_HTTP_\d+|IMPORT_INVALID_RESPONSE|IMPORT_REGION_MISMATCH|UPSTREAM_RETCODE_-?\d+)$/.test(
        error.message
      ) ||
        error.message === "REQUEST_TOO_LARGE" ||
        error.message === "INVALID_REQUEST" ||
        error.message === "INVALID_REGION" ||
        error.message === "ORIGIN_NOT_ALLOWED")
    ) {
      throw error;
    }
    throw new Error("HOYOLAB_IMPORT_FAILED");
  } finally {
    input.auth.clear();
  }
}
