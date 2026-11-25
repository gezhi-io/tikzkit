import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [stage, pw] = process.argv.slice(2);
const json = async file => JSON.parse(await readFile(file));
const cap = await json(path.join(stage, "capture.json"));
const gallery = fileURLToPath(new URL("../examples/", import.meta.url));
const focus = await json(path.join(cap.fixtureRoot, "manifest.json"));
const manifest = await json(path.join(gallery, "manifest.json"));
const load = file => import(pathToFileURL(path.resolve(file)));
const { createWorkbenchServer } = await load(path.join(cap.tree, "web/server.js"));
const { fingerprintRenderEnvironment } = await load(path.join(cap.tree, "scripts/render-example-fixtures.js"));
const server = await createWorkbenchServer({ fixtureRoot: gallery });
let browser;
try {
  await new Promise((ok, fail) => server.once("error", fail).listen(0, "127.0.0.1", ok));
  const origin = "http://127.0.0.1:" + server.address().port;
  browser = await (await load(pw)).chromium.launch({ channel:"chrome", headless:true });
  const context = await browser.newContext(), results = [];
  await context.route("**/*", r => {
    const url = new URL(r.request().url());
    return url.origin === origin || ["data:", "blob:"].includes(url.protocol) ? r.continue() : r.abort();
  });
  for (const spec of focus.cases.filter(s => s.manual || s.variantOf)) {
    const pubs = manifest.cases.filter(s => s.id === spec.id);
    assert.equal(pubs.length, 1);
    const source = path.join(cap.fixtureRoot, spec.source);
    assert.equal(await realpath(path.join(gallery, pubs[0].source)), await realpath(source));
    const page = await context.newPage(), route = "/#" + spec.id;
    await page.goto(origin + route);
    await page.waitForFunction(id => location.hash === "#" + id &&
      document.querySelector("#fixture-select")?.value === id &&
      document.querySelector("#tikzkit-result:not(.is-stale) > svg") &&
      !document.querySelector("#download-svg-button").disabled, spec.id);
    assert.equal(await page.locator(".CodeMirror").evaluate(e => e.CodeMirror.getValue()), await readFile(source, "utf8"));
    const downloading = page.waitForEvent("download");
    await page.locator("#download-svg-button").click();
    const download = await downloading;
    assert.equal(download.suggestedFilename(), spec.id + ".svg");
    const sha256 = createHash("sha256").update(await readFile(await download.path())).digest("hex");
    assert.equal(sha256, cap.rows.find(r => r.id === spec.id).panels.download.svgSha256);
    results.push({route, source:pubs[0].source, downloadSha256:sha256, status:await page.locator("#render-status").textContent()});
    await page.close();
  }
  assert.deepEqual(await fingerprintRenderEnvironment(), cap.environment, "runtime changed during public-route check");
  await writeFile(path.join(stage, "public-routes.json"), JSON.stringify(results, null, 2) + "\n", {flag:"wx"});
  console.log(results.length + " public gallery downloads match the focused capture.");
} finally {
  await browser?.close();
  if (server.listening) await new Promise(ok => server.close(ok));
}
