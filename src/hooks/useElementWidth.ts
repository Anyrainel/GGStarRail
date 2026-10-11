import { type RefCallback, useCallback, useEffect, useState } from "react";

/**
 * Measures an element's content-box width with a ResizeObserver. Returns a
 * callback ref and the last width (null before the first measurement, or where
 * ResizeObserver is unavailable).
 */
export function useElementWidth<T extends HTMLElement = HTMLDivElement>(): [
  RefCallback<T>,
  number | null,
] {
  const [element, setElement] = useState<T | null>(null);
  const [width, setWidth] = useState<number | null>(null);
  const ref = useCallback<RefCallback<T>>((node) => setElement(node), []);

  useEffect(() => {
    if (!element) return;
    const measure = () => {
      const next = element.getBoundingClientRect().width;
      setWidth((current) => (current === next ? current : next));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      const next = entry.contentRect.width;
      setWidth((current) => (current === next ? current : next));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return [ref, width];
}
