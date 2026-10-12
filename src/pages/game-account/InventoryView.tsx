import { Gem, Monitor } from "lucide-react";
import { useState } from "react";
import { InventoryCharacterSection } from "@/components/game-account/InventoryCharacterSection";
import { InventoryLightConeSection } from "@/components/game-account/InventoryLightConeSection";
import { InventoryRelicSection } from "@/components/game-account/InventoryRelicSection";
import { InventorySection } from "@/components/game-account/InventorySection";
import { AccountCoverageNotice } from "@/components/game-account/imports/AccountCoverageNotice";
import { AccountImportDialog } from "@/components/game-account/imports/AccountImportAction";
import { WorkspaceStartState } from "@/components/game-account/imports/WorkspaceStartState";
import { PageLayout } from "@/components/layout/PageLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useI18n } from "@/i18n/I18nContext";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

export function InventoryView() {
  const { t } = useI18n();
  const account = useWorkspaceStore((state) => state.account);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const iconSize = isMobile ? "lg" : "xl";
  const [syncOpen, setSyncOpen] = useState(false);

  const syncAction = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5 max-sm:px-2.5"
      onClick={() => setSyncOpen(true)}
    >
      <Monitor className="h-4 w-4" aria-hidden="true" />
      {t("inventory.syncFromGame")}
    </Button>
  );

  return (
    <PageLayout>
      <PageHeader titleKey="route.inventory.title" visuallyHidden />
      <ScrollLayout bodyClassName="space-y-6">
        <AccountCoverageNotice account={account} />
        {!account ? (
          <WorkspaceStartState messageKey="empty.inventory" icon={Gem} />
        ) : (
          <>
            <InventorySection
              id="inventory-characters"
              title={t("inventory.section.characters")}
              count={account.characters.length}
              defaultExpanded={false}
              action={syncAction}
            >
              <InventoryCharacterSection
                characters={account.characters}
                iconSize={iconSize}
              />
            </InventorySection>
            <InventorySection
              id="inventory-light-cones"
              title={t("inventory.section.lightCones")}
              count={account.lightCones.length}
              action={syncAction}
            >
              <InventoryLightConeSection
                lightCones={account.lightCones}
                iconSize={iconSize}
              />
            </InventorySection>
            <InventorySection
              id="inventory-relics"
              title={t("inventory.section.relics")}
              count={account.relics.length}
              action={syncAction}
            >
              <InventoryRelicSection
                relics={account.relics}
                iconSize={iconSize}
              />
            </InventorySection>
            <AccountImportDialog
              open={syncOpen}
              onOpenChange={setSyncOpen}
              initialMethod="json"
            />
          </>
        )}
      </ScrollLayout>
    </PageLayout>
  );
}

export default InventoryView;
