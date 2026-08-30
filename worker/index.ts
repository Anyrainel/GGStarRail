interface Env {
  APP_ID: string;
  ALLOWED_ORIGIN: string;
}

function json(body: unknown, status: number, origin: string): Response {
  return Response.json(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      Vary: "Origin",
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const allowedOrigin =
      origin === env.ALLOWED_ORIGIN ? origin : env.ALLOWED_ORIGIN;

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
        headers: {
          "Access-Control-Allow-Origin": allowedOrigin,
          "Cache-Control": "no-store",
          Vary: "Origin",
        },
      });
    }
    return json(body, 200, allowedOrigin);
  },
} satisfies ExportedHandler<Env>;
