import type { AccountImportDraft } from "../types";

export class EphemeralAuthMaterial {
  #value: string;
  #cleared = false;

  public constructor(value: string) {
    if (!value.trim()) throw new Error("Authentication material is required");
    this.#value = value;
  }

  public async consumeOnce<T>(
    consumer: (value: string) => Promise<T>
  ): Promise<T> {
    if (this.#cleared) throw new Error("Authentication material was cleared");
    try {
      return await consumer(this.#value);
    } finally {
      this.clear();
    }
  }

  public clear(): void {
    this.#value = "";
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
  region: string;
  auth: EphemeralAuthMaterial;
}

export type HoYoLabTransport = (request: {
  uid: string;
  region: string;
  credential: string;
}) => Promise<AccountImportDraft>;

export async function importFromHoYoLab(
  input: HoYoLabImportInput,
  transport: HoYoLabTransport
): Promise<AccountImportDraft> {
  try {
    return await input.auth.consumeOnce((credential) =>
      transport({ uid: input.uid, region: input.region, credential })
    );
  } catch {
    throw new Error("HOYOLAB_IMPORT_FAILED");
  } finally {
    input.auth.clear();
  }
}
