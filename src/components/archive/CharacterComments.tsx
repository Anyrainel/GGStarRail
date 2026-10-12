import { useState } from "react";
import { PublicPosts } from "@/components/shared/PublicPosts";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { CommentError, submitComment } from "@/providers/community/client";

export function CharacterComments({ characterId }: { characterId: string }) {
  const { t } = useI18n();
  const auth = useAuth();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [requiresSignIn, setRequiresSignIn] = useState(false);
  async function signIn() {
    try {
      await auth.signIn();
    } catch {
      setError(t("community.postFailed"));
    }
  }
  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold">{t("community.comments")}</h3>
      <p className="text-sm">{t("community.commentNotice")}</p>
      {auth.isAuthenticated ? (
        <form
          className="space-y-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!body.trim() || busy) return;
            setBusy(true);
            setError(null);
            try {
              await submitComment(characterId, body, auth.getFeedbackToken);
              setBody("");
              setRevision((value) => value + 1);
              setRequiresSignIn(false);
            } catch (failure) {
              setRequiresSignIn(
                failure instanceof CommentError && failure.status === 401
              );
              setError(
                failure instanceof CommentError && failure.status === 429
                  ? t("community.rateLimited")
                  : failure instanceof CommentError && failure.status === 401
                    ? t("feedback.sessionExpired")
                    : t("community.postFailed")
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <textarea
            aria-label={t("community.comments")}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={1000}
            disabled={busy}
            className="min-h-24 w-full rounded-md border border-border bg-background p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">{body.length}/1000</span>
            <Button type="submit" disabled={busy || !body.trim()}>
              {t("community.post")}
            </Button>
          </div>
        </form>
      ) : (
        <Button onClick={() => void signIn()} disabled={auth.isLoading}>
          {t("auth.signIn")}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {requiresSignIn && (
        <Button disabled={auth.isLoading} onClick={() => void signIn()}>
          {t("auth.signIn")}
        </Button>
      )}
      <PublicPosts characterId={characterId} revision={revision} />
    </section>
  );
}
