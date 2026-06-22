import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listWebCorpora, loadWebCorpus } from "./corpus-gallery-server.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 5173);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const pathname = url.pathname === "/" ? "/web/index.html" : decodeURIComponent(url.pathname);

  if (pathname === "/api/corpora") {
    writeJson(response, { corpora: listWebCorpora() });
    return;
  }

  const corpusMatch = pathname.match(/^\/api\/corpora\/([A-Za-z0-9_-]+)$/);
  if (corpusMatch) {
    const corpus = await loadWebCorpus(corpusMatch[1]);
    if (!corpus) {
      writeJson(response, { error: "Unknown corpus" }, 404);
      return;
    }
    writeJson(response, corpus);
    return;
  }

  const filePath = path.resolve(root, `.${pathname}`);

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error("Not a file");
    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

function writeJson(response, value, status = 200) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(`${JSON.stringify(value)}\n`);
}

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`TikZ renderer available at http://127.0.0.1:${port}\n`);
});
