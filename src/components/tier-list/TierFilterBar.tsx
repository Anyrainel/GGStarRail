import { Filter } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import { useI18n } from "@/i18n/I18nContext";

/** Genshin WideLayout's inline filters and compact-screen filter dialog. */
export function TierFilterBar({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="mb-4 hidden flex-wrap items-center gap-x-4 gap-y-2 md:flex">
        {children}
      </div>
      <div className="mb-3 flex justify-end md:hidden">
        <ResponsiveDialog open={open} onOpenChange={setOpen}>
          <ResponsiveDialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Filter className="h-4 w-4" />
              {t("tier.controls.filters")}
            </Button>
          </ResponsiveDialogTrigger>
          <ResponsiveDialogContent
            closeLabel={t("common.close")}
            aria-describedby={undefined}
          >
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>
                {t("tier.controls.filters")}
              </ResponsiveDialogTitle>
            </ResponsiveDialogHeader>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {children}
            </div>
          </ResponsiveDialogContent>
        </ResponsiveDialog>
      </div>
    </>
  );
}
