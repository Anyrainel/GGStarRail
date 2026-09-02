import { Database, ScanLine, ShieldCheck } from "lucide-react";
import { AccountImportAction } from "@/components/account/AccountImportAction";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusCard } from "@/components/shared/StatusCard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useI18n } from "@/i18n/I18nContext";

export default function DataSourcesPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader
        titleKey="route.imports.title"
        descriptionKey="route.imports.description"
      />
      <section className="grid gap-4 lg:grid-cols-3">
        <StatusCard
          titleKey="imports.gilore.title"
          bodyKey="imports.gilore.body"
          statusKey="imports.boundary.ready"
          status="implemented"
          icon={Database}
        />
        <StatusCard
          titleKey="imports.scanner.title"
          bodyKey="imports.scanner.body"
          statusKey="imports.boundary.ready"
          status="implemented"
          icon={ScanLine}
        />
        <StatusCard
          titleKey="imports.hoyolab.title"
          bodyKey="imports.hoyolab.body"
          statusKey="imports.boundary.ready"
          status="implemented"
          icon={ShieldCheck}
        />
      </section>
      <Card>
        <CardHeader>
          <CardTitle>{t("imports.help.title")}</CardTitle>
          <CardDescription>{t("imports.help.body")}</CardDescription>
        </CardHeader>
        <CardContent>
          <AccountImportAction variant="outline" />
        </CardContent>
      </Card>
      <Card className="border-primary/25">
        <CardHeader>
          <CardTitle>{t("imports.security.title")}</CardTitle>
          <CardDescription>{t("imports.security.body")}</CardDescription>
        </CardHeader>
      </Card>
    </>
  );
}
