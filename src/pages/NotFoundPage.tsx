import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { APP_PATHS } from "@/config/navigation";
import { useI18n } from "@/i18n/I18nContext";

export default function NotFoundPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader
        titleKey="route.notFound.title"
        descriptionKey="route.notFound.description"
      />
      <Button asChild variant="outline">
        <Link to={APP_PATHS.home}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t("common.backHome")}
        </Link>
      </Button>
    </>
  );
}
