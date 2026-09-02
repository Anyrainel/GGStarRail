import { Gem, UsersRound, WandSparkles } from "lucide-react";
import { AccountCoverageNotice } from "@/components/account/AccountCoverageNotice";
import { WorkspaceStartState } from "@/components/account/WorkspaceStartState";
import { InventoryCharacterSection } from "@/components/account-data/InventoryCharacterSection";
import { InventoryLightConeSection } from "@/components/account-data/InventoryLightConeSection";
import { InventoryRelicSection } from "@/components/account-data/InventoryRelicSection";
import { InventorySection } from "@/components/account-data/InventorySection";
import { PageHeader } from "@/components/shared/PageHeader";
import { useI18n } from "@/i18n/I18nContext";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

export function InventoryView() {
  const { t } = useI18n();
  const account = useWorkspaceStore((state) => state.account);

  return (
    <>
      <PageHeader
        titleKey="route.inventory.title"
        descriptionKey="route.inventory.description"
        visuallyHidden
      />
      <AccountCoverageNotice account={account} />
      {!account ? (
        <WorkspaceStartState messageKey="empty.inventory" icon={Gem} />
      ) : (
        <div className="space-y-5">
          <InventorySection
            id="inventory-characters"
            title={t("inventory.section.characters")}
            count={account.characters.length}
            icon={UsersRound}
            defaultExpanded={false}
          >
            <InventoryCharacterSection characters={account.characters} />
          </InventorySection>
          <InventorySection
            id="inventory-light-cones"
            title={t("inventory.section.lightCones")}
            count={account.lightCones.length}
            icon={WandSparkles}
          >
            <InventoryLightConeSection lightCones={account.lightCones} />
          </InventorySection>
          <InventorySection
            id="inventory-relics"
            title={t("inventory.section.relics")}
            count={account.relics.length}
            icon={Gem}
          >
            <InventoryRelicSection relics={account.relics} />
          </InventorySection>
        </div>
      )}
    </>
  );
}

export default InventoryView;
