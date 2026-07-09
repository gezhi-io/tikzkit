import { createReadStream } from "node:fs";
import { access, readFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadMilestoneCatalog } from "./fixtureCatalog.js";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function createWorkbenchServer(options = {}) {
  const fixtureRoot = path.resolve(options.fixtureRoot || path.join(PROJECT_ROOT, "test/fixtures/examples"));
  const outputRoot = path.resolve(options.outputRoot || path.join(fixtureRoot, "output"));
  const catalog = await loadMilestoneCatalog({ fixtureRoot, outputRoot });
  const byId = new Map(catalog.map((entry) => [entry.id, entry]));

  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      if (url.pathname === "/api/fixtures") return sendJson(response, catalog.map(publicFixture));

      const sourceMatch = url.pathname.match(/^\/api\/fixtures\/([^/]+)\/source$/);
      if (sourceMatch) {
        const fixture = byId.get(decodeURIComponent(sourceMatch[1]));
        if (!fixture) return sendStatus(response, 404);
        return sendText(response, await readFile(fixture.sourcePath, "utf8"), "text/plain; charset=utf-8");
      }

      const route = staticRoute(url.pathname, { outputRoot });
      if (!route) return sendStatus(response, 404);
      return sendFile(response, route);
    } catch (error) {
      return sendJson(response, { error: error.message }, 500);
    }
  });
}

function publicFixture(entry) {
  const { sourcePath, outputRoot, ...publicEntry } = entry;
  return publicEntry;
}

function staticRoute(pathname, { outputRoot }) {
  const routes = [
    ["/src/", path.join(PROJECT_ROOT, "src")],
    ["/vendor/chevrotain/", path.join(PROJECT_ROOT, "node_modules/chevrotain/lib")],
    ["/vendor/katex/", path.join(PROJECT_ROOT, "node_modules/katex/dist")],
    ["/node_modules/katex/dist/fonts/", path.join(PROJECT_ROOT, "node_modules/katex/dist/fonts")],
    ["/artifacts/", outputRoot],
    ["/", path.join(PROJECT_ROOT, "web")]
  ];

  for (const [prefix, root] of routes) {
    if (!pathname.startsWith(prefix)) continue;
    const requestPath = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(prefix.length));
    const candidate = path.resolve(root, requestPath);
    const relative = path.relative(root, candidate);
    if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) return candidate;
    return null;
  }

  return null;
}

async function sendFile(response, filePath) {
  try {
    await access(filePath);
  } catch {
    return sendStatus(response, 404);
  }

  const extension = path.extname(filePath).toLowerCase();
  const types = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml; charset=utf-8",
    ".tex": "text/plain; charset=utf-8"
  };
  response.writeHead(200, { "content-type": types[extension] || "application/octet-stream" });
  createReadStream(filePath).pipe(response);
}

function sendJson(response, value, status = 200) {
  return sendText(response, `${JSON.stringify(value)}\n`, "application/json; charset=utf-8", status);
}

function sendText(response, value, type = "text/plain; charset=utf-8", status = 200) {
  response.writeHead(status, { "content-type": type });
  response.end(value);
}

function sendStatus(response, status) {
  response.writeHead(status);
  response.end();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const host = process.env.HOST || "127.0.0.1";
  const port = Number(process.env.PORT) || 5173;
  const server = await createWorkbenchServer();
  server.listen(port, host, () => process.stdout.write(`TikZKit workbench: http://${host}:${port}/\n`));
}
