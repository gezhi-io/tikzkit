import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const optional = { skip: process.env.TIKZKIT_TEST_PDFLATEX !== "1" };
const ptPerCm = 72.27 / 2.54;
const tolerance = .025; // TeX pt, including PGF's fixed-point projection.
const preamble = String.raw`\usepackage{pgfplots}\pgfplotsset{compat=1.18}`;
const probe = new URL("./fixtures/pgfplots-matrix-native-probe.tex", import.meta.url);

const rect = "coordinates {(4,10)[0] (6,10)[1] (8,10)[2] (4,14)[3] (6,14)[4] (8,14)[5]}";
const byColumn = "coordinates {(4,10)[0] (4,14)[3] (6,10)[1] (6,14)[4] (8,10)[2] (8,14)[5]}";
const unequal = `coordinates {(1,0)[0] (3,0)[1] (9,0)[2]
  (1,2)[3] (3,2)[4] (9,2)[5] (1,8)[6] (3,8)[7] (9,8)[8]}`;
// Same centers as the PGFPlots manual's distorted matrix example.
const skew = `table {
x y
0 0
1 -0.1
2 0.2

-0.2 1
1 1
2 1

0 2
1.3 2
2 2.5
}`;
const nanMeta = `coordinates {(0,0)[0] (1,0)[1] (2,0)[2]
  (0,1)[3] (1,1)[nan] (2,1)[5] (0,2)[6] (1,2)[7] (2,2)[8]}`;
const emptyColor = `coordinates {(0,0)[color=red] (1,0)[color=blue] (2,0)[color=yellow]
  (0,1)[color=black] (1,1)[] (2,1)[color=magenta]
  (0,2)[color=green] (1,2)[color=red] (2,2)[color=white]}`;

const bottomLeft = "axis x line*=bottom,axis y line*=left";
const topRight = "axis x line*=top,axis y line*=right";
const cases = [
  { id: "rect-box" },
  { id: "star-box", key: "matrix plot*" },
  { id: "rect-edge", axis: bottomLeft },
  { id: "reverse-edge", key: "matrix plot*", axis: "x dir=reverse,y dir=reverse," + bottomLeft },
  { id: "reverse-opposite-edge", key: "matrix plot*", axis: "x dir=reverse,y dir=reverse," + topRight },
  { id: "arrowed-reverse-edge", key: "matrix plot*", arrowed: true,
    axis: "axis lines=left,x dir=reverse,y dir=reverse,allow reversal of rel axis cs=false" },
  { id: "shifted-star", key: "matrix plot*", axis: "at={(13pt,-6pt)},anchor=south west,x dir=reverse" },
  { id: "column-scan", key: "matrix plot*", data: byColumn, mesh: "mesh/ordering=y varies,mesh/rows=2" },
  { id: "nonuniform", data: unequal, x: [1,9], y: [0,8], count: 9 },
  { id: "manual-skew", data: skew, meta: String.raw`point meta=\coordindex`, x: [0,2], y: [0,2], count: 9 },
  { id: "nan-center", data: nanMeta, x: [0,2], y: [0,2], marks: true, count: 8 },
  { id: "empty-color-center", data: emptyColor, meta: "mesh/color input=explicit",
    x: [0,2], y: [0,2], marks: true, count: 8 }
];

function picture(c, native) {
  const x = c.x ?? [4,8], y = c.y ?? [10,14];
  const axis = ["name=frame,scale only axis,width=120pt,height=80pt,enlargelimits=false",
    `xtick={${x}},ytick={${y}},xticklabels={XL,XH},yticklabels={YL,YH}`, c.axis,
    native && String.raw`axis line style={/tikz/mx role=spine},x tick style={/tikz/mx role=xtick},y tick style={/tikz/mx role=ytick},
    x tick label style={name=xlabel\ticknum},y tick label style={name=ylabel\ticknum}`
  ].filter(Boolean).join(",");
  const plot = [c.key ?? "matrix plot", c.mesh ?? "mesh/cols=3", c.meta ?? "point meta=explicit",
    c.marks && String.raw`mark=*,nodes near coords=\coordindex`,
    c.marks && native && String.raw`nodes near coords style={name=mxidx\coordindex,/tikz/execute at begin node={\mxwrite{node|\coordindex}}}`
  ].filter(Boolean).join(",");
  const labelGauges = ["x", "y"].flatMap(k => [0,1].map(i =>
    String.raw`\mxgauge{${k}${i}}{\pgfpointanchor{${k}label${i}}{center}}`)).join("\n");
  const nodeGauges = c.marks ? Array.from({ length:9 }, (_, i) =>
    String.raw`\mxgauge{n${i}}{\pgfpointanchor{mxidx${i}}{center}}`).join("\n") : "";
  const first = `axis cs:${x[0]},${y[0]}`, last = `axis cs:${x[1]},${y[1]}`;
  const role = name => native ? ",mx role=" + name : "";
  return String.raw`\begin{tikzpicture}${native ? "\\def\\mxid{" + c.id + "}" : ""}
\begin{axis}[${axis}]
\addplot[${plot}] ${c.data ?? rect};
\draw[red${role("overlay")}] (${first}) -- (${last});
\draw[blue,xshift=7pt,yshift=-3pt${role("shift")}] (rel axis cs:.2,.25) -- (axis description cs:.7,.65);
${native ? String.raw`\pgfplotsextra{\mxlimits
  \mxgauge{sw}{\pgfplotspointdescriptionxy{0}{0}}\mxgauge{ne}{\pgfplotspointdescriptionxy{1}{1}}}` : ""}
\end{axis}
${native ? String.raw`\mxgauge{frame}{\pgfpointanchor{frame}{south west}}${labelGauges}${nodeGauges}` : ""}
\end{tikzpicture}`;
}

function runNative(source) {
  const dir = mkdtempSync(join(tmpdir(), "pgfplots-matrix-"));
  try {
    writeFileSync(join(dir, "matrix.tex"), ["\\documentclass{article}", preamble, readFileSync(probe, "utf8"),
      "\\begin{document}", source, "\\end{document}"].join("\n"));
    const run = spawnSync(process.env.QA_LATEX_ENGINE || "pdflatex",
      ["-no-shell-escape", "-interaction=nonstopmode", "-halt-on-error", "matrix.tex"],
      { cwd: dir, encoding: "utf8", timeout: 30000 });
    assert.ifError(run.error);
    return { status: run.status, log: readFileSync(join(dir, "matrix.log"), "utf8"),
      records: readFileSync(join(dir, "matrix.records"), "utf8") };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function parseRecords(lines) {
  const result = new Map();
  for (const line of lines.trim().split(/\r?\n/)) {
    const [id, op, ...args] = line.split("|");
    if (!result.has(id)) result.set(id, { paths: [], gauges: {}, marks: [], order: [] });
    const record = result.get(id);
    const xy = args.slice(-2).map(v => Number.parseFloat(v));
    if (op === "path") {
      const [role, mode, color] = args;
      record.paths.push({ role, mode, rgb: color?.split(",").map(v => Number(v) * 255), ops: "", points: [] });
      if (role !== "clip") record.order.push(role.endsWith("tick") ? "tick" : role);
    } else if (op === "M" || op === "L" || op === "Z") {
      const path = record.paths.at(-1);
      path.ops += op;
      if (op !== "Z") path.points.push(xy);
    } else if (op === "gauge") record.gauges[args[0]] = xy;
    else if (op === "limits") record.limits = args.map(Number);
    else if (op === "mark") { record.marks.push(xy); record.order.push("mark"); }
    else if (op === "node") record.order.push("index" + args[0]);
    else assert.fail("Unexpected PGF record: " + line);
  }
  return result;
}

let cached;
function oracle() {
  if (!cached) {
    const run = runNative(cases.map(c => picture(c, true)).join("\n"));
    assert.equal(run.status, 0, run.log.slice(-1800));
    cached = parseRecords(run.records);
  }
  return cached;
}

const subtract = (p, origin) => p.map((v, i) => v - origin[i]);
const nativePaths = (r, role) => r.paths.filter(p => p.role === role);
const cmToPt = p => [p.x * ptPerCm, p.y * ptPerCm];
const close = (p, q) => p.length === q.length && p.every((v, i) => Math.abs(v - q[i]) < tolerance);
function samePoint(p, q, name) {
  assert.ok(close(p, q), `${name}: got (${p}) vs pdfLaTeX (${q}) TeX pt`);
}
function frameOrigin(ir) { return cmToPt(ir.coordinates["frame.south west"]); }
function publicPoints(path, origin) {
  return path.commands.filter(p => p.type !== "closePath").map(p => subtract(cmToPt(p), origin));
}
const phases = roles => roles.filter((r, i) => i === 0 || roles[i - 1] !== r);

test("installed PGFPlots measures independent matrix ranges, native paths and missing paint", optional, () => {
  for (const c of cases) {
    const r = oracle().get(c.id), cells = nativePaths(r, "cell");
    // Limits printed by the installed PGFPlots image survey, not inferred from polygons.
    const limits = c.id === "manual-skew" ? [-.8,2.5,-.2,2.5] : c.id === "nonuniform" ? [0,12,-1,11]
      : c.marks ? [-.5,2.5,-.5,2.5] : [3,9,8,16];
    assert.deepEqual(r.limits, limits, c.id);
    samePoint(subtract(r.gauges.ne, r.gauges.sw), [120,80], c.id);
    assert.equal(cells.length, c.count ?? 6, c.id);
    assert.ok(cells.every(p => p.ops === "MLLLZ" && p.mode === "fillstroke" && p.rgb.length === 3), c.id);
    assert.equal(r.marks.length, c.marks ? 9 : 0, c.id);
    assert.deepEqual(nativePaths(r, "clip").map(p => p.ops), ["MLLLZ"], c.id);
    assert.ok(nativePaths(r, "spine").length, c.id);
    for (const role of ["overlay", "shift"]) assert.deepEqual(nativePaths(r, role).map(p => p.ops), ["ML"]);
  }
});

function cssRgb(ink) {
  const names = { red:[255,0,0], blue:[0,0,255], black:[0,0,0], white:[255,255,255],
    magenta:[255,0,255], yellow:[255,255,0], lime:[0,255,0], green:[0,128,0] };
  if (Object.hasOwn(names, ink)) return names[ink];
  const rgb = ink?.match(/^rgb\(([\d. ,]+)\)$/)?.[1].split(/[ ,]+/).map(Number);
  assert.equal(rgb?.length, 3, "unrecognized CSS ink " + ink);
  return rgb;
}

function checkCells(ir, r) {
  const origin = frameOrigin(ir);
  const cells = ir.items.filter(p => p.subtype === "axis-matrix-cell"), native = nativePaths(r, "cell");
  const clipPoints = nativePaths(r, "clip")[0].points.map(q => subtract(q, r.gauges.sw));
  const clipCorner = op => [0,1].map(k => op(...clipPoints.map(q => q[k])));
  assert.equal(cells.length, native.length, "painted faces");
  for (const [i, expected] of native.entries()) {
    const p = cells[i];
    assert.deepEqual(p.commands.map(q => q.type), ["moveTo","lineTo","lineTo","lineTo","closePath"]);
    const got = publicPoints(p, origin), quad = expected.points.map(q => subtract(q, r.gauges.sw));
    // A different first corner or winding is equivalent; crossing diagonals are not.
    assert.ok([1,-1].some(d => quad.some((_, start) => got.every((q, j) => close(q, quad[(start + d*j + 4) % 4])))),
      `face ${i}: got ${JSON.stringify(got)} vs pdfLaTeX ${JSON.stringify(quad)} TeX pt`);
    for (const ink of [p.style.fill, p.style.stroke]) {
      const rgb = cssRgb(ink);
      assert.ok(rgb.every((v, k) => Math.abs(v - expected.rgb[k]) <= 1), `face ${i}: ${ink} vs native RGB ${expected.rgb}`);
    }
    const clip = p.clipRect;
    assert.ok(clip, "missing frame clip on face " + i);
    samePoint(subtract([clip.minX * ptPerCm, clip.minY * ptPerCm], origin), clipCorner(Math.min), "clip southwest");
    samePoint(subtract([clip.maxX * ptPerCm, clip.maxY * ptPerCm], origin),
      clipCorner(Math.max), "clip northeast");
  }
  const marks = ir.items.filter(p => p.subtype === "axis-mark");
  assert.equal(marks.length, r.marks.length, "original centers with marks");
  marks.forEach((p, i) => {
    const center = subtract(cmToPt({ x:p.cx, y:p.cy }), origin), nativeCenter = subtract(r.marks[i], r.gauges.sw);
    samePoint(center, nativeCenter, "mark " + i);
    const label = ir.items.find(q => role(q) === "index" + i);
    assert.ok(label, "missing coordindex " + i);
    const at = subtract(cmToPt(label), origin), gauge = subtract(r.gauges["n" + i], r.gauges.frame);
    samePoint([at[0]], [gauge[0]], "coordindex " + i + " x");
    assert.equal(Math.sign(at[1] - center[1]), Math.sign(gauge[1] - nativeCenter[1]), "coordindex " + i + " side");
  });
}

function role(p) {
  if (p.subtype === "axis-matrix-cell") return "cell";
  if (p.subtype === "axis-tick") return "tick";
  if (["axis-line", "axis-frame"].includes(p.subtype) && p.style.stroke !== "none") return "spine";
  if (p.subtype === "axis-mark") return "mark";
  if (p.type === "textNode" && /^[0-8]$/.test(p.text)) return "index" + p.text;
  if (p.type === "path" && p.style.stroke === "red") return "overlay";
  if (p.type === "path" && p.style.stroke === "blue") return "shift";
}

function checkOverlays(ir, r) {
  const origin = frameOrigin(ir);
  samePoint(origin, r.gauges.frame, "named frame anchor");
  for (const tag of ["overlay", "shift"]) {
    const paths = ir.items.filter(p => role(p) === tag);
    assert.equal(paths.length, 1, tag);
    const actual = publicPoints(paths[0], origin), native = nativePaths(r, tag)[0];
    assert.deepEqual(paths[0].commands.map(p => p.type), ["moveTo","lineTo"]);
    actual.forEach((q, i) => samePoint(q, subtract(native.points[i], r.gauges.sw), tag + " " + i));
  }
  assert.deepEqual(phases(ir.items.map(role).filter(Boolean)), phases(r.order), "visible paint order");
}

function segments(ops, points) {
  const out = [];
  let current, start, i = 0;
  for (const op of ops) {
    const next = op === "Z" ? start : points[i++];
    if (op === "M") start = next;
    else if (!close(current, next)) out.push([current, next]);
    current = next;
  }
  return out;
}

function checkStrokes(ir, r, tag, directed = false) {
  const origin = frameOrigin(ir), types = { moveTo:"M", lineTo:"L", closePath:"Z" };
  const actual = ir.items.filter(p => role(p) === tag).flatMap(p =>
    segments(p.commands.map(cmd => types[cmd.type]), publicPoints(p, origin)));
  const native = r.paths.filter(p => tag === "tick" ? p.role.endsWith("tick") : p.role === tag);
  for (const path of native) for (const [a, b] of segments(path.ops, path.points.map(q => subtract(q, r.gauges.sw)))) {
    const j = actual.findIndex(([p, q]) => (close(a, p) && close(b, q)) || (!directed && close(a, q) && close(b, p)));
    assert.notEqual(j, -1, `missing ${path.role} from (${a}) to (${b}) TeX pt`);
    actual.splice(j, 1);
  }
  assert.equal(actual.length, 0, "extra " + tag + " strokes");
}

function checkTicks(ir, r) {
  const origin = frameOrigin(ir), size = subtract(r.gauges.ne, r.gauges.sw);
  checkStrokes(ir, r, "tick");
  for (const [k, text] of Object.entries({ x0:"XL", x1:"XH", y0:"YL", y1:"YH" })) {
    const along = k[0] === "x" ? 0 : 1, normal = 1 - along;
    const n = ir.items.find(p => p.type === "textNode" && p.text === text);
    assert.ok(n, "missing tick label " + text);
    const actual = subtract(cmToPt(n), origin), expected = subtract(r.gauges[k], r.gauges.frame);
    samePoint([actual[along]], [expected[along]], "tick label " + text + " along its axis");
    // Compare physical side, not font-dependent label box metrics.
    const side = p => p[normal] < 0 ? "lower" : p[normal] > size[normal] ? "upper" : "inside";
    assert.notEqual(side(expected), "inside", text);
    assert.equal(side(actual), side(expected), "physical side for " + text);
  }
}

test("public 2D matrix heatmaps match the installed PGFPlots mesh, overlays and physical ticks", optional, async t => {
  const records = oracle();
  const { tikzToSvg } = await import("../src/index.js");
  for (const c of cases) {
    const { ir, diagnostics } = tikzToSvg(preamble + "\n" + picture(c, false)), r = records.get(c.id);
    await t.test(c.id + " faces and marks", () => { assert.deepEqual(diagnostics, []); checkCells(ir, r); });
    await t.test(c.id + " overlays and order", () => checkOverlays(ir, r));
    await t.test(c.id + " frame lines", () => checkStrokes(ir, r, "spine", c.arrowed));
    await t.test(c.id + " ticks and labels", () => checkTicks(ir, r));
  }
});

const invalid = [
  { id:"coordinate-jump", data:nanMeta.replace("(1,1)[nan]", "(nan,1)[4]"),
    axis:"unbounded coords=jump", message:/supports no holes \(jumps\)/ },
  { id:"omitted-center", data:nanMeta.replace("(1,1)[nan]", ""), message:/actually got N = 8 points/ }
];
test("installed PGFPlots rejects a coordinate jump and a genuinely incomplete matrix", optional, () => {
  for (const c of invalid) {
    const run = runNative(picture({ ...c, x:[0,2], y:[0,2] }, true));
    assert.notEqual(run.status, 0, c.id);
    assert.match(run.log, c.message, c.id);
  }
});

test("the public renderer diagnoses native-invalid coordinate meshes without painting substitute faces", optional, async () => {
  const { tikzToSvg } = await import("../src/index.js");
  for (const c of invalid) {
    const { diagnostics, ir } = tikzToSvg(preamble + "\n" + picture({ ...c, x:[0,2], y:[0,2] }, false));
    assert.ok(diagnostics.some(d => /matrix|mesh/i.test(d.message)), c.id);
    assert.ok(!ir.items.some(p => ["axis-matrix-cell","axis-plot"].includes(p.subtype)), c.id);
  }
});
