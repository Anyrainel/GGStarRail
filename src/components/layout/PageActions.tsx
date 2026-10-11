import type { LucideIcon } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useContext,
  useLayoutEffect,
} from "react";
import { useLocation } from "react-router-dom";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";

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

interface PageActionButtonProps extends Omit<ButtonProps, "children"> {
  icon: LucideIcon;
  label: string;
}

/** The app-bar header action: an outline button with an icon and a label. */
export function PageActionButton({
  icon: Icon,
  label,
  className,
  variant = "outline",
  ...props
}: PageActionButtonProps) {
  return (
    <Button
      type="button"
      variant={variant}
      className={cn("h-9 gap-2 px-3", className)}
      {...props}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>{label}</span>
    </Button>
  );
}
