/// <reference path="../worker-configuration.d.ts" />
import {
  approvedRequestOrigin,
  handleImportProxy,
  type ImportProxyEnv,
} from "./importProxy";

interface Env extends ImportProxyEnv {
  APP_ID: string;
  ASSETS?: CloudflareEnv["ASSETS"];
}

function json(body: unknown, status: number, origin: string | null): Response {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Origin",
  });
  if (origin) headers.set("Access-Control-Allow-Origin", origin);
  return Response.json(body, {
    status,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/") && env.ASSETS) {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) {
        if (assetResponse.headers.get("Content-Type")?.includes("text/html")) {
          const response = new Response(assetResponse.body, assetResponse);
          response.headers.set("Cache-Control", "no-cache, must-revalidate");
          return response;
        }
        return assetResponse;
      }
      // Only extensionless HTML navigations receive the app shell. Missing
      // chunks/images must stay 404 so an old tab cannot parse HTML as JS.
      const navigation =
        request.headers.get("Sec-Fetch-Mode") === "navigate" ||
        request.headers.get("Accept")?.includes("text/html");
      if (
        (request.method === "GET" || request.method === "HEAD") &&
        navigation &&
        !url.pathname.startsWith("/assets/") &&
        !url.pathname.startsWith("/media/") &&
        !url.pathname.split("/").pop()?.includes(".")
      ) {
        const indexUrl = new URL("/index.html", url);
        const index = await env.ASSETS.fetch(new Request(indexUrl, request));
        const response = new Response(index.body, index);
        response.headers.set("Cache-Control", "no-cache, must-revalidate");
        response.headers.set("X-Content-Type-Options", "nosniff");
        return response;
      }
      const missing = new Response(assetResponse.body, assetResponse);
      missing.headers.set("Cache-Control", "no-store");
      return missing;
    }
    const requestOrigin = approvedRequestOrigin(request, env);
    if (requestOrigin === false) {
      return Response.json(
        { error: "ORIGIN_NOT_ALLOWED" },
        {
          status: 403,
          headers: {
            "Cache-Control": "no-store",
            "Content-Type": "application/json; charset=utf-8",
            Vary: "Origin",
          },
        }
      );
    }
    const allowedOrigin = requestOrigin;

    const importResponse = await handleImportProxy(request, url, env);
    if (importResponse) return importResponse;

    if (request.method !== "GET" && request.method !== "HEAD") {
      return json({ error: "METHOD_NOT_ALLOWED" }, 405, allowedOrigin);
    }

    if (url.pathname !== "/api/health") {
      return json({ error: "NOT_FOUND" }, 404, allowedOrigin);
    }

    const body = {
      app: env.APP_ID,
      product: "GGStarRail",
      status: "ok",
      resourcesConfigured: false,
    };
    if (request.method === "HEAD") {
      return new Response(null, {
        status: 200,
        headers: (() => {
          const headers = new Headers({
            "Cache-Control": "no-store",
            Vary: "Origin",
          });
          if (allowedOrigin) {
            headers.set("Access-Control-Allow-Origin", allowedOrigin);
          }
          return headers;
        })(),
      });
    }
    return json(body, 200, allowedOrigin);
  },
} satisfies ExportedHandler<Env>;
