import { type LogtoConfig, UserScope } from "@logto/react";

// Configure a dedicated Star Rail SPA; no other product's application ID.
const endpoint = import.meta.env.VITE_LOGTO_ENDPOINT?.trim();
const appId = import.meta.env.VITE_LOGTO_APP_ID?.trim();

export const AUTH_CONFIG: LogtoConfig | null =
  endpoint && appId
    ? { endpoint, appId, scopes: [UserScope.Email, UserScope.Profile] }
    : null;
export const AUTH_CALLBACK_PATH = "/callback";
export const AUTH_RETURN_KEY = "ggstarrail:auth:return-path:v1";
