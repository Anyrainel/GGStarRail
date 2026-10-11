import { useHandleSignInCallback } from "@logto/react";
import { useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AUTH_CONFIG } from "@/config/auth";
import { useI18n } from "@/i18n/I18nContext";
import { consumeAuthReturnPath } from "@/lib/authNavigation";

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
  const { t } = useI18n();
  if (!AUTH_CONFIG)
    return (
      <div className="p-6 text-center" role="alert">
        {t("auth.unavailable")}
      </div>
    );
  return <Callback />;
}
