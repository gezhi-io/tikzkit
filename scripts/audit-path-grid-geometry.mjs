import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [root, modulePath] = process.argv.slice(2);
assert.ok(root && modulePath, "Usage: node scripts/audit-path-grid-geometry.mjs <browser audit directory | --self-test> <playwright entry>");
const titles = ["Live workbench JS", "Local tikztosvg", "After SVG-text"];
// Include the baseline, path continuations and the two cycle diagonals.
// grid-stroke has seven blue rails, six red rails, and one straight arrow shaft.
const nativeCounts = { "grid-manual-basis": 13, "grid-manual-polar": 8, "grid-one-direction": 12,
  "grid-local-steps": 23, "grid-affine": 15, "grid-limit": 9, "grid-cycle": 17, "grid-stroke": 14 };
const tolerancePx = 0.12;

// Runs inside Chrome. Its own path parser expands implicit/repeated coordinates,
// relative moves, H/V and arcs. A close or a curve affects only its own subpath.
async function measure(scope) {
  await document.fonts.ready;
  const svg = document.querySelector("body > svg");
  if (!svg) throw new Error("No root SVG");
  const box = svg.getBoundingClientRect();
  const pageBox = [box.left, box.top, box.right, box.bottom];
  const segments = [], counts = { strokes: 0, fillStrips: 0, skippedClosed: 0, curves: 0, clippedOut: 0 };
  if (scope === "image") return { pageBox, segments, counts };
  const probe = document.createElementNS(svg.namespaceURI, "path");
  if (!probe.getPathData) throw new Error("This audit needs Chrome with SVGPathDataAPI");
  const screen = (m, [x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
  const length = a => Math.hypot(...a);
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  function subpaths(el) {
    if (el.localName !== "path") {
      let points, closed = false;
      if (el.localName === "line") {
        const v = key => el[key].animVal.value;
        points = [[v("x1"), v("y1")], [v("x2"), v("y2")]];
      } else if (el.localName === "rect") {
        const cs = getComputedStyle(el), b = el.getBBox();
        if (parseFloat(cs.rx) > 0 || parseFloat(cs.ry) > 0) return [];
        points = rect(b.x, b.y, b.width, b.height); closed = true;
      } else if (el.animatedPoints) {
        points = Array.from(el.animatedPoints, p => [p.x, p.y]); closed = el.localName === "polygon";
      } else return [];
      return [{ points, closed, lines: points.slice(1).map((p, i) => [points[i], p]), curved: false }];
    }
    const d = getComputedStyle(el).d;
    if (d === "none") return [];
    const path = /^path\("([^"]*)"\)$/.exec(d);
    if (!path) throw new Error("Unrecognized computed SVG path: " + d.slice(0, 80));
    probe.setAttribute("d", path[1]);
    const parts = [];
    let part, current;
    function start(p) { part = { points: [p], lines: [], curved: false, closed: false }; parts.push(part); current = p; }
    for (const { type, values } of probe.getPathData({ normalize: true })) {
      if (type === "M") { start(values); continue; }
      if (!part) start(current); // Drawing may resume at the previous moveto after Z.
      if (type === "Z") { part.closed = true; current = part.points[0]; part = null; continue; }
      const end = values.slice(-2);
      if (type === "L") part.lines.push([current, end]);
      else if (type === "C") part.curved = true;
      else throw new Error("Unexpected normalized path command: " + type);
      part.points.push(end); current = end;
    }
    return parts.filter(p => p.points.length > 1);
  }
  function vertices(points) {
    const v = points.filter((p, i) => !i || length(sub(p, points[i - 1])) > 1e-7);
    if (v.length > 1 && length(sub(v[0], v.at(-1))) < 1e-7) v.pop();
    return v;
  }
  // Cairo sometimes represents a butt stroke as a filled strip. Compare its
  // centreline and perpendicular thickness, never the four edges as four rails.
  function filledStrip(points) {
    let v = vertices(points);
    if (v.length !== 4) return;
    if (length(sub(v[1], v[0])) < length(sub(v[2], v[1]))) v = [...v.slice(1), v[0]];
    const [a, b, c, d] = v, along = sub(b, a), across = sub(d, a);
    if (length(along) < 4 * length(across) || length(sub(along, sub(c, d))) > 0.01) return;
    const pen = Math.abs(cross(along, across)) / length(along);
    if (pen > 0) return { a: mid(a, d), b: mid(b, c), pen };
  }
  // Only single convex user-space clips are needed for these native fixtures.
  // Intersect their actual half-planes; measuring unclipped d can pass invisible ink.
  const transforms = el => Array.from(el.transform.baseVal).reduce((m, t) => m.multiply(t.matrix), new DOMMatrix());
  function clipPolygon(owner, value) {
    const id = /#([^"')]+)["']?\)$/.exec(value)?.[1], clip = id && document.getElementById(id);
    if (clip?.localName !== "clipPath" || clip.children.length !== 1 || clip.clipPathUnits.baseVal !== 1)
      throw new Error("Unsupported grid clip: " + value);
    const child = clip.firstElementChild, parts = subpaths(child);
    if (parts.length !== 1 || parts[0].curved) throw new Error("Unsupported grid clip shape: " + id);
    const m = DOMMatrix.fromMatrix(owner.getScreenCTM()).multiply(transforms(clip)).multiply(transforms(child));
    const v = vertices(parts[0].points.map(p => screen(m, p)));
    const turns = v.map((p, i) => cross(sub(v[(i + 1) % v.length], p), sub(v[(i + 2) % v.length], v[(i + 1) % v.length])));
    if (v.length < 3 || !turns.some(t => t !== 0) || (turns.some(t => t > 0) && turns.some(t => t < 0)))
      throw new Error("Non-convex or degenerate grid clip: " + id);
    return turns.some(t => t > 0) ? v : v.reverse();
  }
  function trim(a, b, polygons) {
    let lo = 0, hi = 1;
    for (const polygon of polygons) for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i], edge = sub(polygon[(i + 1) % polygon.length], p);
      const u = cross(edge, sub(a, p)), v = cross(edge, sub(b, p));
      if (u < 0 && v < 0) return;
      if (u < 0) lo = Math.max(lo, u / (u - v));
      if (v < 0) hi = Math.min(hi, u / (u - v));
    }
    const at = t => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    if (lo < hi) return [at(lo), at(hi)];
  }
  function paint(color, alpha) {
    if (color === "none" || alpha === 0) return null;
    const rgb = /^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)$/.exec(color);
    if (!rgb) return { color, opacity: alpha }; // Reject unsupported paint only if it contributes a grid segment.
    const opacity = alpha * Number(rgb[4] ?? 1);
    return opacity > 0 ? { color: `rgb(${rgb[1]}, ${rgb[2]}, ${rgb[3]})`, opacity } : null;
  }
  for (const el of svg.querySelectorAll("path,line,polyline,polygon,rect")) {
    if (el.closest("defs,clipPath,mask,marker,pattern,symbol,text,[data-math-layout],[data-text-layout],.tikz-math-native,.tikz-text-native,.tikz-text-engine-cache")) continue;
    const cs = getComputedStyle(el), m = el.getScreenCTM();
    if (cs.visibility !== "visible" || !m) continue;
    let alpha = 1, hasEffect = false;
    const clipOwners = [];
    for (let n = el; n instanceof SVGElement; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === "none") { alpha = 0; break; }
      alpha *= Number(s.opacity);
      if (s.clipPath !== "none") clipOwners.push([n, s.clipPath]);
      if (s.maskImage !== "none" || s.filter !== "none") hasEffect = true;
    }
    if (!alpha) continue;
    const fill = paint(cs.fill, alpha * Number(cs.fillOpacity));
    const stroke = parseFloat(cs.strokeWidth) > 0 && paint(cs.stroke, alpha * Number(cs.strokeOpacity));
    if (!stroke && !fill) continue;
    let clips;
    function add(a, b, pen, ink, cap, kind) {
      if (length(sub(b, a)) < 1e-7 || !(pen > 0)) return;
      if (!ink.color.startsWith("rgb(")) throw new Error("Expected a solid sRGB grid pen: " + ink.color);
      if (hasEffect) throw new Error("Masked/filtered grid paint needs whole-image review");
      clips ??= [...(getComputedStyle(svg).overflow === "visible" ? [] : [rect(box.x, box.y, box.width, box.height)]),
        ...clipOwners.map(([n, v]) => clipPolygon(n, v))];
      const ends = trim(a, b, clips);
      if (!ends) { counts.clippedOut++; return; }
      segments.push({ a: ends[0], b: ends[1], pen, ...ink, cap }); counts[kind]++;
    }
    for (const part of subpaths(el)) {
      if (part.curved) counts.curves++;
      if (!part.curved && fill && !stroke) {
        const strip = filledStrip(part.points.map(p => screen(m, p)));
        if (strip) { add(strip.a, strip.b, strip.pen, fill, "butt", "fillStrips"); continue; }
      }
      if (part.closed && (part.curved || fill)) { counts.skippedClosed++; continue; }
      if (!stroke || !part.lines.length) continue;
      if (!cs.strokeWidth.endsWith("px") || cs.strokeDasharray !== "none") throw new Error("Expected a solid grid pen with resolved width");
      const lines = [...part.lines];
      if (part.closed) lines.push([part.points.at(-1), part.points[0]]);
      for (const [p, q] of lines) {
        const a = screen(m, p), b = screen(m, q), span = length(sub(b, a));
        if (!span) continue;
        // Width normal to this particular line under shear or unequal scales.
        const scale = cs.vectorEffect === "non-scaling-stroke" ? 1 : Math.abs(m.a * m.d - m.b * m.c) * length(sub(q, p)) / span;
        add(a, b, parseFloat(cs.strokeWidth) * scale, stroke, cs.strokeLinecap, "strokes");
      }
    }
  }
  return { pageBox, segments, counts };
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function delta(s, t) {
  const endpointPx = Math.min(Math.max(dist(s.a, t.a), dist(s.b, t.b)), Math.max(dist(s.a, t.b), dist(s.b, t.a)));
  return { endpointPx, penPx: Math.abs(s.pen - t.pen),
    paint: s.color === t.color && Math.abs(s.opacity - t.opacity) < 1e-6 && s.cap === t.cap };
}
function compare(actual, ref, expected) {
  const sorted = ss => ss.map(s => s.a[0] > s.b[0] || (s.a[0] === s.b[0] && s.a[1] > s.b[1]) ? { ...s, a: s.b, b: s.a } : s)
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const a = sorted(actual.segments), r = sorted(ref.segments);
  const matrix = a.map(s => r.map(t => delta(s, t)));
  const score = d => Math.max(d.endpointPx, d.penPx);
  const edges = matrix.map(row => row.map((_, j) => j).filter(j => row[j].paint && score(row[j]) < tolerancePx)
    .sort((i, j) => score(row[i]) - score(row[j])));
  // A nearest-first greedy match can steal the only candidate of a later line.
  // An augmenting path consumes each occurrence once, including coincident pens.
  const owner = new Array(r.length).fill(-1);
  function assign(i, seen) {
    for (const j of edges[i]) {
      if (seen.has(j)) continue;
      seen.add(j);
      if (owner[j] === -1 || assign(owner[j], seen)) { owner[j] = i; return true; }
    }
    return false;
  }
  for (let i = 0; i < a.length; i++) assign(i, new Set());
  const pairs = owner.flatMap((i, j) => i < 0 ? [] : [matrix[i][j]]);
  function unmatched(s, others) {
    const nearest = others.map(t => ({ segment: t, ...delta(s, t) }))
      .sort((u, v) => u.endpointPx - v.endpointPx || Number(v.paint) - Number(u.paint) || u.penPx - v.penPx)[0];
    return { segment: s, nearest: nearest ?? null };
  }
  const matchedActual = new Set(owner.filter(i => i >= 0));
  const missing = r.filter((_, j) => owner[j] === -1), unexpected = a.filter((_, i) => !matchedActual.has(i));
  const byColor = Object.fromEntries([...new Set([...r, ...a].map(s => s.color))].sort().map(color => [color, {
    actual: a.filter(s => s.color === color).length, native: r.filter(s => s.color === color).length,
    matched: r.filter((s, j) => s.color === color && owner[j] !== -1).length }]));
  const pageBoxErrorPx = Math.max(...ref.pageBox.map((n, i) => Math.abs(actual.pageBox[i] - n)));
  return { actual: a.length, native: r.length, expectedNative: expected, matched: pairs.length, pageBoxErrorPx,
    maxMatchedEndpointPx: pairs.length ? Math.max(...pairs.map(p => p.endpointPx)) : null,
    maxMatchedPenPx: pairs.length ? Math.max(...pairs.map(p => p.penPx)) : null,
    byColor, missingCount: missing.length, unexpectedCount: unexpected.length,
    missingExamples: missing.slice(0, 8).map(s => unmatched(s, a)),
    unexpectedExamples: unexpected.slice(0, 8).map(s => unmatched(s, r)),
    passed: expected > 0 && r.length === expected && a.length === expected && pairs.length === expected && pageBoxErrorPx < tolerancePx };
}

async function capture(page, svg, scope) {
  await page.setContent('<!doctype html><style>body{margin:0;background:white}body>svg{display:block}</style>' + svg);
  const result = await page.evaluate(measure, scope);
  const width = Math.max(1, Math.ceil(result.pageBox[2])), height = Math.max(1, Math.ceil(result.pageBox[3]));
  const png = await page.screenshot({ clip: { x: 0, y: 0, width, height }, scale: "css" });
  return { ...result, png: png.toString("base64") };
}

// The blue grid has thick, translucent rails. Well inside a crossing, one
// compound stroke paints once; independent overlapping strokes darken the pixel.
function crossings(segments) {
  const result = [];
  const minus = (p, q) => [p[0] - q[0], p[1] - q[1]], cross = (p, q) => p[0] * q[1] - p[1] * q[0];
  for (let i = 0; i < segments.length; i++) for (const t of segments.slice(i + 1)) {
    const s = segments[i], u = minus(s.b, s.a), v = minus(t.b, t.a), den = cross(u, v);
    if (!den || Math.min(s.pen, t.pen) < 3) continue;
    const d = minus(t.a, s.a), k = cross(d, v) / den, l = cross(d, u) / den;
    if (Math.min(k, 1 - k) * Math.hypot(...u) > 2 && Math.min(l, 1 - l) * Math.hypot(...v) > 2)
      result.push([Math.floor(s.a[0] + k * u[0]), Math.floor(s.a[1] + k * u[1])]);
  }
  return result;
}
async function wholeImage(page, actual, ref, probes = []) {
  return page.evaluate(async ({ pngs, probes }) => {
    const images = await Promise.all(pngs.map(async data => {
      const img = new Image(); img.src = "data:image/png;base64," + data; await img.decode(); return img;
    }));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(...images.map(i => i.width)); canvas.height = Math.max(...images.map(i => i.height));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const [a, b] = images.map(img => {
      ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0);
      return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    });
    let actualInk = 0, nativeInk = 0, union = 0, different = 0, sum = 0, maxChannelError = 0;
    for (let i = 0; i < a.length; i += 4) {
      const dark = data => data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255;
      const ai = dark(a), bi = dark(b);
      actualInk += +ai; nativeInk += +bi; union += +(ai || bi);
      let max = 0;
      for (let k = i; k < i + 3; k++) { const e = Math.abs(a[k] - b[k]); sum += e; max = Math.max(max, e); }
      different += +(max > 0); maxChannelError = Math.max(maxChannelError, max);
    }
    const crossingPixels = probes.map(([x, y]) => {
      const rgb = data => Array.from(data.slice(4 * (y * canvas.width + x), 4 * (y * canvas.width + x) + 3));
      const actual = rgb(a), native = rgb(b);
      return { x, y, actual, native, maxChannelError: Math.max(...actual.map((n, i) => Math.abs(n - native[i]))) };
    });
    return { actualInk, nativeInk, differentPixels: different, unionInkPixels: union, maxChannelError, pixelIdentical: different === 0,
      meanAbsRGB8OnInk: union ? sum / (3 * union) : null, nonblank: actualInk > 0 && nativeInk > 0, crossingPixels };
  }, { pngs: [actual.png, ref.png], probes });
}

async function selfTest(page) {
  const wrap = (body, style = "") => `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60" style="${style}">${body}</svg>`;
  const path = (d, style = "") => `<path fill="none" stroke="blue" d="${d}" ${style}/>`;
  let checks = 0;
  const check = async (label, a, b, n, pass, scope = "all") => {
    checks++;
    const actual = await capture(page, a, scope), ref = await capture(page, b, scope);
    const geometry = compare(actual, ref, n);
    assert.equal(geometry.passed, pass, label + ": " + JSON.stringify(geometry));
    return wholeImage(page, actual, ref, scope === "stroke" ? crossings(ref.segments) : []);
  };
  const split = wrap(path("M30 12H10") + path("M20 28V8"));
  const compound = wrap(path("m10 12 20 0 m-10-4v20"));
  await check("compound, shuffled and reversed", split, compound, 2, true);
  const excluded = '<defs><path id="glyph" d="M0 0H35" stroke="black"/></defs><use href="#glyph"/>' +
    '<g class="tikz-text-native"><path d="M2 30h15" stroke="red"/></g>' +
    '<g display="none"><path d="M0 6H20" stroke="red"/></g><path fill="red" d="M1 1h5v5h-5z"/>';
  await check("ignore glyphs/closed fill/curve but preserve later straight operations",
    wrap(excluded + path("M2 40q5-5 10 0 l5 0M10 12h20")), wrap(path("M17 40h-5M30 12h-20")), 2, true);
  await check("affine pen and filled strip", wrap('<path fill="blue" d="m10 9h40v2H10z m0 0"/>'),
    wrap(path("M5 5h20", 'transform="scale(2 2)"')), 1, true);
  await check("packed filled rectangles vs line and polyline", wrap('<path fill="blue" d="m10 9.5h40v1h-40z m27 5h1v20h-1z"/>'),
    wrap('<line x1="50" y1="10" x2="10" y2="10" stroke="blue"/><polyline points="37.5,34.5 37.5,14.5" stroke="blue"/>'), 2, true);
  await check("unequal scales", wrap(path("M10 15H40", 'stroke-width="3"') + path("M20 6V30", 'stroke-width="2"')),
    wrap(path("M5 5H20 M10 2V10", 'transform="scale(2 3)"')), 2, true);
  await check("non-scaling pen", wrap(path("M10 15h40")),
    wrap(path("M5 5h20", 'transform="scale(2 3)" vector-effect="non-scaling-stroke"')), 1, true);
  const lines = ys => wrap(ys.map(y => path(`M10 ${y}h30`)).join(""));
  await check("ambiguous neighbors, not greedy", lines([10.07, 10.18]), lines([10, 10.12]), 2, true);
  await check("legitimate coincident occurrences", lines([10, 11, 10]), lines([10, 10, 11]), 3, true);
  await check("missing duplicate", lines([10]), lines([10, 10]), 2, false);
  await check("compensating missing/extra duplicate", lines([10, 11, 11]), lines([10, 10, 11]), 3, false);
  await check("page offset", wrap(path("M10 12h20"), "margin-left:.25px"), wrap(path("M10 12h20")), 1, false);
  await check("shift within same page", lines([10.2]), lines([10]), 1, false);
  await check("wrong pen", wrap(path("M10 12h20", 'stroke-width="1.2"')), wrap(path("M10 12h20")), 1, false);
  await check("wrong color", wrap(path("M10 12h20", 'style="stroke:red"')), wrap(path("M10 12h20")), 1, false);
  await check("wrong opacity", wrap(path("M10 12h20", 'opacity=".401"')), wrap(path("M10 12h20", 'opacity=".4"')), 1, false);
  await check("scaled viewBox with unchanged page dimensions", wrap(path("M10 12h20")).replace("<svg ", '<svg viewBox="0 0 40 30" '),
    wrap(path("M10 12h20")), 1, false);
  await check("close edge and subsequent relative move", wrap(path("M10 10h10v10z m25 0h10")),
    wrap(path("M10 10L20 20V10H10 M45 10H35")), 4, true);
  const clip = '<defs><clipPath id="c"><rect x="20" width="20" height="20"/></clipPath></defs>';
  await check("clipped ink", wrap(clip + path("M5 10h30M5 8h4", 'clip-path="url(#c)"')), wrap(path("M20 10h15")), 1, true);
  const blank = wrap(path("M10 12h20", 'stroke-opacity="0"'));
  assert.equal((await check("blank vs blank", blank, blank, 1, false)).nonblank, false);
  const thick = d => path(d, 'stroke-width="5" stroke-opacity=".4"');
  const topology = await check("alpha overdraw", wrap(thick("M10 20h40") + thick("M30 5v30")),
    wrap(thick("M10 20h40M30 5v30")), 2, true, "stroke");
  assert.ok(topology.crossingPixels.some(p => p.maxChannelError > 40), "overdraw must be visible in Chrome pixels");
  console.log(`Path grid self-test passed (${checks} positive/negative Chrome controls).`);
}

async function audit(page, browserVersion) {
  const manifest = JSON.parse(await readFile(join(root, "browser-audit.json"), "utf8"));
  assert.ok(Array.isArray(manifest.cases) && Array.isArray(manifest.errors), "Invalid browser audit manifest");
  const report = { browser: browserVersion, tolerancePx, reference: titles[1], coordinates: "Page CSS pixels at intrinsic SVG size; no alignment or fitting",
    raster: "White page at 1 CSS px per pixel, top-left origin. RGB8 difference on union of ink is supplemental, not a geometry tolerance.",
    errors: [...manifest.errors], cases: [] };
  const ids = new Set(manifest.cases.map(c => c.id));
  for (const id of [...Object.keys(nativeCounts), "grid-demo"]) if (!ids.has(id)) report.errors.push("Missing fixture: " + id);
  if (ids.size !== manifest.cases.length) report.errors.push("Duplicate fixture IDs");
  for (const entry of manifest.cases) {
    const id = entry.id, scope = id === "grid-stroke" ? "stroke" : Object.hasOwn(nativeCounts, id) ? "all" : "image";
    const row = { id, scope: scope === "image" ? "whole image only" : scope === "stroke" ? "blue and red rails, straight arrow shaft, blue crossing pixels and whole image" : "all straight segments",
      panels: {}, comparisons: [] };
    report.cases.push(row);
    if (entry.diagnostics?.length) report.errors.push(id + ": workbench diagnostics: " + JSON.stringify(entry.diagnostics));
    try {
      const captures = [];
      for (const title of titles) {
        const panels = entry.panels.filter(p => p.title === title);
        assert.ok(panels.length === 1 && panels[0].svg, `Expected one ${title} SVG`);
        const c = await capture(page, await readFile(join(root, panels[0].svg), "utf8"), scope);
        captures.push(c);
        row.panels[title] = { svg: panels[0].svg, pageBox: c.pageBox, ...(scope !== "image" ? { segments: c.segments.length, ...c.counts } : {}) };
      }
      const ref = captures[1], probes = scope === "stroke" ? crossings(ref.segments.filter(s => s.color === "rgb(0, 0, 255)")) : [];
      for (const i of [0, 2]) {
        const geometry = scope === "image" ? undefined : compare(captures[i], ref, nativeCounts[id]);
        const image = await wholeImage(page, captures[i], ref, probes);
        const crossingPaintPassed = scope === "stroke" ? image.crossingPixels.length === 2 &&
          image.crossingPixels.every(p => p.maxChannelError <= 1 && [153, 153, 255].every((n, k) => Math.abs(p.native[k] - n) <= 1)) : undefined;
        row.comparisons.push({ panel: titles[i], geometry, image, crossingPaintPassed,
          passed: geometry ? image.nonblank && geometry.passed && crossingPaintPassed !== false : undefined });
      }
    } catch (error) { report.errors.push(id + ": " + error.message); }
  }
  const rows = report.cases.flatMap(c => c.comparisons), exact = rows.filter(r => r.geometry);
  const file = join(root, "path-grid-geometry.json");
  await writeFile(file, JSON.stringify(report, null, 2) + "\n");
  console.log(`${exact.filter(r => r.geometry.passed).length}/${exact.length} geometry comparisons within ${tolerancePx} CSS px; ` +
    `${rows.filter(r => r.crossingPaintPassed === false).length} crossing-paint failures; ${report.errors.length} audit errors. ${file}`);
  if (report.errors.length || rows.some(r => !r.image.nonblank || r.passed === false)) process.exitCode = 1;
}

const { chromium } = await import(pathToFileURL(resolve(modulePath)).href);
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-blink-features=SVGPathDataAPI"] });
try {
  const page = await browser.newPage({ viewport: { width: 1800, height: 1600 }, deviceScaleFactor: 1, offline: true });
  if (root === "--self-test") await selfTest(page);
  else await audit(page, browser.version());
} finally { await browser.close(); }
