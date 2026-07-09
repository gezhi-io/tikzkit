# TikZKit M0 Online Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore a real browser workbench that loads the frozen 30-case milestone, edits TikZ source, renders SVG entirely in browser JavaScript through TikZKit's public API, displays diagnostics, and compares against pre-generated `tikztosvg` artifacts with an optional common-origin 1cm grid.

**Architecture:** A small Node HTTP server serves static workbench assets, fixture source, generated references, TikZKit ESM source, and two browser-ready dependency bundles. Rendering happens only in `web/workbench.js` by calling `tikzToSvgAsync`; the server never renders TikZ. The workbench owns the QA grid overlay and fixture navigation, while compiler semantics remain in `src/`.

**Tech Stack:** Node.js ESM and `node:http`, browser ESM/import maps, existing Chevrotain browser bundle, existing KaTeX ESM bundle, vanilla HTML/CSS/JavaScript, Node test runner.

## Global Constraints

- Browser rendering must not invoke MacTeX, `tikztosvg`, `dvisvgm`, or a server-side render endpoint.
- MacTeX is the semantic and visual source of truth; local `tikztosvg` output is a secondary SVG reference.
- The workbench must consume `src/index.js` public exports and must not import parser, engine, PGFPlots, or SVG renderer internals.
- The QA grid is an optional comparison overlay and must not affect the TikZKit SceneGraph, SVG bounds, or exported SVG.
- The frozen Milestone 1 set is exactly the 30 IDs listed in `docs/superpowers/specs/2026-07-10-tikzkit-online-renderer-goal-design.md`.
- Existing dirty worktree changes are preserved; each commit stages only files named by its task.
- No new runtime dependency is added for M0.

---

## File Structure

```text
web/
  server.js              HTTP server and safe static-route mapping only
  fixtureCatalog.js      frozen manifest loading and reference URL projection
  index.html             workbench document and browser import map
  app.js                 DOM wiring, fixture navigation, render interactions
  workbench.js           browser-safe render/diagnostic controller
  qaGrid.js              non-destructive 1cm SVG comparison overlay
  styles.css             contained editor/result/reference layout

test/fixtures/examples/
  milestone-1.json       exact 30-case acceptance manifest

test/
  web-fixture-catalog.test.js
  web-server.test.js
  web-workbench.test.js
  web-qa-grid.test.js
```

Existing files modified:

```text
package.json              make `npm run web` start the restored server
README.md                 document workbench and browser-only render boundary
```

## Task 1: Freeze the 30-case catalog

**Files:**
- Create: `test/fixtures/examples/milestone-1.json`
- Create: `web/fixtureCatalog.js`
- Test: `test/web-fixture-catalog.test.js`

**Interfaces:**
- Consumes: `test/fixtures/examples/manifest.json` entries with `id`, `title`, `source`, `activeFigureId`, and `features`.
- Produces: `loadMilestoneCatalog({ fixtureRoot, outputRoot }) -> Promise<Array<WorkbenchFixture>>` where each fixture contains `id`, `title`, `sourcePath`, `sourceUrl`, `activeFigureId`, `features`, `tikztosvgSvgUrl`, and `tikztosvgGridSvgUrl`.

- [ ] **Step 1: Write the failing catalog test**

```js
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { loadMilestoneCatalog } from "../web/fixtureCatalog.js";

test("workbench catalog freezes the accepted 30 real cases in order", async () => {
  const catalog = await loadMilestoneCatalog({
    fixtureRoot: path.resolve("test/fixtures/examples"),
    outputRoot: path.resolve("test/fixtures/examples/output")
  });

  assert.equal(catalog.length, 30);
  assert.equal(catalog[0].id, "latex-examples-2048");
  assert.equal(catalog.at(-1).id, "latex-examples-arbelos");
  assert.equal(new Set(catalog.map((entry) => entry.id)).size, 30);
  assert.match(catalog[0].sourceUrl, /^\/api\/fixtures\//);
  assert.ok(catalog[0].tikztosvgSvgUrl === null || /^\/artifacts\/tikztosvg-svg\//.test(catalog[0].tikztosvgSvgUrl));
});
```

- [ ] **Step 2: Run the catalog test and verify failure**

Run: `node --test test/web-fixture-catalog.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `web/fixtureCatalog.js`.

- [ ] **Step 3: Add the exact milestone manifest**

Create `test/fixtures/examples/milestone-1.json` with this structure and the 30 IDs from the approved spec in the same order:

```json
{
  "version": 1,
  "sourceManifest": "manifest.json",
  "caseIds": [
    "latex-examples-2048",
    "latex-examples-2d-chi-squared-cdf",
    "latex-examples-2d-chi-squared-pdf",
    "latex-examples-2d-epochs-overfitting",
    "latex-examples-2d-light-bulb",
    "latex-examples-2d-parted-function",
    "latex-examples-2d-x-square-with-circle",
    "latex-examples-3d-cmos-loss-diagram",
    "latex-examples-3d-function-2",
    "latex-examples-3d-function-3",
    "latex-examples-3d-function-4",
    "latex-examples-3d-function-5",
    "latex-examples-3d-function-6",
    "latex-examples-3d-function-7",
    "latex-examples-3d-function-8",
    "latex-examples-3d-function-9",
    "latex-examples-3d-function-continuous",
    "latex-examples-3d-function-semicubical-parabola",
    "latex-examples-3d-gaussian-distribution",
    "latex-examples-3d-gradient-colored",
    "latex-examples-3d-gradient-cos",
    "latex-examples-3d-helix",
    "latex-examples-3d-manhattan-bar-plot",
    "latex-examples-3d-vector",
    "latex-examples-activation-functions",
    "latex-examples-agent-environment-diagram-mdp",
    "latex-examples-agent-environment-diagram-pomdp",
    "latex-examples-agent-environment-diagram-rl",
    "latex-examples-aggregation-blocks",
    "latex-examples-arbelos"
  ]
}
```

- [ ] **Step 4: Implement catalog projection and validation**

```js
import { access, readFile } from "node:fs/promises";
import path from "node:path";

export async function loadMilestoneCatalog(options = {}) {
  const fixtureRoot = path.resolve(options.fixtureRoot || "test/fixtures/examples");
  const outputRoot = path.resolve(options.outputRoot || path.join(fixtureRoot, "output"));
  const milestone = JSON.parse(await readFile(path.join(fixtureRoot, "milestone-1.json"), "utf8"));
  const manifest = JSON.parse(await readFile(path.join(fixtureRoot, milestone.sourceManifest), "utf8"));
  const byId = new Map(manifest.cases.map((entry) => [entry.id, entry]));
  const missing = milestone.caseIds.filter((id) => !byId.has(id));
  if (missing.length) throw new Error(`Milestone fixture IDs missing from manifest: ${missing.join(", ")}`);
  if (new Set(milestone.caseIds).size !== milestone.caseIds.length) {
    throw new Error("Milestone fixture IDs must be unique");
  }

  return Promise.all(milestone.caseIds.map(async (id) => {
    const entry = byId.get(id);
    const tikztosvgSvgUrl = await artifactUrlIfPresent(outputRoot, "tikztosvg-svg", id, "svg");
    const tikztosvgGridSvgUrl = await artifactUrlIfPresent(outputRoot, "tikztosvg-grid-svg", id, "svg");
    return {
      id,
      title: entry.title,
      sourcePath: path.join(fixtureRoot, entry.source),
      sourceUrl: `/api/fixtures/${encodeURIComponent(id)}/source`,
      activeFigureId: entry.activeFigureId || null,
      features: entry.features || [],
      tikztosvgSvgUrl,
      tikztosvgGridSvgUrl,
      outputRoot
    };
  }));
}

async function artifactUrlIfPresent(outputRoot, directory, id, extension) {
  try {
    await access(path.join(outputRoot, directory, `${id}.${extension}`));
    return `/artifacts/${directory}/${encodeURIComponent(id)}.${extension}`;
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Run the catalog test**

Run: `node --test test/web-fixture-catalog.test.js`

Expected: PASS, reporting one passing test.

- [ ] **Step 6: Commit the frozen catalog**

```bash
git add test/fixtures/examples/milestone-1.json web/fixtureCatalog.js test/web-fixture-catalog.test.js
git commit -m "Add frozen 30-case workbench catalog"
```

## Task 2: Restore a safe static workbench server

**Files:**
- Create: `web/server.js`
- Create: `web/index.html`
- Modify: `package.json`
- Test: `test/web-server.test.js`

**Interfaces:**
- Consumes: `loadMilestoneCatalog()` from Task 1 and files under `web/`, `src/`, `node_modules/chevrotain/lib/`, `node_modules/katex/dist/`, and `test/fixtures/examples/output/`.
- Produces: `createWorkbenchServer(options) -> Promise<http.Server>` and routes `/api/fixtures`, `/api/fixtures/:id/source`, `/src/*`, `/vendor/*`, and `/artifacts/*`.

- [ ] **Step 1: Write failing route tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { createWorkbenchServer } from "../web/server.js";

test("workbench server exposes browser assets and fixture source without rendering", async (t) => {
  const server = await createWorkbenchServer({ host: "127.0.0.1", port: 0 });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const port = server.address().port;

  const index = await fetch(`http://127.0.0.1:${port}/`);
  const catalog = await fetch(`http://127.0.0.1:${port}/api/fixtures`).then((response) => response.json());
  const source = await fetch(`http://127.0.0.1:${port}${catalog[0].sourceUrl}`).then((response) => response.text());
  const compiler = await fetch(`http://127.0.0.1:${port}/src/index.js`);
  const chevrotain = await fetch(`http://127.0.0.1:${port}/vendor/chevrotain/chevrotain.mjs`);
  const katex = await fetch(`http://127.0.0.1:${port}/vendor/katex/katex.mjs`);
  const katexFont = await fetch(`http://127.0.0.1:${port}/node_modules/katex/dist/fonts/KaTeX_Main-Regular.woff2`);

  assert.equal(index.status, 200);
  assert.equal(catalog.length, 30);
  assert.match(source, /\\begin\{(?:tikzpicture|axis)\}/);
  assert.equal(compiler.status, 200);
  assert.equal(chevrotain.status, 200);
  assert.equal(katex.status, 200);
  assert.equal(katexFont.status, 200);
});

test("workbench server rejects path traversal", async (t) => {
  const server = await createWorkbenchServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const port = server.address().port;
  const response = await fetch(`http://127.0.0.1:${port}/src/%2e%2e/package.json`);
  assert.equal(response.status, 404);
});
```

- [ ] **Step 2: Run the server tests and verify failure**

Run: `node --test test/web-server.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `web/server.js`.

- [ ] **Step 3: Implement the HTTP server with explicit route roots**

The implementation must use an allowlist rather than expose the repository root:

```js
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
```

Add the concrete route and response helpers in the same file:

```js
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
```

`staticRoute()` must map only these prefixes and verify `path.relative(root, candidate)` does not start with `..`:

```js
const roots = [
  ["/src/", path.join(PROJECT_ROOT, "src")],
  ["/vendor/chevrotain/", path.join(PROJECT_ROOT, "node_modules/chevrotain/lib")],
  ["/vendor/katex/", path.join(PROJECT_ROOT, "node_modules/katex/dist")],
  ["/node_modules/katex/dist/fonts/", path.join(PROJECT_ROOT, "node_modules/katex/dist/fonts")],
  ["/artifacts/", outputRoot],
  ["/", path.join(PROJECT_ROOT, "web")]
];
```

When `web/server.js` is executed directly, listen on `process.env.HOST || "127.0.0.1"` and `Number(process.env.PORT) || 5173`, then print exactly one URL line.

- [ ] **Step 4: Add the browser import map and module entry**

Create `web/index.html` with no inline rendering logic:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TikZKit Workbench</title>
<link rel="stylesheet" href="/styles.css">
<script type="importmap">
{
  "imports": {
    "chevrotain": "/vendor/chevrotain/chevrotain.mjs",
    "katex": "/vendor/katex/katex.mjs"
  }
}
</script>
<script type="module" src="/app.js"></script>
</head>
<body>
  <header class="toolbar">
    <label for="fixture-select">Fixture</label>
    <select id="fixture-select"></select>
    <button id="render-button" type="button">Render</button>
    <label class="toggle"><input id="grid-toggle" type="checkbox" checked> 1cm grid</label>
    <output id="render-status" aria-live="polite">Ready</output>
  </header>
  <main class="workbench">
    <section class="editor-pane" aria-label="TikZ source">
      <textarea id="source-editor" spellcheck="false" aria-label="TikZ source editor"></textarea>
      <section id="diagnostics" class="diagnostics" aria-label="Diagnostics"></section>
    </section>
    <section class="preview-pane" aria-label="Render comparison">
      <article class="preview-column">
        <h2>TikZKit browser SVG</h2>
        <div id="tikzkit-result" class="render-surface"></div>
      </article>
      <article class="preview-column">
        <h2>tikztosvg reference</h2>
        <object id="reference-result" class="render-surface" type="image/svg+xml"></object>
      </article>
    </section>
  </main>
</body>
</html>
```

The document must include unique elements with IDs `fixture-select`, `source-editor`, `render-button`, `grid-toggle`, `tikzkit-result`, `reference-result`, `diagnostics`, and `render-status`.

- [ ] **Step 5: Point the package script at the restored server**

```json
"web": "node web/server.js"
```

- [ ] **Step 6: Run server tests**

Run: `node --test test/web-server.test.js test/web-fixture-catalog.test.js`

Expected: PASS with three passing tests and no open server handles.

- [ ] **Step 7: Commit the server**

```bash
git add web/server.js web/index.html package.json test/web-server.test.js
git commit -m "Restore browser workbench server"
```

## Task 3: Render through the public API and show diagnostics

**Files:**
- Create: `web/workbench.js`
- Create: `web/app.js`
- Create: `web/styles.css`
- Test: `test/web-workbench.test.js`

**Interfaces:**
- Consumes: `tikzToSvgAsync(source, options)` from `src/index.js` and fixture objects from `/api/fixtures`.
- Produces: `renderWorkbenchSource(source, options) -> Promise<{ svg, diagnostics, elapsedMs }>` and `diagnosticRows(diagnostics) -> Array<{ severity, code, message, location }>`.

- [ ] **Step 1: Write failing controller tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { diagnosticRows, renderWorkbenchSource } from "../web/workbench.js";

test("workbench renders through TikZKit public async API", async () => {
  const result = await renderWorkbenchSource(String.raw`\begin{tikzpicture}\draw (0,0)--(1,0);\end{tikzpicture}`);
  assert.match(result.svg, /^<svg class="tikz-render-svg"/);
  assert.equal(Array.isArray(result.diagnostics), true);
  assert.equal(Number.isFinite(result.elapsedMs), true);
});

test("workbench diagnostic rows preserve severity, code, message, and source location", () => {
  assert.deepEqual(
    diagnosticRows([{ severity: "warning", code: "x", message: "Unsupported x", line: 3, column: 7 }]),
    [{ severity: "warning", code: "x", message: "Unsupported x", location: "3:7" }]
  );
});
```

- [ ] **Step 2: Run controller tests and verify failure**

Run: `node --test test/web-workbench.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `web/workbench.js`.

- [ ] **Step 3: Implement the browser-safe controller**

```js
import { tikzToSvgAsync } from "../src/index.js";

export async function renderWorkbenchSource(source, options = {}) {
  const started = Date.now();
  const result = await tikzToSvgAsync(String(source || ""), options);
  return {
    svg: result.svg,
    diagnostics: diagnosticRows(result.diagnostics),
    elapsedMs: Date.now() - started
  };
}

export function diagnosticRows(diagnostics = []) {
  return diagnostics.map((entry) => ({
    severity: entry.severity || "warning",
    code: entry.code || "tikz-diagnostic",
    message: entry.message || String(entry),
    location: Number.isFinite(entry.line)
      ? `${entry.line}:${Number.isFinite(entry.column) ? entry.column : 1}`
      : ""
  }));
}
```

- [ ] **Step 4: Wire fixture selection, editing, explicit rendering, and stable hashes**

`web/app.js` must:

```js
import { renderWorkbenchSource } from "./workbench.js";

const state = { fixtures: [], active: null, lastSvg: "" };

async function loadFixture(id) {
  const fixture = state.fixtures.find((entry) => entry.id === id) || state.fixtures[0];
  if (!fixture) return;
  state.active = fixture;
  document.querySelector("#fixture-select").value = fixture.id;
  document.querySelector("#source-editor").value = await fetch(fixture.sourceUrl).then((response) => response.text());
  history.replaceState(null, "", `#${encodeURIComponent(fixture.id)}`);
  const reference = document.querySelector("#reference-result");
  const referenceUrl = fixture.tikztosvgGridSvgUrl || fixture.tikztosvgSvgUrl;
  if (referenceUrl) {
    reference.data = referenceUrl;
    reference.textContent = "";
  } else {
    reference.removeAttribute("data");
    reference.textContent = "Reference artifact has not been generated yet.";
  }
  await renderCurrentSource();
}

async function renderCurrentSource() {
  const button = document.querySelector("#render-button");
  button.disabled = true;
  try {
    const result = await renderWorkbenchSource(document.querySelector("#source-editor").value, {
      activeFigureId: state.active?.activeFigureId || undefined
    });
    state.lastSvg = result.svg;
    showTikzkitSvg(result.svg);
    showDiagnostics(result.diagnostics);
    document.querySelector("#render-status").textContent = `${result.elapsedMs}ms · ${result.diagnostics.length} diagnostics`;
  } finally {
    button.disabled = false;
  }
}
```

Complete the module with DOM-safe diagnostic output and startup wiring:

```js
function showTikzkitSvg(svg) {
  document.querySelector("#tikzkit-result").innerHTML = svg;
}

function showDiagnostics(rows) {
  const container = document.querySelector("#diagnostics");
  container.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "diagnostic-empty";
    empty.textContent = "No diagnostics";
    container.append(empty);
    return;
  }
  for (const row of rows) {
    const item = document.createElement("div");
    item.className = `diagnostic diagnostic-${row.severity}`;
    const heading = document.createElement("strong");
    heading.textContent = `${row.severity} · ${row.code}${row.location ? ` · ${row.location}` : ""}`;
    const message = document.createElement("span");
    message.textContent = row.message;
    item.append(heading, message);
    container.append(item);
  }
}

async function boot() {
  state.fixtures = await fetch("/api/fixtures").then((response) => response.json());
  const select = document.querySelector("#fixture-select");
  for (const fixture of state.fixtures) {
    const option = document.createElement("option");
    option.value = fixture.id;
    option.textContent = `${fixture.id} · ${fixture.title}`;
    select.append(option);
  }
  select.addEventListener("change", () => loadFixture(select.value));
  document.querySelector("#render-button").addEventListener("click", renderCurrentSource);
  document.querySelector("#source-editor").addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      renderCurrentSource();
    }
  });
  const requested = decodeURIComponent(location.hash.replace(/^#/, ""));
  await loadFixture(requested);
}

boot().catch((error) => {
  document.querySelector("#render-status").textContent = error.message;
});
```

Bind the grid checkbox in Task 4. Resolve the initial fixture from `location.hash`; never render on every keystroke.

- [ ] **Step 5: Add contained workbench styling**

`web/styles.css` must use a two-column editor/result layout above 960px and one column below it. The result and reference surfaces must use:

```css
.render-surface,
object.render-surface {
  position: relative;
  min-height: 360px;
  overflow: auto;
  background: #fff;
}

#tikzkit-result > svg,
object.render-surface {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
  min-height: 360px;
  object-fit: contain;
}
```

Use compact 32-36px controls, a monospace editor, no nested decorative cards, and visible error/warning/info diagnostic states.

- [ ] **Step 6: Run controller and server tests**

Run: `node --test test/web-workbench.test.js test/web-server.test.js`

Expected: PASS with all tests green.

- [ ] **Step 7: Commit browser rendering**

```bash
git add web/workbench.js web/app.js web/styles.css test/web-workbench.test.js
git commit -m "Render TikZ in browser workbench"
```

## Task 4: Add a non-destructive common-origin 1cm QA grid

**Files:**
- Create: `web/qaGrid.js`
- Modify: `web/app.js`
- Test: `test/web-qa-grid.test.js`

**Interfaces:**
- Consumes: an SVG string emitted by TikZKit and its `viewBox`.
- Produces: `withQaGrid(svg, { unitPerCm, originX, originY }) -> string`; the default TikZKit unit is `100` SceneGraph/SVG units per centimeter.

- [ ] **Step 1: Write failing grid tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { withQaGrid } from "../web/qaGrid.js";

test("QA grid inserts a background pattern at the TikZ origin without changing viewBox", () => {
  const source = '<svg class="tikz-render-svg" viewBox="-10 -20 320 240"><path d="M0 0L100 0"/></svg>';
  const output = withQaGrid(source);
  assert.match(output, /id="tikzkit-qa-grid"/);
  assert.match(output, /width="100" height="100"/);
  assert.match(output, /patternTransform="translate\(0 0\)"/);
  assert.match(output, /viewBox="-10 -20 320 240"/);
  assert.ok(output.indexOf("tikzkit-qa-grid-layer") < output.indexOf("<path"));
});

test("QA grid can be disabled without mutating exported SVG", () => {
  const source = '<svg viewBox="0 0 100 100"></svg>';
  assert.equal(withQaGrid(source, { enabled: false }), source);
});
```

- [ ] **Step 2: Run grid tests and verify failure**

Run: `node --test test/web-qa-grid.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `web/qaGrid.js`.

- [ ] **Step 3: Implement SVG-string grid injection**

```js
export function withQaGrid(svg, options = {}) {
  if (options.enabled === false) return svg;
  const unit = Number(options.unitPerCm) || 100;
  const originX = Number(options.originX) || 0;
  const originY = Number(options.originY) || 0;
  const match = String(svg).match(/viewBox="([^"]+)"/);
  if (!match) return svg;
  const [x, y, width, height] = match[1].trim().split(/\s+/).map(Number);
  if (![x, y, width, height].every(Number.isFinite)) return svg;
  const grid = `<defs><pattern id="tikzkit-qa-grid" width="${unit}" height="${unit}" patternUnits="userSpaceOnUse" patternTransform="translate(${originX} ${originY})"><path d="M ${unit} 0 L 0 0 0 ${unit}" fill="none" stroke="#64748b" stroke-opacity="0.48" stroke-width="0.45" stroke-dasharray="3.5 3.5" vector-effect="non-scaling-stroke"/></pattern></defs><rect id="tikzkit-qa-grid-layer" x="${x}" y="${y}" width="${width}" height="${height}" fill="url(#tikzkit-qa-grid)" pointer-events="none"/>`;
  return String(svg).replace(/(<svg\b[^>]*>)/, `$1${grid}`);
}
```

- [ ] **Step 4: Apply the grid only to the displayed copy**

In `web/app.js`, retain `state.lastSvg` unchanged and call:

```js
import { withQaGrid } from "./qaGrid.js";

function showTikzkitSvg(svg) {
  const enabled = document.querySelector("#grid-toggle").checked;
  document.querySelector("#tikzkit-result").innerHTML = withQaGrid(svg, { enabled });
}
```

The grid checkbox calls `showTikzkitSvg(state.lastSvg)` and never calls the compiler again.

- [ ] **Step 5: Run grid and controller tests**

Run: `node --test test/web-qa-grid.test.js test/web-workbench.test.js`

Expected: PASS with no mutation of the ungridded SVG string.

- [ ] **Step 6: Commit the QA grid**

```bash
git add web/qaGrid.js web/app.js test/web-qa-grid.test.js
git commit -m "Add browser QA grid overlay"
```

## Task 5: Verify the complete M0 workbench

**Files:**
- Modify: `README.md`
- Modify: `test/web-server.test.js`

**Interfaces:**
- Consumes: Tasks 1-4 and the existing `npm run examples:render` artifact generator.
- Produces: a documented `npm run web` flow and authoritative Node/browser evidence for M0.

- [ ] **Step 1: Extend the server test with document-contract assertions**

Add assertions that `web/index.html` contains the import map, all required control IDs, `/app.js`, and no `/api/render` endpoint or form action.

```js
const html = await index.text();
assert.match(html, /type="importmap"/);
for (const id of ["fixture-select", "source-editor", "render-button", "grid-toggle", "tikzkit-result", "reference-result", "diagnostics", "render-status"]) {
  assert.match(html, new RegExp(`id="${id}"`));
}
assert.doesNotMatch(html, /\/api\/render/);
```

- [ ] **Step 2: Run the focused M0 suite**

Run:

```bash
node --test test/web-fixture-catalog.test.js test/web-server.test.js test/web-workbench.test.js test/web-qa-grid.test.js
```

Expected: all M0 tests pass.

- [ ] **Step 3: Run architecture and public API regressions**

Run:

```bash
node --test test/architecture-seams.test.js test/frontend.test.js test/engine.test.js test/svg-renderer.test.js test/convert.test.js
```

Expected: all selected tests pass; no workbench code is imported by `src/index.js`.

- [ ] **Step 4: Start the restored workbench**

Run: `npm run web`

Expected output: `TikZKit workbench: http://127.0.0.1:5173/`.

- [ ] **Step 5: Perform browser verification**

Open `http://127.0.0.1:5173/#latex-examples-2048` and verify:

1. the select contains exactly 30 fixtures;
2. the editor contains the selected fixture source;
3. Render replaces the TikZKit SVG without a page reload;
4. `Ctrl/Cmd+Enter` renders;
5. diagnostics show severity, code, message, and source location when present;
6. the URL hash changes with fixture selection and survives reload;
7. the grid toggle changes only the displayed SVG and aligns at `(0,0)`;
8. the reference panel loads the generated `tikztosvg` grid SVG when available;
9. SVG content remains contained at desktop and mobile widths;
10. browser console contains no errors.

- [ ] **Step 6: Document browser-only rendering and reference artifacts**

Update `README.md` to state:

```text
npm run web starts the local workbench. TikZKit rendering runs in the browser
through src/index.js. The server only serves source files and static assets.
MacTeX and tikztosvg are never invoked by the browser workbench; regenerate
reference artifacts separately with npm run examples:render.
```

- [ ] **Step 7: Commit M0 verification and documentation**

```bash
git add README.md test/web-server.test.js
git commit -m "Document and verify online TikZ workbench"
```

## Task 6: Record M0 status and transition to the 30-case compatibility loop

**Files:**
- Modify: `src/capabilities/feature-ids.js`
- Modify: `src/capabilities/matrix.js`
- Modify: `src/capabilities/registries.js`
- Create: `docs/qa/milestone-1-status.md`
- Test: `test/capabilities.test.js`

**Interfaces:**
- Consumes: verified M0 browser behavior and the frozen milestone manifest.
- Produces: an explicit capability entry for browser workbench rendering and a `0/30` through `30/30` case ledger used by subsequent compatibility slices.

- [ ] **Step 1: Add a failing capability-matrix assertion**

```js
test("capability matrix records browser workbench verification", () => {
  const feature = capabilityMatrix.browser_workbench;
  assert.equal(feature.semantic, "stable");
  assert.equal(feature.svg, "stable");
  assert.equal(feature.verification.oracle, "browser+unit-test");
  assert.deepEqual(feature.fixtures, ["test/fixtures/examples/milestone-1.json"]);
});
```

- [ ] **Step 2: Run the capability test and verify failure**

Run: `node --test test/capabilities.test.js`

Expected: FAIL because `browser-workbench` is absent.

- [ ] **Step 3: Add the capability entry only after browser verification passes**

```js
browser_workbench: {
  id: "browser_workbench",
  parser: "stable",
  semantic: "stable",
  svg: "stable",
  modules: ["web/server.js", "web/workbench.js", "web/app.js", "web/qaGrid.js"],
  fixtures: ["test/fixtures/examples/milestone-1.json"],
  verification: {
    oracle: "browser+unit-test",
    tests: ["test/web-server.test.js", "test/web-workbench.test.js", "test/web-qa-grid.test.js"]
  },
  notes: "The workbench renders through src/index.js in the browser. Reference artifacts are generated offline and are not a browser runtime dependency."
}
```

Also append `"browser_workbench"` to `featureIds` and add this registry entry in `src/capabilities/registries.js`:

```js
application: ["browser_workbench"]
```

- [ ] **Step 4: Create the case ledger**

`docs/qa/milestone-1-status.md` must contain one row per frozen case with columns:

```text
Case | Feature inventory | Blocking diagnostics | TikZKit artifact | Reference artifact | Human visual review | Status | Remaining differences
```

Initialize status from current authoritative artifacts and diagnostics. Do not mark a row accepted without a recorded human visual review.

- [ ] **Step 5: Run capability and complete M0 tests**

Run:

```bash
node --test test/capabilities.test.js test/web-fixture-catalog.test.js test/web-server.test.js test/web-workbench.test.js test/web-qa-grid.test.js
```

Expected: all tests pass.

- [ ] **Step 6: Commit M0 status tracking**

```bash
git add src/capabilities/feature-ids.js src/capabilities/matrix.js src/capabilities/registries.js docs/qa/milestone-1-status.md test/capabilities.test.js
git commit -m "Track browser workbench milestone status"
```

After M0, select the highest-impact shared failure from the 30-case ledger and create the next focused plan. Expected ordering is text measurement/node geometry, core paths and arrows, PGFPlots 2D Axis Model, PGFPlots 3D surfaces, then remaining fixture-specific libraries. A case moves to accepted only under the full visual gate from the approved goal design.
