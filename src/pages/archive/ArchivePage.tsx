import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { betaEnabled } from "@/data/betaState";
import { useBetaSearch } from "@/hooks/useBetaSearch";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import { AchievementArchiveView } from "./AchievementArchiveView";
import { BetaPreviews } from "./BetaPreviews";
import { CharacterCatalog } from "./CharacterCatalog";
import { CurrencyWarArchiveView } from "./CurrencyWarArchiveView";
import { LightConeCatalog } from "./LightConeCatalog";
import { RelicSetCatalog } from "./RelicSetCatalog";

export type ArchiveKind =
  | "characters"
  | "lightCones"
  | "relicSets"
  | "achievements"
  | "currencyWar";

interface ArchivePageProps {
  kind: ArchiveKind;
  titleKey: MessageKey;
}

export default function ArchivePage({ kind, titleKey }: ArchivePageProps) {
  const { t } = useI18n();
  const { changeSearch, error } = useBetaSearch(() => {});
  return (
    <>
      <PageHeader titleKey={titleKey} visuallyHidden />
      {betaEnabled() && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3 text-sm">
          <Badge>{t("beta.enabled")}</Badge>
          <Button
            variant="outline"
            onClick={() => changeSearch("关闭测试模式")}
          >
            {t("beta.disable")}
          </Button>
          {error && <span role="alert">{error}</span>}
        </div>
      )}
      {betaEnabled() && kind !== "achievements" && kind !== "currencyWar" && (
        <BetaPreviews kind={kind} />
      )}
      {kind === "characters" && <CharacterCatalog />}
      {kind === "lightCones" && <LightConeCatalog />}
      {kind === "relicSets" && <RelicSetCatalog />}
      {kind === "achievements" && <AchievementArchiveView />}
      {kind === "currencyWar" && <CurrencyWarArchiveView />}
    </>
  );
}
