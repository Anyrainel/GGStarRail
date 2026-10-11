import { LoaderCircle, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScannerManagerConnection } from "@/components/account-data/ScannerManagerConnection";
import { StatusBanner } from "@/components/builds/StatusBanner";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import type {
  ManagerInstructionEnvelope,
  ManagerInstructionPreview,
} from "@/lib/managerInstructions";
import type { ScannerResult } from "@/lib/scannerManager";

/**
 * "Apply to game": prepares a fresh lock and discard-mark preview each time it
 * opens and hands it to the GGScanner manager connection.
 */
export function TriageManagerDialog({
  open,
  onOpenChange,
  createPreview,
  onResult,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  createPreview: () => Promise<ManagerInstructionPreview>;
  onResult: (
    result: ScannerResult,
    submitted: ManagerInstructionEnvelope
  ) => boolean;
}) {
  const { t } = useI18n();
  const [preview, setPreview] = useState<ManagerInstructionPreview | null>(
    null
  );
  const [preparing, setPreparing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [running, setRunning] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // The preview is taken once per opening; results applied in the game make
  // it stale, so the next opening prepares a new one.
  // biome-ignore lint/correctness/useExhaustiveDependencies: createPreview changes with every triage result; only a new opening should rebuild the preview
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPreview(null);
    setFailed(false);
    setPreparing(true);
    createPreview()
      .then((next) => {
        if (!cancelled) setPreview(next);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setPreparing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleResult = useCallback(
    (result: ScannerResult, submitted: ManagerInstructionEnvelope) => {
      const applied = onResult(result, submitted);
      if (applied) setPreview(null);
      return applied;
    },
    [onResult]
  );

  const actionability = preview?.actionability ?? null;
  const metrics: readonly (readonly [MessageKey, number])[] = actionability
    ? [
        ["triage.managerInstructions", actionability.instructions.length],
        ["triage.managerExecutable", actionability.actionableCount],
        ["triage.managerPreviewOnly", actionability.previewOnlyCount],
        [
          "triage.managerReasonUnknownBefore",
          actionability.reasonCounts["unknown-before"],
        ],
        ["triage.managerReasonEquipped", actionability.reasonCounts.equipped],
        ["triage.managerReasonLocked", actionability.reasonCounts.locked],
        [
          "triage.managerReasonAmbiguous",
          actionability.reasonCounts["ambiguous-matcher"],
        ],
        [
          "triage.managerBlockedLockedDiscard",
          preview?.omittedInstructionIds.length ?? 0,
        ],
      ]
    : [];

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && running) return;
        onOpenChange(next);
      }}
    >
      <ResponsiveDialogContent
        ref={contentRef}
        className="md:max-w-lg"
        aria-describedby={undefined}
        closeLabel={t("common.close")}
        // Focus the sheet, not the Port input, so opening it on a phone does
        // not raise the on-screen keyboard.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current?.focus();
        }}
      >
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {t("triage.managerTitle")}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <div className="mt-4 space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-border bg-card/10 px-3 py-2 text-sm">
            <TriangleAlert
              className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--quality-gold))]"
              aria-hidden="true"
            />
            <p className="leading-5">{t("triage.managerBoundary")}</p>
          </div>
          {preparing ? (
            <p
              role="status"
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <LoaderCircle
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              {t("triage.managerPreparing")}
            </p>
          ) : failed ? (
            <StatusBanner tone="error" message={t("triage.managerError")} />
          ) : actionability && actionability.instructions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("triage.managerNoInstructions")}
            </p>
          ) : actionability ? (
            <div className="space-y-2" data-manager-preview>
              <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-sm sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] sm:gap-x-6">
                {metrics.map(([key, value]) => (
                  <div key={key} className="contents">
                    <dt className="text-muted-foreground">{t(key)}</dt>
                    <dd className="text-right font-mono tabular-nums">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs leading-5 text-muted-foreground">
                {actionability.previewOnlyCount > 0
                  ? t("triage.managerReasonHelp")
                  : t("triage.managerFreshEvidence")}
              </p>
            </div>
          ) : null}
          <ScannerManagerConnection
            envelope={preview?.envelope ?? null}
            actionableCount={actionability?.actionableCount ?? 0}
            onResult={handleResult}
            onRunningChange={setRunning}
            closeAction={
              <Button
                type="button"
                variant="outline"
                disabled={running}
                onClick={() => onOpenChange(false)}
              >
                {t("common.close")}
              </Button>
            }
          />
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
