import { type RefObject, useEffect } from "react";

/** Forward wheel events over layout gaps to the content, not the whole page. */
export function useGlobalScroll(
  containerRef: RefObject<HTMLElement | null>,
  mainScrollRef: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      const container = containerRef.current;
      const main = mainScrollRef.current;
      const target = event.target;
      if (
        !container ||
        !main ||
        !(target instanceof Node) ||
        !container.contains(target)
      )
        return;
      if (
        container.querySelector("aside")?.contains(target) ||
        main.contains(target)
      )
        return;
      if (main.scrollHeight > main.clientHeight && !event.ctrlKey) {
        event.preventDefault();
        main.scrollBy({ top: event.deltaY, behavior: "auto" });
      }
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [containerRef, mainScrollRef]);
}
