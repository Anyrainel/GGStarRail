import type { ReactNode } from "react";
import { Toaster } from "sonner";
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
          appBar
          variant="outline"
          size="sm"
          className="hidden h-9 gap-2 px-3 sm:inline-flex"
        />
      }
      renderAccountImportDialog={(props) => <AccountImportDialog {...props} />}
    >
      <Toaster
        closeButton
        toastOptions={{
          style: {
            background: "hsl(var(--card))",
            color: "hsl(var(--foreground))",
            borderColor: "hsl(var(--border))",
          },
        }}
      />
      {children}
    </LayoutShell>
  );
}
