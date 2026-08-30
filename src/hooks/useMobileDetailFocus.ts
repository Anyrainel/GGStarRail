import { useCallback, useEffect, useRef, useState } from "react";

const MOBILE_DETAIL_QUERY = "(max-width: 1023px)";

export function useMobileDetailFocus<T extends HTMLElement>() {
  const detailRef = useRef<T>(null);
  const [focusRequest, setFocusRequest] = useState(0);

  const requestMobileDetailFocus = useCallback(() => {
    setFocusRequest((request) => request + 1);
  }, []);

  useEffect(() => {
    if (focusRequest === 0) return;
    if (!window.matchMedia(MOBILE_DETAIL_QUERY).matches) return;
    const detail = detailRef.current;
    if (!detail) return;
    detail.focus({ preventScroll: true });
    detail.scrollIntoView?.({ behavior: "auto", block: "start" });
  }, [focusRequest]);

  return { detailRef, requestMobileDetailFocus };
}
