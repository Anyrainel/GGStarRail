import { Gem, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type RelicCategory, relicCategory } from "@/domain/account/schemas";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

interface RelicsPageProps {
  category: RelicCategory;
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  emptyKey: MessageKey;
}

export default function RelicsPage({
  category,
  titleKey,
  descriptionKey,
  emptyKey,
}: RelicsPageProps) {
  const { t } = useI18n();
  const account = useWorkspaceStore((state) => state.account);
  const relics = (account?.relics ?? []).filter(
    (relic) => relicCategory(relic.slot) === category
  );
  const Icon = category === "cavern" ? Gem : Sparkles;
  return (
    <>
      <PageHeader titleKey={titleKey} descriptionKey={descriptionKey} />
      {relics.length === 0 ? (
        <EmptyState messageKey={emptyKey} icon={Icon} />
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {relics.map((relic) => (
            <Card key={relic.key}>
              <CardHeader>
                <CardTitle className="font-mono text-base">
                  {relic.definitionId}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Badge>{t("field.level", { value: relic.level })}</Badge>
                <Badge variant="secondary">{relic.slot}</Badge>
                {relic.locked && (
                  <Badge variant="outline">{t("field.locked")}</Badge>
                )}
                {relic.equippedCharacterKey && (
                  <Badge variant="outline">{t("field.equipped")}</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </>
  );
}
