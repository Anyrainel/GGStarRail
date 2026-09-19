import {
  createContext,
  type ReactNode,
  useContext,
  useLayoutEffect,
} from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/i18n/I18nContext";

export interface PageActionContent {
  primary: ReactNode;
  overflow: ReactNode;
}
export interface RegisteredPageActions extends PageActionContent {
  pathname: string;
}
export const PageActionContext = createContext<
  ((actions: RegisteredPageActions | null) => void) | null
>(null);

/** Page-owned handlers use the same primary-action and overflow pattern as GGArtifact. */
export function PageActions({ primary, overflow }: PageActionContent) {
  const setActions = useContext(PageActionContext);
  const { pathname } = useLocation();
  const { t } = useI18n();
  useLayoutEffect(() => {
    if (!setActions) return;
    setActions({ primary, overflow, pathname });
    return () => setActions(null);
  }, [setActions, primary, overflow, pathname]);
  if (setActions) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {primary}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">{t("common.more")}</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>{overflow}</DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
