import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseTikz, tikzToSvg } from "../src/index.js";
import { passiveLabelLayout } from "../src/extensions/circuitikz/passiveLabels.js";
import { estimateFormulaBox, parseMathText } from "../src/tikz/textMetrics.js";

const PT_PER_CM = 72.27 / 2.54;
const east = { x: 1, y: 0 }, west = { x: -1, y: 0 }, up = { x: 0, y: 1 }, down = { x: 0, y: -1 };
const mid = { x: 2.25, y: -0.875 }; // Isolate placement from component geometry.
const normal = { ex: 4.30554 / PT_PER_CM, baselineSkip: 12 / PT_PER_CM };

// Reference columns (TeX pt relative to body.center): label.text (left baseline),
// label.south west, label.north east. Measured with MacTeX TL2025, not TikZKit:
// \pgfpointdiff{\pgfpointanchor{B}{center}}{\pgfpointanchor{Blabel}{text}}
// and likewise for the two corners, with n=B on the component being probed.
function checkPlacement(label, geometry, reference, { sizePt = 10, font = "" } = {}) {
  const { tex, displayMode } = parseMathText(label);
  const textBox = estimateFormulaBox(tex, { scale: sizePt / 10, displayMode, preferNativeMath: true });
  assert.equal(textBox.measurementKind, "cm-tex-box");
  const placement = passiveLabelLayout({ ...normal, mid, side: 1, halfNormal: 0.21, ...geometry, textBox });
  assert.ok(placement);
  const { point, options } = placement;
  const keys = Object.entries(options).map(([k, v]) => v === true ? k : `${k}=${v}`).join(",");
  const source = `\\begin{tikzpicture}${font}\\path (${point.x},${point.y}) node[${keys}] {${label}};\\end{tikzpicture}`;
  const { svg, ir, diagnostics } = tikzToSvg(source, { unit: PT_PER_CM, mathRenderer: "svg-text" });
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(ir.items.filter(i => i.type === "textNode").map(i => i.text), [label]);
  // At one SVG unit per TeX pt, the native paint origin is label.text, y down.
  const paint = svg.match(/data-math-layout="cm-tex-box"[^>]*transform="translate\(([-.\d]+) ([-.\d]+)\)/);
  assert.ok(paint, `missing native label: ${label}`);
  const bounds = ir.items.find(i => i.subtype === "node-layout");
  assert.ok(bounds, `missing strut bounds: ${label}`);
  const corners = bounds.commands.filter(p => p.type !== "closePath");
  const xs = corners.map(p => p.x * PT_PER_CM), ys = corners.map(p => p.y * PT_PER_CM);
  const measured = [Number(paint[1]), -Number(paint[2]), Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  measured.forEach((value, i) => {
    const actual = value - (i % 2 ? mid.y : mid.x) * PT_PER_CM;
    // PGF rounds intermediate dimensions to scaled points.
    assert.ok(Math.abs(actual - reference[i]) < 0.0005,
      `${label} ${["text.x", "text.y", "sw.x", "sw.y", "ne.x", "ne.y"][i]}: ${actual} vs ${reference[i]} pt`);
  });
}

test("the six amplifier R= and C= labels retain their native baselines and strutted rectangles", () => {
  const fixture = readFileSync(new URL("./fixtures/circuitikz-tubes/amplifier.tex", import.meta.url), "utf8");
  const { ast, diagnostics } = parseTikz(fixture);
  assert.deepEqual(diagnostics, []);
  const passives = ast.pictures[0].statements.flatMap(s => s.path?.segments ?? [])
    .filter(s => s.kind === "to").flatMap(s => Object.entries(s.options).filter(([k]) => k === "R" || k === "C"));
  const references = {
    "$C_i$": [east, [-5.23825, 16.37445, -6.85283, 11.15984, 6.85283, 26.38899]],
    "$R_g$": [down, [8.18721, -2.15277, 6.57263, -7.36739, 22.04712, 7.86177]],
    "$R_c$": [down, [8.18721, -2.15277, 6.57263, -7.36739, 21.46841, 7.86177]],
    "$R_a$": [up, [-20.61775, -2.15277, -22.23233, -7.36739, -6.57263, 7.86177]],
    "$C_o$": [east, [-5.79721, 16.37445, -7.41179, 11.15984, 7.41179, 26.38899]],
    "$C_c$": [down, [14.75987, -2.15277, 13.1453, -7.36739, 27.5954, 7.86177]]
  };
  assert.deepEqual(passives.map(([, label]) => label), Object.keys(references));
  for (const [kind, label] of passives) {
    const [u, reference] = references[label];
    checkPlacement(label, { u, halfNormal: kind === "R" ? 0.21 : 0.42 }, reference);
  }
});

test("all four cardinal directions, each with l^ and l_, select the measured PGF anchor", () => {
  const above = [-6.12267, 9.80179, -7.73724, 4.58717, 7.73724, 19.81633];
  const below = [-6.12267, -16.58717, -7.73724, -21.80179, 7.73724, -6.57263];
  const left = [-20.43254, -2.15277, -22.04712, -7.36739, -6.57263, 7.86177];
  const right = [8.18721, -2.15277, 6.57263, -7.36739, 22.04712, 7.86177];
  for (const [u, positive, negative] of [[east, above, below], [west, below, above], [up, left, right], [down, right, left]]) {
    checkPlacement("$R_g$", { u, side: 1 }, positive);
    checkPlacement("$R_g$", { u, side: -1 }, negative);
  }
});

test("4pt label distance adds to the font's .75ex; the strut is a minimum, not a fixed box", () => {
  // Native probe: \sffamily\fontsize{9}{15}\selectfont (1ex=4pt), 1.6cm Rlen,
  // bipoles/capacitor/height=.5, bipoles/border margin=1.35, label distance=4pt.
  const geometry = { u: east, halfNormal: 0.4, borderMargin: 1.35, labelDistance: 4 / PT_PER_CM,
    ex: 4 / PT_PER_CM, baselineSkip: 15 / PT_PER_CM };
  const font = { sizePt: 9, font: String.raw`[font={\sffamily\fontsize{9}{15}\selectfont}]` };
  checkPlacement("$p$", geometry, [-2.32169, 22.3646, -5.82169, 14.36455, 5.82169, 36.36455], font);
  checkPlacement("$p$", { ...geometry, side: -1 }, [-2.32169, -29.36455, -5.82169, -37.3646, 5.82169, -15.3646], font);
  checkPlacement(String.raw`$\displaystyle\frac{R_g}{C_o}$`, { ...geometry, side: -1 },
    [-6.8802, -30.83522, -10.3802, -41.43921, 10.3802, -15.3646], font);
  checkPlacement("$C_i$", { ...geometry, u: up }, [-28.64081, -2, -32.14081, -10.00005, -15.3646, 11.99995], font);
  // Same 9pt label font, now assigned by picture font= rather than outside
  // the picture: the ambient cmr10 ex still drives both spacing and mid.
  checkPlacement("$C_i$", { ...geometry, u: up, ex: normal.ex },
    [-28.75539, -2.15277, -32.36996, -10.2674, -15.3646, 11.96176], font);
});

test("non-cardinal paths and unavailable or invalid dimensions leave placement to the caller", () => {
  const input = { mid, u: east, side: 1, halfNormal: 0.42, ...normal, textBox: { width: 0.4, height: 0.3, depth: 0 } };
  for (const patch of [
    { u: { x: Math.SQRT1_2, y: Math.SQRT1_2 } }, { u: { x: 1, y: 1e-8 } }, { u: { x: 0, y: 0 } }, { u: { x: 2, y: 0 } },
    { side: 0 }, { mid: { x: NaN, y: 0 } }, { halfNormal: -1 }, { ex: 0 }, { baselineSkip: Infinity },
    { textBox: null }, { borderMargin: NaN }, { labelDistance: Infinity }, { labelDistance: -normal.ex }
  ]) assert.equal(passiveLabelLayout({ ...input, ...patch }), null);
});

test("the circuit interpreter places real R and C label nodes at their native paint origins", () => {
  for (const [symbol, target, label, left, base] of [
    ["R", "(0,-2)", "$R_g$", 8.18721, -2.15277],
    ["C", "(2,0)", "$C_i$", -5.23825, 16.37445],
    ["R", "(0,2)", "$R_a$", -20.61775, -2.15277]
  ]) {
    const src = `\\begin{circuitikz}\\draw (0,0) to[${symbol}=${label}] ${target};\\end{circuitikz}`;
    const { svg, diagnostics } = tikzToSvg(src, { unit: PT_PER_CM, mathRenderer: "svg-text" });
    assert.deepEqual(diagnostics, []);
    const paint = svg.match(/data-math-layout="cm-tex-box"[^>]*transform="translate\(([-.\d]+) ([-.\d]+)\)/);
    assert.ok(paint, label);
    const [x, y] = target.slice(1, -1).split(",").map(Number);
    assert.ok(Math.abs(Number(paint[1]) - x / 2 * PT_PER_CM - left) < .0005, label + " x");
    assert.ok(Math.abs(-Number(paint[2]) - y / 2 * PT_PER_CM - base) < .0005, label + " baseline");
  }
});
