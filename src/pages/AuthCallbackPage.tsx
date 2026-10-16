import { useHandleSignInCallback } from "@logto/react";
import { useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nContext";
import { consumeAuthReturnPath } from "@/services/auth/navigation";

function Callback() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const onComplete = useCallback(
    () => navigate(consumeAuthReturnPath(), { replace: true }),
    [navigate]
  );
  const { error } = useHandleSignInCallback(onComplete);
  const query = new URLSearchParams(window.location.search);
  const failed =
    Boolean(error) ||
    !query.has("state") ||
    !(query.has("code") || query.has("error"));
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-4"
      role="status"
    >
      <p>{t(failed ? "auth.failed" : "auth.completing")}</p>
      {failed && (
        <Button asChild>
          <Link to="/">{t("site.home")}</Link>
        </Button>
      )}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <ScrollLayout bodyClassName="flex items-center justify-center px-4">
      <Callback />
    </ScrollLayout>
  );
}
