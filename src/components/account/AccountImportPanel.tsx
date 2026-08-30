import {
  CheckCircle2,
  FileJson,
  FlaskConical,
  TriangleAlert,
} from "lucide-react";
import { type ChangeEvent, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useI18n } from "@/i18n/I18nContext";
import { createDemoAccount } from "@/lib/demoAccount";
import { redactDiagnostic } from "@/lib/security";
import {
  parseVersionedScannerExport,
  SCANNER_WARNING_DISCARD_NOT_IMPORTED,
  SCANNER_WARNING_TRACES_NOT_INCLUDED,
  SCANNER_WARNING_UNKNOWN_LOCK_DEFAULTED,
} from "@/providers/scanner/schema";
import type { AccountImportDraft } from "@/providers/types";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

type SuccessState = "import" | "demo" | null;

function readFileText(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () =>
      reject(reader.error ?? new Error("FILE_READ_FAILED"))
    );
    reader.readAsText(file);
  });
}

export function AccountImportPanel() {
  const { t } = useI18n();
  const account = useWorkspaceStore((state) => state.account);
  const replaceAccount = useWorkspaceStore((state) => state.replaceAccount);
  const [draft, setDraft] = useState<AccountImportDraft | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<SuccessState>(null);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    setBusy(true);
    setDraft(null);
    setError(null);
    setSuccess(null);
    try {
      const parsed: unknown = JSON.parse(await readFileText(file));
      setDraft(await parseVersionedScannerExport(parsed));
    } catch (reason: unknown) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  };

  const applyDraft = () => {
    if (!draft) return;
    replaceAccount(draft.account);
    setDraft(null);
    setError(null);
    setSuccess("import");
  };

  const loadDemo = async () => {
    setBusy(true);
    setDraft(null);
    setError(null);
    setSuccess(null);
    try {
      replaceAccount(await createDemoAccount());
      setSuccess("demo");
    } catch (reason: unknown) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  };

  const warningText = (warning: string) => {
    switch (warning) {
      case SCANNER_WARNING_TRACES_NOT_INCLUDED:
        return t("imports.warning.traces");
      case SCANNER_WARNING_UNKNOWN_LOCK_DEFAULTED:
        return t("imports.warning.unknownLock");
      case SCANNER_WARNING_DISCARD_NOT_IMPORTED:
        return t("imports.warning.discard");
      default:
        return warning;
    }
  };

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5 text-primary" aria-hidden />
            {t("imports.account.title")}
          </CardTitle>
          <CardDescription>{t("imports.account.body")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 has-[:disabled]:pointer-events-none has-[:disabled]:opacity-50">
            <FileJson className="h-4 w-4" aria-hidden />
            {busy ? t("common.loading") : t("imports.selectFile")}
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              disabled={busy}
              onChange={handleFile}
            />
          </label>
          <p className="text-xs leading-5 text-muted-foreground">
            {t("imports.fileHelp")}
          </p>
          {account && (
            <p className="text-sm text-muted-foreground">
              {t("imports.existingWarning")}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" aria-hidden />
            {t("imports.demo.title")}
          </CardTitle>
          <CardDescription>{t("imports.demo.body")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button type="button" onClick={loadDemo} disabled={busy}>
            {busy
              ? t("common.loading")
              : account
                ? t("imports.demo.replace")
                : t("imports.demo.load")}
          </Button>
          {account && (
            <p className="text-sm text-muted-foreground">
              {t("imports.existingWarning")}
            </p>
          )}
        </CardContent>
      </Card>

      {draft && (
        <Card className="border-primary/35 lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("imports.review.title")}</CardTitle>
            <CardDescription>
              {t("imports.review.counts", {
                characters: draft.account.characters.length,
                lightCones: draft.account.lightCones.length,
                relics: draft.account.relics.length,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {t("imports.review.source", {
                  source: draft.account.source.provider,
                  version: draft.account.source.sourceVersion,
                })}
              </Badge>
              <Badge variant="outline">
                {t("imports.review.revision", {
                  revision:
                    draft.account.source.sourceRevision ?? t("common.none"),
                })}
              </Badge>
            </div>
            {draft.warnings.length > 0 && (
              <div className="space-y-2 rounded-lg border border-border bg-background/60 p-4">
                <p className="text-sm font-medium">
                  {t("imports.review.warnings")}
                </p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {draft.warnings.map((warning) => (
                    <li key={warning}>{warningText(warning)}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={applyDraft}>
                {t("imports.apply")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDraft(null)}
              >
                {t("imports.cancel")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {error !== null && (
        <div
          className="space-y-2 rounded-xl border border-destructive/50 bg-destructive/10 p-5 lg:col-span-2"
          role="alert"
        >
          <div className="flex items-center gap-2 font-medium">
            <TriangleAlert className="h-5 w-5 text-destructive" aria-hidden />
            {t("imports.error.title")}
          </div>
          <p className="text-sm text-muted-foreground">
            {t("imports.error.hint")}
          </p>
          <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground select-text">
            {redactDiagnostic(error)}
          </pre>
        </div>
      )}

      {success !== null && (
        <div
          className="flex items-center gap-3 rounded-xl border border-primary/35 bg-primary/10 p-5 text-sm lg:col-span-2"
          role="status"
        >
          <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden />
          {success === "demo" ? t("imports.demo.loaded") : t("imports.success")}
        </div>
      )}
    </section>
  );
}
