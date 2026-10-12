import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n/I18nContext";
import { TEAM_DMG_TAB_ORDER, TEAM_DMG_TABS, type TeamDmgTab } from "./types";
import { TEAM_PARAM } from "./useTeamParam";

/** Links to the same team on the other two Team DMG tabs. */
export function TeamAspectLinks({
  tab,
  teamId,
}: {
  tab: TeamDmgTab;
  teamId: string;
}) {
  const { t } = useI18n();
  const search = `?${new URLSearchParams({ [TEAM_PARAM]: teamId })}`;
  return (
    <nav
      aria-label={t("nav.teamDamageSection")}
      className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-center md:gap-x-12 xl:gap-x-20"
    >
      {TEAM_DMG_TAB_ORDER.filter((other) => other !== tab).map((other) => (
        <Link
          key={other}
          to={{ pathname: TEAM_DMG_TABS[other].path, search }}
          className="inline-flex items-center gap-1 border-b border-transparent text-base text-primary outline-hidden hover:border-primary focus-visible:border-primary xl:text-lg"
        >
          {t(TEAM_DMG_TABS[other].aspectKey)}
          <ArrowUpRight className="size-4 md:size-5" aria-hidden />
        </Link>
      ))}
    </nav>
  );
}
