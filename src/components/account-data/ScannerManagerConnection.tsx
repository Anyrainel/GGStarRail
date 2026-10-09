import { Link2, Play, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { StatusBanner } from "@/components/builds/StatusBanner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import type { ManagerInstructionEnvelope } from "@/lib/managerInstructions";
import {
  ScannerManagerClient,
  ScannerManagerError,
  type ScannerResult,
  type ScannerStatus,
} from "@/lib/scannerManager";
import { cn } from "@/lib/utils";

const reasons: Record<string, MessageKey> = {
  noOpAlreadyDesired: "manager.alreadyDesired",
  previewOnlyNotFound: "manager.notFound",
  previewOnlyAmbiguous: "triage.managerReasonAmbiguous",
  previewOnlyEquipped: "triage.managerReasonEquipped",
  previewOnlyEquipmentUnknown: "manager.equipmentUnknown",
  previewOnlyLocked: "triage.managerReasonLocked",
  previewOnlyUnknownBefore: "triage.managerReasonUnknownBefore",
  previewOnlyBeforeMismatch: "manager.stateChanged",
};

function asError(value: unknown): ScannerManagerError {
  return value instanceof ScannerManagerError
    ? value
    : new ScannerManagerError("response");
}

export function ScannerManagerConnection({
  envelope,
  onResult,
  actionableCount,
}: {
  envelope: ManagerInstructionEnvelope | null;
  onResult?: (
    result: ScannerResult,
    submitted: ManagerInstructionEnvelope
  ) => boolean;
  actionableCount?: number;
}) {
  const { locale, t } = useI18n();
  const [port, setPort] = useState("8765");
  const [client, setClient] = useState<ScannerManagerClient | null>(null);
  const [status, setStatus] = useState<ScannerStatus | null>(null);
  const [result, setResult] = useState<ScannerResult | null>(null);
  const [error, setError] = useState<ScannerManagerError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const resultJob = useRef<string | null>(null);
  const submitted = useRef<{
    jobId: string;
    envelope: ManagerInstructionEnvelope;
    onResult: typeof onResult;
  } | null>(null);
  const [accountChanged, setAccountChanged] = useState(false);
  const running =
    submitting || status?.phase === "pending" || status?.phase === "running";
  const text = (value: { zh: string; en: string }) =>
    locale === "zh-CN" ? value.zh : value.en;

  useEffect(() => {
    if (!client) return;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      if (!client) return;
      try {
        const next = await client.status(abort.signal);
        if (abort.signal.aborted) return;
        setStatus(next);
        if (
          next.kind === "manage" &&
          next.jobId &&
          (next.phase === "completed" || next.phase === "failed") &&
          resultJob.current !== next.jobId
        ) {
          resultJob.current = next.jobId;
          const completed = await client.result(next.jobId, abort.signal);
          if (abort.signal.aborted) return;
          setResult(completed);
          if (
            submitted.current?.jobId === completed.jobId &&
            submitted.current.onResult
          ) {
            setAccountChanged(
              !submitted.current.onResult(completed, submitted.current.envelope)
            );
            submitted.current = null;
          }
        }
      } catch (failure) {
        if (abort.signal.aborted) return;
        const feedback = asError(failure);
        setError(feedback);
        if (feedback.code !== "operation") {
          setClient(null);
          return;
        }
      }
      if (!abort.signal.aborted) timer = setTimeout(() => void poll(), 700);
    }
    void poll();
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [client]);

  async function connect() {
    setError(null);
    setSubmitting(true);
    try {
      const next = new ScannerManagerClient(Number(port));
      setStatus(await next.status());
      resultJob.current = null;
      setClient(next);
    } catch (failure) {
      setError(asError(failure));
    } finally {
      setSubmitting(false);
    }
  }

  async function apply() {
    if (!client || !envelope || running) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    setAccountChanged(false);
    try {
      const jobId = await client.apply(envelope);
      submitted.current = { jobId, envelope, onResult };
      setStatus(await client.status());
    } catch (failure) {
      setError(asError(failure));
    } finally {
      setSubmitting(false);
    }
  }

  async function stop() {
    if (!client || !status?.jobId) return;
    try {
      await client.stop(status.jobId);
    } catch (failure) {
      setError(asError(failure));
    }
  }

  const errorKeys: Record<ScannerManagerError["code"], MessageKey> = {
    connect: "manager.connectError",
    busy: "manager.busyError",
    "wrong-game": "manager.wrongGame",
    request: "manager.requestError",
    response: "manager.responseError",
    operation: "manager.requestError",
  };
  const skipped = new Map<string, number>();
  for (const instruction of result?.instructions ?? []) {
    if (instruction.classification !== "actionable")
      skipped.set(
        instruction.classification,
        (skipped.get(instruction.classification) ?? 0) + 1
      );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          {t("manager.port")}
          <input
            aria-label={t("manager.port")}
            type="number"
            min={1024}
            max={65535}
            value={port}
            disabled={Boolean(client) || submitting}
            onChange={(event) => setPort(event.target.value)}
            className="h-9 w-20 rounded-md border border-border bg-background px-2 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
          />
        </label>
        <Button
          size="sm"
          variant="outline"
          disabled={running}
          onClick={() => {
            if (client) {
              setClient(null);
              setStatus(null);
            } else void connect();
          }}
        >
          <Link2 className="h-4 w-4" aria-hidden />
          {client ? t("manager.disconnect") : t("manager.connect")}
        </Button>
        {running && status?.jobId ? (
          <Button size="sm" variant="outline" onClick={() => void stop()}>
            <Square className="h-4 w-4" aria-hidden />
            {t("manager.stop")}
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={
              !client ||
              !(actionableCount ?? envelope?.instructions.length) ||
              submitting
            }
            onClick={() => void apply()}
          >
            <Play className="h-4 w-4" aria-hidden />
            {t("manager.apply")}
          </Button>
        )}
      </div>
      {!client && !error && (
        <p className="text-sm text-muted-foreground">
          {t("manager.disconnected")}
        </p>
      )}
      {client && status?.progress.message && (
        <p className="text-sm font-semibold" role="status">
          {text(status.progress.message)}
        </p>
      )}
      {status?.progress.steps.map((step) => (
        <div
          key={step.key}
          className="grid h-8 grid-cols-[minmax(0,1fr)_auto_6rem] items-center gap-3 text-xs sm:grid-cols-[minmax(0,1fr)_auto_8rem]"
        >
          <span
            className={cn(
              "truncate",
              step.state === "complete" && "text-primary"
            )}
            title={text(step)}
          >
            {text(step)}
          </span>
          <span className="tabular-nums">
            {step.showCount && (
              <>
                {step.completed}
                {step.total !== null && ` / ${step.total}`}
              </>
            )}
          </span>
          {step.showCount ? (
            <progress
              className="h-1.5 w-full accent-primary"
              aria-label={text(step)}
              max={Math.max(step.total ?? 0, 1)}
              value={
                step.total === null && step.state === "running"
                  ? undefined
                  : step.completed
              }
            />
          ) : (
            <span aria-hidden />
          )}
        </div>
      ))}
      {error && (
        <StatusBanner
          tone="error"
          message={
            error.feedback ? text(error.feedback) : t(errorKeys[error.code])
          }
        />
      )}
      {error?.feedback?.details && (
        <details className="text-xs">
          <summary className="cursor-pointer">{t("manager.details")}</summary>
          <pre className="mt-2 whitespace-pre-wrap break-words">
            {error.feedback.details}
          </pre>
        </details>
      )}
      {accountChanged && <StatusBanner message={t("manager.accountChanged")} />}
      {result && (
        <>
          <StatusBanner
            tone={
              result.needsReview > 0
                ? "error"
                : result.skipped > 0
                  ? "info"
                  : "success"
            }
            message={t("manager.result", {
              verified: result.verified,
              skipped: result.skipped,
              review: result.needsReview,
            })}
          />
          {result.needsReview > 0 && (
            <p className="text-sm font-semibold text-destructive">
              {t("manager.reviewRequired")}
            </p>
          )}
          {skipped.size > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {[...skipped].map(([reason, count]) => (
                <span key={reason}>
                  {t(reasons[reason] ?? "manager.skipped")} · {count}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
