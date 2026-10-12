import type { ReactNode } from "react";
import {
  AccountImportAction,
  AccountImportDialog,
} from "@/components/game-account/imports/AccountImportAction";
import { AppShell as LayoutShell } from "@/components/layout/AppShell";

/** Compose feature actions here; the layout only renders slots. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <LayoutShell
      accountImportAction={
        <AccountImportAction
          variant="outline"
          className="hidden bg-background/70 sm:inline-flex"
        />
      }
      renderAccountImportDialog={(props) => <AccountImportDialog {...props} />}
    >
      {children}
    </LayoutShell>
  );
}
