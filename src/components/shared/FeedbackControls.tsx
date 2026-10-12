import { Eye, EyeOff, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import {
  type CommunityPost,
  updateFeedbackPost,
} from "@/providers/community/client";

export function FeedbackControls({ post }: { post: CommunityPost }) {
  const { t } = useI18n();
  const auth = useAuth();
  const [current, setCurrent] = useState(post);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function update(action: "visibility" | "vote", enabled: boolean) {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      setCurrent(
        await updateFeedbackPost(
          post.id,
          action,
          enabled,
          auth.getFeedbackToken
        )
      );
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm">
          {current.authorEmail ?? t("feedback.anonymous")}
        </span>
        {current.isPublic === false && (
          <span className="text-sm">{t("feedback.hidden")}</span>
        )}
        <Button
          variant="outline"
          size="sm"
          aria-label={t("feedback.upvote")}
          aria-pressed={current.hasUpvoted ?? false}
          disabled={busy || !auth.isAuthenticated}
          onClick={() => void update("vote", !current.hasUpvoted)}
        >
          <ThumbsUp className="size-4" /> {current.upvotes ?? 1}
        </Button>
        {current.isOwner && (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void update("visibility", !current.isPublic)}
          >
            {current.isPublic ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
            {current.isPublic ? t("feedback.hide") : t("feedback.publish")}
          </Button>
        )}
      </div>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {t("feedback.updateFailed")}
        </p>
      )}
    </div>
  );
}
