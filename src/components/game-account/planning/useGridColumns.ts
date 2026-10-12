import {
  type RefCallback,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

function countColumns(element: HTMLElement): number {
  const template = getComputedStyle(element).gridTemplateColumns;
  if (!template || template === "none") return 1;
  return Math.max(1, template.trim().split(/\s+/).length);
}

/**
 * How many columns a CSS grid renders, so a whole row of cards can expand
 * together. One column where ResizeObserver is unavailable.
 */
export function useGridColumns<T extends HTMLElement>(): {
  ref: RefCallback<T>;
  columns: number;
} {
  const observer = useRef<ResizeObserver | null>(null);
  const [columns, setColumns] = useState(1);

  const ref = useCallback<RefCallback<T>>((element) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!element) return;
    setColumns(countColumns(element));
    if (typeof ResizeObserver === "undefined") return;
    observer.current = new ResizeObserver(() =>
      setColumns(countColumns(element))
    );
    observer.current.observe(element);
  }, []);

  useEffect(() => () => observer.current?.disconnect(), []);

  return { ref, columns };
}
