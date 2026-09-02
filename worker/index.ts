import {
  approvedRequestOrigin,
  handleImportProxy,
  type ImportProxyEnv,
} from "./importProxy";

interface Env extends ImportProxyEnv {
  APP_ID: string;
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
