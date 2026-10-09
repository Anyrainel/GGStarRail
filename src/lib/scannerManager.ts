import { z } from "zod";
import type { ManagerInstructionEnvelope } from "./managerInstructions";
import { serializeManagerInstructionEnvelope } from "./managerInstructions";

const TextSchema = z.object({ zh: z.string(), en: z.string() });
const StepSchema = TextSchema.extend({
  key: z.string(),
  completed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative().nullable(),
  showCount: z.boolean().default(true),
  state: z.enum(["pending", "running", "complete", "interrupted"]),
});
const StatusSchema = z.object({
  game: z.literal("star-rail"),
  jobId: z.string().nullable(),
  kind: z.enum(["manage", "scan"]).nullable(),
  phase: z.enum(["idle", "pending", "running", "completed", "failed"]),
  count: z.number().int().nonnegative(),
  progress: z.object({
    message: TextSchema.nullable(),
    steps: z.array(StepSchema),
  }),
});
const ResultSchema = z.object({
  jobId: z.string(),
  kind: z.literal("manage"),
  verified: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  needsReview: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  instructions: z.array(z.object({ classification: z.string() })),
  entries: z.array(
    z.object({
      instructionId: z.string(),
      status: z.enum(["pending", "mutationStarted", "verified", "needsReview"]),
      change: z.object({
        field: z.enum(["lock", "discard"]),
        before: z.boolean(),
        desired: z.boolean(),
      }),
    })
  ),
});
const FailureSchema = z.object({
  error: TextSchema.extend({ details: z.string() }),
});
export type ScannerStatus = z.infer<typeof StatusSchema>;
export type ScannerResult = z.infer<typeof ResultSchema>;

export class ScannerManagerError extends Error {
  constructor(
    public readonly code:
      | "connect"
      | "busy"
      | "wrong-game"
      | "request"
      | "response"
      | "operation",
    public readonly feedback?: { zh: string; en: string; details: string }
  ) {
    super(code);
  }
}

export class ScannerManagerClient {
  private readonly base: string;
  constructor(port: number) {
    if (!Number.isInteger(port) || port < 1024 || port > 65535)
      throw new ScannerManagerError("connect");
    this.base = `http://127.0.0.1:${port}`;
  }

  private async request(
    path: string,
    signal?: AbortSignal,
    body?: string
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`${this.base}${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers:
          body === undefined
            ? undefined
            : { "Content-Type": "application/json" },
        body,
        signal,
        cache: "no-store",
        credentials: "omit",
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new ScannerManagerError("connect");
    }
    if (!response.ok)
      throw new ScannerManagerError(
        response.status === 409 ? "busy" : "request"
      );
    try {
      return await response.json();
    } catch {
      throw new ScannerManagerError("response");
    }
  }

  async status(signal?: AbortSignal): Promise<ScannerStatus> {
    const body = await this.request("/status", signal);
    if (
      typeof body === "object" &&
      body !== null &&
      "game" in body &&
      body.game !== "star-rail"
    )
      throw new ScannerManagerError("wrong-game");
    const parsed = StatusSchema.safeParse(body);
    if (!parsed.success) throw new ScannerManagerError("response");
    return parsed.data;
  }

  async apply(
    envelope: ManagerInstructionEnvelope,
    signal?: AbortSignal
  ): Promise<string> {
    // Verify the game before sending any instruction; POST is never retried automatically.
    await this.status(signal);
    const body = await this.request(
      "/manage",
      signal,
      serializeManagerInstructionEnvelope(envelope)
    );
    const parsed = z
      .object({ game: z.literal("star-rail"), jobId: z.string() })
      .safeParse(body);
    if (!parsed.success) throw new ScannerManagerError("response");
    return parsed.data.jobId;
  }

  async result(jobId: string, signal?: AbortSignal): Promise<ScannerResult> {
    const body = await this.request(
      `/result?jobId=${encodeURIComponent(jobId)}`,
      signal
    );
    const failure = FailureSchema.safeParse(body);
    if (failure.success)
      throw new ScannerManagerError("operation", failure.data.error);
    const parsed = ResultSchema.safeParse(body);
    if (!parsed.success || parsed.data.jobId !== jobId)
      throw new ScannerManagerError("response");
    return parsed.data;
  }

  async stop(jobId: string): Promise<void> {
    await this.request(
      `/cancel?jobId=${encodeURIComponent(jobId)}`,
      undefined,
      "{}"
    );
  }
}
