import { type LogtoConfig, UserScope } from "@logto/react";

// Both game sites use the same public Logto SPA integration. Each origin
// completes its own callback and keeps its own browser session.
const endpoint =
  import.meta.env.VITE_LOGTO_ENDPOINT?.trim() || "https://auth.ggartifact.com";
const appId =
  import.meta.env.VITE_LOGTO_APP_ID?.trim() || "tglrsenlbfrfrnevjwlan";

export const AUTH_CONFIG: LogtoConfig = {
  endpoint,
  appId,
  scopes: [UserScope.Email, UserScope.Profile],
};
export const AUTH_CALLBACK_PATH = "/callback";
export const AUTH_RETURN_KEY = "ggstarrail:auth:return-path:v1";
