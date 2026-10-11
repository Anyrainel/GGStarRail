import {
  type RefCallback,
  useCallback,
  useLayoutEffect,
  useState,
} from "react";

/** WideLayout's gap-4 between the title, its actions, and filter groups. */
const GAP = 16;
/** The gap-2 between an action's icon and its label. */
const LABEL_GAP = 8;
/** From here the filter bar may wrap to make room for the labels. */
const WRAP_BAR_QUERY = "(min-width: 1280px)";

/** Lines a wrapping row of items needs at the given width. */
function lineCount(widths: readonly number[], width: number): number {
  let lines = 0;
  let used = 0;
  for (const itemWidth of widths) {
    if (lines > 0 && used + GAP + itemWidth <= width + 0.5) {
      used += GAP + itemWidth;
    } else {
      lines += 1;
      used = itemWidth;
    }
  }
  return lines;
}

/** A label's text width, whether it is laid out or visually hidden. */
function textWidth(label: HTMLElement): number {
  const range = label.ownerDocument.createRange();
  range.selectNodeContents(label);
  return typeof range.getBoundingClientRect === "function"
    ? range.getBoundingClientRect().width
    : label.scrollWidth;
}

function maxWidth(element: HTMLElement, containingWidth: number): number {
  const value = getComputedStyle(element).maxWidth;
  if (value.endsWith("px")) return Number.parseFloat(value);
  if (value.endsWith("%")) {
    return (Number.parseFloat(value) * containingWidth) / 100;
  }
  const calc = /^calc\(([\d.]+)% - ([\d.]+)px\)$/.exec(value);
  return calc
    ? (Number(calc[1]) * containingWidth) / 100 - Number(calc[2])
    : Number.POSITIVE_INFINITY;
}

/**
 * Whether labels marked `data-action-label` inside the WideLayout title
 * actions fit: the title keeps its full width and, below 1280px, the filter bar
 * needs no more lines than it does beside icon-only actions.
 */
function labelsFit(actions: HTMLElement): boolean {
  const titleBlock = actions.parentElement;
  const row = titleBlock?.parentElement;
  const heading = titleBlock?.querySelector("h1");
  if (!titleBlock || !row || !heading) return true;
  const rowStyle = getComputedStyle(row);
  const rowWidth =
    row.clientWidth -
    Number.parseFloat(rowStyle.paddingLeft) -
    Number.parseFloat(rowStyle.paddingRight);
  let labelWidth = 0;
  let shownWidth = 0;
  for (const label of actions.querySelectorAll<HTMLElement>(
    "[data-action-label]"
  )) {
    const width = textWidth(label) + LABEL_GAP;
    labelWidth += width;
    if (getComputedStyle(label).position !== "absolute") shownWidth += width;
  }
  const iconTitle =
    heading.scrollWidth +
    GAP +
    actions.getBoundingClientRect().width -
    shownWidth;
  const titleLimit = maxWidth(titleBlock, rowWidth);
  const labelledTitle = iconTitle + labelWidth;
  if (labelledTitle > titleLimit + 0.5) return false;
  if (window.matchMedia?.(WRAP_BAR_QUERY)?.matches) return true;
  const bar = row.querySelector<HTMLElement>("[data-wide-filters]");
  if (!bar || getComputedStyle(bar).display === "none") return true;
  const groups = [...bar.children].map(
    (group) => group.getBoundingClientRect().width
  );
  return (
    lineCount(groups, rowWidth - labelledTitle - GAP) <=
    lineCount(groups, rowWidth - Math.min(iconTitle, titleLimit) - GAP)
  );
}

/**
 * Measures whether the title actions have room for their labels. Returns a
 * ref for the actions wrapper and the answer.
 */
export function useActionLabelRoom(): [RefCallback<HTMLElement>, boolean] {
  const [actions, setActions] = useState<HTMLElement | null>(null);
  const [fit, setFit] = useState(false);
  const ref = useCallback<RefCallback<HTMLElement>>(
    (node) => setActions(node),
    []
  );

  useLayoutEffect(() => {
    if (!actions) return;
    const measure = () => setFit(labelsFit(actions));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    const row = actions.parentElement?.parentElement;
    const heading = actions.parentElement?.querySelector("h1");
    const bar = row?.querySelector("[data-wide-filters]");
    for (const element of [
      row,
      heading,
      actions,
      ...(bar ? [...bar.children] : []),
    ]) {
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [actions]);

  return [ref, fit];
}
