import { AUTH_CALLBACK_PATH, AUTH_RETURN_KEY } from "@/config/auth";

export function safeAuthReturnPath(path: string | null): string {
  if (!path) return "/";
  try {
    const url = new URL(path, window.location.origin);
    if (
      url.origin !== window.location.origin ||
      url.pathname === AUTH_CALLBACK_PATH
    )
      return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export function rememberAuthReturnPath(): void {
  sessionStorage.setItem(
    AUTH_RETURN_KEY,
    safeAuthReturnPath(window.location.href)
  );
}

export function consumeAuthReturnPath(): string {
  const path = sessionStorage.getItem(AUTH_RETURN_KEY);
  sessionStorage.removeItem(AUTH_RETURN_KEY);
  return safeAuthReturnPath(path);
}
