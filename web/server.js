import { createReadStream } from "node:fs";
import { readFile, realpath, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditTikzSource } from "../scripts/case-semantic-audit.js";
import { loadMilestoneCatalog } from "./fixtureCatalog.js";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function createWorkbenchServer(options = {}) {
  const fixtureRoot = path.resolve(options.fixtureRoot || path.join(PROJECT_ROOT, "test/fixtures/examples"));
  const outputRoot = path.resolve(options.outputRoot || path.join(fixtureRoot, "output"));
  const auditCache = new Map();
  const localSourceCache = new Map();
  await loadMilestoneCatalog({ fixtureRoot, outputRoot });

  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      if (url.pathname === "/api/fixtures") {
        // Reference artifacts are commonly generated while the workbench is
        // already running. Re-read the catalog so a browser refresh sees them
        // without requiring a server restart.
        const currentCatalog = await loadMilestoneCatalog({ fixtureRoot, outputRoot });
        return sendJson(response, currentCatalog.map(publicFixture));
      }

      const sourceMatch = url.pathname.match(/^\/api\/fixtures\/([^/]+)\/source$/);
      if (sourceMatch) {
        const currentCatalog = await loadMilestoneCatalog({ fixtureRoot, outputRoot });
        const fixture = currentCatalog.find((entry) => entry.id === decodeURIComponent(sourceMatch[1]));
        if (!fixture) return sendStatus(response, 404);
        return sendText(response, await readFile(fixture.sourcePath, "utf8"), "text/plain; charset=utf-8");
      }

      const auditMatch = url.pathname.match(/^\/api\/fixtures\/([^/]+)\/audit$/);
      if (auditMatch) {
        const currentCatalog = await loadMilestoneCatalog({ fixtureRoot, outputRoot });
        const fixture = currentCatalog.find((entry) => entry.id === decodeURIComponent(auditMatch[1]));
        if (!fixture) return sendStatus(response, 404);
        const source = await readFile(fixture.sourcePath, "utf8");
        const audit = await fixtureAudit(fixture, source, auditCache, localSourceCache);
        return sendJson(response, audit);
      }

      if (url.pathname === "/api/audit" && request.method === "POST") {
        const payload = await readJsonBody(request);
        if (!payload || typeof payload !== "object" || Array.isArray(payload) || typeof payload.source !== "string") {
          return sendJson(response, { error: "Expected a string field named source." }, 400);
        }
        const report = auditTikzSource(payload.source, {
          sourcePath: "workbench-draft.tex",
          localSourceResolver: (lookup) => resolveLocalSource(lookup, localSourceCache)
        });
        return sendJson(response, publicAudit(report));
      }

      const resourceMatch = url.pathname.match(/^\/api\/fixtures\/([^/]+)\/resources\/(\d+)$/);
      if (resourceMatch) {
        const currentCatalog = await loadMilestoneCatalog({ fixtureRoot, outputRoot });
        const fixture = currentCatalog.find((entry) => entry.id === decodeURIComponent(resourceMatch[1]));
        const resource = fixture?.resources?.[Number(resourceMatch[2])];
        if (!resource) return sendStatus(response, 404);
        return sendFile(response, resource.sourcePath);
      }

      const route = await staticRoute(url.pathname, { outputRoot });
      if (!route) return sendStatus(response, 404);
      return sendFile(response, route);
    } catch (error) {
      const status = error instanceof RequestBodyError ? error.status : 500;
      return sendJson(response, { error: error.message }, status);
    }
  });
}

class RequestBodyError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function readJsonBody(request, maxBytes = 1_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new RequestBodyError(413, "Source is limited to 1 MB.");
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new RequestBodyError(400, "Request body must be valid JSON.");
  }
}

async function fixtureAudit(fixture, source, auditCache, localSourceCache) {
  const reviewPath = fixture.sourcePath.replace(/\.[^.]+$/, ".review.json");
  let reviewSource = "";
  try {
    reviewSource = await readFile(reviewPath, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const cached = auditCache.get(fixture.id);
  if (cached?.source === source && cached.reviewSource === reviewSource) return cached.value;

  const report = auditTikzSource(source, {
    sourcePath: fixture.sourcePath,
    review: reviewSource ? JSON.parse(reviewSource) : {},
    localSourceResolver: (lookup) => resolveLocalSource(lookup, localSourceCache)
  });
  const value = publicAudit(report);
  auditCache.set(fixture.id, { source, reviewSource, value });
  return value;
}

function resolveLocalSource(lookup, cache) {
  if (cache.has(lookup)) return cache.get(lookup);
  let resolved = null;
  for (const executable of ["/Library/TeX/texbin/kpsewhich", "kpsewhich"]) {
    const result = spawnSync(executable, [lookup], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) {
      resolved = result.stdout.trim();
      break;
    }
  }
  cache.set(lookup, resolved);
  return resolved;
}

function publicAudit(report) {
  return {
    schemaVersion: report.schemaVersion,
    summary: report.summary,
    gate: report.gate,
    dependencies: report.dependencies.map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      name: entry.name,
      implementationStatus: entry.implementationStatus,
      implementedBy: entry.implementedBy,
      localSourceFound: entry.localSourceFound,
      localSourceReviewed: entry.localSourceReviewed,
      localSourceName: entry.localSource ? path.basename(entry.localSource) : null,
      lookup: entry.lookup,
      features: entry.features,
      notes: entry.notes,
      reviewStatus: entry.reviewStatus
    })),
    commands: report.commands.map(publicFeature),
    environments: report.environments.map(publicFeature),
    options: report.options.map(publicFeature),
    declarations: report.declarations.map(publicFeature),
    numbers: report.numbers.map(publicFeature),
    expressions: report.expressions.map(publicFeature)
  };
}

function publicFeature(entry) {
  const { localSource, sourceRange, ...feature } = entry;
  return {
    ...feature,
    localSourceName: localSource ? path.basename(localSource) : null
  };
}

function publicFixture(entry) {
  const { sourcePath, outputRoot, ...publicEntry } = entry;
  publicEntry.resources = (publicEntry.resources || []).map(({ sourcePath: _sourcePath, ...resource }) => resource);
  return publicEntry;
}

async function staticRoute(pathname, { outputRoot }) {
  const routes = [
    ["/fonts/", path.join(PROJECT_ROOT, "web", "fonts")],
    ["/src/", path.join(PROJECT_ROOT, "src")],
    ["/vendor/codemirror/", path.join(PROJECT_ROOT, "web", "vendor", "codemirror")],
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
    if (relative !== "" && (relative.startsWith("..") || path.isAbsolute(relative))) return null;

    try {
      const [resolvedRoot, resolvedCandidate] = await Promise.all([realpath(root), realpath(candidate)]);
      const resolvedRelative = path.relative(resolvedRoot, resolvedCandidate);
      if (resolvedRelative === "" || (!resolvedRelative.startsWith("..") && !path.isAbsolute(resolvedRelative))) {
        return resolvedCandidate;
      }
    } catch {
      return null;
    }

    return null;
  }

  return null;
}

async function sendFile(response, filePath) {
  try {
    const file = await stat(filePath);
    if (!file.isFile()) return sendStatus(response, 404);
  } catch {
    return sendStatus(response, 404);
  }

  const extension = path.extname(filePath).toLowerCase();
  const types = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".otf": "font/otf",
    ".png": "image/png",
    ".svg": "image/svg+xml; charset=utf-8",
    ".csv": "text/csv; charset=utf-8",
    ".tex": "text/plain; charset=utf-8",
    ".ttf": "font/ttf",
    ".woff": "font/woff",
    ".woff2": "font/woff2"
  };
  const stream = createReadStream(filePath);
  stream.on("error", (error) => {
    if (response.headersSent) {
      response.destroy(error);
      return;
    }
    sendJson(response, { error: error.message }, 500);
  });
  response.writeHead(200, {
    "cache-control": "no-store",
    "content-type": types[extension] || "application/octet-stream"
  });
  stream.pipe(response);
}

function sendJson(response, value, status = 200) {
  return sendText(response, `${JSON.stringify(value)}\n`, "application/json; charset=utf-8", status);
}

function sendText(response, value, type = "text/plain; charset=utf-8", status = 200) {
  response.writeHead(status, { "cache-control": "no-store", "content-type": type });
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
