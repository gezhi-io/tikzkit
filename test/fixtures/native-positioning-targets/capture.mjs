import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [treeArg, stageArg, playwrightArg, revision] = process.argv.slice(2);
assert.ok(revision, "Usage: node capture.mjs <renderer-tree> <stage-output> <playwright/index.mjs> <revision-label>");
const root = path.resolve(stageArg), tree = path.resolve(treeArg);
const load = file => import(pathToFileURL(file).href);
const { chromium } = await load(path.resolve(playwrightArg));
const { createWorkbenchServer } = await load(path.join(tree, "web/server.js"));
const { fingerprintRenderEnvironment } = await load(path.join(tree, "scripts/render-example-fixtures.js"));
const hash = data => createHash("sha256").update(data).digest("hex");
const fileHash = async file => hash(await readFile(file));
const json = async file => JSON.parse(await readFile(file, "utf8"));
const summary = await json(path.join(root, "summary.json"));
const fixtureRoot = summary.fixtureRoot;
const manifest = await json(path.join(fixtureRoot, "manifest.json"));
assert.equal(summary.gate.accepted, true, "Strict generation gate is not green");
assert.deepEqual(summary.cases.map(e => e.id).sort(), manifest.cases.map(e => e.id).sort());
assert.equal(summary.comparisonGridMode, "none");
const environment = await fingerprintRenderEnvironment();
for (const dir of ["ui", "live", "download", "export", "tikztosvg", "pdf"]) {
  await mkdir(path.join(root, "capture", dir), { recursive: true });
}
const dst = (panel, id, ext) => path.join(root, "capture", panel, id + "." + ext);
const rel = file => path.relative(root, file);
const dpr = 4;

// Resolve paint through the browser's SVG transforms, without reading node IDs,
// text, renderer classes, or scene metadata. Undo preview layout, then map the
// viewBox to the *declared* physical SVG viewport (never fit to another image).
function paintedVectors(svg, colored) {
  const vb = svg.viewBox.baseVal;
  const w = svg.width.baseVal.value, h = svg.height.baseVal.value;
  const par = svg.preserveAspectRatio.baseVal;
  if (par.align !== 6 || par.meetOrSlice !== 1) throw Error("Expected xMidYMid meet");
  const s = Math.min(w / vb.width, h / vb.height), mm = 25.4 / 96;
  const toRoot = svg.getScreenCTM().inverse(), shapes = [], connectors = [];
  for (const el of svg.querySelectorAll("path,rect,circle,ellipse,polygon")) {
    if (el.closest("defs,symbol,marker,clipPath,mask,pattern")) continue;
    const style = getComputedStyle(el);
    const closed = ["path"].includes(el.localName) ? /z/i.test(el.getAttribute("d")) : true;
    if (style.visibility !== "visible" || style.display === "none") continue;
    const m = toRoot.multiply(el.getScreenCTM()), b = el.getBBox();
    const point = (x, y) => {
      const p = new DOMPoint(x, y).matrixTransform(m);
      return [(s*(p.x-vb.x)+(w-s*vb.width)/2)*mm, (s*(p.y-vb.y)+(h-s*vb.height)/2)*mm];
    };
    if (!colored && el.localName === "path" && style.stroke === "rgb(0, 0, 0)" &&
        (!closed || style.fill === "rgb(0, 0, 0)")) {
      const start = el.getPointAtLength(0), end = el.getPointAtLength(el.getTotalLength());
      connectors.push({ kind: closed ? "head" : "shaft", firstMm: point(start.x,start.y), lastMm: point(end.x,end.y) });
    }
    if (!closed || (colored ? style.fill === "none" : style.stroke !== "rgb(0, 0, 0)" || style.fill !== "none")) continue;
    if (Math.max(Math.abs(m.b), Math.abs(m.c)) > 1e-5) throw Error("Unexpected rotated candidate outline");
    const pts = [point(b.x,b.y), point(b.x+b.width,b.y+b.height)];
    const [x1,y1] = pts[0], [x2,y2] = pts[1];
    shapes.push({ fill: style.fill, boxMm: [Math.min(x1,x2),Math.min(y1,y2),Math.max(x1,x2),Math.max(y1,y2)],
      flatTop: !colored && el.isPointInStroke(new DOMPoint(b.x+b.width/4, b.y)) });
  }
  return { shapes, connectors };
}
const server = await createWorkbenchServer({ fixtureRoot, outputRoot: root });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const rows = [], errors = [], badRequests = [];
try {
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  const origin = "http://127.0.0.1:" + server.address().port;
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr });
  const workbench = await context.newPage(), standalone = await context.newPage();
  // These fixtures require no external resources. Never send their source outside localhost.
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    return url.origin === origin || ["data:", "blob:"].includes(url.protocol) ? route.continue() : route.abort();
  });
  for (const page of [workbench, standalone]) {
    page.on("pageerror", e => errors.push(e.message));
    page.on("response", res => { if (res.status() >= 400) badRequests.push([res.status(), res.url()]); });
    page.on("requestfailed", req => {
      if (!req.failure()?.errorText.includes("ERR_ABORTED")) badRequests.push([req.failure()?.errorText, req.url()]);
    });
  }
  await workbench.goto(origin + "/#tikzkit-scratch");
  await workbench.locator("#grid-toggle").uncheck();

  async function intrinsicShot(page, selector, file, live, colored) {
    const svg = page.locator(selector);
    const size = await svg.evaluate(el => ({
      w: el.getAttribute("width"), h: el.getAttribute("height"), viewBox: el.getAttribute("viewBox"),
      width: el.width.baseVal.value, height: el.height.baseVal.value
    }));
    for (const v of [size.w, size.h]) assert.match(v, /^[\d.]+(?:pt|px)?$/);
    // The workbench normally fits its two columns. Keep the actual live DOM,
    // but display its *declared* physical dimensions at the page origin for QA.
    const content =
      (live ? "#tikzkit-result{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;" +
        "z-index:2147483647!important;overflow:visible!important;margin:0!important;padding:0!important;border:0!important;background:white!important;}" : "") +
      selector + "{position:fixed!important;left:0!important;top:0!important;display:block!important;" +
      "min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;margin:0!important;" +
      "width:" + size.w + "!important;height:" + size.h + "!important;}";
    const style = live ? await page.addStyleTag({ content }) : await svg.evaluateHandle((el, css) => {
      const tag = document.createElementNS(el.namespaceURI, "style");
      tag.textContent = css;
      el.append(tag);
      return tag;
    }, content);
    try {
      await page.evaluate(async () => { await document.fonts.ready; await new Promise(requestAnimationFrame); });
      const b = await svg.boundingBox();
      for (const [actual, wanted] of [[b.x, 0], [b.y, 0], [b.width, size.width], [b.height, size.height]]) {
        assert.ok(Math.abs(actual - wanted) < 0.03, "Unexpected CSS viewport: " + JSON.stringify({ b, size }));
      }
      await page.screenshot({ path: file, scale: "device", clip: {
        x: 0, y: 0, width: Math.ceil(size.width), height: Math.ceil(size.height)
      } });
      const { shapes, connectors } = await svg.evaluate(paintedVectors, colored);
      return { file: rel(file), sha256: await fileHash(file), intrinsicCssPx: [size.width, size.height],
        declared: [size.w, size.h], viewBox: size.viewBox, vectors: shapes, connectors,
        fonts: await svg.evaluate(el => ({
          textFamilies: [...new Set([...el.querySelectorAll("text")].map(t => getComputedStyle(t).fontFamily))],
          loaded: [...document.fonts].filter(f => f.status === "loaded").map(f => f.family)
        })) };
    } finally { await style.evaluate(el => el.remove()); }
  }

  for (const fixture of manifest.cases) {
    const { id } = fixture, entry = summary.cases.find(e => e.id === id);
    assert.deepEqual(entry.fingerprints.environment, environment, id + ": renderer changed since strict run");
    assert.equal(entry.referenceKind, "tikztosvg");
    assert.ok(entry.tikztosvgStatus === "rendered" && entry.mactexPngStatus === "rendered");
    const source = await readFile(path.join(fixtureRoot, fixture.source), "utf8");
    assert.equal(hash(source), entry.fingerprints.sourceSha256);
    const texDir = path.join(root, ".mactex-work", id);
    assert.equal(await readFile(path.join(texDir, "reference.tex"), "utf8"), source, id + ": PDF is not the original source");
    const pdf = dst("pdf", id, "pdf");
    await copyFile(path.join(texDir, "reference.pdf"), pdf);
    const pdfPng = dst("pdf", id, "png");
    execFileSync("pdftocairo", ["-png", "-r", String(96 * dpr), "-singlefile", pdf, pdfPng.slice(0, -4)]);

    await workbench.locator("#fixture-select").selectOption(id);
    await workbench.waitForFunction(({ id, source }) =>
      document.querySelector("#fixture-select")?.value === id &&
      document.querySelector(".CodeMirror")?.CodeMirror.getValue() === source &&
      document.querySelector("#render-status")?.textContent.includes("diagnostics") &&
      !document.querySelector("#render-button").disabled && !document.querySelector("#download-svg-button").disabled &&
      document.querySelector("#tikzkit-result:not(.is-stale) > svg"), { id, source });
    const diagnostics = await workbench.locator("#diagnostics .diagnostic").allTextContents();
    const live = workbench.locator("#tikzkit-result > svg");
    const liveSvg = await live.evaluate(el => new XMLSerializer().serializeToString(el));
    await writeFile(dst("live", id, "svg"), liveSvg);
    await workbench.evaluate(() => document.fonts.ready);
    await workbench.screenshot({ path: dst("ui", id, "png"), scale: "css" });
    const colored = !fixture.source.startsWith("../");
    const panels = { live: await intrinsicShot(workbench, "#tikzkit-result > svg", dst("live", id, "png"), true, colored) };
    const downloading = workbench.waitForEvent("download");
    await workbench.locator("#download-svg-button").click();
    const download = await downloading;
    await download.saveAs(dst("download", id, "svg"));
    for (const [panel, svgFile, expected] of [
      ["download", rel(dst("download", id, "svg"))],
      ["export", entry.tikzkitSvg, entry.fingerprints.artifacts.tikzkitSvg],
      ["tikztosvg", entry.tikztosvgSvg, entry.fingerprints.artifacts.tikztosvgSvg]
    ]) {
      const sha256 = await fileHash(path.join(root, svgFile));
      if (expected) assert.equal(sha256, expected, id + ": changed " + panel);
      await standalone.goto(origin + "/artifacts/" + svgFile);
      assert.equal(await standalone.evaluate(() => document.documentElement.localName), "svg");
      panels[panel] = { ...await intrinsicShot(standalone, ":root", dst(panel, id, "png"), false, colored), svgFile, svgSha256: sha256 };
    }
    Object.assign(panels.live, { svgFile: rel(dst("live", id, "svg")), svgSha256: hash(liveSvg) });
    panels.pdf = { file: rel(pdfPng), sha256: await fileHash(pdfPng), pdfFile: rel(pdf), pdfSha256: await fileHash(pdf) };
    rows.push({ id, source: fixture.source, sourceSha256: hash(source), renderFingerprint: entry.renderFingerprint,
      originalPdfInputMatchesSource: true, diagnostics, exportDiagnostics: entry.diagnostics,
      suggestedDownload: download.suggestedFilename(), panels });
    console.log("Captured workbench, actual download, CLI export, tikztosvg and original PDF: " + id);
  }
  const report = { revision, tree, fixtureRoot, browser: await browser.version(), deviceScaleFactor: dpr,
    dpi: 96 * dpr, environment, summarySha256: await fileHash(path.join(root, "summary.json")),
    pdftocairo: spawnSync("pdftocairo", ["-v"], { encoding: "utf8" }).stderr.split("\n")[0],
    errors, badRequests, rows };
  await writeFile(path.join(root, "capture.json"), JSON.stringify(report, null, 2) + "\n");
  assert.deepEqual(errors, [], "Browser page errors");
  assert.deepEqual(badRequests, [], "Browser resource errors");
} finally {
  await browser.close();
  if (server.listening) await new Promise(resolve => server.close(resolve));
}
