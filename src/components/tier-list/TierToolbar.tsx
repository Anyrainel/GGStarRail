import {
  ArrowLeftRight,
  Check,
  Layers,
  Pencil,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type WideFilterGroup,
  WideLayout,
} from "@/components/layout/WideLayout";
import { CheckboxRow } from "@/components/shared/Checkbox";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import { useTierLibraryStore } from "@/stores/useTierLibraryStore";
import { TierPageActions } from "./TierPageActions";
import { useActionLabelRoom } from "./useActionLabelRoom";

interface TierToolbarProps {
  children: ReactNode;
  filters: readonly WideFilterGroup[];
  document: TierDocument;
  itemIds: ReadonlySet<string>;
  onApply: (document: TierDocument) => void;
  onPresentationChange: (presentation: TierPresentation) => void;
  tableRef: RefObject<HTMLDivElement | null>;
}

const INPUT_CLASS =
  "h-9 w-full min-w-0 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring";
const ROW_CARD = "rounded-lg border border-border bg-card p-4";
const ROW_LABEL = "shrink-0 text-sm font-medium text-muted-foreground";

function ListMarker({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full p-1.5",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground"
      )}
      aria-hidden="true"
    >
      <Layers className="h-5 w-5" />
    </span>
  );
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
  const [actionsRef, labelsFit] = useActionLabelRoom();
  const [dialog, setDialog] = useState<"customize" | "lists" | null>(null);
  const [renaming, setRenaming] = useState<{
    id: string;
    title: string;
  } | null>(null);
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

  function rename(id: string, entry: TierDocument, value: string) {
    const nextTitle = value.trim();
    if (nextTitle && id === activeId) {
      onPresentationChange({ ...document.presentation, title: nextTitle });
    } else if (nextTitle) {
      save(id, {
        ...entry,
        presentation: { ...entry.presentation, title: nextTitle },
      });
    }
    setRenaming(null);
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

  function exportDocument() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(document, null, 2)], {
        type: "application/json",
      })
    );
    download(url, `${title}.json`);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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

  const actionLabel = labelsFit ? "sr-only sm:not-sr-only" : "sr-only";
  const lists = Object.entries(documents).filter(
    ([, entry]) => entry.category === document.category
  );

  return (
    <>
      <TierPageActions
        assignedCount={Object.keys(document.assignments).length}
        totalCount={itemIds.size}
        exporting={exporting}
        onImport={() => fileInput.current?.click()}
        onExport={exportDocument}
        onDownloadImage={() => void exportImage()}
        onReset={() =>
          onApply({ ...document, assignments: {}, groupAssignments: {} })
        }
      />
      <WideLayout
        title={title}
        filters={filters}
        actions={
          <div ref={actionsRef} className="flex shrink-0 items-center gap-4">
            <Button
              size="sm"
              variant="secondary"
              className="shrink-0 gap-2"
              aria-label={t("tier.controls.customize")}
              title={t("tier.controls.customize")}
              onClick={() => setDialog("customize")}
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
              <span data-action-label className={actionLabel}>
                {t("tier.controls.customize")}
              </span>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="shrink-0 gap-2"
              aria-label={t("tier.controls.manage")}
              title={t("tier.controls.manage")}
              onClick={() => {
                keepCurrent();
                setRenaming(null);
                setDialog("lists");
              }}
            >
              <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
              <span data-action-label className={actionLabel}>
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
          className={
            dialog === "customize" ? "md:max-w-[700px]" : "md:max-w-md"
          }
          onEscapeKeyDown={(event) => {
            if (!renaming) return;
            event.preventDefault();
            setRenaming(null);
          }}
        >
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {dialog === "customize"
                ? t("tier.controls.customize")
                : t("tier.controls.manage")}
            </ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          {dialog === "customize" ? (
            <div className="mt-4 space-y-3">
              <label className={cn(ROW_CARD, "flex items-center gap-4")}>
                <span className={cn(ROW_LABEL, "w-24")}>
                  {t("tier.controls.title")}
                </span>
                <input
                  className={INPUT_CLASS}
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
              {PRIORITY_ROWS.map((tier) => {
                const tierName =
                  tier === "Pool" ? t("tier.priority.pool") : tier;
                return (
                  <div
                    key={tier}
                    className={cn(
                      ROW_CARD,
                      "flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"
                    )}
                  >
                    <span className={cn(ROW_LABEL, "sm:w-24")}>{tierName}</span>
                    <input
                      aria-label={t("tier.controls.tierName", { tier })}
                      className={INPUT_CLASS}
                      maxLength={40}
                      value={document.presentation.labels[tier] ?? ""}
                      placeholder={tierName}
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
                    <CheckboxRow
                      className="shrink-0 whitespace-nowrap xl:text-sm"
                      label={t("tier.controls.visible")}
                      checked={!document.presentation.hidden.includes(tier)}
                      onCheckedChange={(checked) =>
                        onPresentationChange({
                          ...document.presentation,
                          hidden: checked
                            ? document.presentation.hidden.filter(
                                (value) => value !== tier
                              )
                            : [...document.presentation.hidden, tier],
                        })
                      }
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-2">
              {lists.map(([id, entry]) => {
                const active = id === activeId;
                const editing = renaming?.id === id;
                return (
                  <div
                    key={id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                      active
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    {editing ? (
                      <form
                        className="flex min-w-0 flex-1 items-center gap-3"
                        onSubmit={(event) => {
                          event.preventDefault();
                          rename(id, entry, renaming.title);
                        }}
                      >
                        <ListMarker active={active} />
                        <input
                          // biome-ignore lint/a11y/noAutofocus: renaming starts from the row's own action
                          autoFocus
                          aria-label={t("tier.controls.listName")}
                          className={cn(INPUT_CLASS, "h-8")}
                          maxLength={160}
                          value={renaming.title}
                          onChange={(event) =>
                            setRenaming({ id, title: event.target.value })
                          }
                        />
                        <Button
                          type="submit"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          aria-label={t("tier.controls.saveName")}
                          disabled={!renaming.title.trim()}
                        >
                          <Check className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </form>
                    ) : (
                      <>
                        <button
                          type="button"
                          aria-current={active ? "true" : undefined}
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => {
                            keepCurrent();
                            activate(document.category, id);
                            onApply(entry);
                            setDialog(null);
                          }}
                        >
                          <ListMarker active={active} />
                          <span className="truncate font-medium text-foreground">
                            {entry.presentation.title || title}
                          </span>
                        </button>
                        {active && (
                          <span className="shrink-0 rounded-sm bg-primary/20 px-1.5 py-0.5 text-xs text-primary">
                            {t("tier.controls.active")}
                          </span>
                        )}
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            aria-label={t("tier.controls.renameList")}
                            title={t("tier.controls.renameList")}
                            onClick={() =>
                              setRenaming({
                                id,
                                title: entry.presentation.title || title,
                              })
                            }
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            aria-label={t("tier.controls.deleteList")}
                            title={t("tier.controls.deleteList")}
                            disabled={active}
                            onClick={() => remove(id)}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
              <Button
                variant="outline"
                className="mt-2 h-auto w-full justify-start gap-3 rounded-lg p-3"
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
                <span
                  className="shrink-0 rounded-full border border-primary p-1.5 text-primary"
                  aria-hidden="true"
                >
                  <Plus className="h-5 w-5" />
                </span>
                <span className="font-medium text-foreground">
                  {t("tier.controls.newList")}
                </span>
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
