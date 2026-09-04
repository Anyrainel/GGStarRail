import {
  CheckCircle2,
  FileJson,
  FlaskConical,
  Globe2,
  KeyRound,
  TriangleAlert,
} from "lucide-react";
import { type ChangeEvent, type FormEvent, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  type AccountImportMode,
  resolveAccountImportIdentity,
} from "@/domain/account/merge";
import type { ImportCoverage } from "@/domain/account/schemas";
import { useI18n } from "@/i18n/I18nContext";
import { createDemoAccount } from "@/lib/demoAccount";
import { redactDiagnostic } from "@/lib/security";
import { importFromUidShowcase } from "@/providers/enka/client";
import {
  EphemeralAuthMaterial,
  type HoYoLabRegion,
  importFromHoYoLab,
} from "@/providers/hoyolab/ephemeralAuth";
import {
  SCANNER_WARNING_V4_COVERAGE_UNKNOWN,
  SCANNER_WARNING_V4_EQUIPPED_CHARACTER_MISSING,
  SCANNER_WARNING_V4_PREVIEW_STATS_OMITTED,
  SCANNER_WARNING_V4_TRACES_PARTIAL,
} from "@/providers/scanner/interopV4";
import {
  parseVersionedScannerExport,
  SCANNER_WARNING_PARTIAL_COVERAGE,
  SCANNER_WARNING_REFERENCE_REVISION_MISMATCH,
  SCANNER_WARNING_SANITIZED_FIXTURE,
  SCANNER_WARNING_TRACES_NOT_INCLUDED,
  SCANNER_WARNING_UNKNOWN_DISCARD_STATE,
  SCANNER_WARNING_UNKNOWN_LOCK_STATE,
  SCANNER_WARNING_V1_COVERAGE_UNKNOWN,
} from "@/providers/scanner/schema";
import type { AccountImportDraft } from "@/providers/types";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

type SuccessState = "import" | "demo" | null;

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-ring/30";

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

interface AccountImportPanelProps {
  uidImporter?: typeof importFromUidShowcase;
  hoYoLabImporter?: typeof importFromHoYoLab;
}

export function AccountImportPanel({
  uidImporter = importFromUidShowcase,
  hoYoLabImporter = importFromHoYoLab,
}: AccountImportPanelProps = {}) {
  const { t } = useI18n();
  const account = useWorkspaceStore((state) => state.account);
  const replaceAccount = useWorkspaceStore((state) => state.replaceAccount);
  const applyAccountImport = useWorkspaceStore(
    (state) => state.applyAccountImport
  );
  const [draft, setDraft] = useState<AccountImportDraft | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<SuccessState>(null);
  const [uid, setUid] = useState("");
  const [hoYoUid, setHoYoUid] = useState("");
  const [hoYoRegion, setHoYoRegion] = useState<HoYoLabRegion>("os");
  const [rawCookie, setRawCookie] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [deviceFp, setDeviceFp] = useState("");
  const [replacementConfirmed, setReplacementConfirmed] = useState(false);
  const [demoConfirmationOpen, setDemoConfirmationOpen] = useState(false);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    setBusy(true);
    setDraft(null);
    setError(null);
    setSuccess(null);
    setReplacementConfirmed(false);
    try {
      const parsed: unknown = JSON.parse(await readFileText(file));
      setDraft(await parseVersionedScannerExport(parsed));
    } catch (reason: unknown) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  };

  const applyDraft = (mode: AccountImportMode) => {
    if (!draft) return;
    applyAccountImport(draft.account, mode);
    setDraft(null);
    setError(null);
    setSuccess("import");
    setReplacementConfirmed(false);
  };

  const beginImport = () => {
    setBusy(true);
    setDraft(null);
    setError(null);
    setSuccess(null);
    setReplacementConfirmed(false);
  };

  const importUid = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    beginImport();
    try {
      setDraft(await uidImporter(uid.trim()));
    } catch (reason: unknown) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  };

  const importHoYoLab = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    beginImport();
    try {
      const auth = new EphemeralAuthMaterial({
        credentials: { kind: "raw-cookie", rawCookie },
        device: { deviceId, deviceFp },
      });
      setDraft(
        await hoYoLabImporter({
          uid: hoYoUid.trim(),
          region: hoYoRegion,
          auth,
        })
      );
    } catch (reason: unknown) {
      setError(reason);
    } finally {
      setRawCookie("");
      setDeviceId("");
      setDeviceFp("");
      setBusy(false);
    }
  };

  const loadDemo = async () => {
    setBusy(true);
    setDraft(null);
    setError(null);
    setSuccess(null);
    setReplacementConfirmed(false);
    try {
      replaceAccount(await createDemoAccount());
      setSuccess("demo");
      setDemoConfirmationOpen(false);
    } catch (reason: unknown) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  };

  const warningText = (warning: string) => {
    if (warning === SCANNER_WARNING_TRACES_NOT_INCLUDED) {
      return t("imports.warning.traces");
    }
    if (warning === SCANNER_WARNING_UNKNOWN_LOCK_STATE) {
      return t("imports.warning.unknownLock");
    }
    if (warning === SCANNER_WARNING_UNKNOWN_DISCARD_STATE) {
      return t("imports.warning.discard");
    }
    if (warning === SCANNER_WARNING_V1_COVERAGE_UNKNOWN) {
      return t("imports.warning.legacyCoverage");
    }
    if (warning === SCANNER_WARNING_PARTIAL_COVERAGE) {
      return t("imports.warning.partialCoverage");
    }
    if (warning === SCANNER_WARNING_SANITIZED_FIXTURE) {
      return t("imports.warning.fixture");
    }
    if (warning === SCANNER_WARNING_REFERENCE_REVISION_MISMATCH) {
      return t("imports.warning.referenceMismatch");
    }
    if (warning === SCANNER_WARNING_V4_COVERAGE_UNKNOWN) {
      return t("imports.warning.v4CoverageUnknown");
    }
    if (warning === SCANNER_WARNING_V4_PREVIEW_STATS_OMITTED) {
      return t("imports.warning.v4PreviewStats");
    }
    if (warning === SCANNER_WARNING_V4_EQUIPPED_CHARACTER_MISSING) {
      return t("imports.warning.v4EquippedCharacter");
    }
    if (warning === SCANNER_WARNING_V4_TRACES_PARTIAL) {
      return t("imports.warning.v4Traces");
    }
    if (warning === "PARTIAL_IMPORT_MERGED_WITH_LOCAL_DATA") {
      return t("imports.warning.merged");
    }
    if (warning.startsWith("UID_SHOWCASE_ONLY")) {
      return t("imports.warning.showcaseOnly");
    }
    if (warning.startsWith("UID_LOCK_STATE_UNAVAILABLE")) {
      return t("imports.warning.unknownLock");
    }
    if (warning.startsWith("UID_DISCARD_STATE_UNAVAILABLE")) {
      return t("imports.warning.discard");
    }
    if (warning.startsWith("UID_SHOWCASE_EMPTY")) {
      return t("imports.warning.emptyShowcase");
    }
    if (warning.startsWith("UID_MIHOMO_FALLBACK_USED")) {
      return t("imports.warning.mihomoFallback");
    }
    if (warning.startsWith("HOYOLAB_EQUIPPED_ONLY")) {
      return t("imports.warning.hoyolabEquippedOnly");
    }
    if (warning.startsWith("HOYOLAB_LOCK_STATE_UNAVAILABLE")) {
      return t("imports.warning.unknownLock");
    }
    if (warning.startsWith("HOYOLAB_DISCARD_STATE_UNAVAILABLE")) {
      return t("imports.warning.discard");
    }
    if (warning.startsWith("HOYOLAB_AUTH_LIVE_UNVERIFIED")) {
      return t("imports.warning.hoyolabUnverified");
    }
    if (warning.startsWith("HOYOLAB_ASCENSION_INFERRED")) {
      return t("imports.warning.ascensionInferred");
    }
    if (warning.startsWith("HOYOLAB_PREVIEW_SUBSTATS_OMITTED")) {
      return t("imports.warning.previewOmitted");
    }
    if (warning.startsWith("HOYOLAB_ACCOUNT_EMPTY")) {
      return t("imports.warning.emptyAccount");
    }
    return t("imports.warning.technical", { code: warning });
  };

  const coverageText = (coverage: ImportCoverage) => {
    switch (coverage) {
      case "complete":
        return t("imports.coverage.complete");
      case "equipped-only":
        return t("imports.coverage.equipped-only");
      case "showcase-only":
        return t("imports.coverage.showcase-only");
      case "unknown":
        return t("imports.coverage.unknown");
    }
  };

  const errorHint =
    error instanceof Error &&
    error.message === "HOYOLAB_SECURITY_VERIFICATION_REQUIRED"
      ? t("imports.error.verification")
      : error instanceof Error && error.message === "HOYOLAB_RISK_BLOCKED"
        ? t("imports.error.riskBlocked")
        : t("imports.error.hint");
  const identity = draft
    ? resolveAccountImportIdentity(account, draft.account)
    : null;

  const identityLabel = () => {
    switch (identity) {
      case "empty-workspace":
        return t("imports.identity.empty");
      case "same-uid":
        return t("imports.identity.same");
      case "different-uid":
        return t("imports.identity.different");
      case "unknown-identity":
        return t("imports.identity.unknown");
      case null:
        return "";
    }
  };

  const identityHelp = () => {
    switch (identity) {
      case "empty-workspace":
        return t("imports.identity.emptyHelp");
      case "same-uid":
        return t("imports.identity.sameHelp");
      case "different-uid":
        return t("imports.identity.differentHelp");
      case "unknown-identity":
        return t("imports.identity.unknownHelp");
      case null:
        return "";
    }
  };

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe2 className="h-5 w-5 text-primary" aria-hidden />
            {t("imports.uid.title")}
          </CardTitle>
          <CardDescription>{t("imports.uid.body")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={importUid}>
            <label className="block space-y-1.5 text-sm font-medium">
              <span>{t("imports.uid.label")}</span>
              <input
                className={FIELD_CLASS}
                value={uid}
                onChange={(event) => setUid(event.target.value)}
                inputMode="numeric"
                pattern="[0-9]{9}"
                minLength={9}
                maxLength={9}
                autoComplete="off"
                placeholder={t("imports.uid.placeholder")}
                required
                disabled={busy}
              />
            </label>
            <p className="text-xs leading-5 text-muted-foreground">
              {t("imports.uid.help")}
            </p>
            <Button type="submit" disabled={busy || !/^\d{9}$/.test(uid)}>
              {busy ? t("common.loading") : t("imports.uid.action")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" aria-hidden />
            {t("imports.credentials.title")}
          </CardTitle>
          <CardDescription>{t("imports.credentials.body")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={importHoYoLab}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5 text-sm font-medium">
                <span>{t("imports.uid.label")}</span>
                <input
                  className={FIELD_CLASS}
                  value={hoYoUid}
                  onChange={(event) => setHoYoUid(event.target.value)}
                  inputMode="numeric"
                  pattern="[0-9]{9}"
                  minLength={9}
                  maxLength={9}
                  autoComplete="off"
                  placeholder={t("imports.uid.placeholder")}
                  required
                  disabled={busy}
                />
              </label>
              <label className="block space-y-1.5 text-sm font-medium">
                <span>{t("imports.credentials.region")}</span>
                <select
                  className={FIELD_CLASS}
                  value={hoYoRegion}
                  onChange={(event) =>
                    setHoYoRegion(event.target.value as HoYoLabRegion)
                  }
                  disabled={busy}
                >
                  <option value="os">{t("imports.credentials.global")}</option>
                  <option value="cn">{t("imports.credentials.cn")}</option>
                </select>
              </label>
            </div>
            <label className="block space-y-1.5 text-sm font-medium">
              <span>{t("imports.credentials.cookie")}</span>
              <textarea
                className="min-h-24 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-ring/30"
                value={rawCookie}
                onChange={(event) => setRawCookie(event.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                required
                disabled={busy}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5 text-sm font-medium">
                <span>{t("imports.credentials.deviceId")}</span>
                <input
                  className={FIELD_CLASS}
                  type="password"
                  value={deviceId}
                  onChange={(event) => setDeviceId(event.target.value)}
                  autoComplete="off"
                  required
                  disabled={busy}
                />
              </label>
              <label className="block space-y-1.5 text-sm font-medium">
                <span>{t("imports.credentials.deviceFp")}</span>
                <input
                  className={FIELD_CLASS}
                  type="password"
                  value={deviceFp}
                  onChange={(event) => setDeviceFp(event.target.value)}
                  autoComplete="off"
                  required
                  disabled={busy}
                />
              </label>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              {t("imports.credentials.help")}
            </p>
            <Button
              type="submit"
              disabled={
                busy ||
                !/^\d{9}$/.test(hoYoUid) ||
                !rawCookie ||
                !deviceId ||
                !deviceFp
              }
            >
              {busy ? t("common.loading") : t("imports.credentials.action")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5 text-primary" aria-hidden />
            {t("imports.account.title")}
          </CardTitle>
          <CardDescription>{t("imports.account.body")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-background/70 px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-within:outline-none focus-within:ring-2 focus-within:ring-ring has-[:disabled]:pointer-events-none has-[:disabled]:opacity-50">
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

      <Card className="border-dashed bg-card/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical
              className="h-4 w-4 text-muted-foreground"
              aria-hidden
            />
            {t("imports.demo.title")}
          </CardTitle>
          <CardDescription>{t("imports.demo.body")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              account ? setDemoConfirmationOpen(true) : loadDemo()
            }
            disabled={busy}
          >
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
              <Badge variant="outline">
                {t("imports.review.coverageCharacters", {
                  coverage: coverageText(
                    draft.account.source.coverage.characters
                  ),
                })}
              </Badge>
              <Badge variant="outline">
                {t("imports.review.coverageLightCones", {
                  coverage: coverageText(
                    draft.account.source.coverage.lightCones
                  ),
                })}
              </Badge>
              <Badge variant="outline">
                {t("imports.review.coverageRelics", {
                  coverage: coverageText(draft.account.source.coverage.relics),
                })}
              </Badge>
              <Badge variant="outline">
                {draft.account.achievementCompletion
                  ? t(
                      draft.account.achievementCompletion.capture
                        ? draft.account.achievementCompletion.locallyModifiedAt
                          ? "imports.review.achievementCapturedEdited"
                          : "imports.review.achievementComplete"
                        : "imports.review.achievementTracked",
                      {
                        count:
                          draft.account.achievementCompletion.completedIds
                            .length,
                      }
                    )
                  : t("imports.review.achievementUnavailable")}
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
            {identity && (
              <div className="space-y-2 rounded-lg border border-border bg-background/60 p-4">
                <p className="text-sm font-medium">{identityLabel()}</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {identityHelp()}
                </p>
                {(identity === "different-uid" ||
                  identity === "unknown-identity") && (
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background/70 p-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-primary"
                      checked={replacementConfirmed}
                      onChange={(event) =>
                        setReplacementConfirmed(event.target.checked)
                      }
                    />
                    <span>{t("imports.identity.replaceConfirm")}</span>
                  </label>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              {(identity === "empty-workspace" || identity === "same-uid") && (
                <Button
                  type="button"
                  onClick={() =>
                    applyDraft(identity === "same-uid" ? "merge" : "replace")
                  }
                >
                  {identity === "same-uid"
                    ? t("imports.apply.merge")
                    : t("imports.apply")}
                </Button>
              )}
              {identity === "unknown-identity" && (
                <Button type="button" onClick={() => applyDraft("merge")}>
                  {t("imports.apply.mergeUnknown")}
                </Button>
              )}
              {(identity === "different-uid" ||
                identity === "unknown-identity") && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={!replacementConfirmed}
                  onClick={() => applyDraft("replace")}
                >
                  {t("imports.apply.replace")}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDraft(null);
                  setReplacementConfirmed(false);
                }}
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
          <p className="text-sm text-muted-foreground">{errorHint}</p>
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

      <ResponsiveDialog
        open={demoConfirmationOpen}
        onOpenChange={setDemoConfirmationOpen}
      >
        <ResponsiveDialogContent
          closeLabel={t("common.close")}
          className="md:w-[min(30rem,calc(100vw-2rem))]"
        >
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {t("imports.demo.confirmTitle")}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {t("imports.demo.confirmBody")}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDemoConfirmationOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="button" variant="destructive" onClick={loadDemo}>
              {t("imports.demo.confirmAction")}
            </Button>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </section>
  );
}
