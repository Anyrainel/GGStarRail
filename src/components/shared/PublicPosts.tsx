import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nContext";
import { fetchPosts, type PostPage } from "@/providers/community/client";

export function PublicPosts({
  characterId,
  revision = 0,
}: {
  characterId?: string;
  revision?: number;
}) {
  return (
    <PostList
      key={`${characterId ?? "feedback"}:${revision}`}
      characterId={characterId}
    />
  );
}
function PostList({ characterId }: { characterId?: string }) {
  const { t, locale } = useI18n();
  const [history, setHistory] = useState<(string | null)[]>([null]);
  const [request, setRequest] = useState({
    page: 0,
    cursor: null as string | null,
  });
  const [result, setResult] = useState<PostPage | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    setFailed(false);
    fetchPosts(characterId, request.cursor, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setResult(data);
      },
      () => {
        if (!controller.signal.aborted) setFailed(true);
      }
    );
    return () => controller.abort();
  }, [characterId, request]);
  return (
    <div className="space-y-3" aria-live="polite">
      {failed ? (
        <div role="alert" className="flex items-center gap-3">
          <p>{t("community.failed")}</p>
          <Button variant="outline" onClick={() => setRequest({ ...request })}>
            {t("community.retry")}
          </Button>
        </div>
      ) : !result ? (
        <p role="status">{t("community.loading")}</p>
      ) : result.items.length === 0 ? (
        <p>{t("community.empty")}</p>
      ) : (
        result.items.map((post) => (
          <article
            key={post.id}
            className="space-y-2 break-words rounded-lg border border-border bg-gradient-card p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              {post.rating != null && (
                <span
                  role="img"
                  aria-label={t("feedback.stars", { count: post.rating })}
                >
                  {"★".repeat(post.rating)}
                  {"☆".repeat(5 - post.rating)}
                </span>
              )}
              <time dateTime={new Date(post.createdAt).toISOString()}>
                {new Date(post.createdAt).toLocaleString(locale)}
              </time>
            </div>
            {post.body && <p className="whitespace-pre-wrap">{post.body}</p>}
            {post.suggestion && (
              <div>
                <h2 className="font-medium">{t("feedback.suggestion")}</h2>
                <p className="whitespace-pre-wrap">{post.suggestion}</p>
              </div>
            )}
            {post.bugReport && (
              <div>
                <h2 className="font-medium">{t("feedback.bugReport")}</h2>
                <p className="whitespace-pre-wrap">{post.bugReport}</p>
              </div>
            )}
          </article>
        ))
      )}
      <nav
        aria-label={t("community.pagination")}
        className="flex items-center justify-between gap-3"
      >
        <Button
          variant="outline"
          disabled={!result || request.page === 0}
          onClick={() =>
            setRequest({
              page: request.page - 1,
              cursor: history[request.page - 1],
            })
          }
        >
          {t("community.previous")}
        </Button>
        <span>{request.page + 1}</span>
        <Button
          variant="outline"
          disabled={!result?.nextCursor}
          onClick={() => {
            if (!result?.nextCursor) return;
            setHistory([
              ...history.slice(0, request.page + 1),
              result.nextCursor,
            ]);
            setRequest({ page: request.page + 1, cursor: result.nextCursor });
          }}
        >
          {t("community.next")}
        </Button>
      </nav>
    </div>
  );
}
