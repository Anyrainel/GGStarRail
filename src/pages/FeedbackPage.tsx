import { Star } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { PublicPosts } from "@/components/shared/PublicPosts";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";
import {
  FEEDBACK_CONTACT_LIMIT,
  FEEDBACK_TEXT_LIMIT,
  FeedbackError,
  submitFeedback,
} from "@/providers/community/feedback";

interface FeedbackDraft {
  rating: number | null;
  suggestion: string;
  bugReport: string;
  contactMethod: string;
}
const EMPTY_DRAFT: FeedbackDraft = {
  rating: null,
  suggestion: "",
  bugReport: "",
  contactMethod: "",
};
const DRAFT_KEY = "ggstarrail:feedback:draft:v1";

function readDraft(): FeedbackDraft {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null");
    if (
      draft?.schemaVersion !== 1 ||
      !(
        draft.rating === null ||
        (Number.isInteger(draft.rating) &&
          draft.rating >= 1 &&
          draft.rating <= 5)
      )
    )
      return EMPTY_DRAFT;
    if (
      typeof draft.suggestion !== "string" ||
      draft.suggestion.length > FEEDBACK_TEXT_LIMIT ||
      typeof draft.bugReport !== "string" ||
      draft.bugReport.length > FEEDBACK_TEXT_LIMIT ||
      typeof draft.contactMethod !== "string" ||
      draft.contactMethod.length > FEEDBACK_CONTACT_LIMIT
    )
      return EMPTY_DRAFT;
    return {
      rating: draft.rating,
      suggestion: draft.suggestion,
      bugReport: draft.bugReport,
      contactMethod: draft.contactMethod,
    };
  } catch {
    return EMPTY_DRAFT;
  }
}

export default function FeedbackPage() {
  const { t } = useI18n();
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const [draft, setDraft] = useState(readDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<
    "failed" | "signed-out" | "rate-limited" | null
  >(null);
  const [success, setSuccess] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const cooldownKey = auth.accountId
    ? `ggstarrail:feedback:${auth.accountId}:next-allowed:v1`
    : null;
  useEffect(() => {
    try {
      if (
        draft.rating === null &&
        !draft.suggestion &&
        !draft.bugReport &&
        !draft.contactMethod
      )
        localStorage.removeItem(DRAFT_KEY);
      else
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ schemaVersion: 1, ...draft })
        );
    } catch {
      /* Drafts can still be submitted when browser storage is blocked. */
    }
  }, [draft]);
  useEffect(() => {
    try {
      setRetryAt(
        cooldownKey ? Number(localStorage.getItem(cooldownKey)) || 0 : 0
      );
    } catch {
      setRetryAt(0);
    }
  }, [cooldownKey]);
  useEffect(() => {
    if (retryAt <= Date.now()) return;
    const timer = window.setTimeout(() => setRetryAt(0), retryAt - Date.now());
    return () => window.clearTimeout(timer);
  }, [retryAt]);
  const coolingDown = retryAt > Date.now();
  const valid =
    draft.rating !== null &&
    Boolean(draft.suggestion.trim() || draft.bugReport.trim());
  function saveCooldown(value: number) {
    setRetryAt(value);
    try {
      if (cooldownKey) localStorage.setItem(cooldownKey, String(value));
    } catch {
      /* Server still enforces the cooldown. */
    }
  }
  async function signIn() {
    setError(null);
    try {
      await auth.signIn();
    } catch {
      setError("failed");
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || coolingDown || busy || draft.rating === null) return;
    setBusy(true);
    setError(null);
    try {
      const result = await submitFeedback(
        { ...draft, rating: draft.rating },
        auth.getFeedbackToken
      );
      saveCooldown(result.nextAllowedAt);
      setDraft(EMPTY_DRAFT);
      setSuccess(true);
      setRevision((value) => value + 1);
    } catch (failure) {
      if (failure instanceof FeedbackError && failure.kind === "rate-limited") {
        saveCooldown(failure.retryAt ?? Date.now() + 5 * 60 * 1000);
        setError("rate-limited");
      } else
        setError(
          failure instanceof FeedbackError && failure.kind === "signed-out"
            ? "signed-out"
            : "failed"
        );
    } finally {
      setBusy(false);
    }
  }
  const needsLogin = !auth.isAuthenticated || error === "signed-out";
  return (
    <PageLayout>
      <ScrollLayout
        header={
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-semibold">{t("account.feedback")}</h1>
            <Button
              onClick={() => {
                setSuccess(false);
                setOpen(true);
              }}
            >
              {t("feedback.submit")}
            </Button>
          </div>
        }
      >
        <PublicPosts revision={revision} />
      </ScrollLayout>
      <ResponsiveDialog
        open={open}
        onOpenChange={(open) => {
          if (!busy) setOpen(open);
        }}
      >
        <ResponsiveDialogContent
          closeLabel={t("common.close")}
          className="md:w-[min(36rem,calc(100vw-2rem))]"
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {t(needsLogin ? "feedback.signInTitle" : "account.feedback")}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {t(
                needsLogin
                  ? "feedback.signInDescription"
                  : "community.feedbackNotice"
              )}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          {success ? (
            <div className="mt-5 space-y-4">
              <p role="status">{t("feedback.success")}</p>
              <Button onClick={() => setOpen(false)}>
                {t("common.close")}
              </Button>
            </div>
          ) : needsLogin ? (
            <div className="mt-5 space-y-4">
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {t(
                    error === "signed-out"
                      ? "feedback.sessionExpired"
                      : "feedback.failed"
                  )}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button disabled={auth.isLoading} onClick={() => void signIn()}>
                  {t("auth.signIn")}
                </Button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(event) => void submit(event)}
              className="mt-5 space-y-4"
            >
              <div className="text-sm">
                {t("feedback.gameSite")}: {t("site.starRail")}
              </div>
              <fieldset className="space-y-2" disabled={busy}>
                <legend className="text-sm font-medium">
                  {t("feedback.ratingLabel")}
                </legend>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <Button
                      type="button"
                      key={rating}
                      variant="ghost"
                      size="icon"
                      aria-label={t("feedback.stars", { count: rating })}
                      aria-pressed={draft.rating === rating}
                      onClick={() => {
                        setDraft({ ...draft, rating });
                        setError(null);
                      }}
                    >
                      <Star
                        className={cn(
                          "size-5 text-muted-foreground",
                          (draft.rating ?? 0) >= rating &&
                            "fill-current text-primary"
                        )}
                      />
                    </Button>
                  ))}
                </div>
              </fieldset>
              <label
                className="block space-y-2 text-sm font-medium"
                htmlFor="feedback-suggestion"
              >
                <span className="flex justify-between gap-3">
                  <span>{t("feedback.suggestion")}</span>
                  <span className="text-xs text-muted-foreground">
                    {draft.suggestion.length}/{FEEDBACK_TEXT_LIMIT}
                  </span>
                </span>
                <textarea
                  id="feedback-suggestion"
                  value={draft.suggestion}
                  maxLength={FEEDBACK_TEXT_LIMIT}
                  placeholder={t("feedback.suggestionPlaceholder")}
                  disabled={busy}
                  onChange={(event) => {
                    setDraft({ ...draft, suggestion: event.target.value });
                    setError(null);
                  }}
                  className="min-h-28 w-full resize-y rounded-md border border-border bg-background px-3 py-2 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <label
                className="block space-y-2 text-sm font-medium"
                htmlFor="feedback-bug"
              >
                <span className="flex justify-between gap-3">
                  <span>{t("feedback.bugReport")}</span>
                  <span className="text-xs text-muted-foreground">
                    {draft.bugReport.length}/{FEEDBACK_TEXT_LIMIT}
                  </span>
                </span>
                <textarea
                  id="feedback-bug"
                  value={draft.bugReport}
                  maxLength={FEEDBACK_TEXT_LIMIT}
                  placeholder={t("feedback.bugPlaceholder")}
                  disabled={busy}
                  onChange={(event) => {
                    setDraft({ ...draft, bugReport: event.target.value });
                    setError(null);
                  }}
                  className="min-h-28 w-full resize-y rounded-md border border-border bg-background px-3 py-2 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <label
                className="block space-y-2 text-sm font-medium"
                htmlFor="feedback-contact"
              >
                <span>{t("feedback.contact")}</span>
                <input
                  id="feedback-contact"
                  value={draft.contactMethod}
                  maxLength={FEEDBACK_CONTACT_LIMIT}
                  placeholder={t("feedback.contactPlaceholder")}
                  disabled={busy}
                  onChange={(event) =>
                    setDraft({ ...draft, contactMethod: event.target.value })
                  }
                  className="h-10 w-full rounded-md border border-border bg-background px-3 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <p
                role={error ? "alert" : undefined}
                className="min-h-5 text-sm text-destructive"
              >
                {error === "rate-limited" || coolingDown
                  ? t("feedback.rateLimited")
                  : error
                    ? t("feedback.failed")
                    : ""}
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={busy || !valid || coolingDown}>
                  {t(busy ? "feedback.submitting" : "feedback.submit")}
                </Button>
              </div>
            </form>
          )}
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </PageLayout>
  );
}
