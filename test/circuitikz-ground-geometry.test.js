import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { colorToRgb } from "../src/engine/colors.js";
import { parseOptions } from "../src/engine/options.js";
import { pgfFixedMultiply } from "../src/engine/pgf-fixed-math.js";
import { lineWidthFromPt } from "../src/engine/units.js";
import { circuitikzGroundGeometry, circuitikzGroundKind, circuitikzGroundLocalAnchor,
  circuitikzGroundParts } from "../src/extensions/circuitikz/grounds.js";

const pt = 2.54 / 72.27;
// pgfsys.code.tex: pgf@sys@bp@correct multiplies a TeX dimension by .99627.
const bp = cm => pgfFixedMultiply(cm / pt, .99627);
const env = { circuitikz: { "bipoles/length": "40pt" } };
const pen = { stroke: "black", lineWidth: lineWidthFromPt(1) };

function near(actual, expected, tolerance) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} +/- ${tolerance}`);
}

test("cground: the native chassis teeth extend below the saved south anchor", () => {
  // MacTeX, bipoles/length=40pt and line width=1pt. Compare the actual PDF
  // operators in bp, independently of our anchor calculations (20pt != 21pt).
  const geometry = circuitikzGroundGeometry("cground", {}, env);
  const parts = circuitikzGroundParts("cground", geometry, {}, env, pen);
  assert.deepEqual(parts.map(p => p.commands.map(c => c.type)), [
    ["moveTo", "lineTo"], ["moveTo", "lineTo", "lineTo", "lineTo", "moveTo", "lineTo"]
  ]);
  const pdf = [[0, 0], [0, -14.94415], [-9.96277, -20.92186], [-7.47208, -14.94415],
    [7.47208, -14.94415], [4.98138, -20.92186], [0, -14.94415], [-2.49069, -20.92186]];
  parts.flatMap(p => p.commands).forEach((c, i) => {
    near(bp(c.x), pdf[i][0], .00002);
    near(bp(c.y), pdf[i][1], .00002);
  });
  near(circuitikzGroundLocalAnchor("south", geometry).y / pt, -20, .0001);
  assert.deepEqual(parts.map(p => p.style.lineWidth), [pen.lineWidth, 2 * pen.lineWidth]);
});

// Half-width, depth and each visible pgfusepath at step=10pt.
const catalog = [
  ["ground", 6, 16, ["ML", "MLMLML"], [1, 2]],
  ["tlground", 6, 4, ["MLMLML"], [2]],
  ["rground", 6, 10, ["ML", "ML"], [1, 2]],
  ["tground", 6, 0, ["ML"], [3]],
  ["sground", 6, 18, ["ML", "MLLZ"], [1, 2]],
  ["nground", 9, 16, ["ML", "MLMLML", "MCC"], [1, 2, 2]],
  ["pground", 9, 18, ["MCCCCZ", "ML", "MLMLML"], [2, 1, 2]],
  ["cground", 10, 20, ["ML", "MLLLML"], [1, 2]],
  ["eground", 11, 17, ["ML", "ML", "MLMLMLML"], [1, 3, 1]],
  ["eground2", 11, 17, ["ML", "ML", "MLMLML"], [1, 3, 1]]
];
const ops = { moveTo: "M", lineTo: "L", curveTo: "C", closePath: "Z" };
const draw = (kind, options = {}, scope = env, style = pen) =>
  circuitikzGroundParts(kind, circuitikzGroundGeometry(kind, options, scope), options, scope, style);

test("ground selection follows the order of bare variants and shape keys", () => {
  for (const [kind] of catalog) {
    assert.equal(circuitikzGroundKind({ [kind]: true }), kind);
    assert.equal(circuitikzGroundKind({ shape: kind }), kind);
  }
  for (const [raw, expected] of [
    ["ground,shape=nground", "nground"], ["shape=pground,ground", "ground"],
    ["rground,eground2,rground", "rground"], ["shape=tground,nground,shape=cground", "cground"],
    ["pground,/tikz/shape=rectangle", null], ["grounds/scale=1.2", null], ["chassis", null]
  ]) assert.equal(circuitikzGroundKind(parseOptions(raw)), expected, raw);
});

test("the ten saved anchor rectangles, disconnected strokes, caps and pen factors", () => {
  for (const [kind, w, depth, operations, factors] of catalog) {
    const g = circuitikzGroundGeometry(kind, {}, env);
    near(g.step / pt, 10, .0001);
    near(g.width / pt, 2 * w, .0003);
    near(g.depth / pt, depth, .0002);
    for (const anchor of ["center", "north", "left", "right", "text", "45"]) {
      assert.deepEqual(circuitikzGroundLocalAnchor(anchor, g), { x: 0, y: 0 }, kind + "." + anchor);
    }
    for (const [anchor, x, y] of [["north east", w, 0], ["east", w, -depth/2], ["south east", w, -depth],
      ["south", 0, -depth], ["south west", -w, -depth], ["west", -w, -depth/2], ["north west", -w, 0]]) {
      const p = circuitikzGroundLocalAnchor(anchor, g);
      near(p.x / pt, x, .0002);
      near(p.y / pt, y, .0002);
    }
    const parts = draw(kind);
    assert.deepEqual(parts.map(p => p.commands.map(c => ops[c.type]).join("")), operations, kind);
    assert.deepEqual(parts.map(p => p.style.lineWidth), factors.map(f => f * pen.lineWidth), kind);
    assert.ok(parts.some(p => p.subtype === "circuitikz-" + kind), kind);
    for (const [i, p] of parts.entries()) {
      assert.equal(p.type, "path");
      assert.equal(p.groundKind, kind);
      assert.equal(p.style.fill, "none");
      assert.equal(p.style.lineCap, kind === "rground" && i === 1 ? "round" : "butt", kind);
    }
  }
});

test("ground dimensions come from scoped Rlen, class scale and monopole width, not canvas transforms", () => {
  const scope = { circuitikz: { "bipoles/length": "2cm", "grounds/scale": 1.5, "monopoles/ground/width": .3 },
    transform: { a: 3, b: 0, c: 0, d: 5 } };
  const local = parseOptions("/tikz/circuitikz/grounds/scale=2,circuitikz/monopoles/ground/width=.4");
  near(circuitikzGroundGeometry("ground", local, scope).step, 1.6, .00006);
  near(circuitikzGroundGeometry("ground", {}, scope).step, .9, .00006);
  near(circuitikzGroundGeometry("ground").step, .35, .00002);
  assert.equal(circuitikzGroundGeometry("antenna"), null);
  assert.deepEqual(draw("antenna"), []);
});

test("class pen overrides each native legacy pen, but never the unscaled leads and hatches", () => {
  const scope = { circuitikz: { ...env.circuitikz, "monopoles/ground/connectionthickness": .5,
    "monopoles/ground/thickness": 4, "monopoles/rground/thickness": 5,
    "monopoles/tground/thickness": 6, "bipoles/thickness": 7 } };
  for (const [kind, legacy, overridden] of [["ground", [.5, 4], [.5, 3]], ["rground", [1, 5], [1, 3]],
    ["tground", [6], [3]], ["sground", [1, 7], [1, 3]], ["pground", [4, .5, 4], [3, .5, 3]],
    ["eground2", [1, 6, 1], [1, 3, 1]]]) {
    for (const [value, expected] of [["none", legacy], ["3", overridden]]) {
      const parts = draw(kind, { "circuitikz/grounds/thickness": value }, scope, { ...pen, lineCap: "square" });
      assert.deepEqual(parts.map(p => p.style.lineWidth), expected.map(f => f * pen.lineWidth), kind);
      assert.deepEqual(parts.map(p => p.style.lineCap), expected.map((_, i) =>
        kind === "rground" && i === 1 ? "round" : "square"), kind);
    }
  }
});

test("protective ring and signal triangle use draworfill; ordinary strokes never knock out the wire", () => {
  const scope = { circuitikz: { "grounds/fill": "red", color: "purple" } };
  const style = { ...pen, stroke: "blue", lineJoin: "bevel", lineCap: "round", dashArray: [3, 3], opacity: .7, fillOpacity: .4,
    markerStart: { kind: "latex" }, shortenEnd: 2 };
  const ring = draw("pground", {}, scope, style);
  assert.deepEqual(ring.map(p => p.style.fill), ["red", "none", "none"]);
  for (const p of ring) {
    assert.equal(p.style.stroke, "blue");
    assert.equal(p.style.opacity, .7);
    assert.equal(p.style.fillOpacity, .4);
    assert.equal(p.style.lineJoin, "bevel");
    assert.equal(p.style.lineCap, "round");
    assert.deepEqual(p.style.dashArray, [3, 3]);
    assert.equal(p.style.markerStart, undefined);
    assert.equal(p.style.shortenEnd, undefined);
  }
  const triangle = (options, penStyle = style, e = scope) => draw("sground", options, e, penStyle)[1].style.fill;
  assert.equal(triangle({ fill: "white" }), "white");
  assert.equal(triangle({ fill: "none" }), "red");
  assert.equal(triangle({ fill: true }, { ...style, fill: "black" }), "red");
  assert.equal(triangle({}, { ...style, fillInk: "white" }), "red");
  assert.equal(triangle({ fill: "." }, { ...style, fillInk: "white" }), "white");
  assert.equal(triangle({}, { ...style, fillInk: "white" }, env), "none");
  assert.equal(triangle({ fill: "none" }, style, { circuitikz: { ...scope.circuitikz, tikzFillInk: "blue" } }), "blue");
  assert.equal(draw("eground", { fill: "white" }, scope, style).every(p => p.style.fill === "none"), true);
  assert.equal(draw("sground", {}, { circuitikz: { color: "red" } }, {}).at(-1).style.stroke, "black");
  for (const [raw, stroke] of [["red,tikzkit stroke ink=blue,draw=none", "blue"],
    ["tikzkit stroke ink=blue,red,draw=none", "red"]]) {
    assert.equal(draw("ground", parseOptions(raw), env, {}).at(-1).style.stroke, stroke);
  }
});

function nativeInk(pdf, name) {
  const block = pdf.split("/" + name + " BMC")[1]?.split("EMC")[0];
  assert.ok(block, name);
  const parts = [];
  let commands = [], width, cap = "butt", stroke = [0, 0, 0], fill = [0, 0, 0];
  for (const line of block.split(/\r?\n/)) {
    const tokens = line.trim().split(/\s+/), op = tokens.pop();
    // The probe uses only DeviceGray and DeviceRGB; pdfTeX sometimes writes
    // both color operators on the same line when it sets the current color.
    for (const [, nums, action] of line.matchAll(/((?:[\d.]+\s+)+)(rg|RG|g|G)\b/g)) {
      let channels = nums.trim().split(/\s+/).map(x => Math.round(Number(x) * 255));
      if (channels.length === 1) channels = Array(3).fill(channels[0]);
      if (action === action.toUpperCase()) stroke = channels; else fill = channels;
    }
    if (op === "w") width = Number(tokens[0]);
    else if (op === "J") cap = ["butt", "round", "square"][tokens[0]];
    else if (["m", "l", "c", "h"].includes(op)) commands.push([op, ...tokens.map(Number)]);
    else if (op === "S" || op === "B") {
      // pgfpathcircle restores the pen at its center after h; tground's
      // zero-length lead is also only a moveto. Neither contributes any ink.
      if (commands.at(-1)?.[0] === "m") commands.pop();
      if (commands.length) parts.push({ commands, width, cap, stroke, fill: op === "B" ? fill : null });
      commands = [];
    }
  }
  return parts;
}

function pdfCommand(c) {
  if (c.type === "closePath") return ["h"];
  if (c.type === "curveTo") return ["c", ...[c.x1, c.y1, c.x2, c.y2, c.x, c.y].map(bp)];
  return [c.type === "moveTo" ? "m" : "l", bp(c.x), bp(c.y)];
}

test("installed Circuitikz paints all ten ground paths with the measured controls, pens and fill actions", {
  skip: process.env.TIKZKIT_TEST_PDFLATEX !== "1" && "set TIKZKIT_TEST_PDFLATEX=1 to replay"
}, () => {
  const dir = mkdtempSync(join(tmpdir(), "circuitikz-ground-geometry-"));
  const cases = [...catalog.map(([kind]) => [kind, kind, ""]), ["ring", "pground",
    "line cap=rect,circuitikz/grounds/scale=1.5,circuitikz/monopoles/ground/width=.3," +
    "circuitikz/grounds/thickness=4,circuitikz/monopoles/ground/connectionthickness=.5,fill=white"],
    ["bare", "sground", "fill"], ["signal", "sground", "circuitikz/grounds/fill=red"],
    ["bluewire", "pground", "red,draw=blue,circuitikz/color=white"],
    ["dot", "pground", "fill=.,red,draw=blue"], ["classdot", "pground", "red,draw=blue,circuitikz/grounds/fill=."]];
  try {
    const nodes = cases.map(([id, kind, opts]) => "\\markground{" + id + "}{" + kind + ",line width=1pt," + opts + "}");
    const tex = String.raw`\documentclass{standalone}
\pdfcompresslevel=0
\usepackage{circuitikz}
\makeatletter
\def\markground#1#2{\pgfsysprotocol@literal{/#1 BMC}\node[#2] at (0,0) {};\pgfsysprotocol@literal{EMC}}
\makeatother
\begin{document}\begin{tikzpicture}\ctikzset{bipoles/length=40pt}
${nodes.join("\n")}
\end{tikzpicture}\end{document}`;
    writeFileSync(join(dir, "grounds.tex"), tex);
    execFileSync("pdflatex", ["-no-shell-escape", "-interaction=nonstopmode", "-halt-on-error", "grounds.tex"],
      { cwd: dir, timeout: 30000 });
    const pdf = readFileSync(join(dir, "grounds.pdf"), "latin1");
    for (const [id, kind, opts] of cases) {
      const actual = draw(kind, parseOptions(opts), env, { lineWidth: pen.lineWidth }), reference = nativeInk(pdf, id);
      assert.equal(actual.length, reference.length, id);
      for (const [i, { commands, style }] of actual.entries()) {
        const part = reference[i], painted = commands.map(pdfCommand);
        assert.deepEqual(painted.map(c => c[0]), part.commands.map(c => c[0]), id);
        for (const [j, c] of painted.entries()) {
          c.slice(1).forEach((v, k) => near(v, part.commands[j][k + 1], .00002));
        }
        near(pgfFixedMultiply(style.lineWidth / pen.lineWidth, .99627), part.width, .00002);
        assert.equal(style.lineCap, part.cap, id);
        assert.deepEqual(colorToRgb(style.stroke), part.stroke, id + " stroke");
        assert.deepEqual(style.fill === "none" ? null : colorToRgb(style.fill), part.fill, id + " fill");
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
