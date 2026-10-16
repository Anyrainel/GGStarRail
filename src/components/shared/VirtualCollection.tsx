import {
  type Key,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { cn } from "@/lib/utils";

interface VirtualCollectionProps<T> {
  items: readonly T[];
  getKey: (item: T) => Key;
  children: (item: T, index: number) => ReactNode;
  /** Grid classes determine the responsive column count and spacing. */
  gridClassName?: string;
  className?: string;
  /** Fixed-width inventory tiles can use the same row virtualization. */
  tileWidth?: number;
  revealKey?: Key | null;
  onReveal?: () => void;
}

/** Measured rows share the page's scroller; offscreen cards are unmounted. */
export function VirtualCollection<T>({
  items,
  getKey,
  children,
  gridClassName = "grid gap-3",
  className,
  tileWidth,
  revealKey,
  onReveal,
}: VirtualCollectionProps<T>) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const [scrollParent, setScrollParent] = useState<HTMLElement | null>();
  const [layout, setLayout] = useState({ columns: 1, gap: 12 });
  const gridStyle = tileWidth
    ? { gridTemplateColumns: `repeat(auto-fill, ${tileWidth}px)` }
    : undefined;

  // The effect reads computed CSS; rerun when either layout input changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: CSS inputs affect the measured column count and gap.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const probe = probeRef.current;
    if (!root || !probe) return;
    let parent = root.parentElement;
    while (
      parent &&
      !/(auto|scroll)/.test(getComputedStyle(parent).overflowY)
    ) {
      parent = parent.parentElement;
    }
    setScrollParent(parent);
    const measure = () => {
      const style = getComputedStyle(probe);
      const template = style.gridTemplateColumns;
      const columns =
        !template || template === "none"
          ? 1
          : template.trim().split(/\s+/).length;
      const gap = Number.parseFloat(style.rowGap) || 0;
      setLayout((previous) =>
        previous.columns === columns && previous.gap === gap
          ? previous
          : { columns, gap }
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(probe);
    // Blur editable drafts before their row can leave the mounted range, so
    // existing onBlur save handlers run while the input is still mounted.
    const commitOffscreenDraft = () => {
      const active = document.activeElement;
      if (
        !(active instanceof HTMLElement) ||
        !root.contains(active) ||
        !active.matches("input, textarea, [contenteditable='true']")
      )
        return;
      const bounds = active.getBoundingClientRect();
      const viewport = parent?.getBoundingClientRect();
      if (
        bounds.bottom < (viewport?.top ?? 0) ||
        bounds.top > (viewport?.bottom ?? window.innerHeight)
      )
        active.blur();
    };
    const scroller = parent ?? window;
    scroller.addEventListener("scroll", commitOffscreenDraft, {
      passive: true,
    });
    return () => {
      observer.disconnect();
      scroller.removeEventListener("scroll", commitOffscreenDraft);
    };
  }, [gridClassName, tileWidth]);

  const rows = useMemo(() => {
    const result: T[][] = [];
    for (let index = 0; index < items.length; index += layout.columns) {
      result.push(items.slice(index, index + layout.columns));
    }
    return result;
  }, [items, layout.columns]);

  const revealIndex =
    revealKey == null
      ? -1
      : items.findIndex((item) => getKey(item) === revealKey);
  useEffect(() => {
    if (revealIndex < 0 || scrollParent === undefined) return;
    if (items.length <= 24 || typeof ResizeObserver === "undefined") {
      rootRef.current
        ?.querySelectorAll<HTMLElement>("[data-virtual-key]")
        [revealIndex]?.scrollIntoView({ block: "nearest" });
    } else {
      virtuosoRef.current?.scrollIntoView({
        index: Math.floor(revealIndex / layout.columns),
      });
    }
    if (!onReveal) return;
    // Scroll completion can precede React mounting the target row. Focus only
    // after the requested item actually exists in the DOM.
    let revealed: Element | null = null;
    const notifyMounted = () => {
      const mounted = [
        ...(rootRef.current?.querySelectorAll<HTMLElement>(
          "[data-virtual-key]"
        ) ?? []),
      ].find((element) => element.dataset.virtualKey === String(revealKey));
      const content = mounted?.firstElementChild ?? null;
      if (content && content !== revealed) onReveal();
      revealed = content;
    };
    notifyMounted();
    if (!rootRef.current) return;
    // Measurement can replace the initial range more than once. Track the
    // mounted node so a replacement keeps focus without refocusing on edits.
    const observer = new MutationObserver(notifyMounted);
    observer.observe(rootRef.current, { childList: true, subtree: true });
    // Once the player takes control, scrolling back to the item must not
    // steal focus from another control.
    const interactions = [
      "pointerdown",
      "keydown",
      "wheel",
      "touchstart",
    ] as const;
    const stopWatching = () => {
      observer.disconnect();
      for (const event of interactions)
        document.removeEventListener(event, stopWatching, true);
    };
    for (const event of interactions)
      document.addEventListener(event, stopWatching, {
        capture: true,
        passive: true,
      });
    return stopWatching;
  }, [
    revealIndex,
    revealKey,
    items.length,
    layout.columns,
    scrollParent,
    onReveal,
  ]);

  const renderRow = (index: number, row: readonly T[]) => (
    <div style={{ paddingBottom: index < rows.length - 1 ? layout.gap : 0 }}>
      <div className={gridClassName} style={gridStyle}>
        {row.map((item, column) => (
          <div
            key={getKey(item)}
            className="grid min-w-0"
            data-virtual-key={getKey(item)}
          >
            {children(item, index * layout.columns + column)}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div
      ref={rootRef}
      className={cn("relative min-w-0", className)}
      data-virtual-collection
    >
      <div
        ref={probeRef}
        aria-hidden="true"
        className={cn(
          gridClassName,
          "invisible pointer-events-none absolute inset-x-0 top-0"
        )}
        style={gridStyle}
      />
      {items.length <= 24 || typeof ResizeObserver === "undefined" ? (
        <div className={gridClassName} style={gridStyle}>
          {items.map((item, index) => (
            <div
              key={getKey(item)}
              className="grid min-w-0"
              data-virtual-key={getKey(item)}
            >
              {children(item, index)}
            </div>
          ))}
        </div>
      ) : scrollParent !== undefined ? (
        <Virtuoso
          ref={virtuosoRef}
          key={layout.columns}
          customScrollParent={scrollParent ?? undefined}
          useWindowScroll={scrollParent === null}
          data={rows}
          computeItemKey={(_, row) => getKey(row[0]!)}
          itemContent={renderRow}
          increaseViewportBy={300}
          defaultItemHeight={200}
        />
      ) : null}
    </div>
  );
}
