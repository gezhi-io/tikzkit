// node capture.mjs <renderer checkout> <strict reference output> <playwright/index.mjs> <before|after>
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [tree, output, playwright, version] = process.argv.slice(2);
assert.ok(["before", "after"].includes(version));
const stage = path.resolve(output);
const catalog = JSON.parse(await readFile(path.join(stage, "summary.json"), "utf8"));
const fixtures = JSON.parse(await readFile(path.join(catalog.fixtureRoot, "manifest.json"), "utf8"));
const { createWorkbenchServer } = await import(pathToFileURL(path.resolve(tree, "web/server.js")));
const { chromium } = await import(pathToFileURL(path.resolve(playwright)));
const server = await createWorkbenchServer({ fixtureRoot: catalog.fixtureRoot, outputRoot: stage });
const browser = await chromium.launch({ channel: "chrome" });
const results = [], errors = [];

// Compare the painted paths after applying their actual SVG transforms.
// A native reference stores crossings as M L M L and some marks inside clips.
function markCenters(el) {
  const vb = el.viewBox.baseVal, mm = el.width.baseVal.value / vb.width * 25.4 / 96;
  const inverse = el.getScreenCTM().inverse(), marks = {cross: [], blue: [], red: []};
  for (const p of el.querySelectorAll("path")) {
    if (p.closest("defs,clipPath,symbol")) continue;
    const style = getComputedStyle(p);
    const ops = (p.getAttribute("d")?.match(/[MLCZQASTHV]/gi) || []).join("").toUpperCase();
    const kind = ops === "MLML" && style.stroke === "rgb(0, 0, 0)" ? "cross"
      : style.fill === "rgb(0, 0, 255)" ? "blue" : style.fill === "rgb(255, 0, 0)" ? "red" : "";
    if (!kind) continue;
    const b = p.getBBox(), c = new DOMPoint(b.x+b.width/2, b.y+b.height/2).matrixTransform(inverse.multiply(p.getScreenCTM()));
    marks[kind].push([(c.x-vb.x)*mm, (c.y-vb.y)*mm]);
  }
  return marks;
}

// Measure/save the physical viewport, not the workbench's fitted columns.
async function capture(page, selector, target) {
  const svg = page.locator(selector);
  const [width, height] = await svg.evaluate(el => [el.getAttribute("width"), el.getAttribute("height")]);
  assert.ok([width, height].every(n => /^[\d.]+(pt|px)?$/.test(n)));
  const css = (selector === ":root" ? "" : "#tikzkit-result{position:fixed!important;inset:0!important;z-index:99999!important;overflow:visible!important;}") +
    selector + "{position:fixed!important;top:0!important;left:0!important;display:block!important;margin:0!important;" +
    "min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;" +
    "width:" + width + "!important;height:" + height + "!important;background:white;}";
  const style = await svg.evaluateHandle((el, css) => {
    const sheet = document.createElementNS("http://www.w3.org/2000/svg", "style");
    sheet.textContent = css; el.append(sheet); return sheet;
  }, css);
  try {
    await page.evaluate(() => document.fonts.ready);
    await svg.evaluate(el => {
      const b = el.getBoundingClientRect();
      if (Math.abs(b.width-el.width.baseVal.value) > 0.05 || Math.abs(b.height-el.height.baseVal.value) > 0.05) {
        throw new Error("Preview stylesheet overrode the physical SVG viewport");
      }
    });
    await svg.screenshot({ path: target, animations: "disabled" });
  } finally { await style.evaluate(el => el.remove()); }
}

try {
  await new Promise((ok, no) => server.once("error", no).listen(0, "127.0.0.1", ok));
  const origin = "http://127.0.0.1:" + server.address().port;
  const context = await browser.newContext({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 3 });
  await context.route("**/*", r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
  const workbench = await context.newPage(), viewer = await context.newPage();
  for (const page of [workbench, viewer]) page.on("pageerror", error => errors.push(error.message));
  const dir = path.join(stage, version);
  await mkdir(dir, { recursive: true });
  for (const { id, source } of fixtures.cases) {
    const input = await readFile(path.join(catalog.fixtureRoot, source), "utf8");
    const reference = catalog.cases.find(row => row.id === id);
    assert.equal(reference.referenceKind, "tikztosvg");
    assert.equal(reference.mactexPngStatus, "rendered");
    await workbench.goto(origin + "/#" + id);
    await workbench.waitForFunction(({id,input}) => document.querySelector("#fixture-select")?.value === id &&
      document.querySelector(".CodeMirror")?.CodeMirror.getValue() === input &&
      !document.querySelector("#download-svg-button").disabled && document.querySelector("#tikzkit-result:not(.is-stale) > svg"), {id,input});
    await workbench.locator("#grid-toggle").uncheck();
    const svg = workbench.locator("#tikzkit-result > svg"), old = await svg.elementHandle();
    await workbench.locator("#render-button").click();
    await workbench.waitForFunction(old => !old.isConnected && !document.querySelector("#download-svg-button").disabled, old);
    const diagnostics = await workbench.locator("#diagnostics .diagnostic").allTextContents();
    if (version === "after") assert.deepEqual(diagnostics, []);
    const prefix = path.join(dir, id);
    const centers = { live: await svg.evaluate(markCenters) };
    await writeFile(prefix + ".svg", await svg.evaluate(el => new XMLSerializer().serializeToString(el)));
    await capture(workbench, "#tikzkit-result > svg", prefix + ".png");
    if (version === "after") {
      const pending = workbench.waitForEvent("download");
      await workbench.locator("#download-svg-button").click();
      await (await pending).saveAs(prefix + "-download.svg");
      for (const [suffix, rel] of [["download", version + "/" + id + "-download.svg"], ["tikztosvg", reference.tikztosvgSvg]]) {
        await viewer.goto(origin + "/artifacts/" + rel);
        assert.equal(await viewer.locator(":root").evaluate(el => el.localName), "svg");
        centers[suffix] = await viewer.locator(":root").evaluate(markCenters);
        await capture(viewer, ":root", prefix + "-" + suffix + ".png");
      }
    }
    results.push({id, diagnostics, centers});
  }
  assert.deepEqual(errors, []);
  await writeFile(path.join(dir, "browser.json"), JSON.stringify({ browser: browser.version(), results, errors }, null, 2));
  console.log(version, results.map(r => [r.id, r.diagnostics.length]));
} finally {
  await browser.close();
  if (server.listening) await new Promise(ok => server.close(ok));
}
