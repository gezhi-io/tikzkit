import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, stat, symlink, utimes, writeFile } from "node:fs/promises";
import test from "node:test";
import os from "node:os";
import path from "node:path";
import { createWorkbenchServer } from "../web/server.js";
import { fontManifest } from "../src/fonts/manifest.js";
import { auditTikzSource } from "../scripts/case-semantic-audit.js";

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
  assert.ok(fontManifest.length > 0);
  const fonts = await Promise.all(fontManifest.map((font) => fetch(`http://127.0.0.1:${port}/fonts/${font.file}`)));
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
  assert.equal(reviewedAudit.gate.status, "incomplete");
  assert.equal(reviewedAudit.gate.accepted, false);
  assert.ok(reviewedAudit.summary.reviewTodos > 0);
  assert.ok(reviewedAudit.gate.todos.some((todo) => /unbound review binding/.test(todo)));
  const reviewedPath = reviewedAudit.commands.find((entry) => entry.name === "\\path");
  assert.ok(reviewedPath);
  assert.equal(reviewedPath.claimedReviewStatus, "verified");
  assert.equal(reviewedPath.reviewStatus, "unbound");
  assert.equal(reviewedPath.approvalCurrent, false);
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
  assert.equal(katexFont.status, 404);
  const vendorFont = await fetch(`http://127.0.0.1:${port}/vendor/katex/fonts/KaTeX_Main-Regular.woff2`);
  assert.equal(vendorFont.status, 404);
  for (const [index, response] of fonts.entries()) {
    const font = fontManifest[index];
    assert.equal(font.format, "woff", font.file);
    assert.equal(response.status, 200, font.file);
    assert.equal(response.headers.get("content-type"), "font/woff", font.file);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.toString("ascii", 0, 4), "wOFF", font.file);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), font.sha256, font.file);
  }
  for (const license of new Set(fontManifest.map((font) => font.license))) {
    const response = await fetch(`http://127.0.0.1:${port}/fonts/${license}`);
    assert.equal(response.status, 200, license);
    assert.ok((await response.text()).trim().length > 0, license);
  }
});

test("workbench audit cache invalidates bound approval when evidence changes or disappears", async (t) => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-web-audit-cache-"));
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  const source = String.raw`\begin{tikzpicture}\draw (0,0)--(1,1);\end{tikzpicture}`;
  const sourcePath = path.join(fixtureRoot, "probe.tex");
  const evidencePath = path.join(fixtureRoot, "evidence.txt");
  const evidence = "independently checked baseline\n";
  await writeFile(evidencePath, evidence);
  const review = {
    caseStatus: "accepted",
    localSources: ["tikz.code.tex", "latex.ltx"],
    localSourceNotes: { "tikz.code.tex": "Reviewed drawing", "latex.ltx": "Reviewed shell" },
    rules: [{ match: "*", status: "verified", evidence: [evidencePath] }]
  };
  review.binding = auditTikzSource(source, { sourcePath, review }).binding;
  assert.equal(auditTikzSource(source, { sourcePath, review }).gate.accepted, true);
  await writeFile(sourcePath, source);
  await writeFile(path.join(fixtureRoot, "probe.review.json"), JSON.stringify(review));
  await writeFile(path.join(fixtureRoot, "manifest.json"), JSON.stringify({ cases: [{ id: "probe", source: "probe.tex" }] }));
  await writeFile(path.join(fixtureRoot, "milestone-1.json"), JSON.stringify({ sourceManifest: "manifest.json", caseIds: ["probe"] }));

  const server = await createWorkbenchServer({ fixtureRoot });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const auditUrl = `http://127.0.0.1:${server.address().port}/api/fixtures/probe/audit`;
  const fetchAudit = async () => {
    const response = await fetch(auditUrl);
    assert.equal(response.status, 200);
    return response.json();
  };
  const before = await fetchAudit();
  assert.equal(before.gate.accepted, true);
  assert.deepEqual(await fetchAudit(), before);
  await writeFile(path.join(fixtureRoot, "unrelated.txt"), "not review evidence\n");
  assert.deepEqual(await fetchAudit(), before);

  const originalStat = await stat(evidencePath);
  const changedEvidence = evidence.replace("checked", "changed");
  assert.equal(Buffer.byteLength(changedEvidence), originalStat.size);
  await writeFile(evidencePath, changedEvidence);
  await utimes(evidencePath, originalStat.atime, originalStat.mtime);
  const direct = auditTikzSource(source, { sourcePath, review });
  assert.equal(direct.bindingStatus, "stale");
  const changed = await fetchAudit();
  assert.equal(changed.gate.accepted, false);
  assert.deepEqual(changed.gate, direct.gate);
  const draw = changed.commands.find((entry) => entry.name === "\\draw");
  assert.equal(draw.reviewStatus, "stale");
  assert.equal(draw.approvalCurrent, false);

  await writeFile(evidencePath, evidence);
  assert.deepEqual(await fetchAudit(), before);
  await rm(evidencePath);
  const missing = await fetchAudit();
  assert.equal(missing.gate.accepted, false);
  assert.deepEqual(missing.gate, auditTikzSource(source, { sourcePath, review }).gate);
  await writeFile(evidencePath, evidence);
  assert.deepEqual(await fetchAudit(), before);
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
