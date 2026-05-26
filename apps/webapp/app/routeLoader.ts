import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Router } from "express";

const ROUTES_DIR = path.resolve(import.meta.dirname, "routes");

interface RemixModule {
  loader?: (args: { request: Request; params: Record<string, string> }) => Response | Promise<Response>;
  action?: (args: { request: Request; params: Record<string, string> }) => Response | Promise<Response>;
}

function remixFileToExpressPath(filename: string): string {
  const withoutExt = filename.replace(/\.tsx$/, "");
  const segments = withoutExt.split(".");
  const expressSegments: string[] = [];
  for (const seg of segments) {
    if (seg === "_index") continue;
    if (seg.startsWith("$")) {
      expressSegments.push(`:${seg.slice(1)}`);
    } else {
      expressSegments.push(seg);
    }
  }
  return "/" + expressSegments.join("/");
}

function expressReqToWebRequest(req: import("express").Request): Request {
  const host = req.headers.host ?? "localhost";
  const protocol = req.protocol;
  const url = new URL(req.originalUrl || req.url, `${protocol}://${host}`);
  let bodyInit: BodyInit | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    bodyInit = req.body !== undefined ? JSON.stringify(req.body) : undefined;
  }
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  return new Request(url, { method: req.method, headers, body: bodyInit });
}

async function webResponseToExpress(res: import("express").Response, response: Response): Promise<void> {
  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  const body = await response.text();
  res.send(body);
}

function wrapHandler(fn: RemixModule["loader"]): import("express").RequestHandler {
  if (!fn) return (_req, res) => { res.status(405).json({ error: "Method not allowed" }); };
  return (req, res, next) => {
    const request = expressReqToWebRequest(req);
    const result = fn({ request, params: req.params as Record<string, string> });
    Promise.resolve(result)
      .then((r) => webResponseToExpress(res, r))
      .catch((err: unknown) => {
        if (err instanceof Response) {
          webResponseToExpress(res, err);
        } else {
          next(err);
        }
      });
  };
}

export async function mountApiRoutes(router: Router): Promise<void> {
  const files = fs.readdirSync(ROUTES_DIR).filter((f) => f.startsWith("api.") && f.endsWith(".tsx"));
  console.log(`Found ${files.length} API route files`);

  for (const file of files) {
    const expressPath = remixFileToExpressPath(file);

    try {
      const filePath = path.resolve(ROUTES_DIR, file);
      const fileUrl = pathToFileURL(filePath);
      const mod: RemixModule = await import(fileUrl.href);
      const loader = mod.loader;
      const action = mod.action;

      if (loader) {
        console.log(`  [OK] ${file.padEnd(50)} ${expressPath} (loader)`);
        router.get(expressPath, wrapHandler(loader));
        router.options(expressPath, (_req, res) => res.json({}));
      }
      if (action) {
        console.log(`  [OK] ${file.padEnd(50)} ${expressPath} (action)`);
        router.post(expressPath, wrapHandler(action));
      }
    } catch (err) {
      console.error(`  [FAIL] ${file}:`, err instanceof Error ? err.message : String(err));
    }
  }
}