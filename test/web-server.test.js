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
  assert.equal(katexFont.headers.get("content-type"), "font/woff2");
});

test("workbench server rejects allowlisted directories", async (t) => {
  const server = await createWorkbenchServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const port = server.address().port;
  const response = await fetch(`http://127.0.0.1:${port}/src/`);
  assert.equal(response.status, 404);
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
