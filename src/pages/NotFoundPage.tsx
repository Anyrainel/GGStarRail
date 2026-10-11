import { ArrowLeft, Home, SearchX } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { Button } from "@/components/ui/button";
import { APP_PATHS } from "@/config/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { getAssetUrl } from "@/lib/assets";

export default function NotFoundPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  // A direct visit has no in-app entry to return to; go home instead.
  const goBack = () =>
    location.key === "default" ? navigate(APP_PATHS.home) : navigate(-1);
  return (
    <ScrollLayout bodyClassName="flex items-center justify-center px-4">
      <section className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-gradient-card shadow-lg">
        <div className="flex items-center gap-3 border-b border-border bg-gradient-select px-5 py-4">
          <img
            src={getAssetUrl("logo-hsr.svg")}
            alt=""
            className="h-10 w-10 shrink-0"
          />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-primary">
              {t("app.name")}
            </div>
            <h1 className="text-xl font-bold md:text-2xl">
              {t("route.notFound.title")}
            </h1>
          </div>
        </div>
        <div className="space-y-5 p-5">
          <div className="flex items-start gap-3">
            <div className="shrink-0 rounded-full border border-border p-2">
              <SearchX className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="text-sm font-semibold">
                {t("notFound.status")}
              </div>
              <p className="text-sm text-muted-foreground">
                {t("notFound.reason")}
              </p>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={goBack}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t("notFound.goBack")}
            </Button>
            <Button asChild>
              <Link to={APP_PATHS.home}>
                <Home className="h-4 w-4" aria-hidden="true" />
                {t("notFound.goHome")}
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </ScrollLayout>
  );
}
