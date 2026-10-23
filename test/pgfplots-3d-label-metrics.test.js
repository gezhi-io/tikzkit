import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { axis3DParentBounds, renderAxis3DTicks, renderAxis3DBackground, renderAxis3DColorbar } from "../src/pgfplots/axis3d.js";
import { createAxisGeometry } from "../src/pgfplots/geometry.js";
import { parseOptions } from "../src/engine/options.js";
import { computeAxisRanges } from "../src/pgfplots/rangeResolver.js";

const pt = 72.27 / 2.54;
const fixture = name => readFileSync(new URL(`fixtures/pgfplots-3d-labels/${name}.tex`, import.meta.url), "utf8");
const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 0.055,
  `${label}: ${actual}pt differs from MacTeX ${expected}pt`);

test("a single surface scanline stays one-dimensional instead of inventing faces", () => {
  for (const source of [fixture("flat-planes"), fixture("explicit-flat-planes").replaceAll("mesh/cols=2,", "")]) {
    const result = tikzToSvg(source);
    assert.deepEqual(result.diagnostics, []);
    const plots = result.ir.items.filter(item => item.type === "path" && item.subtype === "axis-surface");
    assert.equal(plots.length, 6, "two one-dimensional meshes with three segments each");
    assert.ok(plots.every(item => item.style.fill === "none"));
    assert.ok(plots.every(item => item.commands.filter(command => command.type === "lineTo").length === 1));
  }
});

test("explicit two-dimensional flat meshes do not gain extruded side walls", () => {
  const result = tikzToSvg(fixture("explicit-flat-planes"));
  assert.deepEqual(result.diagnostics, []);
  const fills = result.ir.items.filter(item => item.type === "path" && item.subtype === "axis-surface" && item.style.fill !== "none");
  assert.equal(fills.length, 2);
  assert.ok(fills.every(item => item.commands.filter(command => command.type === "lineTo").length === 3));
});

test("flat shaders inherit from the axis and stroke with the mapped fill color", () => {
  const flat = fixture("explicit-flat-planes");
  for (const source of [flat, flat.replaceAll("mesh/cols=2,", "shader=flat,mesh/cols=2,")]) {
    const { ir } = tikzToSvg(source);
    const surfaces = ir.items.filter(item => item.type === "path" && item.subtype === "axis-surface");
    assert.equal(surfaces.length, 4);
    for (let index = 0; index < surfaces.length; index += 2) {
      assert.equal(surfaces[index].style.stroke, "none");
      assert.equal(surfaces[index + 1].style.stroke, surfaces[index].style.fill);
      assert.equal(surfaces[index + 1].style.fill, "none");
    }
  }
  const { ir } = tikzToSvg(flat.replaceAll("mesh/cols=2,", "draw=black,mesh/cols=2,"));
  assert.equal(ir.items.filter(item => item.subtype === "axis-surface" && item.style.stroke === "black").length, 2);
});

test("transparent flat surfaces retain the native same-color mesh strokes", () => {
  const { ir } = tikzToSvg(fixture("flat-shader-strokes"));
  const surfaces = ir.items.filter(item => item.type === "path" && item.subtype === "axis-surface");
  assert.equal(surfaces.length, 64, "two 4 by 4 meshes, each with separate fill and stroke");
  for (let index = 0; index < 32; index += 2) {
    assert.equal(surfaces[index + 1].style.stroke, surfaces[index].style.fill);
    assert.equal(surfaces[index + 1].style.opacity, 0.5);
  }
});

test("boxed 3D auto limits enlarge only inferred z boundaries", () => {
  const plots = [{ type: "coordinates", is3d: true, options: { surf: true },
    points: [{ x: 0, y: 0, z: 0 }, { x: 4, y: 4, z: 6 }] }];
  const options = { "pgfplots 3d surface": true, zmin: "0" };
  assert.deepEqual(computeAxisRanges(options, plots),
    { xMin: 0, xMax: 4, yMin: 0, yMax: 4, zMin: 0, zMax: 6.6 });
  for (const override of [{ enlargelimits: false }, { "axis lines": "left" }, { zmax: "6" }]) {
    assert.equal(computeAxisRanges({ ...options, ...override }, plots).zMax, 6);
  }
  assert.equal(computeAxisRanges({ ...options, "enlarge z limits": "{upper,abs=2}" }, plots).zMax, 8);
});

test("3D Manhattan canvas has no synthetic description gutters", () => {
  const result = tikzToSvg(readFileSync("test/fixtures/examples/latex-examples/3d-manhattan-bar-plot.tex", "utf8"),
    { margin: 0, mathRenderer: "svg-text" });
  const width = Number(result.svg.match(/\bwidth="([\d.]+)pt"/)[1]) * 72.27 / 72;
  const height = Number(result.svg.match(/\bheight="([\d.]+)pt"/)[1]) * 72.27 / 72;
  // PDF and CSS/SVG pt are both 72/in. Convert to TeX pt (72.27/in).
  // Local pdflatex: 228.996 x 186.543bp, including 2mm PreviewBorder.
  close(width, 228.996 * 72.27 / 72 - 4 * 72.27 / 25.4, "Manhattan width");
  close(height, 186.543 * 72.27 / 72 - 4 * 72.27 / 25.4, "Manhattan height");
  assert.ok(result.ir.items.some(item => item.type === "path" && ["blue", "rgb(0 0 255)"].includes(item.style.fill)),
    "enlarging z limits must not desaturate the maximum point-meta color");
  assert.ok(result.ir.items.some(item => item.type === "path" && ["white", "rgb(255 255 255)"].includes(item.style.fill)),
    "zero-height cells remain white surface facets with visible mesh edges");
});

test("default 3D sizing reproduces TeX's final fixed-point basis scaling", () => {
  const geometry = createAxisGeometry({ "pgfplots 3d surface": true },
    { xMin: -5, xMax: 5, yMin: -5, yMax: 5, zMin: -10, zMax: 10 });
  // pgfplots-3d-regression-metrics.tex: the nominal box is 195 x 162pt,
  // but compat=default rounds each final unit-vector component separately.
  close(geometry.width * pt, 196.34694, "legacy width");
  close(geometry.height * pt, 162.56757, "legacy height");
});

test("legacy 3D scaling follows the data spans instead of a fitted margin", () => {
  const geometry = createAxisGeometry({ "pgfplots 3d surface": true, width: "15cm", view: "{60}{55}", enlargelimits: false },
    { xMin: -2, xMax: 2, yMin: -5, yMax: 5, zMin: -4.998, zMax: 4.997 });
  close(geometry.width * pt, 383.60730, "ridge width");
  close(geometry.height * pt, 324.48056, "ridge height");
});

for (const [compat, expected] of [["1.3", [193.37152, 161.20345]], ["1.18", [194.97368, 161.97858]]]) {
  test(`3D compat=${compat} uses its native arithmetic mode`, () => {
    const geometry = createAxisGeometry({ "pgfplots 3d surface": true, compat },
      { xMin: -5, xMax: 5, yMin: -5, yMax: 5, zMin: -10, zMax: 10 });
    close(geometry.width * pt, expected[0], `${compat} width`);
    close(geometry.height * pt, expected[1], `${compat} height`);
  });
}

// Coordinates are relative to axis description cs:0,0, from the local
// pgfplots-3d-label-metrics.tex probe. No screenshot-derived translations.
const centers = {
  boxed: [[39.67730, -14.36774], [159.95908, -8.35263], [-26.14545, 46.18910]],
  left: [[38.56215, -16.18690], [161.33592, -9.98276], [-28.25479, 45.86725]],
  explicit: [[45.67807, -18.70600], [-23.02225, 56.90155], [193.42203, 56.90155]],
  small: [[153.62648, 0.56810], [43.88814, -7.33325], [-19.13461, 46.28458]]
};
for (const [name, expected] of Object.entries(centers)) {
  test(`3D ${name} labels use native projected text-box anchors`, () => {
    const result = tikzToSvg(fixture(name));
    assert.deepEqual(result.diagnostics, []);
    const texts = name === "explicit" ? ["office AV", "gyp", "$z_i$"] : ["$x$", "$y$", "$z$"];
    for (const [index, text] of texts.entries()) {
      const node = result.ir.items.find(item => item.type === "textNode" && item.text === text);
      assert.ok(node, text);
      close(node.x * pt, expected[index][0], `${name} ${text} x`);
      close(node.y * pt, expected[index][1], `${name} ${text} y`);
    }
  });
}

test("3D ticklabel aliases retain NFSS sizes and absolute inner sep", () => {
  const result = tikzToSvg(fixture("small"));
  const ticks = result.ir.items.filter(item => item.type === "textNode" && !item.text.startsWith("$"));
  assert.equal(ticks.length, 9);
  for (const tick of ticks) {
    assert.equal(tick.font.sizePt, 7);
    assert.equal(tick.style.mathMode, "number");
  }
  // Last tick on each axis is 1. Its physical TeX box must match placement.
  const expected = [[112.08165, -4.64676], [105.46896, -4.72516], [-4.19292, 77.84050]];
  for (const [index, node] of ticks.filter(item => item.text === "1").entries()) {
    close(node.x * pt, expected[index][0], `small tick ${index} x`);
    close(node.y * pt, expected[index][1], `small tick ${index} y`);
  }
});

test("3D explicit font and color aliases reach browser and export text", () => {
  for (const options of [{}, { mathRenderer: "svg-text" }]) {
    const result = tikzToSvg(fixture("explicit"), options);
    const y = result.ir.items.find(item => item.type === "textNode" && item.text === "gyp");
    assert.equal(y.font.sizePt, 12);
    assert.equal(y.style.fill, "blue");
    assert.equal(y.rotation, 90);
    assert.match(result.svg, /data-text-layout="cm-tex-box"/);
    assert.match(result.svg, /data-math-layout="cm-tex-box"/);
  }
});

test("open 3D tick labels follow the transverse surface direction", () => {
  const result = tikzToSvg(fixture("left"));
  const expected = [[102.00680, -8.01384], [178.62047, 24.58255], [-7.93454, 80.10287]];
  const labels = result.ir.items.filter(item => item.type === "textNode" && item.text === "1");
  assert.equal(labels.length, 3);
  for (const [index, node] of labels.entries()) {
    close(node.x * pt, expected[index][0], `left tick ${index} x`);
    close(node.y * pt, expected[index][1], `left tick ${index} y`);
  }
});

test("top-view surfaces use the same native tick boxes as 2D boxed axes", () => {
  const source = fixture("boxed").replace("view={30}{30}", "view={0}{90}");
  const result = tikzToSvg(source);
  assert.deepEqual(result.diagnostics, []);
  const ticks = result.ir.items.filter(item => item.type === "textNode" && !item.text.startsWith("$"));
  assert.equal(ticks.length, 6);
  assert.ok(ticks.every(item => item.style.mathMode === "number"));
  assert.match(result.svg, /data-math-layout="cm-tex-box"/);
});

test("top-view foreground ticks are not hidden underneath surface fills", () => {
  const source = String.raw`\begin{tikzpicture}
    \begin{axis}[view={0}{90},xmin=0,xmax=1,ymin=0,ymax=1,
      xtick={0,.5,1},ytick={0,.5,1}]
      \addplot3[surf,samples=2,domain=0:1] {x+y};
    \end{axis}\end{tikzpicture}`;
  const { ir, diagnostics } = tikzToSvg(source);
  assert.deepEqual(diagnostics, []);
  const lastSurface = ir.items.findLastIndex(item => item.subtype === "axis-surface");
  const ticks = ir.items.map((item, index) => ({ item, index })).filter(({ item }) => item.subtype === "axis-tick");
  assert.ok(lastSurface >= 0);
  assert.ok(ticks.length > 0);
  assert.ok(ticks.every(({ index }) => index > lastSurface));
});

test("3D ticks are drawn in both adjacent coordinate planes", () => {
  const ranges = { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 1 };
  const geometry = { mapPoint3d: ({ x, y, z }) => ({ x: x + y, y: y + z * 2 }) };
  const commands = renderAxis3DTicks({ xtick: "{0.5}", ytick: "{}", ztick: "{}", "tick align": "inside" }, ranges, geometry);
  // pgfplots.code.tex draws x ticks twice: xy/z and xz/y. These are
  // normalized transverse vectors, not a screen-perpendicular approximation.
  assert.ok(commands.includes(String.raw`\draw[axis tick, gray, line width=0.2pt] (0.5,0) -- (0.606,0.106);`));
  assert.ok(commands.includes(String.raw`\draw[axis tick, gray, line width=0.2pt] (0.5,0) -- (0.5,0.15);`));
});

test("open 3D ticks respect the lower side in each oriented surface", () => {
  const options = { view: "{30}{30}", "axis lines": "left", "scale only axis": true,
    width: "6cm", height: "4cm", xtick: "{-1,0,1}", ytick: "{-1,0,1}", ztick: "{-1,0,1}" };
  const ranges = { xMin: -1, xMax: 1, yMin: -1, yMax: 1, zMin: -1, zMax: 1 };
  const geometry = createAxisGeometry(options, ranges);
  const ticks = renderAxis3DTicks(options, ranges, geometry).filter(command => command.startsWith("\\draw"));
  // MacTeX emits 2 x-directions, 1 y-direction and 2 z-directions.
  // The shared corners reduce fifteen marks to thirteen unique segments.
  assert.equal(ticks.length, 13);
  const yTicks = renderAxis3DTicks({ ...options, xtick: "{}", ztick: "{}" }, ranges, geometry)
    .filter(command => command.startsWith("\\draw"));
  assert.equal(yTicks.length, 3);
  for (const command of yTicks) {
    const p = [...command.matchAll(/\(([-\d.]+),([-\d.]+)\)/g)];
    assert.equal(p[0][1], p[1][1], "y ticks use the z direction, not the hidden upper x side");
  }
});

test("3D face passes preserve grid overpainting of background box edges", () => {
  const options = { view: "{30}{30}", grid: "major", xtick: "{-1,0,1}", ytick: "{-1,0,1}", ztick: "{-1,0,1}" };
  const ranges = { xMin: -1, xMax: 1, yMin: -1, yMax: 1, zMin: -1, zMax: 1 };
  const commands = renderAxis3DBackground(options, ranges, createAxisGeometry(options, ranges));
  const geometryOf = command => command.slice(command.indexOf("]") + 1);
  const edges = commands.filter(command => command.startsWith("\\draw[axis line,"));
  const overpainted = edges.filter(edge => commands.slice(commands.indexOf(edge) + 1)
    .some(command => command.startsWith("\\draw[axis 3d grid,") && geometryOf(command) === geometryOf(edge)));
  assert.equal(edges.length, 9);
  assert.equal(overpainted.length, 6, "six boundary grid lines cover earlier box strokes, as in PGF's face passes");
});

const bounds = {
  boxed: [-31.63120, -19.85349, 182.34946, 114.00310],
  left: [-33.74054, -21.67265, 184.45345, 114.00310],
  explicit: [-28.77223, -23.83100, 198.85951, 114.00310],
  small: [-23.07210, -12.14574, 182.91643, 114.00615]
};

test("3D colorbar uses native independent-axis tick and title boxes", () => {
  // Measured by pgfplots-colorbar-metrics.tex, relative to the parent origin.
  const result = tikzToSvg(fixture("colorbar"));
  assert.deepEqual(result.diagnostics, []);
  const nodes = result.ir.items.filter(item => item.type === "textNode");
  for (const [text, x, y] of [["\u22122", 229.00185, 0], ["0", 225.11295, 42.67883],
    ["2", 225.11295, 85.35767], ["$f(x,y)$", 211.96709, 99.89064]]) {
    const node = nodes.find(item => item.text === text);
    assert.ok(node, text);
    assert.equal(node.style.preferNativeMath, true);
    close(node.x * pt, x, `${text} center x`);
    close(node.y * pt, y, `${text} center y`);
  }
});

test("3D colorbar inherits boxed-axis inside ticks on both edges", () => {
  const options = { colorbar: true, "colorbar style": "{at={(0,0)},anchor=south west,width=.5cm,height=3cm,ytick={-2,0,2}}" };
  const ranges = { xMin: -1, xMax: 1, yMin: -1, yMax: 1, zMin: -2, zMax: 2 };
  const commands = renderAxis3DColorbar(options, ranges, createAxisGeometry({}, ranges));
  const ticks = commands.filter(command => command.startsWith("\\draw[axis colorbar tick,"));
  assert.equal(ticks.length, 6);
  for (const command of ticks) {
    const points = [...command.matchAll(/\(([-\d.]+),([-\d.]+)\)/g)].map(m => [Number(m[1]), Number(m[2])]);
    assert.equal(points[0][1], points[1][1]);
    assert.ok(Math.abs(Math.abs(points[1][0] - points[0][0]) - .15) < .001);
    assert.ok(points[1][0] > 0 && points[1][0] < .5);
  }
});

test("horizontal colorbar keeps the native upper multiplier and title placements", () => {
  const result = tikzToSvg(fixture("colorbar-horizontal"));
  assert.deepEqual(result.diagnostics, []);
  const labels = result.ir.items.filter(item => item.type === "textNode");
  for (const [text, x, y] of [["2", 290.21187, 20.98096],
    ["$\\cdot 10^{4}$", 281.67557, 36.80615], ["Score", 247.53304, 27.1754]]) {
    const node = labels.find(item => item.text === text);
    assert.ok(node, text);
    close(node.x * pt, x, `${text} x`);
    close(node.y * pt, y, `${text} y`);
  }
});
for (const [name, expected] of Object.entries(bounds)) {
  test(`3D ${name} description bounds contain the native text boxes`, () => {
    const options = { ...parseOptions(fixture(name).match(/\\begin\{axis\}\[([\s\S]*?)\]\s*\\addplot3/)[1]),
      "pgfplots 3d surface": true, "pgfplots compat": "1.18" };
    const ranges = { xMin: -1, xMax: 1, yMin: -1, yMax: 1, zMin: -1, zMax: 1 };
    const actual = axis3DParentBounds(options, ranges, createAxisGeometry(options, ranges));
    for (const [i, key] of ["minX", "minY", "maxX", "maxY"].entries()) {
      close(actual[key] * pt, expected[i], `${name} bounds ${key}`);
    }
  });
}
