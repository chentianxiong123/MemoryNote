/**
 * Minimal replacements for @remix-run/node and @remix-run/server-runtime.
 * Provides json() helper and type aliases used by route files and apiBuilder.
 */

export function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
}

export type Params = Record<string, string | undefined>;

export type LoaderFunctionArgs = {
  request: Request;
  params: Params;
};

export type ActionFunctionArgs = {
  request: Request;
  params: Params;
};

export function redirect(url: string, init?: number | ResponseInit): Response {
  const status = typeof init === "number" ? init : (init as ResponseInit)?.status ?? 302;
  return new Response(null, { status, headers: { Location: url } });
}
