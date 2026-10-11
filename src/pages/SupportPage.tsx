import { PageLayout } from "@/components/layout/PageLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { useI18n } from "@/i18n/I18nContext";
import { getAssetUrl } from "@/lib/assets";

const SUPPORT_IMAGES = ["assets/support/imga.JPG", "assets/support/imgv.JPG"];

export default function SupportPage() {
  const { t } = useI18n();
  return (
    <PageLayout>
      <ScrollLayout bodyClassName="px-4 py-8 md:py-12">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6">
          <header className="max-w-xl space-y-2 text-center">
            <h1 className="text-2xl font-semibold md:text-3xl">
              {t("support.title")}
            </h1>
            <p className="text-sm leading-6 text-muted-foreground md:text-base">
              {t("support.description")}
            </p>
          </header>
          <div className="grid w-full max-w-2xl grid-cols-1 items-start justify-items-center gap-4 md:grid-cols-2">
            {SUPPORT_IMAGES.map((path) => (
              <div
                key={path}
                className="w-full max-w-xs overflow-hidden rounded-lg border border-border bg-card/40"
              >
                <img
                  src={getAssetUrl(path)}
                  alt=""
                  className="block h-auto w-full max-w-full"
                />
              </div>
            ))}
          </div>
        </div>
      </ScrollLayout>
    </PageLayout>
  );
}
