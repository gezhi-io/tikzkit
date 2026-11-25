import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { tikzToSvg } from "../src/index.js";

// pgfcorelayers.code.tex: \pgfonlayer emits .4pt BEFORE opening/appending its
// hbox; \pgf@dolayer saves/restores the WHOLE background at shipout. In
// tikzlibrarybackgrounds.code.tex the begin-scope hook selects the box, then
// executes every on background layer followed by the inline argument.
// Neither source rule specifies the actual ink. That comes from the PDF oracle.
// Only explicit background/main painting; no custom layer lists, frame hooks,
// nested pictures, blend modes, or general driver/color-stack emulation.
// Live check: TIKZKIT_TEST_PDFLATEX=1 node --test test/background-scope-native.test.js
// Refresh: python3 test/fixtures/native-background-scope-tests/measure.py --record
const dir = new URL("./fixtures/native-background-scope-tests/", import.meta.url);
const fixture = file => new URL(file, dir);
const stored = JSON.parse(readFileSync(fixture("texlive-2025.json"), "utf8"));
const descriptions = {
  "paint-order": "overlapping marks retain their order within background and main",
  "color-stack": "plain ink and an explicit TeX current color differ across the switch",
  "shorthand-color": "bare color pops at box end; a backend pen need not pop with it",
  reentry: "disjoint boxes share split ink, width, dash, cap, join and channel alpha",
  nested: "same-layer TikZ scopes restore the pen; same-layer raw groups do not",
  "raw-main-pen": "raw entry resets the source pen, within its actual graphics scope",
  "raw-primitive": "bare pgfonlayer and endpgfonlayer keep their paint and reset the source pen",
  "every-inline": "picture basis survives; every-layer style precedes inline args and skips raw entry",
  "every-path": "inherited every path can add a stroke to a fill and override the layer pen",
  "transforms-clips": "coordinate and canvas matrices, parent and re-entered clips are distinct",
  "canvas-reentry": "background canvas translation persists; ordinary coordinate shifts are local",
  "bounds-pens": "the bounding-box diagonal uses the TeX pen, even when the PDF uses a wider pen",
  "bounds-clips": "background ink can escape a main clip without contributing to picture bounds"
};
const source = id => readFileSync(fixture(id + ".tex"), "utf8");
const cmToPt = 72.27 / 2.54, unit = 100, svgToPt = cmToPt / unit;
// PGF rounds when emitting bp, and PDF page coordinates are single precision in MuPDF.
const near = (a, b, eps = .008) => Math.abs(a - b) < eps;
const nearList = (a, b, eps) => a.length === b.length && a.every((n, i) => near(n, b[i], eps));
const samePoint = (a, b) => nearList(a, b);

function samePath(a, b) {
  if (a.length !== b.length || !a.length) return false;
  if (a.every((pt, i) => samePoint(pt, b[i]))) return true;
  if (!samePoint(a[0], a.at(-1)) || !samePoint(b[0], b.at(-1))) return false;
  // MuPDF can simplify a closed rectangle into one "re" with a different start corner.
  const n = b.length - 1;
  return [b.slice(0, n), b.slice(0, n).reverse()].some(loop =>
    loop.some((_, start) => a.slice(0, n).every((p, i) => samePoint(p, loop[(start + i) % n]))));
}

function points(commands) {
  const pts = [];
  for (const c of commands) {
    if (c.type === "closePath") pts.push(pts[0]);
    else {
      assert.ok(c.type === "lineTo" || (c.type === "moveTo" && !pts.length), c.type);
      pts.push([c.x * cmToPt, c.y * cmToPt]);
    }
  }
  return pts;
}

function color(value) {
  if (value === "none" || value === undefined) return undefined;
  const named = { black: "#000000", white: "#ffffff", red: "#ff0000", blue: "#0000ff",
    green: "#008000", lime: "#00ff00" };
  if (named[value]) return named[value];
  if (/^#[\da-f]{6}$/i.test(value)) return value.toLowerCase();
  if (/^#[\da-f]{3}$/i.test(value)) return "#" + [...value.slice(1)].map(c => c + c).join("").toLowerCase();
  const rgb = value.match(/^rgb\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)\s*\)$/);
  assert.ok(rgb, "unrecognized SVG paint " + value);
  return "#" + rgb.slice(1).map(n => (+n).toString(16).padStart(2, "0")).join("");
}

function picture(id) {
  const { ir, svg, diagnostics } = tikzToSvg("\\usetikzlibrary{backgrounds}\n" + source(id), { unit, margin: 0 });
  // Use the public path/clip commands for geometry and the emitted SVG for ink.
  // Definition paths have no explicit stroke/fill in these plain line/rectangle probes.
  const attrs = [...svg.matchAll(/<path\b([^>]*)>/g)]
    .map(tag => Object.fromEntries([...tag[1].matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v])))
    .filter(a => color(a.stroke) || color(a.fill));
  const items = ir.items.filter(i => i.type === "path" && [i.style.stroke, i.style.fill].some(v => v && v !== "none"));
  assert.equal(attrs.length, items.length, id + ": painted SVG paths versus scene paths");
  const paint = items.map((item, i) => {
    const a = attrs[i], stroke = color(a.stroke), fill = color(a.fill), alpha = Number(a.opacity ?? 1);
    const row = { pathPt: points(item.commands), stroke, fill };
    if (fill) row.fillAlpha = alpha * Number(a["fill-opacity"] ?? 1);
    if (stroke) Object.assign(row, {
      strokeAlpha: alpha * Number(a["stroke-opacity"] ?? 1),
      penPt: Number(a["stroke-width"]) * svgToPt,
      dashPt: a["stroke-dasharray"] && a["stroke-dasharray"] !== "none"
        ? a["stroke-dasharray"].trim().split(/[ ,]+/).map(n => Number(n) * svgToPt) : [],
      phasePt: Number(a["stroke-dashoffset"] ?? 0) * svgToPt,
      cap: a["stroke-linecap"] ?? "butt", join: a["stroke-linejoin"] ?? "miter"
    });
    if (item.scopeClips) row.clipsPt = item.scopeClips.map(c => points(c.commands));
    return row;
  });
  const [x, y, w, h] = svg.match(/\bviewBox="([^"]+)"/)[1].split(/\s+/).map(n => Number(n) * svgToPt);
  return { paint, boxPt: [x, -(y + h), x + w, -y], diagnostics };
}

function assertPicture(id, actual, expected, native = false) {
  const errors = [], show = v => JSON.stringify(v, (_, n) => typeof n === "number" ? +n.toFixed(3) : n) ?? "none";
  if (actual.diagnostics?.length) errors.push("diagnostics: " + show(actual.diagnostics));
  if (!nearList(actual.boxPt, expected.boxPt)) errors.push("picture box: " +
    show(actual.boxPt) + ", native " + show(expected.boxPt) + " pt");
  if (actual.paint.length !== expected.paint.length) errors.push(
    "paint count: " + actual.paint.length + ", native " + expected.paint.length);
  for (const [i, b] of expected.paint.entries()) {
    const a = actual.paint[i];
    if (!a) break;
    const differences = [];
    const diff = (key, equal) => {
      if (!equal) differences.push(key + ": " + show(a[key]) + ", native " + show(b[key]));
    };
    diff("pathPt", samePath(a.pathPt, b.pathPt));
    for (const key of ["stroke", "fill", ...(native ? ["layer"] : [])]) diff(key, a[key] === b[key]);
    if (b.fill && a.fill) diff("fillAlpha", near(a.fillAlpha, b.fillAlpha, .001));
    if (b.stroke && a.stroke) {
      for (const key of ["penPt", "phasePt", "strokeAlpha", ...(native ? ["texPenPt"] : [])]) {
        diff(key, near(a[key], b[key], .002));
      }
      diff("dashPt", nearList(a.dashPt, b.dashPt, .002));
      for (const key of ["cap", "join"]) diff(key, a[key] === b[key]);
    }
    const ac = a.clipsPt ?? [], bc = b.clipsPt ?? [];
    diff("clipsPt", ac.length === bc.length && ac.every((p, j) => samePath(p, bc[j])));
    if (differences.length) errors.push("paint " + (i + 1) + " (" + b.layer + " at " + b.pathPt[0] +
      (b.stroke ? ", PDF/TeX pen " + b.penPt + "/" + b.texPenPt + " pt" : "") + "): " + differences.join("; "));
  }
  assert.ok(errors.length === 0, id + ":\n" + errors.join("\n"));
}

test("native background scope references cover the exact TeX inputs", () => {
  const ids = Object.keys(descriptions).sort();
  assert.deepEqual(Object.keys(stored.cases).sort(), ids);
  assert.deepEqual(readdirSync(dir).filter(f => f.endsWith(".tex")).sort(), ids.map(id => id + ".tex"));
  for (const id of ids) assert.equal(createHash("sha256").update(source(id)).digest("hex"),
    stored.cases[id].sha256, id + ": changed TeX input; remeasure with measure.py --record");
});

if (process.env.TIKZKIT_TEST_PDFLATEX === "1") {
  test("live pdflatex background paint and TeX box trace reproduce the stored oracle", () => {
    const live = JSON.parse(execFileSync("python3", [fileURLToPath(fixture("measure.py"))],
      { encoding: "utf8", timeout: 60000 }));
    for (const [id, expected] of Object.entries(stored.cases)) {
      assertPicture(id, live.cases[id], expected, true);
      assert.deepEqual(live.cases[id].pixelsPtRGB, expected.pixelsPtRGB, id + ": native raster ink at probe points");
    }
  });
}

for (const [id, title] of Object.entries(descriptions)) {
  test("native background: " + title, () => assertPicture(id, picture(id), stored.cases[id]));
}
