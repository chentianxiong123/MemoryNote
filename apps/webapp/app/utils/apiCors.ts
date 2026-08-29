/**
 * Simple CORS implementation replacing remix-utils/cors.
 */

type CorsMethod = "GET" | "HEAD" | "PUT" | "PATCH" | "POST" | "DELETE";

type CorsOptions = {
  methods?: CorsMethod[];
  /** Defaults to 5 mins */
  maxAge?: number;
  origin?: boolean | string;
  credentials?: boolean;
  exposedHeaders?: string[];
};

function setCorsHeaders(
  response: Response,
  origin: string,
  options: CorsOptions,
): Response {
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Methods", (options.methods ?? ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]).join(", "));
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key, X-Requested-With");
  response.headers.set("Access-Control-Max-Age", String(options.maxAge ?? 5 * 60));
  if (options.credentials) {
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }
  if (options.exposedHeaders && options.exposedHeaders.length > 0) {
    response.headers.set("Access-Control-Expose-Headers", options.exposedHeaders.join(", "));
  }
  return response;
}

export async function apiCors(
  request: Request,
  response: Response,
  options: CorsOptions = { maxAge: 5 * 60 },
): Promise<Response> {
  if (response.headers.has("access-control-allow-origin")) {
    return response;
  }

  const origin = options.origin === true ? "*" : (options.origin || "*");
  return setCorsHeaders(response, origin, options);
}

export function makeApiCors(
  request: Request,
  options: CorsOptions = { maxAge: 5 * 60 },
): (response: Response) => Promise<Response> {
  return (response: Response) => apiCors(request, response, options);
}
