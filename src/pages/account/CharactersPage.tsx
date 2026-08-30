import { UsersRound } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n/I18nContext";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

export default function CharactersPage() {
  const { t } = useI18n();
  const account = useWorkspaceStore((state) => state.account);
  const characters = account?.characters ?? [];
  return (
    <>
      <PageHeader
        titleKey="route.characters.title"
        descriptionKey="route.characters.description"
      />
      {characters.length === 0 ? (
        <EmptyState messageKey="empty.characters" icon={UsersRound} />
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {characters.map((character) => (
            <Card key={character.key}>
              <CardHeader>
                <CardTitle className="font-mono text-base">
                  {character.definitionId}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Badge>{t("field.level", { value: character.level })}</Badge>
                <Badge variant="secondary">
                  {t("field.eidolon", { value: character.eidolon })}
                </Badge>
                <Badge variant="outline">
                  {t("field.path", { value: character.pathId })}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </>
  );
}
