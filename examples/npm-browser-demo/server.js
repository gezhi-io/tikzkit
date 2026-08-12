import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 5175;

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const filePath = resolveFile(url.pathname);
    if (!filePath || !(await stat(filePath)).isFile()) return sendStatus(response, 404);
    sendFile(response, filePath);
  } catch {
    sendStatus(response, 404);
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`TikZKit npm browser demo: http://127.0.0.1:${port}/`);
});

function resolveFile(pathname) {
  const decoded = decodeURIComponent(pathname === "/" ? "/index.html" : pathname);
  const candidate = path.resolve(root, `.${decoded}`);
  const relative = path.relative(root, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return candidate;
}

function sendFile(response, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml; charset=utf-8",
    ".ttf": "font/ttf",
    ".woff": "font/woff",
    ".woff2": "font/woff2"
  };
  response.writeHead(200, { "content-type": contentTypes[extension] || "application/octet-stream" });
  createReadStream(filePath).pipe(response);
}

function sendStatus(response, status) {
  response.writeHead(status);
  response.end();
}
