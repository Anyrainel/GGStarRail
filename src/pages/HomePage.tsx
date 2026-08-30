import { Ban, Braces, Database, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusCard } from "@/components/shared/StatusCard";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useI18n } from "@/i18n/I18nContext";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

export default function HomePage() {
  const { t } = useI18n();
  const account = useWorkspaceStore((state) => state.account);

  return (
    <>
      <PageHeader
        titleKey="route.home.title"
        descriptionKey="route.home.description"
      />

      <section className="grid gap-4 md:grid-cols-3">
        <StatusCard
          titleKey="home.ready.title"
          bodyKey="home.ready.body"
          statusKey="status.implemented"
          status="implemented"
          icon={ShieldCheck}
        />
        <StatusCard
          titleKey="home.scaffolded.title"
          bodyKey="home.scaffolded.body"
          statusKey="status.scaffolded"
          status="scaffolded"
          icon={Braces}
        />
        <StatusCard
          titleKey="home.excluded.title"
          bodyKey="home.excluded.body"
          statusKey="status.excluded"
          status="excluded"
          icon={Ban}
        />
      </section>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-2">
            <CardTitle>{t("home.snapshot.title")}</CardTitle>
            <CardDescription>
              {account
                ? t("home.snapshot.source", {
                    source:
                      account.source.provider === "demo-account"
                        ? t("source.demo")
                        : account.source.provider,
                  })
                : t("home.snapshot.empty")}
            </CardDescription>
          </div>
          <div className="rounded-lg border border-border bg-background/70 p-2 text-primary">
            {account ? (
              <Database className="h-5 w-5" aria-hidden="true" />
            ) : (
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {account ? (
            <p className="text-sm text-muted-foreground">
              {t("home.snapshot.counts", {
                characters: account.characters.length,
                lightCones: account.lightCones.length,
                relics: account.relics.length,
              })}
            </p>
          ) : (
            <Badge variant="outline">{t("status.noLiveData")}</Badge>
          )}
        </CardContent>
      </Card>
    </>
  );
}
