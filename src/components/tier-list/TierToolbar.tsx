import {
  ArrowLeftRight,
  Download,
  FileDown,
  Plus,
  Trash2,
  Upload,
  Wrench,
} from "lucide-react";
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { WideLayout } from "@/components/layout/WideLayout";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { PRIORITY_ROWS } from "@/domain/tier-list/constants";
import {
  type TierDocument,
  TierDocumentSchema,
  type TierPresentation,
} from "@/domain/tier-list/document";
import { useI18n } from "@/i18n/I18nContext";
import { useTierLibraryStore } from "@/stores/useTierLibraryStore";
import { TierPageActions } from "./TierPageActions";

interface TierToolbarProps {
  children: ReactNode;
  filters: ReactNode;
  document: TierDocument;
  itemIds: ReadonlySet<string>;
  onApply: (document: TierDocument) => void;
  onPresentationChange: (presentation: TierPresentation) => void;
  tableRef: RefObject<HTMLDivElement | null>;
}

function download(href: string, filename: string) {
  const anchor = window.document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
}

export function TierToolbar({
  children,
  filters,
  document,
  itemIds,
  onApply,
  onPresentationChange: changePresentation,
  tableRef,
}: TierToolbarProps) {
  const { t } = useI18n();
  const fileInput = useRef<HTMLInputElement>(null);
  const [dialog, setDialog] = useState<"customize" | "lists" | null>(null);
  const [pending, setPending] = useState<TierDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const documents = useTierLibraryStore((state) => state.documents);
  const activeId = useTierLibraryStore(
    (state) => state.active[document.category]
  );
  const save = useTierLibraryStore((state) => state.save);
  const activate = useTierLibraryStore((state) => state.activate);
  const remove = useTierLibraryStore((state) => state.remove);
  const title =
    document.presentation.title ||
    (document.category === "character"
      ? t("route.tierCharacters.title")
      : document.category === "light-cone"
        ? t("route.tierLightCones.title")
        : t("route.tierRelics.title"));

  useEffect(() => {
    if (activeId) save(activeId, document);
  }, [activeId, document, save]);

  function keepCurrent() {
    const id = activeId ?? crypto.randomUUID();
    save(id, document);
    activate(document.category, id);
    return id;
  }

  function onPresentationChange(presentation: TierPresentation) {
    keepCurrent();
    changePresentation(presentation);
  }

  async function importFile(file: File) {
    setError(null);
    try {
      const parsed = TierDocumentSchema.safeParse(
        JSON.parse(await file.text())
      );
      if (
        !parsed.success ||
        parsed.data.category !== document.category ||
        [
          ...Object.keys(parsed.data.assignments),
          ...Object.keys(parsed.data.groupAssignments),
        ].some((id) => !itemIds.has(id)) ||
        (document.category !== "relic-set" &&
          Object.keys(parsed.data.groupAssignments).length > 0)
      ) {
        setError(t("tier.controls.invalidImport"));
        return;
      }
      setPending(parsed.data);
    } catch {
      setError(t("tier.controls.invalidImport"));
    }
  }

  async function exportImage() {
    if (!tableRef.current) return;
    setExporting(true);
    setError(null);
    try {
      const { toPng } = await import("html-to-image");
      const node = tableRef.current;
      await Promise.all(
        [...node.querySelectorAll("img")].map((img) =>
          img.decode().catch(() => undefined)
        )
      );
      download(
        await toPng(node, {
          pixelRatio: 2,
          backgroundColor: getComputedStyle(window.document.body)
            .backgroundColor,
        }),
        `${title}.png`
      );
    } catch {
      setError(t("tier.controls.exportError"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <TierPageActions
        assignedCount={Object.keys(document.assignments).length}
        totalCount={itemIds.size}
        onReset={() =>
          onApply({ ...document, assignments: {}, groupAssignments: {} })
        }
        primary={
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInput.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {t("tier.controls.import")}
          </Button>
        }
        overflow={
          <>
            <DropdownMenuItem
              className="sm:hidden"
              onSelect={() => fileInput.current?.click()}
            >
              <Upload className="h-4 w-4" />
              {t("tier.controls.import")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                const url = URL.createObjectURL(
                  new Blob([JSON.stringify(document, null, 2)], {
                    type: "application/json",
                  })
                );
                download(url, `${title}.json`);
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              <FileDown className="h-4 w-4" />
              {t("tier.controls.export")}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={exporting}
              onSelect={() => void exportImage()}
            >
              <Download className="h-4 w-4" />
              {t("tier.controls.image")}
            </DropdownMenuItem>
          </>
        }
      />
      <WideLayout
        title={title}
        filters={filters}
        actions={
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="gap-2"
              aria-label={t("tier.controls.customize")}
              onClick={() => setDialog("customize")}
            >
              <Wrench className="h-4 w-4" />
              <span className="hidden sm:inline">
                {t("tier.controls.customize")}
              </span>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="gap-2"
              aria-label={t("tier.controls.manage")}
              onClick={() => {
                keepCurrent();
                setDialog("lists");
              }}
            >
              <ArrowLeftRight className="h-4 w-4" />
              <span className="hidden sm:inline">
                {t("tier.controls.manage")}
              </span>
            </Button>
          </div>
        }
      >
        {error && (
          <p role="alert" className="mb-3 text-sm text-destructive">
            {error}
          </p>
        )}
        {children}
      </WideLayout>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        className="hidden"
        aria-label={t("tier.controls.import")}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void importFile(file);
        }}
      />
      <ResponsiveDialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <ResponsiveDialogContent
          closeLabel={t("common.close")}
          aria-describedby={undefined}
          className="md:max-w-lg"
        >
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {dialog === "customize"
                ? t("tier.controls.customize")
                : t("tier.controls.manage")}
            </ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          {dialog === "customize" ? (
            <div className="mt-4 space-y-4">
              <label className="block space-y-1 text-sm">
                <span>{t("tier.controls.title")}</span>
                <input
                  className="h-9 w-full rounded-md border border-border bg-background px-3"
                  value={document.presentation.title}
                  maxLength={160}
                  placeholder={title}
                  onChange={(event) =>
                    onPresentationChange({
                      ...document.presentation,
                      title: event.target.value,
                    })
                  }
                />
              </label>
              {PRIORITY_ROWS.map((tier) => (
                <div key={tier} className="flex items-center gap-3">
                  <span className="w-12 text-sm font-bold">
                    {tier === "Pool" ? t("tier.priority.pool") : tier}
                  </span>
                  <input
                    aria-label={t("tier.controls.tierName", { tier })}
                    className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm"
                    maxLength={40}
                    value={document.presentation.labels[tier] ?? ""}
                    placeholder={
                      tier === "Pool" ? t("tier.priority.pool") : tier
                    }
                    onChange={(event) =>
                      onPresentationChange({
                        ...document.presentation,
                        labels: {
                          ...document.presentation.labels,
                          [tier]: event.target.value,
                        },
                      })
                    }
                  />
                  <label className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={!document.presentation.hidden.includes(tier)}
                      onChange={(event) =>
                        onPresentationChange({
                          ...document.presentation,
                          hidden: event.target.checked
                            ? document.presentation.hidden.filter(
                                (value) => value !== tier
                              )
                            : [...document.presentation.hidden, tier],
                        })
                      }
                    />
                    {t("tier.controls.visible")}
                  </label>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {Object.entries(documents)
                .filter(([, entry]) => entry.category === document.category)
                .map(([id, entry]) => (
                  <div key={id} className="flex items-center gap-2">
                    <Button
                      className="min-w-0 flex-1 justify-start truncate"
                      variant={id === activeId ? "default" : "outline"}
                      onClick={() => {
                        keepCurrent();
                        activate(document.category, id);
                        onApply(entry);
                        setDialog(null);
                      }}
                    >
                      {entry.presentation.title || title}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t("tier.controls.deleteList")}
                      disabled={id === activeId}
                      onClick={() => remove(id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => {
                  keepCurrent();
                  const entry: TierDocument = {
                    ...document,
                    assignments: {},
                    groupAssignments: {},
                    presentation: {
                      title: t("tier.controls.newList"),
                      labels: {},
                      hidden: [],
                    },
                  };
                  const id = crypto.randomUUID();
                  save(id, entry);
                  activate(document.category, id);
                  onApply(entry);
                  setDialog(null);
                }}
              >
                <Plus className="h-4 w-4" />
                {t("tier.controls.newList")}
              </Button>
            </div>
          )}
        </ResponsiveDialogContent>
      </ResponsiveDialog>
      <ResponsiveDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
      >
        <ResponsiveDialogContent
          closeLabel={t("common.close")}
          aria-describedby={undefined}
          className="md:max-w-md"
        >
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {t("tier.controls.replaceTitle")}
            </ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPending(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => {
                if (pending) {
                  keepCurrent();
                  const id = crypto.randomUUID();
                  save(id, pending);
                  activate(pending.category, id);
                  onApply(pending);
                }
                setPending(null);
              }}
            >
              {t("tier.controls.import")}
            </Button>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
