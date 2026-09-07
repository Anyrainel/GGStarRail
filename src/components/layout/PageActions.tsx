import {
  createContext,
  type ReactNode,
  useContext,
  useLayoutEffect,
} from "react";
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
export const PageActionContext = createContext<
  ((actions: PageActionContent | null) => void) | null
>(null);

/** Page-owned handlers use the same primary-action and overflow pattern as GGArtifact. */
export function PageActions({ primary, overflow }: PageActionContent) {
  const setActions = useContext(PageActionContext);
  const { t } = useI18n();
  useLayoutEffect(() => {
    if (!setActions) return;
    setActions({ primary, overflow });
    return () => setActions(null);
  }, [setActions, primary, overflow]);
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
