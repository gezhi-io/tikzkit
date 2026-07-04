import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tikzToSvg } from "../src/index.js";
import { addTikzSourceUnitGrid } from "./tikz-source-grid.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 5173);
const webRenderOptions = { strict: false, margin: 0 };

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (request.method === "POST" && url.pathname === "/api/render") {
    try {
      const body = await readRequestBody(request);
      const payload = JSON.parse(body || "{}");
      const source = String(payload.source || "");
      const result = tikzToSvg(source, webRenderOptions);
      const gridResult = tikzToSvg(addTikzSourceUnitGrid(source), webRenderOptions);
      writeJson(response, {
        svg: result.svg,
        gridSvg: gridResult.svg,
        diagnostics: result.diagnostics
      });
    } catch (error) {
      writeJson(response, { error: error instanceof Error ? error.message : String(error) }, 500);
    }
    return;
  }

  const pathname = url.pathname === "/" ? "/web/index.html" : decodeURIComponent(url.pathname);
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

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        request.destroy();
        reject(new Error("Request body too large"));
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function writeJson(response, value, status = 200) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(`${JSON.stringify(value)}\n`);
}

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`TikZ web test available at http://127.0.0.1:${port}\n`);
});
