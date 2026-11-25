import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { sha256 } from "./render-example-fixtures.js";

const titles = ["Live workbench JS", "Local tikztosvg", "After SVG-text"];
const tolerancePx = 0.05; // Intrinsic CSS pixels, not the raster audit's 3x capture.
// One token per ordered paint subpath: stroke/fill, open/closed, cubic count.
const nativeTopology = {
  "manual-open": "sO3", "manual-inline": "sC3", "manual-braced": "sO2", disconnected: "sO1 sO1",
  "closed-cycle": "sC4", rectangles: "sC4 sC4", "line-rectangle-line": "sO0 sC4 sO0",
  "cubic-joins": "sO5", oversize: "sO3", "oversize-bbox": "sO1", transform: "sO1 sO1",
  "sharp-control": "sO1", "corpus-polyline": "fC3 sC3", "nested-scopes": "sO0 sO1 sO0 sO1"
};
const fixtureDir = new URL("../test/fixtures/native-rounded-corners/", import.meta.url);
const json = async file => JSON.parse(await readFile(file, "utf8"));

// Use Chrome's path expansion and screen CTM, as in audit-path-grid-geometry.
// Read the complete centerline, even where the native PDF clips it to the page.
function measure() {
  const svg = document.querySelector("body > svg"), page = svg.getBoundingClientRect();
  const elements = [...svg.querySelectorAll("path,line,rect,polygon,polyline,circle,ellipse,use,image,text")];
  const scratch = document.createElementNS(svg.namespaceURI, "path");
  svg.append(scratch);
  const parts = [];
  for (const el of elements) {
    if (el.closest("defs,clipPath,mask,marker,symbol,pattern")) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility !== "visible") continue;
    let hidden = false;
    for (let n = el; n instanceof SVGElement; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === "none" || Number(s.opacity) === 0) hidden = true;
    }
    if (hidden) continue;
    const fill = cs.fill !== "none" && Number(cs.fillOpacity) > 0;
    const stroke = cs.stroke !== "none" && Number(cs.strokeOpacity) > 0 && parseFloat(cs.strokeWidth) > 0;
    if (!fill && !stroke) continue;
    if (el.localName !== "path" || !scratch.getPathData) throw new Error("Expected Chrome SVGPathDataAPI and painted paths");
    if (cs.strokeDasharray !== "none" || cs.paintOrder !== "normal") throw new Error("Unsupported dashed or reordered paint");
    const d = /^path\("([^"]*)"\)$/.exec(cs.d);
    if (!d) throw new Error("Unsupported computed path: " + cs.d);
    scratch.setAttribute("d", d[1]);
    const m = el.getScreenCTM(), groups = [];
    let group, start, current;
    function begin(p) { start = current = p; group = [{ type: "M", values: p }]; groups.push(group); }
    for (const { type, values } of scratch.getPathData({ normalize: true })) {
      const v = [];
      for (let i = 0; i < values.length; i += 2) {
        const p = new DOMPoint(values[i], values[i + 1]).matrixTransform(m);
        v.push(p.x, p.y);
      }
      if (type === "M") { begin(v); continue; }
      if (!group) begin(current); // A drawing command is legal immediately after Z.
      if (!["L", "C", "Z"].includes(type)) throw new Error("Unexpected normalized command " + type);
      group.push({ type, values: v });
      if (type === "Z") { current = start; group = null; } else current = v.slice(-2);
    }
    const subpaths = [];
    for (const raw of groups) {
      if (!raw.some(s => s.type === "L" || s.type === "C")) continue; // Cairo's trailing moveto after Z.
      scratch.setPathData(raw);
      const b = scratch.getBBox(); // Browser curve extrema in absolute coordinates, before any simplification.
      let from = raw[0].values;
      const segments = [];
      for (const { type, values } of raw.slice(1)) {
        const end = type === "Z" ? raw[0].values : values.slice(-2);
        // Z's implicit edge is a line, but keep the closed flag. Cairo omits
        // zero-length sides on the 1ex capsule. Never drop nonzero backtracking.
        if (type === "C" || end[0] !== from[0] || end[1] !== from[1])
          segments.push({ type: type === "Z" ? "L" : type, coords: [...from, ...(type === "Z" ? end : values)] });
        from = end;
      }
      subpaths.push({ closed: raw.at(-1).type === "Z", segments, bounds: [b.x, b.y, b.x + b.width, b.y + b.height] });
    }
    // Cairo splits a filled-and-stroked shape. Preserve both paint passes and their order.
    for (const kind of ["fill", "stroke"]) if (kind === "fill" ? fill : stroke)
      for (const part of subpaths) parts.push({ kind, color: cs[kind], ...part });
  }
  scratch.remove();
  return { page: [page.left, page.top, page.right, page.bottom], parts };
}

async function capture(page, svg) {
  await page.setContent("<!doctype html><style>body{margin:0}body>svg{display:block}</style>" + svg);
  return page.evaluate(measure);
}

const cubicCount = part => part.segments.filter(s => s.type === "C").length;
const topology = image => image.parts.map(p => p.kind[0] + (p.closed ? "C" : "O") + cubicCount(p)).join(" ");
const delta = (a, b) => Math.max(...a.map((n, i) => Math.abs(n - b[i])));
const word = p => p.segments.map(s => s.type).join("");
function describe(image) {
  return { page: image.page, topology: topology(image), open: image.parts.filter(p => !p.closed).length,
    closed: image.parts.filter(p => p.closed).length, cubics: image.parts.reduce((n, p) => n + cubicCount(p), 0),
    paths: image.parts.map(p => ({ kind: p.kind, color: p.color, commands: word(p), bounds: p.bounds })) };
}

function compare(actual, ref) {
  const pagePx = delta(actual.page, ref.page), issues = [];
  let boundsPx = null, vertexPx = null, handlePx = null, cubicPx = null, comparedCubics = 0, worstCubic = null;
  if (actual.parts.length !== ref.parts.length) issues.push("Paint subpath count differs");
  else for (const [i, r] of ref.parts.entries()) {
    const a = actual.parts[i];
    boundsPx = Math.max(boundsPx ?? 0, delta(a.bounds, r.bounds));
    if (a.kind !== r.kind || a.color !== r.color || a.closed !== r.closed || word(a) !== word(r)) {
      issues.push("Subpath " + (i + 1) + ": paint, closure or ordered commands differ");
      continue; // No nearest-curve matching, reordering, reversal or alignment.
    }
    for (const [j, s] of r.segments.entries()) {
      const v = a.segments[j].coords;
      vertexPx = Math.max(vertexPx ?? 0, delta(v.slice(0, 2), s.coords.slice(0, 2)), delta(v.slice(-2), s.coords.slice(-2)));
      if (s.type !== "C") continue;
      comparedCubics++;
      handlePx = Math.max(handlePx ?? 0, delta(v.slice(2, 6), s.coords.slice(2, 6)));
      const error = delta(v, s.coords); // Start, control 1, control 2, end: largest absolute x/y delta.
      if (cubicPx === null || error > cubicPx) {
        const k = v.findIndex((n, k) => Math.abs(n - s.coords[k]) === error);
        worstCubic = { part: i + 1, segment: j + 1, coordinate: ["startX","startY","c1X","c1Y","c2X","c2Y","endX","endY"][k],
          actual: v[k], native: s.coords[k] };
        cubicPx = error;
      }
    }
  }
  return { passed: !issues.length && comparedCubics > 0 && Math.max(pagePx, boundsPx, vertexPx, cubicPx) <= tolerancePx,
    pagePx, boundsPx, vertexPx, handlePx, cubicPx, comparedCubics, worstCubic, issues };
}

async function selfTest(page) {
  const shape = (d, width = 40) => '<svg width="' + width + '" height="30"><path stroke="blue" fill="none" d="' + d + '"/></svg>';
  const raw = "M2 15C4 10 8 10 10 15L2 15Z M25 8L30 8";
  const ref = await capture(page, shape(raw));
  const check = async (d, passed, width) => assert.equal(compare(await capture(page, shape(d, width)), ref).passed, passed, d);
  await check("m2 15 l0 0 c2-5 6-5 8 0z m0 0 M25 8h5", true);
  await check(raw.replace("4 10", "5 10"), false); // Same bounding box and endpoints, wrong control.
  await check(raw.replace("Z ", " "), false);
  await check(raw.replace("M25", "L25"), false);
  await check("M25 8L30 8 M2 15C4 10 8 10 10 15L2 15Z", false); // Same ink, swapped subpaths.
  await check(raw.replace("L2 15Z", "L12 15L2 15Z"), false); // A backtracking line is not an empty line.
  const shifted = await capture(page, shape(raw).replace("<path", '<path transform="translate(.2 0)"'));
  assert.equal(compare(shifted, ref).passed, false);
  await check(raw, false, 41);
  console.log("Passed browser controls for equivalent PDF commands, handles, closure, subpath breaks, position and page size.");
}

async function audit(page, root, browser) {
  const audit = await json(join(root, "browser-audit.json")), summary = await json(join(root, "summary.json"));
  const fixtures = await json(new URL("manifest.json", fixtureDir));
  assert.deepEqual(audit.errors, [], "Browser errors");
  const ids = new Set(audit.cases.map(c => c.id));
  assert.equal(ids.size, audit.cases.length, "Duplicate capture IDs");
  assert.ok(audit.cases.every(c => fixtures.cases.some(f => f.id === c.id)), "Unexpected fixture in audit");
  const missing = fixtures.cases.filter(c => !ids.has(c.id)).map(c => c.id);
  const rows = [];
  for (const fixture of fixtures.cases) {
    if (!ids.has(fixture.id)) continue;
    const { id } = fixture, entry = audit.cases.find(c => c.id === id), source = summary.cases.find(c => c.id === id);
    assert.deepEqual(entry.diagnostics, [], id + ": workbench diagnostics");
    assert.deepEqual(source?.diagnostics, [], id + ": render diagnostics");
    assert.ok(source.referenceKind === "tikztosvg" && source.tikztosvgStatus === "rendered" &&
      source.referenceProvenance?.tools?.kind === "local-tools", id + ": missing local native reference");
    assert.equal(source.fingerprints.sourceSha256, sha256(await readFile(new URL(fixture.source, fixtureDir))), id + ": stale fixture");
    const images = [];
    for (const [i, title] of titles.entries()) {
      const panels = entry.panels.filter(p => p.title === title);
      assert.equal(panels.length, 1, id + ": expected one " + title + " SVG");
      const svg = await readFile(join(root, panels[0].svg), "utf8");
      if (i !== 0) assert.equal(sha256(svg), source.fingerprints.artifacts[i === 1 ? "tikztosvgSvg" : "tikzkitSvg"], id + ": stale " + title);
      images.push(await capture(page, svg));
    }
    const native = images[1];
    assert.equal(topology(native), nativeTopology[id.slice("round-".length)], id + ": unexpected native topology");
    rows.push({ id, native: describe(native), comparisons: [0, 2].map(i =>
      ({ panel: titles[i], actual: describe(images[i]), ...compare(images[i], native) })) });
  }
  const comparisons = rows.flatMap(r => r.comparisons);
  return { browser, coordinates: "Intrinsic page CSS pixels; absolute x/y, unclipped path bounds; no alignment or fitting",
    tolerancePx, missing, passed: !missing.length && comparisons.length > 0 && comparisons.every(r => r.passed), rows };
}

const [root, modulePath, option] = process.argv.slice(2);
assert.ok(root && modulePath && (!option || option === "--json"), "Usage: node scripts/audit-rounded-corner-geometry.mjs <audit-directory|--self-test> <playwright/index.mjs> [--json]");
const { chromium } = await import(pathToFileURL(resolve(modulePath)).href);
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-blink-features=SVGPathDataAPI"] });
try {
  const page = await browser.newPage({ viewport: { width: 1800, height: 1600 }, deviceScaleFactor: 1, offline: true });
  if (root === "--self-test") await selfTest(page);
  else {
    const report = await audit(page, root, browser.version());
    if (option === "--json") console.log(JSON.stringify(report, null, 2));
    else {
      if (report.missing.length) console.log("Missing browser captures: " + report.missing.join(", "));
      const fmt = n => n === null ? "n/a" : n.toFixed(5);
      for (const { id, native, comparisons } of report.rows) for (const r of comparisons)
        console.log([r.passed ? "PASS" : "FAIL", id, r.panel, r.actual.topology + " vs " + native.topology,
          "cubics " + r.comparedCubics + "/" + native.cubics + " max " + fmt(r.cubicPx),
          "handles " + fmt(r.handlePx), "vertices " + fmt(r.vertexPx), "bounds " + fmt(r.boundsPx), "page " + fmt(r.pagePx), ...r.issues].join(" | "));
      const all = report.rows.flatMap(r => r.comparisons);
      console.log(all.filter(r => r.passed).length + "/" + all.length + " measured panels passed at " + tolerancePx +
        " CSS px; " + report.missing.length + " missing fixture(s).");
    }
    if (!report.passed) process.exitCode = 1;
  }
} finally { await browser.close(); }
