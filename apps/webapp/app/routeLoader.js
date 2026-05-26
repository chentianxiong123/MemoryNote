import fs from "node:fs";
import path from "node:path";
const ROUTES_DIR = path.resolve(import.meta.dirname, "app/routes");
function remixFileToExpressPath(filename) {
    const withoutExt = filename.replace(/\.tsx$/, "");
    const segments = withoutExt.split(".");
    const expressSegments = [];
    for (const seg of segments) {
        if (seg === "_index")
            continue;
        if (seg.startsWith("$")) {
            expressSegments.push(`:${seg.slice(1)}`);
        }
        else {
            expressSegments.push(seg);
        }
    }
    return "/" + expressSegments.join("/");
}
function expressReqToWebRequest(req) {
    const host = req.headers.host ?? "localhost";
    const protocol = req.protocol;
    const url = new URL(req.originalUrl || req.url, `${protocol}://${host}`);
    let bodyInit;
    if (req.method !== "GET" && req.method !== "HEAD") {
        bodyInit = req.body !== undefined ? JSON.stringify(req.body) : undefined;
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
        if (value)
            headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }
    return new Request(url, { method: req.method, headers, body: bodyInit });
}
async function webResponseToExpress(res, response) {
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    const body = await response.text();
    res.send(body);
}
function wrapHandler(fn) {
    if (!fn)
        return (_req, res) => { res.status(405).json({ error: "Method not allowed" }); };
    return (req, res, next) => {
        const request = expressReqToWebRequest(req);
        const result = fn({ request, params: req.params });
        Promise.resolve(result)
            .then((r) => webResponseToExpress(res, r))
            .catch((err) => {
            if (err instanceof Response) {
                webResponseToExpress(res, err);
            }
            else {
                next(err);
            }
        });
    };
}
export async function mountApiRoutes(router) {
    const files = fs.readdirSync(ROUTES_DIR).filter((f) => f.startsWith("api.") && f.endsWith(".tsx"));
    console.log(`Found ${files.length} API route files`);
    for (const file of files) {
        const modulePath = path.resolve(ROUTES_DIR, file);
        const expressPath = remixFileToExpressPath(file);
        try {
            const mod = await import(modulePath);
            const loader = mod.loader;
            const action = mod.action;
            if (loader) {
                router.get(expressPath, wrapHandler(loader));
                router.options(expressPath, (_req, res) => res.json({}));
            }
            if (action) {
                router.post(expressPath, wrapHandler(action));
            }
            if (loader || action) {
                console.log(`  [OK] ${file.padEnd(50)} ${expressPath}`);
            }
        }
        catch (err) {
            console.error(`  [FAIL] ${file}:`, err instanceof Error ? err.message : err);
        }
    }
}
