import type { RequestHandler } from "express";

/**
 * Polyfill for Remix's `json()` helper.
 * Remix route handlers call `json(data)` which returns a Response.
 */
export function json(data: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return new Response(JSON.stringify(data), { ...init, headers });
}

/** Minimal load-context shape needed by Remix route handlers. */
type LoadContext = Record<string, unknown>;
type LoaderArgs = { request: Request; params: Record<string, string>; context?: LoadContext };

type RemixLoader = (args: LoaderArgs) => Response | Promise<Response>;
type RemixAction = (args: { request: Request; params: Record<string, string>; context?: LoadContext }) => Response | Promise<Response>;

/**
 * Wraps a Remix-style `loader` function so it can be used as an Express route handler.
 * Converts Express req/res to a Web API Request, calls the loader, and serialises the Response.
 */
export function adaptLoader(remixLoader: RemixLoader): RequestHandler {
  return async (req, res, next) => {
    try {
      const request = expressReqToWebRequest(req);
      const response = await remixLoader({ request, params: req.params });
      webResponseToExpress(res, response);
    } catch (err) {
      if (err instanceof Response) {
        webResponseToExpress(res, err);
      } else {
        next(err);
      }
    }
  };
}

/**
 * Wraps a Remix-style `action` function so it can be used as an Express route handler.
 */
export function adaptAction(remixAction: RemixAction): RequestHandler {
  return async (req, res, next) => {
    try {
      const request = expressReqToWebRequest(req);
      const response = await remixAction({ request, params: req.params });
      webResponseToExpress(res, response);
    } catch (err) {
      if (err instanceof Response) {
        webResponseToExpress(res, err);
      } else {
        next(err);
      }
    }
  };
}

function expressReqToWebRequest(req: import("express").Request): Request {
  // Reconstruct the full URL from the Express request
  const host = req.headers.host ?? "localhost";
  const protocol = req.protocol;
  const url = new URL(req.originalUrl || req.url, `${protocol}://${host}`);

  let bodyInit: BodyInit | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    bodyInit = req.body !== undefined ? JSON.stringify(req.body) : undefined;
  }

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }
  }

  return new Request(url, {
    method: req.method,
    headers,
    body: bodyInit,
  });
}

function webResponseToExpress(res: import("express").Response, response: Response): void {
  res.status(response.status);
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  response.text().then((body) => res.send(body));
}