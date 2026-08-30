import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";

interface StatusCardProps {
  titleKey: MessageKey;
  bodyKey: MessageKey;
  statusKey: MessageKey;
  icon: LucideIcon;
  status: "implemented" | "scaffolded" | "excluded";
}

export function StatusCard({
  titleKey,
  bodyKey,
  statusKey,
  icon: Icon,
  status,
}: StatusCardProps) {
  const { t } = useI18n();
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="rounded-lg border border-border bg-background/70 p-2 text-primary">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <Badge variant={status === "excluded" ? "outline" : "default"}>
            {t(statusKey)}
          </Badge>
        </div>
        <div className="space-y-2">
          <CardTitle>{t(titleKey)}</CardTitle>
          <CardDescription>{t(bodyKey)}</CardDescription>
        </div>
      </CardHeader>
    </Card>
  );
}
