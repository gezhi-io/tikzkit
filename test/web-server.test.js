import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import test from "node:test";
import os from "node:os";
import path from "node:path";
import { createWorkbenchServer } from "../web/server.js";

test("workbench server exposes browser assets and fixture source without rendering", async (t) => {
  const server = await createWorkbenchServer({ host: "127.0.0.1", port: 0 });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const port = server.address().port;

  const index = await fetch(`http://127.0.0.1:${port}/`);
  const html = await index.text();
  const catalog = await fetch(`http://127.0.0.1:${port}/api/fixtures`).then((response) => response.json());
  const source = await fetch(`http://127.0.0.1:${port}${catalog[0].sourceUrl}`).then((response) => response.text());
  const auditResponse = await fetch(`http://127.0.0.1:${port}/api/fixtures/${encodeURIComponent(catalog[0].id)}/audit`);
  const audit = await auditResponse.json();
  const reviewedAuditResponse = await fetch(
    `http://127.0.0.1:${port}/api/fixtures/to-path-distance-flowchart/audit`
  );
  const reviewedAudit = await reviewedAuditResponse.json();
  const classTree = catalog.find((entry) => entry.id === "latex-examples-class-tree");
  const roadResource = classTree?.resources.find((resource) => resource.name === "road.jpg");
  const road = await fetch(`http://127.0.0.1:${port}${roadResource?.url}`);
  const roadBytes = new Uint8Array(await road.arrayBuffer());
  const compiler = await fetch(`http://127.0.0.1:${port}/src/index.js`);
  const codeMirror = await fetch(`http://127.0.0.1:${port}/vendor/codemirror/codemirror.min.js`);
  const codeMirrorStyles = await fetch(`http://127.0.0.1:${port}/vendor/codemirror/codemirror.min.css`);
  const chevrotain = await fetch(`http://127.0.0.1:${port}/vendor/chevrotain/chevrotain.mjs`);
  const katex = await fetch(`http://127.0.0.1:${port}/vendor/katex/katex.mjs`);
  const katexFont = await fetch(`http://127.0.0.1:${port}/node_modules/katex/dist/fonts/KaTeX_Main-Regular.woff2`);
  const cmuFonts = await Promise.all([
    "TikZKitCMUSans-Regular.otf",
    "TikZKitCMUSans-Italic.otf",
    "TikZKitCMUSans-Bold.otf",
    "TikZKitCMUSans-BoldItalic.otf",
    "TikZKitCMUSerif-Roman.otf",
    "TikZKitCMUSerif-Italic.otf",
    "TikZKitCMUSerif-Bold.otf",
    "TikZKitCMUSerif-BoldItalic.otf",
    "TikZKitCMR5-Regular.otf",
    "TikZKitCMR6-Regular.otf",
    "TikZKitCMR7-Regular.otf",
    "TikZKitCMR8-Regular.otf",
    "TikZKitCMR9-Regular.otf",
    "TikZKitCMR10-Regular.otf",
    "TikZKitCMR12-Regular.otf",
    "TikZKitCMR17-Regular.otf",
    "TikZKitCMBX5-Bold.otf",
    "TikZKitCMBX6-Bold.otf",
    "TikZKitCMBX7-Bold.otf",
    "TikZKitCMBX8-Bold.otf",
    "TikZKitCMBX9-Bold.otf",
    "TikZKitCMBX10-Bold.otf",
    "TikZKitCMBX12-Bold.otf",
    "TikZKitMath_Caligraphic-Regular.ttf",
    "TikZKitMath_Caligraphic-Bold.ttf"
  ].map((fileName) => fetch(`http://127.0.0.1:${port}/fonts/${fileName}`)));
  const openingTags = [...html.matchAll(/<[A-Za-z][^>]*>/g)].map(([tag]) => tag);
  const hasAttribute = (tag, name) => new RegExp(`(?:^|\\s)${name}\\s*=`, "i").test(tag);
  const hasAttributeValue = (tag, name, value) =>
    new RegExp(`(?:^|\\s)${name}\\s*=\\s*["']${value}["']`, "i").test(tag);

  assert.equal(index.status, 200);
  for (const id of [
    "fixture-select",
    "fixture-filter",
    "new-source-button",
    "source-editor",
    "render-button",
    "reset-source-button",
    "copy-svg-button",
    "download-svg-button",
    "grid-toggle",
    "tikzkit-result",
    "reference-result",
    "reference-empty",
    "diagnostics",
    "render-status",
    "fixture-title",
    "fixture-summary",
    "cursor-status",
    "draft-status",
    "semantic-details",
    "semantic-summary",
    "semantic-content"
  ]) {
    assert.ok(
      openingTags.some((tag) => hasAttributeValue(tag, "id", id)),
      `expected an opening tag with id=${id}`
    );
  }
  const scriptTags = openingTags.filter((tag) => /^<script(?:\s|>)/i.test(tag));
  assert.ok(
    scriptTags.some(
      (tag) => hasAttributeValue(tag, "type", "module") && hasAttributeValue(tag, "src", "/app\\.js")
    ),
    "expected an executable module script referencing /app.js"
  );
  assert.ok(
    scriptTags.some((tag) => hasAttributeValue(tag, "type", "importmap")),
    "expected a script element with type=importmap"
  );
  assert.doesNotMatch(html, /\/api\/render/);
  assert.ok(
    !openingTags.some((tag) => /^<form(?:\s|>)/i.test(tag) && hasAttribute(tag, "action")),
    "expected no form action attribute"
  );
  assert.ok(catalog.length >= 60);
  assert.equal(new Set(catalog.map((entry) => entry.id)).size, catalog.length);
  assert.ok(classTree);
  assert.equal(classTree.resources.length, 14);
  assert.ok(roadResource);
  assert.equal(road.status, 200);
  assert.equal(road.headers.get("content-type"), "image/jpeg");
  assert.deepEqual([...roadBytes.slice(0, 2)], [0xff, 0xd8]);
  assert.match(source, /\\begin\{(?:tikzpicture|axis)\}/);
  assert.equal(auditResponse.status, 200);
  assert.ok(audit.summary.commands > 0);
  assert.ok(Array.isArray(audit.dependencies));
  assert.ok(Array.isArray(audit.commands));
  assert.ok(Array.isArray(audit.options));
  assert.ok(audit.commands.every((entry) => !Object.hasOwn(entry, "localSource")));
  assert.ok(audit.dependencies.every((entry) => !Object.hasOwn(entry, "localSource")));
  assert.ok(audit.dependencies.some((entry) => entry.lookup));
  assert.equal(reviewedAuditResponse.status, 200);
  assert.equal(reviewedAudit.gate.status, "accepted");
  assert.equal(reviewedAudit.summary.reviewTodos, 0);
  assert.equal(reviewedAudit.summary.blockers, 0);

  const draftSource = String.raw`\usetikzlibrary{calc}
\begin{tikzpicture}
  \draw[red, very thick] (0,0) -- (1,1);
\end{tikzpicture}`;
  const draftAuditResponse = await fetch(`http://127.0.0.1:${port}/api/audit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ source: draftSource })
  });
  const draftAudit = await draftAuditResponse.json();
  assert.equal(draftAuditResponse.status, 200);
  assert.ok(draftAudit.dependencies.some((entry) => entry.name === "calc"));
  assert.ok(draftAudit.commands.some((entry) => entry.name === "\\draw"));
  assert.ok(draftAudit.options.some((entry) => entry.key === "very thick"));

  const invalidDraftAudit = await fetch(`http://127.0.0.1:${port}/api/audit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "not-json"
  });
  assert.equal(invalidDraftAudit.status, 400);

  const missingSourceAudit = await fetch(`http://127.0.0.1:${port}/api/audit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "null"
  });
  assert.equal(missingSourceAudit.status, 400);
  assert.equal(compiler.status, 200);
  assert.equal(codeMirror.status, 200);
  assert.equal(codeMirror.headers.get("content-type"), "text/javascript; charset=utf-8");
  assert.equal(codeMirrorStyles.status, 200);
  assert.equal(codeMirrorStyles.headers.get("content-type"), "text/css; charset=utf-8");
  assert.equal(chevrotain.status, 200);
  assert.equal(katex.status, 200);
  assert.equal(katexFont.status, 200);
  assert.equal(katexFont.headers.get("content-type"), "font/woff2");
  for (const font of cmuFonts) {
    assert.equal(font.status, 200);
    assert.equal(font.headers.get("content-type"), font.url.endsWith(".ttf") ? "font/ttf" : "font/otf");
  }
});

test("workbench server rejects allowlisted directories", async (t) => {
  const server = await createWorkbenchServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const port = server.address().port;
  const response = await fetch(`http://127.0.0.1:${port}/src/`);
  assert.equal(response.status, 404);
});

test("workbench catalog discovers reference artifacts generated after server startup", async (t) => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-web-artifacts-"));
  const outputRoot = path.join(tempRoot, "output");
  await mkdir(outputRoot, { recursive: true });
  t.after(() => rm(tempRoot, { recursive: true, force: true }));

  const server = await createWorkbenchServer({ outputRoot });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const port = server.address().port;
  const catalogUrl = `http://127.0.0.1:${port}/api/fixtures`;

  const before = await fetch(catalogUrl).then((response) => response.json());
  const fixture = before[0];
  assert.equal(fixture.tikztosvgSvgUrl, null);

  const artifactDirectory = path.join(outputRoot, "tikztosvg-svg");
  await mkdir(artifactDirectory, { recursive: true });
  await writeFile(path.join(artifactDirectory, `${fixture.id}.svg`), "<svg xmlns=\"http://www.w3.org/2000/svg\"/>");

  const after = await fetch(catalogUrl).then((response) => response.json());
  assert.equal(after[0].tikztosvgSvgUrl, `/artifacts/tikztosvg-svg/${fixture.id}.svg`);
});

test("workbench server rejects artifact symlinks outside the output root", async (t) => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-web-server-"));
  const outputRoot = path.join(tempRoot, "output");
  const outsidePath = path.join(tempRoot, "outside.txt");
  const linkPath = path.join(outputRoot, "escaped.txt");
  await mkdir(outputRoot, { recursive: true });
  await writeFile(outsidePath, "secret outside artifact");
  await symlink(outsidePath, linkPath);
  t.after(() => rm(tempRoot, { recursive: true, force: true }));

  const server = await createWorkbenchServer({ outputRoot });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const port = server.address().port;
  const response = await fetch(`http://127.0.0.1:${port}/artifacts/escaped.txt`);

  assert.equal(response.status, 404);
  assert.equal(await response.text(), "");
});

test("workbench server rejects path traversal", async (t) => {
  const server = await createWorkbenchServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const port = server.address().port;
  const response = await fetch(`http://127.0.0.1:${port}/src/%2e%2e/package.json`);
  assert.equal(response.status, 404);
});
