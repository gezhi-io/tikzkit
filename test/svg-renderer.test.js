import assert from "node:assert/strict";
import test from "node:test";
import {
  arrowMarkerId,
  blurShadowFilterId,
  collectArrowMarkerDefs,
  collectSvgDefs,
  computeSvgBounds,
  includeTextRenderBounds,
  createSvgDefs,
  createSvgTextEngine,
  createSvgView,
  escapeAttribute,
  escapeHtml,
  formatPlainTexText,
  formatSvgNumber,
  inlineArrowGeometry,
  estimateMathBox,
  measureMathBoxPt,
  lineBaselineGap,
  renderUnitScale,
  renderArrowMarkerDef,
  renderLibraryShapeNodeBox,
  renderMarker,
  renderPathElement,
  renderPlainSvgTextContent,
  renderSvgBackground,
  renderSvgDocument,
  renderScopedMathHtml,
  renderSvg,
  renderSvgText,
  scopedMathForeignObjectBox,
  scopedMathHostFontSize,
  scaleItemsForRenderUnit,
  scopeMathHtml,
  styleAttributes,
  svgPaint,
  svgPathData,
  nodeShapeCommands,
  pathTerminalSegments
} from "../src/renderers/svg/index.js";
import { createFontSpec } from "../src/tex/fontSpec.js";
import { tikzToSvg } from "../src/internal.js";
import { renderSvg as compatRenderSvg } from "../src/renderer-svg.js";
import { createRasterImageShape, createSceneGraph, createTextShape } from "../src/scene/index.js";
import { lineWidthFromPt } from "../src/tikz/metrics.js";
import {
  stealthArrowHalfWidthFromLength,
  stealthArrowLengthFromLineWidth
} from "../src/tikz/metrics.js";
import { estimateFormulaBox, measurePlainTextTeXBoxPt } from "../src/tikz/textMetrics.js";
import { normalizeTikzText } from "../src/tikz/text.js";
import { renderPlainTextNodeWithTextEngine } from "../src/renderers/svg/plainTextNode.js";

test("svg renderer layer exposes render, escaping, defs, text, and path-data helpers", () => {
  const scene = createSceneGraph({
    items: [{ type: "path", commands: [{ type: "moveTo", x: 0, y: 0 }, { type: "lineTo", x: 1, y: 0 }], style: { stroke: "black" } }]
  });

  assert.match(renderSvg(scene), /<svg/);
  assert.match(renderSvg(scene), /width="34\.02pt"/);
  assert.match(renderSvg(scene), /height="34\.02pt"/);
  assert.equal(escapeAttribute(`"<&>`), "&quot;&lt;&amp;>");
  assert.equal(escapeHtml(`"<&>`), "&quot;&lt;&amp;&gt;");
  assert.equal(svgPathData(scene.items[0].commands, 10), "M 0 0 L 10 0");
  assert.equal(formatSvgNumber(-0), "0");
  assert.equal(formatSvgNumber(1 / 3), "0.333333");
  assert.equal(renderUnitScale(200), 2);
  const view = createSvgView({ minX: 0, minY: 0, maxX: 1, maxY: 2 }, 100, 10);
  assert.deepEqual(view, { x: -10, y: -210, width: 120, height: 220 });
  assert.match(renderSvgBackground(view, "white"), /tikz-background/);
  assert.match(renderSvgDocument("0 0 10 10", ["<path />"], ["<marker />"]), /<defs><marker \/><\/defs>/);
  assert.deepEqual(scaleItemsForRenderUnit([{ style: { lineWidth: 1, dashArray: [1, 2] } }], 200)[0].style, {
    lineWidth: 2,
    doubleDistance: undefined,
    dashArray: [2, 4]
  });
  assert.equal(createSvgDefs(["<marker />"]), "<defs><marker /></defs>");
  assert.match(renderSvgText({ text: "<x>", x: 1, y: 2 }), /&lt;x&gt;/);
  assert.equal(formatPlainTexText(String.raw`\strut \$ 1\,x`), "$1\uE1000.166667em\uE101x");
  assert.equal(formatPlainTexText(String.raw`100\% \#1 \& x\_1 \{ok\}`), "100% #1 & x_1 {ok}");
  assert.equal(renderPlainSvgTextContent("<x>"), "&lt;x&gt;");
  const compactMathBox = estimateMathBox("x", false, 100, 1);
  const compactForeignObjectBox = scopedMathForeignObjectBox(compactMathBox, false);
  assert.ok(compactMathBox.width < 35);
  assert.ok(compactForeignObjectBox.width < 60);
  assert.ok(compactForeignObjectBox.height < 42);
  const legendMathTex = String.raw`\varphi_4(x)=\log(e^x + 1)`;
  const legendMathBox = estimateMathBox(legendMathTex, false, 100, 1);
  const legendForeignObjectBox = scopedMathForeignObjectBox(legendMathBox, false, legendMathTex);
  assert.ok(legendForeignObjectBox.width - legendMathBox.width >= legendMathBox.fontSize * 1.69);
  const svgTextMath = renderSvg(createSceneGraph({ items: [{ type: "textNode", text: "$x$", x: 0, y: 0, style: { fill: "black" } }] }), {
    margin: 0,
    mathRenderer: "svg-text"
  });
  const svgTextHeight = Number(svgTextMath.match(/height="([^"]+)pt"/)?.[1]);
  assert.ok(svgTextHeight > 7.7);
  assert.ok(svgTextHeight < 7.9);
  assert.equal(
    scopeMathHtml('<span class="katex katex-html custom"></span>'),
    '<span class="tikzkit-math-root tikzkit-math-html tikzkit-math-custom"></span>'
  );
  const mathHtml = renderScopedMathHtml(String.raw`\frac{1}{x}`);
  assert.match(mathHtml, /tikzkit-math-scope/);
  assert.doesNotMatch(mathHtml, /class="katex/);
  assert.match(arrowMarkerId("stealth", { stroke: "red", lineWidth: 2 }), /^arrow-stealth-/);
  const [marker] = collectArrowMarkerDefs([{ style: { markerEnd: "stealth", stroke: "red", lineWidth: 2 } }]);
  assert.match(renderArrowMarkerDef(marker), /<marker/);
  assert.match(renderMarker({ x: 1, y: 2, angle: 30, style: { fill: "red" } }, 10), /translate\(10 -20\)/);
  assert.equal(svgPaint("green!50!black"), "rgb(0 128 0)");
  assert.match(
    styleAttributes({ stroke: "black", fill: "none", dashArray: [2, 3], markerEnd: "stealth" }),
    /marker-end="url\(#arrow-stealth-/
  );
  assert.match(
    renderPathElement(
      {
        type: "path",
        commands: [{ type: "moveTo", x: 0, y: 0 }, { type: "lineTo", x: 1, y: 0 }],
        style: { stroke: "black", markerEnd: "stealth", lineWidth: 1 }
      },
      10
    ),
    /tikz-arrow-tip/
  );
  assert.ok(Math.abs(pathTerminalSegments(scene.items[0].commands).last.angle) < 1e-9);
  assert.match(
    renderLibraryShapeNodeBox(
      {
        shape: "star",
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        shapeData: { starPoints: 5 },
        style: { stroke: "black", fill: "none" }
      },
      10
    ),
    /tikz-node-star/
  );
  assert.equal(nodeShapeCommands({ shape: "regularPolygon", x: 0, y: 0, width: 2, height: 2 }).filter((command) => command.type === "lineTo").length, 4);
  const defs = collectSvgDefs(
    [
      { style: { pattern: "north west lines", stroke: "red" } },
      { style: { shading: "radial", radialStops: [{ offset: 0.5, color: "black", opacity: 0.4 }] } },
      { shadows: [{ blur: true, blurRadius: 0.08 }] }
    ],
    100
  ).join("");
  assert.match(defs, /<pattern/);
  assert.match(defs, /<radialGradient/);
  assert.match(defs, /feGaussianBlur/);
  assert.equal(blurShadowFilterId({ blurRadius: 0.08 }), "tikzkit-blur-shadow-80");
});

test("plain Computer Modern text uses MacTeX design fonts across LaTeX sizes", () => {
  const source = String.raw`\begin{tikzpicture}
    \node at (0,2) {Normal};
    \node[font=\small] at (0,1) {Small};
    \node[font=\footnotesize] at (0,0) {2012};
    \node[font=\scriptsize] at (0,-1) {2956};
    \node[font=\bfseries] at (0,-2) {Bold title};
  \end{tikzpicture}`;
  const result = tikzToSvg(source, { fontUrlPrefix: "../fonts/" });

  assert.match(result.svg, /font-family="TikZKitCMR10, TikZKitCMUSerif, serif"[^>]*>Normal<\/text>/);
  assert.match(result.svg, /font-family="TikZKitCMR9, TikZKitCMUSerif, serif"[^>]*>Small<\/text>/);
  assert.match(result.svg, /font-family="TikZKitCMR8, TikZKitCMUSerif, serif"[^>]*>2012<\/text>/);
  assert.match(result.svg, /font-family="TikZKitCMR7, TikZKitCMUSerif, serif"[^>]*>2956<\/text>/);
  assert.match(result.svg, /font-family="TikZKitCMBX10, TikZKitCMUSerif, serif"[^>]*>Bold title<\/text>/);
  assert.match(result.svg, /url\('\.\.\/fonts\/TikZKitCMR10-Regular\.otf'\)/);
  assert.match(result.svg, /url\('\.\.\/fonts\/TikZKitCMR9-Regular\.otf'\)/);
  assert.match(result.svg, /url\('\.\.\/fonts\/TikZKitCMR8-Regular\.otf'\)/);
  assert.match(result.svg, /url\('\.\.\/fonts\/TikZKitCMR7-Regular\.otf'\)/);
  assert.match(result.svg, /url\('\.\.\/fonts\/TikZKitCMBX10-Bold\.otf'\)/);
});

test("classic stealth bounds follow the PGF line-width geometry", () => {
  const lineWidth = lineWidthFromPt(1.2);
  const length = stealthArrowLengthFromLineWidth(lineWidth);
  const halfWidth = stealthArrowHalfWidthFromLength(length);
  const geometry = inlineArrowGeometry({ kind: "stealth" }, { lineWidth });

  assert.equal(geometry.bounds.minX, -length);
  assert.equal(geometry.bounds.maxX, 0);
  assert.equal(geometry.bounds.minY, -halfWidth);
  assert.equal(geometry.bounds.maxY, halfWidth);
});

test("svg text engine measures math before rendering from cache", async () => {
  const engine = createSvgTextEngine({ unit: 100 });
  const metrics = engine.measure({
    text: String.raw`$x_i^2$`,
    mode: "math",
    textWidthPt: null,
    fontStyle: "normal",
    fontWeight: "normal",
    fontFamily: "serif",
    fontSizePt: 10
  });

  assert.ok(metrics, "expected math text metrics");
  assert.ok(metrics.width > 0, `expected positive width, got ${metrics.width}`);
  assert.ok(metrics.height > 0, `expected positive height, got ${metrics.height}`);
  assert.ok(metrics.baselineY > 0, `expected baselineY, got ${metrics.baselineY}`);
  assert.ok(metrics.midLineY > 0, `expected midLineY, got ${metrics.midLineY}`);
  assert.match(metrics.cacheKey, /^svg-text-engine:/);
  assert.equal(metrics.renderSourceText, String.raw`x_i^2`);

  const payload = engine.renderFromCache(metrics.cacheKey);
  assert.ok(payload, "expected render payload from cache");
  assert.equal(payload.cacheKey, metrics.cacheKey);
  assert.ok(payload.viewBox.width >= metrics.width);
  assert.ok(payload.viewBox.height >= metrics.height);
  assert.match(payload.body, /tikzkit-math-scope|tikz-math/);
  assert.deepEqual(await engine.flushPending(), []);

  const displayMetrics = engine.measure({
    text: String.raw`$\displaystyle x_i$`,
    mode: "math",
    textWidthPt: null,
    fontStyle: "normal",
    fontWeight: "normal",
    fontFamily: "serif",
    fontSizePt: 10
  });
  const displayPayload = engine.renderFromCache(displayMetrics.cacheKey);
  const foreignObjectWidth = Number(displayPayload.body.match(/<foreignObject[^>]* width="([^"]+)"/)?.[1]);
  assert.ok(
    foreignObjectWidth <= displayPayload.viewBox.width + 1e-6,
    `expected measured viewBox to cover rendered foreignObject width, got viewBox=${displayPayload.viewBox.width} body=${foreignObjectWidth}`
  );
});

test("keeps KaTeX compensation private while exposing a physical formula box", () => {
  const box = measureMathBoxPt(String.raw`x_i^2`, {
    font: createFontSpec({ sizePt: 10, baselineSkipPt: 12 }),
    displayMode: false
  });

  assert.equal(box.fontSizePt, 10);
  assert.ok(box.widthPt > 0);
  assert.ok(box.heightPt > 0);
  assert.ok(box.depthPt >= 0);
  assert.ok(Math.abs(box.baselinePt - box.heightPt) < 1e-9);
  assert.equal(scopedMathHostFontSize(box.svgFontSize), box.svgFontSize / 1.21);
});

test("uses MacTeX cmmib10 boxes for Large bold math labels", () => {
  const font = createFontSpec({ sizePt: 14.4, baselineSkipPt: 18, mathVersion: "bold" });
  const x = measureMathBoxPt("x", { font, displayMode: false });
  const fx = measureMathBoxPt("f(x)", { font, displayMode: false });

  assert.ok(Math.abs(x.widthPt - 9.48997) < 0.002, `unexpected bold x width ${x.widthPt}`);
  assert.ok(Math.abs(fx.widthPt - 31.85995) < 0.002, `unexpected bold f(x) width ${fx.widthPt}`);
  assert.equal(x.mathVersion, "bold");
  assert.equal(fx.mathVersion, "bold");
});

test("agrees between browser and SVG fallback formula boxes", () => {
  const font = createFontSpec({ sizePt: 9, baselineSkipPt: 11 });
  const tex = String.raw`A=\begin{pmatrix}2&1\\0&3\end{pmatrix}`;
  const browser = measureMathBoxPt(tex, { font, renderer: "katex" });
  const fallback = measureMathBoxPt(tex, { font, renderer: "svg-text" });

  assert.ok(Math.abs(browser.widthPt - fallback.widthPt) <= 0.1);
  assert.ok(Math.abs((browser.heightPt + browser.depthPt) - (fallback.heightPt + fallback.depthPt)) <= 0.1);
  assert.equal(browser.baselinePt, fallback.baselinePt);
});

test("uses local Computer Modern design sizes for inline pmatrix formula metrics", () => {
  const base = String.raw`A=\begin{pmatrix}2&1\\0&3\end{pmatrix}`;
  const samples = [
    [String.raw`\tiny ${base}`, 39.6821],
    [String.raw`\scriptsize ${base}`, 46.5318],
    [String.raw`\footnotesize ${base}`, 48.71445],
    [String.raw`\small ${base}`, 52.13716],
    [base, 55.55556],
    [String.raw`\tiny \begin{pmatrix}0\\-42\end{pmatrix} + U`, 34.3649]
  ];

  for (const [tex, expectedWidthPt] of samples) {
    const box = estimateFormulaBox(tex, { texTextMetrics: true, minWidth: 0, widthPadding: 0 });
    const widthPt = box.width * 28.45274;
    assert.ok(Math.abs(widthPt - expectedWidthPt) <= 0.02, `expected ${tex} to measure ${expectedWidthPt}pt, got ${widthPt}pt`);
  }
});

test("uses the same measured formula box in both SVG text engine modes", () => {
  const request = {
    text: String.raw`$A=\begin{pmatrix}2&1\\0&3\end{pmatrix}$`,
    mode: "math",
    font: createFontSpec({ sizePt: 9, baselineSkipPt: 11 })
  };
  const browser = createSvgTextEngine({ unit: 100, mathRenderer: "katex" }).measure(request);
  const fallback = createSvgTextEngine({ unit: 100, mathRenderer: "svg-text" }).measure(request);

  assert.ok(Math.abs(browser.width - fallback.width) < 1e-9);
  assert.ok(Math.abs(browser.height - fallback.height) < 1e-9);
  assert.ok(Math.abs(browser.baselineY - fallback.baselineY) < 1e-9);
});

test("uses the same physical formula box for SVG document bounds", () => {
  const scene = createSceneGraph({
    items: [createTextShape(String.raw`$x_i^2$`, 0, 0, { fill: "black" }, {
      font: createFontSpec({ sizePt: 9, baselineSkipPt: 11 })
    })]
  });
  const browser = computeSvgBounds(scene.items, { unit: 100, mathRenderer: "katex" });
  const fallback = computeSvgBounds(scene.items, { unit: 100, mathRenderer: "svg-text" });

  for (const key of ["minX", "minY", "maxX", "maxY"]) {
    assert.ok(Math.abs(browser[key] - fallback[key]) < 1e-12, `${key} should use the same physical formula box`);
  }
});

test("computes rotated node and text bounds in canvas coordinates", () => {
  const nodeBounds = computeSvgBounds([
    { type: "nodeBox", x: 0, y: 0, width: 4, height: 2, rotation: 90, style: { stroke: "none" } }
  ]);
  assert.ok(Math.abs(nodeBounds.minX + 1) < 1e-9);
  assert.ok(Math.abs(nodeBounds.maxX - 1) < 1e-9);
  assert.ok(Math.abs(nodeBounds.minY + 2) < 1e-9);
  assert.ok(Math.abs(nodeBounds.maxY - 2) < 1e-9);

  const included = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const include = (x, y) => {
    included.minX = Math.min(included.minX, x);
    included.minY = Math.min(included.minY, y);
    included.maxX = Math.max(included.maxX, x);
    included.maxY = Math.max(included.maxY, y);
  };
  includeTextRenderBounds({ x: 0, y: 0, rotation: 90 }, 4, 2, include);
  assert.ok(Math.abs(included.minX + 1) < 1e-9);
  assert.ok(Math.abs(included.maxX - 1) < 1e-9);
  assert.ok(Math.abs(included.minY + 2) < 1e-9);
  assert.ok(Math.abs(included.maxY - 2) < 1e-9);
});

test("includes half the node border width on every SVG document edge", () => {
  const bounds = computeSvgBounds([
    { type: "nodeBox", x: 0, y: 0, width: 4, height: 2, style: { stroke: "black", lineWidth: 40 } }
  ], { unit: 100 });

  assert.deepEqual(bounds, { minX: -2.2, minY: -1.2, maxX: 2.2, maxY: 1.2 });
});

test("svg text engine prefers FontSpec physical size for plain text and math", () => {
  const engine = createSvgTextEngine({ unit: 100, mathRenderer: "svg-text" });
  const font = createFontSpec({
    sizePt: 9,
    baselineSkipPt: 11,
    family: "sans-serif",
    weight: 700,
    style: "italic",
    source: "node-option"
  });
  const plain = engine.measure({
    text: "x",
    mode: "text",
    font,
    fontSizePt: 20,
    fontFamily: "serif",
    fontWeight: "normal",
    fontStyle: "normal"
  });
  const math = engine.measure({
    text: "$x$",
    mode: "math",
    font,
    fontSizePt: 20,
    fontFamily: "serif",
    fontWeight: "normal",
    fontStyle: "normal"
  });

  for (const metrics of [plain, math]) {
    assert.equal(metrics.fontSizePt, 9);
    assert.equal(metrics.baselineSkipPt, 11);
    assert.equal(metrics.fontFamily, "sans-serif");
    assert.equal(metrics.fontWeight, 700);
    assert.equal(metrics.fontStyle, "italic");
  }
});

test("scene text shapes retain resolved FontSpec attributes", () => {
  const font = createFontSpec({ sizePt: 9, baselineSkipPt: 11, source: "scope" });
  const shape = createTextShape("x", 1, 2, { fill: "black" }, { font });

  assert.equal(shape.type, "textNode");
  assert.equal(shape.text, "x");
  assert.deepEqual(shape.font, font);
});

test("svg text engine keeps legacy fontSizePt fallback for plain text and math", () => {
  const engine = createSvgTextEngine({ unit: 100, mathRenderer: "svg-text" });
  const plain = engine.measure({ text: "x", mode: "text", fontSizePt: 9 });
  const math = engine.measure({ text: "$x$", mode: "math", fontSizePt: 9 });

  for (const metrics of [plain, math]) {
    assert.equal(metrics.fontSizePt, 9);
    assert.ok(Math.abs(metrics.baselineSkipPt - 10.8) < 1e-9);
  }
});

test("equal-size multiline baseline gap follows FontSpec baseline skip", () => {
  const baseFontSize = 90;

  assert.ok(Math.abs(lineBaselineGap(baseFontSize, {}, {}, { baselineSkipRatio: 11 / 9 }) - 110) < 1e-9);
  assert.equal(lineBaselineGap(baseFontSize, {}, {}), 103.49999999999999);
});

test("public multiline SVG uses resolved FontSpec baseline skip for tspan dy", () => {
  const result = tikzToSvg(
    String.raw`\begin{tikzpicture}\node[font=\small] {A\\B};\end{tikzpicture}`,
    { mathRenderer: "svg-text" }
  );
  const textNode = result.ir.items.find((item) => item.type === "textNode");
  const dyValues = [...result.svg.matchAll(/<tspan\b[^>]*\bdy="([^"]+)"/g)].map((match) => Number(match[1]));
  const expectedBaselineSkip = (11 / 28.4527559) * 100;

  assert.equal(textNode.font.baselineSkipPt, 11);
  assert.equal(dyValues.length, 2);
  assert.ok(Math.abs(dyValues[1] - expectedBaselineSkip) < 1e-6);
});

test("text-width paragraphs retain their TeX base baseline grid across scoped font changes", () => {
  const result = tikzToSvg(
    String.raw`\begin{tikzpicture}\node[text width=3cm] {Enum\\{\small first line}\\{\small second line}};\end{tikzpicture}`,
    { mathRenderer: "svg-text" }
  );
  const dyValues = [...result.svg.matchAll(/<tspan\b[^>]*\bdy="([^"]+)"/g)].map((match) => Number(match[1]));
  const normalBaseline = (12 / 28.4527559) * 100;

  assert.equal(dyValues.length, 3);
  assert.ok(Math.abs(dyValues[1] - normalBaseline) < 1e-6);
  assert.ok(Math.abs(dyValues[2] - normalBaseline) < 1e-6);
});

test("node boldmath font options reach SVG math glyphs", () => {
  const result = tikzToSvg(
    String.raw`\begin{tikzpicture}\node[font=\boldmath\Large] {$x$};\end{tikzpicture}`,
    { mathRenderer: "svg-text" }
  );
  const textNode = result.ir.items.find((item) => item.type === "textNode");

  assert.equal(textNode.font.sizePt, 14.4);
  assert.equal(textNode.font.weight, 400);
  assert.equal(textNode.font.mathVersion, "bold");
  assert.equal(textNode.style.fontWeight, undefined);
  assert.match(result.svg, /<text\b[^>]*font-weight="700"[^>]*>x<\/text>/);

  const browser = tikzToSvg(
    String.raw`\begin{tikzpicture}\node[font=\boldmath\Large] {$x$};\end{tikzpicture}`
  );
  assert.match(browser.svg, /tikzkit-math-boldsymbol/);
});

test("mixed content size commands only resize the following text segment", () => {
  const result = tikzToSvg(
    String.raw`\begin{tikzpicture}\node {normal \tiny tiny};\end{tikzpicture}`,
    { mathRenderer: "svg-text" }
  );
  const textNode = result.ir.items.find((item) => item.type === "textNode");
  const baseSize = Number(result.svg.match(/<text\b[^>]*\bfont-size="([^"]+)"/)?.[1]);
  const tinySize = Number(result.svg.match(/<tspan\b[^>]*\bfont-size="([^"]+)"[^>]*>tiny<\/tspan>/)?.[1]);

  assert.equal(textNode.font.sizePt, 10);
  assert.equal(textNode.font.source, "document");
  assert.ok(Number.isFinite(baseSize));
  assert.ok(Number.isFinite(tinySize));
  assert.ok(Math.abs(tinySize / baseSize - 0.5) < 1e-6);
});

test("multiline content size commands keep absolute 9pt and 5pt line sizes", () => {
  const result = tikzToSvg(
    String.raw`\begin{tikzpicture}\node {\small A\\\tiny B};\end{tikzpicture}`,
    { mathRenderer: "svg-text" }
  );
  const textNode = result.ir.items.find((item) => item.type === "textNode");
  const baseSize = Number(result.svg.match(/<text\b[^>]*\bfont-size="([^"]+)"/)?.[1]);
  const secondLineSize = Number(result.svg.match(/<tspan\b[^>]*\bfont-size="([^"]+)"[^>]*>B<\/tspan>/)?.[1]);

  assert.equal(textNode.font.sizePt, 9);
  assert.equal(textNode.font.baselineSkipPt, 11);
  assert.equal(textNode.font.source, "content-command");
  assert.ok(Number.isFinite(baseSize));
  assert.ok(Number.isFinite(secondLineSize));
  assert.ok(Math.abs(secondLineSize / baseSize - 5 / 9) < 1e-6);
});

test("TeX font groups restore size on the same line and after a line break", () => {
  const inline = tikzToSvg(
    String.raw`\begin{tikzpicture}\node {{\small A} B};\end{tikzpicture}`,
    { mathRenderer: "svg-text" }
  ).svg;
  const inlineText = inline.match(/<text\b[^>]*>[\s\S]*?<\/text>/)?.[0] || "";
  const inlineBaseSize = Number(inlineText.match(/^<text\b[^>]*\bfont-size="([^"]+)"/)?.[1]);
  const groupedSize = Number(inlineText.match(/<tspan\b[^>]*\bfont-size="([^"]+)"[^>]*>A<\/tspan>/)?.[1]);

  assert.match(inlineText, /<tspan\b[^>]*>A<\/tspan> B<\/text>$/);
  assert.ok(Math.abs(groupedSize / inlineBaseSize - 0.9) < 1e-6);

  const multiline = tikzToSvg(
    String.raw`\begin{tikzpicture}\node {{\small A}\\B};\end{tikzpicture}`,
    { mathRenderer: "svg-text" }
  ).svg;
  const multilineText = multiline.match(/<text\b[^>]*>[\s\S]*?<\/text>/)?.[0] || "";
  const multilineBaseSize = Number(multilineText.match(/^<text\b[^>]*\bfont-size="([^"]+)"/)?.[1]);
  const firstLineSize = Number(multilineText.match(/<tspan\b[^>]*\bfont-size="([^"]+)"[^>]*>A<\/tspan>/)?.[1]);

  assert.ok(Math.abs(firstLineSize / multilineBaseSize - 0.9) < 1e-6);
  assert.match(multilineText, /<tspan\b(?=[^>]*\bdy=)(?![^>]*\bfont-size=)[^>]*>B<\/tspan>/);
});

test("mid-line font declarations style only following segments", () => {
  const cases = [
    { command: String.raw`\bfseries`, text: "bold", attribute: "font-weight", value: "700" },
    { command: String.raw`\itshape`, text: "italic", attribute: "font-style", value: "italic" },
    { command: String.raw`\scshape`, text: "caps", attribute: "font-variant", value: "small-caps" },
    { command: String.raw`\sffamily`, text: "sans", attribute: "font-family", value: "TikZKitCMUSans" }
  ];

  for (const entry of cases) {
    const svg = tikzToSvg(
      String.raw`\begin{tikzpicture}\node {normal ${entry.command} ${entry.text}};\end{tikzpicture}`,
      { mathRenderer: "svg-text" }
    ).svg;
    const text = svg.match(/<text\b[^>]*>[\s\S]*?<\/text>/)?.[0] || "";
    const openingTag = text.match(/^<text\b[^>]*>/)?.[0] || "";
    const segmentPattern = new RegExp(
      `<tspan\\b(?=[^>]*${entry.attribute}="[^"]*${entry.value}[^"]*")[^>]*>${entry.text}<\\/tspan>`
    );

    assert.doesNotMatch(openingTag, new RegExp(`${entry.attribute}="[^"]*${entry.value}`));
    assert.match(text, new RegExp(`normal <tspan\\b`));
    assert.match(text, segmentPattern);
    if (entry.command === String.raw`\bfseries`) {
      assert.match(
        text,
        /<tspan\b(?=[^>]*font-family="TikZKitCMBX10, TikZKitCMUSerif, serif")[^>]*font-weight="700"[^>]*>bold<\/tspan>/
      );
    }
  }

  const grouped = tikzToSvg(
    String.raw`\begin{tikzpicture}\node {{\bfseries bold} normal};\end{tikzpicture}`,
    { mathRenderer: "svg-text" }
  ).svg;
  const groupedText = grouped.match(/<text\b[^>]*>[\s\S]*?<\/text>/)?.[0] || "";
  assert.match(groupedText, /<tspan\b[^>]*font-weight="700"[^>]*>bold<\/tspan> normal<\/text>$/);
});

test("scoped text font wrappers style only their arguments and restore afterward", () => {
  const cases = [
    { command: "textbf", text: "bold", attribute: "font-weight", value: "700" },
    { command: "textit", text: "italic", attribute: "font-style", value: "italic" },
    { command: "textsf", text: "sans", attribute: "font-family", value: "TikZKitCMUSans" },
    { command: "texttt", text: "mono", attribute: "font-family", value: "KaTeX_Typewriter" },
    { command: "textsl", text: "slanted", attribute: "font-style", value: "italic" },
    { command: "textsc", text: "caps", attribute: "font-variant", value: "small-caps" }
  ];

  for (const entry of cases) {
    const wrapper = `\\${entry.command}{${entry.text}}`;
    const svg = tikzToSvg(
      String.raw`\begin{tikzpicture}\node {normal ${wrapper} normal};\end{tikzpicture}`,
      { mathRenderer: "svg-text" }
    ).svg;
    const text = svg.match(/<text\b[^>]*>[\s\S]*?<\/text>/)?.[0] || "";
    const openingTag = text.match(/^<text\b[^>]*>/)?.[0] || "";

    assert.doesNotMatch(openingTag, new RegExp(`${entry.attribute}="[^"]*${entry.value}`));
    assert.match(
      text,
      new RegExp(`normal <tspan\\b(?=[^>]*${entry.attribute}="[^"]*${entry.value}[^"]*")[^>]*>${entry.text}<\\/tspan> normal`)
    );
    if (entry.command === "textbf") {
      assert.match(
        text,
        /<tspan\b(?=[^>]*font-family="TikZKitCMBX10, TikZKitCMUSerif, serif")[^>]*font-weight="700"[^>]*>bold<\/tspan>/
      );
    }
  }

  const overrideCases = [
    { option: String.raw`\sffamily`, command: "textrm", text: "serif", attribute: "font-family", value: "TikZKitCMUSerif" },
    { option: String.raw`\bfseries`, command: "textmd", text: "medium", attribute: "font-weight", value: "400" },
    { option: String.raw`\itshape`, command: "textup", text: "upright", attribute: "font-style", value: "normal" }
  ];

  for (const entry of overrideCases) {
    const wrapper = `\\${entry.command}{${entry.text}}`;
    const svg = tikzToSvg(
      String.raw`\begin{tikzpicture}\node[font=${entry.option}] {before ${wrapper} after};\end{tikzpicture}`,
      { mathRenderer: "svg-text" }
    ).svg;
    const text = svg.match(/<text\b[^>]*>[\s\S]*?<\/text>/)?.[0] || "";

    assert.match(
      text,
      new RegExp(`before <tspan\\b(?=[^>]*${entry.attribute}="[^"]*${entry.value}[^"]*")[^>]*>${entry.text}<\\/tspan> after`)
    );
  }
});

test("resolved FontSpec properties reach plain SVG without legacy style fields", () => {
  const font = createFontSpec({
    sizePt: 9,
    baselineSkipPt: 11,
    family: "sans-serif",
    weight: 700,
    style: "italic",
    variant: "small-caps",
    source: "node-option"
  });
  const svg = renderSvg(
    createSceneGraph({ items: [createTextShape("x", 0, 0, { fill: "black" }, { font })] }),
    { mathRenderer: "svg-text" }
  );

  assert.match(svg, /font-family="TikZKitCMUSans,[^"]+"/);
  assert.match(svg, /font-weight="700"/);
  assert.match(svg, /font-style="italic"/);
  assert.match(svg, /font-variant="small-caps"/);
});

test("resolved math FontSpec rendering is independent of source metadata", () => {
  const engine = createSvgTextEngine({ unit: 100, mathRenderer: "svg-text" });
  const request = (source) => engine.measure({
    text: String.raw`$\tiny x$`,
    mode: "math",
    font: createFontSpec({ sizePt: 5, baselineSkipPt: 6, source })
  });
  const nodeOption = request("node-option");
  const contentCommand = request("content-command");

  assert.equal(nodeOption.width, contentCommand.width);
  assert.equal(nodeOption.height, contentCommand.height);
  assert.equal(
    engine.renderFromCache(nodeOption.cacheKey).body,
    engine.renderFromCache(contentCommand.cacheKey).body
  );
});

test("measures a supported plain Main-Regular logical TeX box", () => {
  const box = measurePlainTextTeXBoxPt("concatenate", { fontSizePt: 10 });
  const kerned = measurePlainTextTeXBoxPt("Wahlbeteiligung", { fontSizePt: 10 });
  const spaced = measurePlainTextTeXBoxPt("a a", { fontSizePt: 10 });
  const negativeDepth = measurePlainTextTeXBoxPt("=", { fontSizePt: 10 });
  const unicodeMinus = measurePlainTextTeXBoxPt("−2", { fontSizePt: 10 });
  const zeroDepthMixed = measurePlainTextTeXBoxPt("=a", { fontSizePt: 10 });
  const positiveDepthMixed = measurePlainTextTeXBoxPt("=g", { fontSizePt: 10 });

  assert.ok(box, "expected supported Main-Regular metrics");
  assert.ok(Math.abs(box.width - 51.666) < 0.01, `expected TeX width near 51.666pt, got ${box.width}`);
  assert.ok(Math.abs(kerned.width - 70.83351) < 0.01, `expected MacTeX CMR10 kerning width 70.83351pt, got ${kerned.width}`);
  assert.ok(Math.abs(spaced.width - 13.333) < 0.01, `expected CMR10 interword space width, got ${spaced.width}`);
  assert.ok(Math.abs(box.height - 6.151) < 0.01, `expected TeX height near 6.151pt, got ${box.height}`);
  assert.ok(Math.abs(box.depth) < 1e-9, `expected zero TeX depth, got ${box.depth}`);
  assert.ok(Math.abs(negativeDepth.width - 7.7778) < 0.001, `expected equals width near 7.7778pt, got ${negativeDepth.width}`);
  assert.ok(Math.abs(negativeDepth.height - 3.6687) < 0.001, `expected equals height near 3.6687pt, got ${negativeDepth.height}`);
  assert.ok(Math.abs(negativeDepth.depth - -1.33125) < 0.001, `expected equals depth near -1.33125pt, got ${negativeDepth.depth}`);
  assert.ok(Math.abs(unicodeMinus.width - 12.7778) < 0.001, `expected Unicode minus tick width near 12.7778pt, got ${unicodeMinus.width}`);
  assert.ok(Math.abs(unicodeMinus.height - 6.4444) < 0.001, `expected Unicode minus tick height near 6.4444pt, got ${unicodeMinus.height}`);
  assert.ok(Math.abs(unicodeMinus.depth - 0.8333) < 0.001, `expected Unicode minus tick depth near 0.8333pt, got ${unicodeMinus.depth}`);
  assert.ok(Math.abs(zeroDepthMixed.depth) < 1e-9, `expected mixed zero depth, got ${zeroDepthMixed.depth}`);
  assert.ok(Math.abs(positiveDepthMixed.depth - 1.9444) < 0.001, `expected mixed positive depth near 1.9444pt, got ${positiveDepthMixed.depth}`);
  assert.equal(measurePlainTextTeXBoxPt("caf\u00e9", { fontSizePt: 10 }), null);
});

test("measures numeric sans-serif ticks from the TeX Helvetica TFM", () => {
  const box = measurePlainTextTeXBoxPt("40", { fontSizePt: 10, fontFamily: "sans-serif" });

  assert.ok(box, "expected supported Helvetica tick metrics");
  assert.ok(Math.abs(box.width - 11.11988) < 0.0001, `expected 11.11988pt width, got ${box.width}`);
  assert.ok(Math.abs(box.height - 7.04492) < 0.0001, `expected 7.04492pt height, got ${box.height}`);
  assert.ok(Math.abs(box.depth - 0.16492) < 0.0001, `expected 0.16492pt depth, got ${box.depth}`);
});

test("svg text engine logical TeX box preserves negative depth in total height", () => {
  const engine = createSvgTextEngine({ unit: 100 });
  const metrics = engine.measure({
    text: "=",
    mode: "text",
    textWidthPt: null,
    alignment: "center",
    fontStyle: "normal",
    fontWeight: "normal",
    fontFamily: "serif",
    fontSizePt: 10
  });
  const ptToEngineUnits = 100 / 28.4527559;
  const expectedHeight = (3.6687 - 1.3313) * ptToEngineUnits;
  const expectedBaseline = 3.6687 * ptToEngineUnits;

  assert.equal(metrics.measurementKind, "tex-box");
  assert.ok(Math.abs(metrics.height - expectedHeight) < 0.01, `expected height + negative depth ${expectedHeight}, got ${metrics.height}`);
  assert.ok(Math.abs(metrics.baselineY - expectedBaseline) < 0.01, `expected baseline from logical height ${expectedBaseline}, got ${metrics.baselineY}`);
  assert.ok(metrics.baselineY > metrics.height, `expected negative depth to place baseline below total box height, got ${JSON.stringify(metrics)}`);
});

test("svg text engine keeps calibrated CMR logical and paint boxes aligned", () => {
  const engine = createSvgTextEngine({ unit: 100 });
  const request = {
    text: "concatenate",
    mode: "text",
    textWidthPt: null,
    alignment: "center",
    fontStyle: "normal",
    fontWeight: "normal",
    fontFamily: "serif",
    fontSizePt: 10
  };
  const metrics = engine.measure(request);
  const payload = engine.renderFromCache(metrics.cacheKey);
  const ptToEngineUnits = 100 / 28.4527559;

  assert.equal(metrics.measurementKind, "tex-box");
  assert.ok(Math.abs(metrics.width - 51.6667 * ptToEngineUnits) < 0.05, `expected logical width, got ${metrics.width}`);
  assert.ok(Math.abs(metrics.height - 6.1508 * ptToEngineUnits) < 0.05, `expected logical total height, got ${metrics.height}`);
  assert.ok(Math.abs(metrics.baselineY - 6.1508 * ptToEngineUnits) < 0.05, `expected logical baseline, got ${metrics.baselineY}`);
  assert.ok(Math.abs(payload.viewBox.width - metrics.width) < 0.001, `expected calibrated CMR paint width, got ${payload.viewBox.width}`);
  assert.ok(Math.abs(payload.viewBox.height - metrics.height) < 0.001, `expected calibrated CMR paint height, got ${payload.viewBox.height}`);
  assert.match(payload.body, />concatenate<\/text>/);
});

test("svg text engine falls back outside the logical TeX box slice", () => {
  const engine = createSvgTextEngine({ unit: 100 });
  const base = {
    text: "concatenate",
    mode: "text",
    textWidthPt: null,
    alignment: "center",
    fontStyle: "normal",
    fontWeight: "normal",
    fontFamily: "serif",
    fontSizePt: 10
  };
  const requests = [
    { ...base, textWidthPt: 40 },
    { ...base, text: String.raw`one\\two` },
    { ...base, text: "plain $x$" },
    { ...base, fontStyle: "italic" },
    { ...base, fontWeight: "bold" },
    { ...base, fontFamily: "monospace" },
    { ...base, text: "caf\u00e9" }
  ];

  for (const request of requests) {
    const metrics = engine.measure(request);
    const payload = engine.renderFromCache(metrics.cacheKey);
    assert.equal(metrics.measurementKind, undefined, `expected untyped paint-bound fallback for ${JSON.stringify(request)}`);
    assert.equal(metrics.width, payload.viewBox.width, `expected paint-width fallback for ${JSON.stringify(request)}`);
    assert.equal(metrics.height, payload.viewBox.height, `expected paint-height fallback for ${JSON.stringify(request)}`);
  }
});

test("svg text engine uses paint fallback for a logical TeX box request with explicit font size", () => {
  assertPlainTextEnginePaintFallback(String.raw`\Large concatenate`);
});

test("svg text engine uses paint fallback for a scaled logical TeX box request", () => {
  assertPlainTextEnginePaintFallback(String.raw`\scalebox{2}{concatenate}`);
});

test("svg text engine uses paint fallback for a parbox logical TeX box request", () => {
  assertPlainTextEnginePaintFallback(String.raw`\parbox{2cm}{concatenate}`);
});

test("svg text engine uses paint fallback for mixed ensuremath logical TeX box control syntax", () => {
  assertPlainTextEnginePaintFallback(String.raw`plain \ensuremath{x}`);
});

test("svg text engine uses paint fallback for fontsize logical TeX box control syntax", () => {
  assertPlainTextEnginePaintFallback(String.raw`\fontsize{12}{14}\selectfont concatenate`);
});

test("svg text engine uses paint fallback for fontfamily logical TeX box control syntax", () => {
  assertPlainTextEnginePaintFallback(String.raw`\fontfamily{phv}\selectfont concatenate`);
});

test("svg text engine uses paint fallback for a minipage logical TeX box wrapper", () => {
  assertPlainTextEnginePaintFallback(String.raw`\begin{minipage}{2cm}concatenate\end{minipage}`);
});

test("svg text engine uses paint fallback for escaped logical TeX box control-symbol syntax", () => {
  assertPlainTextEnginePaintFallback(String.raw`plain \%`);
});

function assertPlainTextEnginePaintFallback(text) {
  const engine = createSvgTextEngine({ unit: 100 });
  const metrics = engine.measure({
    text,
    mode: "text",
    textWidthPt: null,
    alignment: "center",
    fontStyle: "normal",
    fontWeight: "normal",
    fontFamily: "serif",
    fontSizePt: 10
  });
  const payload = engine.renderFromCache(metrics.cacheKey);

  assert.equal(metrics.measurementKind, undefined);
  assert.equal(metrics.width, payload.viewBox.width);
  assert.equal(metrics.height, payload.viewBox.height);
}

test("svg text engine preserves plain text alignment in cached payloads", () => {
  const engine = createSvgTextEngine({ unit: 100 });
  const baseRequest = {
    text: "Alpha beta gamma",
    mode: "text",
    textWidthPt: 56.905512,
    fontStyle: "normal",
    fontWeight: "normal",
    fontFamily: "serif",
    fontSizePt: 10
  };

  const left = engine.measure({ ...baseRequest, alignment: "left" });
  const center = engine.measure({ ...baseRequest, alignment: "center" });
  const right = engine.measure({ ...baseRequest, alignment: "right" });

  assert.notEqual(left.cacheKey, center.cacheKey);
  assert.notEqual(center.cacheKey, right.cacheKey);
  assert.match(engine.renderFromCache(left.cacheKey).body, /text-anchor="start"/);
  assert.match(engine.renderFromCache(center.cacheKey).body, /text-anchor="middle"/);
  assert.match(engine.renderFromCache(right.cacheKey).body, /text-anchor="end"/);
});

test("svg text engine keeps an unwrapped left-aligned paragraph centered on its TikZ node", () => {
  const engine = createSvgTextEngine({ unit: 100, mathRenderer: "svg-text" });
  const item = {
    type: "textNode",
    x: 4,
    y: 2,
    text: String.raw`$A~\nicefrac{6}{10}$\\$B~\nicefrac{2}{10}$`,
    textAlign: "left",
    style: { fill: "black" }
  };
  const rendered = renderPlainTextNodeWithTextEngine(item, normalizeTikzText(item.text), 100, { textEngine: engine });
  const match = rendered.match(/transform="translate\(([-0-9.]+)\s+[-0-9.]+\)"/);

  assert.ok(match, `expected cached text transform, got ${rendered}`);
  assert.ok(Number(match[1]) < 400, `expected left-aligned paragraph to shift left from the node center, got ${match[1]}`);
  assert.match(rendered, /text-anchor="start"/);
  assert.match(rendered, /class="tikz-nicefrac-numerator"/);
});

test("svg text engine honors explicit SVG text anchors instead of the centered node point", () => {
  const engine = createSvgTextEngine({ unit: 100, mathRenderer: "svg-text" });
  const item = {
    type: "textNode",
    x: 5,
    y: 2,
    svgTextAnchor: "start",
    svgTextX: 3,
    text: "Legend label",
    style: { fill: "black" }
  };
  const rendered = renderPlainTextNodeWithTextEngine(item, normalizeTikzText(item.text), 100, { textEngine: engine });

  assert.match(rendered, /transform="translate\(300\s+-200\)"/);
  assert.match(rendered, /text-anchor="start"/);
});

test("svg text engine isolates cached payloads by render-affecting text style", () => {
  const engine = createSvgTextEngine({ unit: 100 });
  const baseTextRequest = {
    text: "colored label",
    mode: "text",
    textWidthPt: null,
    alignment: "center",
    fontStyle: "normal",
    fontWeight: "normal",
    fontFamily: "serif",
    fontSizePt: 10
  };
  const blackText = engine.measure({ ...baseTextRequest, color: "black" });
  const redText = engine.measure({ ...baseTextRequest, color: "red" });

  assert.notEqual(blackText.cacheKey, redText.cacheKey);
  assert.match(engine.renderFromCache(blackText.cacheKey).body, /fill="black"/);
  assert.match(engine.renderFromCache(redText.cacheKey).body, /fill="red"/);

  const baseMathRequest = {
    text: String.raw`$x_i$`,
    mode: "math",
    textWidthPt: null,
    alignment: "center",
    fontStyle: "normal",
    fontWeight: "normal",
    fontFamily: "serif",
    fontSizePt: 10
  };
  const blackMath = engine.measure({ ...baseMathRequest, color: "black" });
  const blueMath = engine.measure({ ...baseMathRequest, color: "blue" });

  assert.notEqual(blackMath.cacheKey, blueMath.cacheKey);
  assert.match(engine.renderFromCache(blackMath.cacheKey).body, /(?:color:black|fill="black")/);
  assert.match(engine.renderFromCache(blueMath.cacheKey).body, /(?:color:blue|fill="blue")/);
});

test("svg text engine isolates font variant, math style, and math version cache entries", () => {
  const engine = createSvgTextEngine({ unit: 100, mathRenderer: "svg-text" });
  const normal = engine.measure({
    text: "label",
    mode: "text",
    font: createFontSpec({ variant: "normal" })
  });
  const smallCaps = engine.measure({
    text: "label",
    mode: "text",
    font: createFontSpec({ variant: "small-caps" })
  });

  assert.notEqual(normal.cacheKey, smallCaps.cacheKey);
  assert.doesNotMatch(engine.renderFromCache(normal.cacheKey).body, /font-variant="small-caps"/);
  assert.match(engine.renderFromCache(smallCaps.cacheKey).body, /font-variant="small-caps"/);

  const textMath = engine.measure({
    text: "$x$",
    mode: "math",
    font: createFontSpec({ mathStyle: "text" })
  });
  const displayMath = engine.measure({
    text: "$x$",
    mode: "math",
    font: createFontSpec({ mathStyle: "display" })
  });

  assert.notEqual(textMath.cacheKey, displayMath.cacheKey);
  assert.ok(displayMath.height > textMath.height);

  const boldMath = engine.measure({
    text: "$x$",
    mode: "math",
    font: createFontSpec({ mathStyle: "text", mathVersion: "bold" })
  });
  assert.notEqual(textMath.cacheKey, boldMath.cacheKey);
  assert.equal(boldMath.mathVersion, "bold");
  assert.match(engine.renderFromCache(boldMath.cacheKey).body, /font-weight="700"/);
});

test("svg text engine cache separates canonical line and segment styles before rendering", () => {
  const engine = createSvgTextEngine({ unit: 100, mathRenderer: "svg-text" });
  const request = {
    mode: "text",
    font: createFontSpec(),
    alignment: "center"
  };
  const plain = engine.measure({ ...request, text: "normal bold" });
  const styled = engine.measure({ ...request, text: String.raw`normal \bfseries bold` });

  assert.notEqual(plain.cacheKey, styled.cacheKey);

  const plainBody = engine.renderFromCache(plain.cacheKey).body;
  const styledBody = engine.renderFromCache(styled.cacheKey).body;
  assert.doesNotMatch(plainBody, /font-weight="700"/);
  assert.match(styledBody, /<tspan\b[^>]*font-weight="700"[^>]*>bold<\/tspan>/);
});

test("tikzToSvg creates svg text engine before sizing math node boxes", () => {
  const expected = createSvgTextEngine({ unit: 100, mathRenderer: "svg-text" }).measure({
    text: String.raw`$\displaystyle x_i$`,
    mode: "math",
    textWidthPt: null,
    fontStyle: "normal",
    fontWeight: "normal",
    fontFamily: "serif",
    fontSizePt: 10
  });
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
  \node[draw, inner sep=0pt] {$\displaystyle x_i$};
\end{tikzpicture}`, { margin: 0, mathRenderer: "svg-text" });
  const box = result.ir.items.find((item) => item.type === "nodeBox");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(box, "expected a rendered node box");
  assert.ok(Math.abs(box.width - expected.width / 100) < 0.03, `expected node width to use svg text engine metrics ${expected.width / 100}cm, got ${box.width}cm`);
  assert.ok(Math.abs(box.height - expected.height / 100) < 0.03, `expected node height to use svg text engine metrics ${expected.height / 100}cm, got ${box.height}cm`);
});

test("core node measurement receives the same resolved FontSpec as textNode IR", () => {
  const calls = [];
  const textEngine = {
    validate() {
      return null;
    },
    measure(request) {
      calls.push(request);
      return {
        cacheKey: `font-spec-measure-${calls.length}`,
        width: 90,
        height: 22,
        baselineY: 14,
        midLineY: 11,
        renderSourceText: request.text
      };
    },
    renderFromCache() {
      return null;
    },
    async flushPending() {
      return [];
    }
  };

  const result = tikzToSvg(
    String.raw`\begin{tikzpicture}\node[draw,font=\small,inner sep=0pt] {x};\end{tikzpicture}`,
    { margin: 0, textEngine, textEngineUnit: 100 }
  );
  const textNode = result.ir.items.find((item) => item.type === "textNode");
  const sizingCall = calls[0];

  assert.deepEqual(sizingCall.font, textNode.font);
  assert.equal(sizingCall.font.sizePt, 9);
  assert.equal(sizingCall.font.baselineSkipPt, 11);
});

test("tikzToSvg renders plain text nodes from injected text engine cache", () => {
  const textEngineCalls = [];
  const renderedCacheKeys = [];
  const textEngine = {
    validate() {
      return null;
    },
    measure(request) {
      textEngineCalls.push(request);
      if (request.mode !== "text") return null;
      return {
        cacheKey: `custom-text-${textEngineCalls.length}`,
        width: 120,
        height: 32,
        baselineY: 20,
        midLineY: 16,
        renderSourceText: request.text
      };
    },
    renderFromCache(cacheKey) {
      renderedCacheKeys.push(cacheKey);
      return {
        cacheKey,
        viewBox: { x: -60, y: -16, width: 120, height: 32 },
        body: `<text class="custom-text-engine-payload">cached text</text>`
      };
    },
    async flushPending() {
      return [];
    }
  };

  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \node[inner sep=0pt, text width=1cm] {Cached text};
\end{tikzpicture}`, { margin: 0, textEngine, textEngineUnit: 100 });

  assert.deepEqual(result.diagnostics, []);
  assert.ok(textEngineCalls.some((call) => call.mode === "text" && call.text === "Cached text"), `expected text engine measure call, got ${JSON.stringify(textEngineCalls)}`);
  assert.ok(renderedCacheKeys.length > 0, "expected renderer to request text engine cache payload");
  assert.match(result.svg, /custom-text-engine-payload/);
});

test("renders raster image scene items with tight bounds", () => {
  const scene = createSceneGraph({
    items: [
      createRasterImageShape({
        x: 1,
        y: 2,
        width: 3,
        height: 1,
        href: "data:image/png;base64,AA=="
      })
    ]
  });

  const svg = renderSvg(scene, { margin: 0 });

  assert.match(svg, /<image class="tikz-raster-image"/);
  assert.match(svg, /x="100"/);
  assert.match(svg, /y="-300"/);
  assert.match(svg, /width="300"/);
  assert.match(svg, /height="100"/);
  assert.match(svg, /href="data:image\/png;base64,AA=="/);
  assert.match(svg, /preserveAspectRatio="none"/);
  assert.match(svg, /viewBox="100 -300 300 100"/);
});

test("keeps legacy top-level renderer import as compatibility adapter", () => {
  assert.equal(compatRenderSvg, renderSvg);
});

test("renders decoration text as glyphs sampled along path commands", () => {
  const scene = createSceneGraph({
    items: [
      {
        type: "textNode",
        subtype: "decoration-text",
        text: String.raw`Aktion {$a_k$}`,
        x: 1,
        y: 0.5,
        rotation: 80,
        pathCommands: [
          { type: "moveTo", x: 0, y: 0 },
          { type: "curveTo", x1: 0.5, y1: 1, x2: 1.5, y2: 1, x: 2, y: 0 }
        ],
        style: { fill: "black" }
      }
    ]
  });
  const svg = renderSvg(scene, { margin: 0, mathRenderer: "svg-text" });

  assert.match(svg, /tikz-decoration-glyph/);
  assert.match(svg, /class="tikz-decoration-glyph"[^>]+dominant-baseline="alphabetic"/);
  assert.match(svg, />A</);
  assert.match(svg, />n</);
  assert.doesNotMatch(svg, /<textPath\b/);
});

test("uses approximate glyph advances for decoration text along paths", () => {
  const scene = createSceneGraph({
    items: [
      {
        type: "textNode",
        subtype: "decoration-text",
        text: "iiW",
        pathCommands: [
          { type: "moveTo", x: 0, y: 0 },
          { type: "lineTo", x: 5, y: 0 }
        ],
        style: { fill: "black" }
      }
    ]
  });
  const svg = renderSvg(scene, { margin: 0, mathRenderer: "svg-text" });
  const xs = [...svg.matchAll(/class="tikz-decoration-glyph" x="([^"]+)"/g)].map((match) => Number(match[1]));

  assert.equal(xs.length, 3);
  assert.ok(xs[1] - xs[0] < xs[2] - xs[1], `expected narrow i/i spacing before wide W: ${xs.join(", ")}`);
});

test("reverses decorations.text character boxes before sampling the path", () => {
  const scene = createSceneGraph({
    items: [
      {
        type: "textNode",
        subtype: "decoration-text",
        text: "ABCD",
        pathTextReverse: true,
        pathCommands: [
          { type: "moveTo", x: 0, y: 0 },
          { type: "lineTo", x: 5, y: 0 }
        ],
        style: { fill: "black" }
      }
    ]
  });
  const svg = renderSvg(scene, { margin: 0, mathRenderer: "svg-text" });
  const letters = [...svg.matchAll(/class="tikz-decoration-glyph"[^>]*>([A-Z])<\/text>/g)].map((match) => match[1]);

  assert.deepEqual(letters, ["D", "C", "B", "A"]);
});

test("reverses the sampled decorations.text path without reversing its text", () => {
  const scene = createSceneGraph({
    items: [
      {
        type: "textNode",
        subtype: "decoration-text",
        text: "AB",
        pathTextReversePath: true,
        pathCommands: [
          { type: "moveTo", x: 0, y: 0 },
          { type: "lineTo", x: 5, y: 0 }
        ],
        style: { fill: "black" }
      }
    ]
  });
  const svg = renderSvg(scene, { margin: 0, mathRenderer: "svg-text" });
  const glyphs = [...svg.matchAll(/class="tikz-decoration-glyph" x="([^"]+)"[^>]*transform="rotate\((-?\d+(?:\.\d+)?) [^"]+\)">([A-Z])<\/text>/g)]
    .map((match) => ({ x: Number(match[1]), angle: Number(match[2]), text: match[3] }));

  assert.deepEqual(glyphs.map((glyph) => glyph.text), ["A", "B"]);
  assert.ok(glyphs[0].x > glyphs[1].x, `reverse path should start the text at the visual end: ${JSON.stringify(glyphs)}`);
  assert.ok(Math.abs(Math.abs(glyphs[0].angle) - 180) < 1e-6, `expected reverse tangent angle, got ${glyphs[0].angle}`);
});

test("repeats decorations.text source glyphs without placing a partial terminal box", () => {
  const scene = createSceneGraph({
    items: [
      {
        type: "textNode",
        subtype: "decoration-text",
        text: "AB",
        pathTextRepeat: 1,
        pathCommands: [
          { type: "moveTo", x: 0, y: 0 },
          { type: "lineTo", x: 5, y: 0 }
        ],
        style: { fill: "black" }
      },
      {
        type: "textNode",
        subtype: "decoration-text",
        text: "AB ",
        pathTextRepeat: -1,
        pathCommands: [
          { type: "moveTo", x: 0, y: 1 },
          { type: "lineTo", x: 2, y: 1 }
        ],
        style: { fill: "black" }
      }
    ]
  });
  const svg = renderSvg(scene, { margin: 0, mathRenderer: "svg-text" });
  const textRuns = [...svg.matchAll(/class="tikz-decoration-glyph"[^>]*>([A-Z])<\/text>/g)].map((match) => match[1]);
  const xPositions = [...svg.matchAll(/class="tikz-decoration-glyph" x="([^"]+)"/g)].map((match) => Number(match[1]));

  assert.deepEqual(textRuns.slice(0, 4), ["A", "B", "A", "B"]);
  assert.ok(textRuns.length > 6, "negative repeat text should keep cycling until the path ends");
  assert.ok(xPositions.every((x) => x <= 500 + 1e-6), `glyph centers must stay inside their path: ${xPositions.join(", ")}`);
});

test("groups decorations.text words into one tangent-aligned text box", () => {
  const scene = createSceneGraph({
    items: [
      {
        type: "textNode",
        subtype: "decoration-text",
        text: "group words",
        pathTextEffects: ["group"],
        pathCommands: [
          { type: "moveTo", x: 0, y: 0 },
          { type: "curveTo", x1: 1, y1: 2, x2: 4, y2: 2, x: 5, y: 0 }
        ],
        style: { fill: "black" }
      },
      {
        type: "textNode",
        subtype: "decoration-text",
        text: "left-right",
        pathTextEffects: ["group", "reverse"],
        pathTextWordSeparator: "-",
        pathCommands: [
          { type: "moveTo", x: 0, y: -1 },
          { type: "lineTo", x: 5, y: -1 }
        ],
        style: { fill: "black" }
      },
      {
        type: "textNode",
        subtype: "decoration-text",
        text: "left-right",
        pathTextEffects: ["reverse", "group"],
        pathTextWordSeparator: "-",
        pathCommands: [
          { type: "moveTo", x: 0, y: -2 },
          { type: "lineTo", x: 5, y: -2 }
        ],
        style: { fill: "black" }
      }
    ]
  });
  const svg = renderSvg(scene, { margin: 0, mathRenderer: "svg-text" });
  const words = [...svg.matchAll(/class="tikz-decoration-word"[^>]*>([^<]+)<\/text>/g)].map((match) => match[1]);

  assert.deepEqual(words, ["group", "words", "right", "left", "thgir", "tfel"]);
  assert.equal((svg.match(/class="tikz-decoration-glyph"/g) || []).length, 2, "the two word separators remain individual boxes");
  assert.match(svg, />-<\/text>/);
});

test("places braced inline decoration math as one TeX box with a lowered script", () => {
  const scene = createSceneGraph({
    items: [
      {
        type: "textNode",
        subtype: "decoration-text",
        text: String.raw`Aktion {$a_k$}`,
        pathCommands: [
          { type: "moveTo", x: 0, y: 0 },
          { type: "lineTo", x: 5, y: 0 }
        ],
        pathTextAlign: "center",
        style: { fill: "black" }
      }
    ]
  });
  const svg = renderSvg(scene, { margin: 0, mathRenderer: "svg-text" });
  const box = svg.match(/class="tikz-decoration-math-box" x="([^"]+)" y="([^"]+)"[^>]+font-family="TikZKitMath_Math[^>]+font-style="italic"[^>]*>a<tspan font-size="([^"]+)" baseline-shift="sub">k<\/tspan><\/text>/);

  assert.ok(box, "expected a single math italic decoration box for the braced formula");
  assert.ok(Number(box[3]) < 30, `expected a smaller script font, got ${box[3]}`);
  assert.equal((svg.match(/class="tikz-decoration-math-box"/g) || []).length, 1);
  assert.doesNotMatch(svg, />ₖ<\/text>/);
});

test("honors decorations.text alignment, indents, fit spacing, and signed raise", () => {
  const pathCommands = [
    { type: "moveTo", x: 0, y: 0 },
    { type: "lineTo", x: 10, y: 0 }
  ];
  const scene = createSceneGraph({
    items: [
      {
        type: "textNode",
        subtype: "decoration-text",
        text: "L",
        pathCommands,
        pathTextAlign: "left",
        pathLeftIndent: 1,
        style: { fill: "black" }
      },
      {
        type: "textNode",
        subtype: "decoration-text",
        text: "C",
        pathCommands,
        pathTextAlign: "center",
        pathLeftIndent: 1,
        pathRightIndent: 3,
        style: { fill: "black" }
      },
      {
        type: "textNode",
        subtype: "decoration-text",
        text: "R",
        pathCommands,
        pathTextAlign: "right",
        pathRightIndent: 1,
        style: { fill: "black" }
      },
      {
        type: "textNode",
        subtype: "decoration-text",
        text: "A B",
        pathCommands,
        pathTextAlign: "left",
        pathTextFitToPath: true,
        pathTextFitToPathStretchingSpaces: true,
        pathRaise: -0.2,
        style: { fill: "black" }
      }
    ]
  });
  const svg = renderSvg(scene, { margin: 0, mathRenderer: "svg-text" });
  const glyph = (character) => {
    const match = svg.match(new RegExp(`<text class="tikz-decoration-glyph" x="([^"]+)" y="([^"]+)"[^>]*>${character}</text>`));
    assert.ok(match, `expected ${character} decoration glyph`);
    return { x: Number(match[1]), y: Number(match[2]) };
  };

  const left = glyph("L");
  const center = glyph("C");
  const right = glyph("R");
  const fittedA = glyph("A");

  assert.ok(left.x < center.x && center.x < right.x, `expected left/center/right placement: ${left.x}, ${center.x}, ${right.x}`);
  assert.ok(left.x > 90 && left.x < 130, `expected 1cm left indent, got x=${left.x}`);
  assert.ok(right.x > 850 && right.x < 910, `expected 1cm right indent, got x=${right.x}`);
  assert.ok(fittedA.y > 15 && fittedA.y < 25, `expected negative raise below the path, got y=${fittedA.y}`);
});

test("uses the normal TikZ text size for decoration text", () => {
  const scene = createSceneGraph({
    items: [
      {
        type: "textNode",
        subtype: "decoration-text",
        text: "human-level error",
        pathCommands: [
          { type: "moveTo", x: 0, y: 0 },
          { type: "lineTo", x: 5, y: 0 }
        ],
        style: { fill: "black" }
      }
    ]
  });
  const svg = renderSvg(scene, { margin: 0, mathRenderer: "svg-text" });
  const fontSize = Number(svg.match(/class="tikz-decoration-glyph"[^>]+font-size="([^"]+)"/)?.[1]);

  assert.ok(fontSize > 35 && fontSize < 35.3, `expected the native 10pt TikZ text size, got ${fontSize}`);
});

test("uses SVG point units and stroke bounds for no-margin path documents", () => {
  const scene = createSceneGraph({
    items: [
      {
        type: "path",
        commands: [
          { type: "moveTo", x: 0, y: 0 },
          { type: "lineTo", x: 0, y: 2 }
        ],
        style: { stroke: "black", fill: "none", lineWidth: 1.4058392143307286 }
      },
      {
        type: "path",
        commands: [
          { type: "moveTo", x: 2, y: 0 },
          { type: "lineTo", x: 2, y: 2 }
        ],
        style: { stroke: "black", fill: "none", lineWidth: 1.4058392143307286 }
      },
      {
        type: "path",
        commands: [
          { type: "moveTo", x: 0, y: 0 },
          { type: "lineTo", x: 2, y: 0 }
        ],
        style: { stroke: "black", fill: "none", lineWidth: 1.4058392143307286 }
      },
      {
        type: "path",
        commands: [
          { type: "moveTo", x: 0, y: 2 },
          { type: "lineTo", x: 2, y: 2 }
        ],
        style: { stroke: "black", fill: "none", lineWidth: 1.4058392143307286 }
      }
    ]
  });

  const svg = renderSvg(scene, { margin: 0 });
  const widthPt = Number(svg.match(/width="([^"]+)pt"/)?.[1]);
  const heightPt = Number(svg.match(/height="([^"]+)pt"/)?.[1]);

  assert.ok(widthPt > 57.08);
  assert.ok(widthPt < 57.11);
  assert.ok(heightPt > 57.08);
  assert.ok(heightPt < 57.11);
});

test("keeps svg-text math node bounds close to TikZ glyph boxes", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
  \node[draw, rounded corners=2pt, inner sep=3pt] at (0,0) {$x^2+y^2=1$};
\end{tikzpicture}`, { margin: 0, mathRenderer: "svg-text" });
  const widthPt = Number(result.svg.match(/width="([^"]+)pt"/)?.[1]);
  const heightPt = Number(result.svg.match(/height="([^"]+)pt"/)?.[1]);
  const nodeBox = result.ir.items.find((item) => item.type === "nodeBox");

  assert.ok(widthPt > 56.4, `expected width close to tikztosvg 56.69pt, got ${widthPt}pt`);
  assert.ok(widthPt < 56.8, `expected width close to tikztosvg 56.69pt, got ${widthPt}pt`);
  assert.ok(heightPt > 16.1, `expected height close to tikztosvg 16.42pt, got ${heightPt}pt`);
  assert.ok(heightPt < 16.5, `expected height close to tikztosvg 16.42pt, got ${heightPt}pt`);
  assert.ok(nodeBox.width > 1.8, `expected visible node width to cover formula, got ${nodeBox.width}cm`);
});

test("does not double-shift simple superscripts in svg-text math fallback", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
  \node at (0,0) {$x^2+y^2=1$};
\end{tikzpicture}`, { margin: 0, mathRenderer: "svg-text" });

  assert.doesNotMatch(result.svg, /baseline-shift="super"[^>]*\bdy="/);
});

test("renders amsmath xrightarrow as an extensible labeled SVG relation", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
  \node at (0,0) {$T \xrightarrow{\text{Liften}} \mathbb{R}^2 / \mathbb{Z}^2$};
\end{tikzpicture}`, { margin: 0, mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.match(result.svg, /class="tikz-math-extensible-arrow" data-direction="right"/);
  assert.match(result.svg, /class="tikz-math-arrow-label"[^>]*>Liften<\/text>/);
  assert.match(result.svg, /class="tikz-math-arrow-shaft"/);
  assert.match(result.svg, /class="tikz-math-arrow-head"/);
  assert.doesNotMatch(result.svg, /xrightarrow/);

  const box = estimateFormulaBox(String.raw`T \xrightarrow{\text{Liften}} \mathbb{R}^2 / \mathbb{Z}^2`, {
    minWidth: 0,
    widthPadding: 0
  });
  assert.ok(box.width * 28.45274 > 67.65 && box.width * 28.45274 < 67.95, `expected TeX width 67.81pt, got ${box.width * 28.45274}pt`);
  assert.ok(box.height * 28.45274 > 11.45 && box.height * 28.45274 < 11.6, `expected TeX height 11.53pt, got ${box.height * 28.45274}pt`);
  assert.ok(box.depth * 28.45274 > 2.42 && box.depth * 28.45274 < 2.58, `expected TeX depth 2.5pt, got ${box.depth * 28.45274}pt`);

  const fragmentY = Number(result.svg.match(/class="tikz-math-arrow-fragment"[^>]*\by="([^"]+)"/)?.[1]);
  const textNode = result.ir.items.find((item) => item.type === "textNode");
  assert.ok(Number.isFinite(fragmentY));
  assert.ok(fragmentY > -textNode.y * 100 + 15, "expected the TeX baseline below the node center for an asymmetric xrightarrow box");
  assert.ok(textNode.nodeLayoutWidth > box.width, "expected TikZ inner xsep in the invisible node layout box");
  assert.ok(textNode.nodeLayoutHeight > box.height + box.depth, "expected TikZ inner ysep in the invisible node layout box");
  assert.match(result.svg, /tikz-math-arrow-fragment[^>]*dominant-baseline="alphabetic"/);
});

test("renders xleftarrow optional lower and required upper labels", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
  \node at (0,0) {$B \xleftarrow[g]{f} A$};
\end{tikzpicture}`, { margin: 0, mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.match(result.svg, /class="tikz-math-extensible-arrow" data-direction="left"/);
  assert.match(result.svg, />f<\/text>/);
  assert.match(result.svg, />g<\/text>/);
});

test("renders simple math variables as TeX-like glyph paths in svg-text mode", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
  \draw[thick, -stealth] (0,0) -- node[above] {$x$} (2,0);
\end{tikzpicture}`, { margin: 0, mathRenderer: "svg-text" });

  assert.match(result.svg, /class="tikz-math-glyph tikz-math-glyph-x"/);
  assert.doesNotMatch(result.svg, /<text[^>]*>\s*x\s*<\/text>/);
});

test("keeps sansmath variables as math italic while preserving the sans math version", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
  \node[font=\sansmath\sffamily] at (0,0) {$x$};
  \node[font=\sansmath\sffamily] at (1,0) {$f(x)$};
  \end{tikzpicture}`, { margin: 0, mathRenderer: "svg-text" });

  assert.equal(result.ir.items[0].font.mathVersion, "sans");
  assert.match(result.svg, /class="tikz-math-glyph tikz-math-glyph-x"/);
  assert.doesNotMatch(result.svg, /font-family="TikZKitCMUSans, 'CMU Sans Serif', sans-serif"[^>]*>x<\/text>/);
});

test("svg-text sansmath keeps variables italic but makes digits, roman text, and bold vectors sans", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
  \node[font=\sansmath\sffamily] at (0,0) {$x+123\,\mathrm{km}=\mathbf{v}$};
  \end{tikzpicture}`, { margin: 0, mathRenderer: "svg-text" });

  assert.match(result.svg, /font-family="TikZKitCMUSans, 'CMU Sans Serif', sans-serif" font-style="normal">1<\/tspan>/);
  assert.match(result.svg, /font-family="TikZKitCMUSans, 'CMU Sans Serif', sans-serif" font-style="normal">km<\/tspan>/);
  assert.match(result.svg, /font-family="TikZKitCMUSans, 'CMU Sans Serif', sans-serif" font-style="normal" font-weight="700">v<\/tspan>/);
  assert.match(result.svg, />x<tspan/);
});

test("scopes KaTeX sansmath digits and bold vectors without leaking a KaTeX class", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
  \node[font=\sansmath\sffamily] at (0,0) {$x+123\,\mathrm{km}=\mathbf{v}$};
  \end{tikzpicture}`, { margin: 0 });

  assert.match(result.svg, /tikzkit-math-root tikzkit-math-sans/);
  assert.match(result.svg, /tikzkit-math-mathboldsf/);
  assert.match(result.svg, /TikZKitCMUSans/);
  assert.doesNotMatch(result.svg, /class="[^\"]*\bkatex\b/);
});

test("applies helvet's sans-family default to text and sansmath glyphs", () => {
  const svgText = tikzToSvg(String.raw`\usepackage{helvet}
\usepackage{sansmath}
\begin{tikzpicture}
  \node[font=\sansmath\sffamily] at (0,0) {$x+123\,\mathrm{km}=\mathbf{v}$};
  \node[font=\sffamily] at (0,-1) {Helvetica text};
\end{tikzpicture}`, { margin: 0, mathRenderer: "svg-text" });

  assert.deepEqual(svgText.diagnostics, []);
  assert.equal(svgText.ir.items[0].font.family, "helvetica");
  assert.match(svgText.svg, /font-family="Helvetica, Arial, sans-serif" font-style="normal">1<\/tspan>/);
  assert.match(svgText.svg, /font-family="Helvetica, Arial, sans-serif"[^>]*>Helvetica text<\/text>/);
  assert.doesNotMatch(svgText.svg, /tikzkithelvetfamily/);

  const html = tikzToSvg(String.raw`\usepackage{helvet}\usepackage{sansmath}
\begin{tikzpicture}\node[font=\sansmath\sffamily] at (0,0) {$x+1$};\end{tikzpicture}`, { margin: 0 });
  assert.match(html.svg, /tikzkit-math-helvetica/);
  assert.match(html.svg, /font-family:Helvetica,Arial,sans-serif/);
});

test("renders simple y math glyph at anchored node positions without NaN transforms", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
  \node[anchor=west] at (0.91,5.106) {$y$};
  \node[anchor=north west] at (0.91,4.5) {$y$};
\end{tikzpicture}`, { margin: 0, mathRenderer: "svg-text" });

  assert.match(result.svg, /class="tikz-math-glyph tikz-math-glyph-y"/);
  assert.doesNotMatch(result.svg, /NaN/);
});

test("ignores empty text nodes when computing svg bounds", () => {
  const scene = createSceneGraph({
    items: [
      {
        type: "path",
        commands: [
          { type: "moveTo", x: 0, y: 0 },
          { type: "lineTo", x: 0, y: 5.67 }
        ],
        style: { stroke: "black", fill: "none", lineWidth: 0.4 }
      },
      { type: "textNode", text: "", x: 0, y: 5.9, style: { fill: "black" } }
    ]
  });
  const svg = renderSvg(scene, { margin: 0, mathRenderer: "svg-text" });
  const viewTopCm = -Number(svg.match(/viewBox="[-\d.]+ ([-\d.]+) /)?.[1]) / 100;

  assert.ok(viewTopCm < 5.68, `expected empty text not to expand top bound, got ${viewTopCm}cm`);
  assert.doesNotMatch(svg, /<text[^>]*>\s*<\/text>/);
});

test("matches tikztosvg bounds for the basic arrow math label", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
  \draw[thick, -stealth] (0,0) -- node[above] {$x$} (2,0);
\end{tikzpicture}`, { margin: 0, mathRenderer: "svg-text" });
  const widthPt = Number(result.svg.match(/width="([^"]+)pt"/)?.[1]);
  const heightPt = Number(result.svg.match(/height="([^"]+)pt"/)?.[1]);

  assert.ok(widthPt > 57.45, `expected width close to tikztosvg 57.49pt, got ${widthPt}pt`);
  assert.ok(widthPt < 57.53, `expected width close to tikztosvg 57.49pt, got ${widthPt}pt`);
  assert.ok(heightPt > 11.65, `expected height close to tikztosvg 11.73pt, got ${heightPt}pt`);
  assert.ok(heightPt < 11.8, `expected height close to tikztosvg 11.73pt, got ${heightPt}pt`);
});

test("renders simple scripted polynomial math as TeX-like glyph paths in svg-text mode", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
  \node[draw, rounded corners=2pt, inner sep=3pt] at (0,0) {$x^2+y^2=1$};
\end{tikzpicture}`, { margin: 0, mathRenderer: "svg-text" });

  assert.match(result.svg, /class="tikz-math-glyphs tikz-math-glyphs-formula"/);
  assert.match(result.svg, /class="tikz-math-glyph tikz-math-glyph-y"/);
  assert.match(result.svg, /class="tikz-math-glyph tikz-math-glyph-equals"/);
  assert.doesNotMatch(result.svg, /<text[^>]*>\s*<tspan>x<\/tspan>/);
});

test("aligns scripted polynomial glyph fallback with tikztosvg point coordinates", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
  \node[draw, rounded corners=2pt, inner sep=3pt] at (0,0) {$x^2+y^2=1$};
\end{tikzpicture}`, { margin: 0, mathRenderer: "svg-text" });
  const glyphs = mappedGlyphTransforms(result.svg);

  assert.ok(Math.abs(glyphs[0].x - 3.188) < 0.015, `expected first x glyph at 3.188pt, got ${glyphs[0].x}pt`);
  assert.ok(Math.abs(glyphs[0].y - 11.294) < 0.015, `expected main baseline at 11.294pt, got ${glyphs[0].y}pt`);
  assert.ok(Math.abs(glyphs[1].x - 8.882) < 0.015, `expected superscript 2 at 8.882pt, got ${glyphs[1].x}pt`);
  assert.ok(Math.abs(glyphs[1].y - 7.679) < 0.015, `expected superscript baseline at 7.679pt, got ${glyphs[1].y}pt`);
  assert.ok(Math.abs(glyphs[6].x - 48.50658) < 0.015, `expected final 1 glyph at 48.50658pt, got ${glyphs[6].x}pt`);
  assert.ok(Math.abs(glyphs[0].scale - 1) < 0.001, `expected tikztosvg glyph scale 1, got ${glyphs[0].scale}`);
});

test("renders rounded rectangle node boxes as explicit paths", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
  \node[draw, rounded corners=2pt, inner sep=3pt] at (0,0) {$x^2+y^2=1$};
\end{tikzpicture}`, { margin: 0, mathRenderer: "svg-text" });

  assert.match(result.svg, /class="tikz-node-box tikz-rounded-rectangle"/);
  assert.match(result.svg, /class="tikz-node-box tikz-rounded-rectangle" d="[^"]*\bC\b/);
  assert.doesNotMatch(result.svg, /<rect x="-99\.[^"]*"[^>]*rx="8"/);
});

test("rounds document point dimensions to tikztosvg precision", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
  \path[draw=blue, fill=blue!15, rounded corners=2pt] (0,0) -- (1.6,0) -- (1.2,1) -- cycle;
\end{tikzpicture}`, { margin: 0, mathRenderer: "svg-text" });

  assert.match(result.svg, /width="45\.75pt"/);
  assert.match(result.svg, /height="28\.74pt"/);
});

test("calibrates thick stealth arrow tip geometry against tikztosvg", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
  \draw[thick, -stealth] (0,0) -- (2,0);
\end{tikzpicture}`, { margin: 0, mathRenderer: "svg-text" });
  const tipPath = result.svg.match(/class="tikz-arrow-tip tikz-arrow-stealth" d="([^"]+)"/)?.[1] || "";
  const values = [...tipPath.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));

  assert.ok(Math.abs(values[2] + 14.566) < 0.01, `expected tikztosvg stealth length, got ${values[2]}`);
  assert.ok(Math.abs(values[3] + 7.29) < 0.01, `expected tikztosvg stealth half width, got ${values[3]}`);
  assert.ok(Math.abs(values[4] + 9.104) < 0.01, `expected tikztosvg stealth inset, got ${values[4]}`);
});

test("renders the legacy arrows-library stealth prime with PGF's curved fill-and-stroke geometry", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}[>=stealth']
  \draw[thick, ->] (0,0) -- (2,0);
\end{tikzpicture}`, { margin: 0, mathRenderer: "svg-text" });
  const tip = result.svg.match(/<path class="tikz-arrow-tip tikz-arrow-stealth-prime"[^>]+>/)?.[0] || "";

  assert.deepEqual(result.diagnostics, []);
  assert.match(tip, /\bd="M [^"]+ C [^"]+ C [^"]+ C [^"]+ Z"/);
  assert.match(tip, /fill="black"/);
  assert.match(tip, /stroke="black"/);
  assert.match(tip, /stroke-width="2\.811678"/);
  assert.match(tip, /stroke-linejoin="round"/);
});

test("calibrates thin classic stealth geometry against TeX Live 2025", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
  \draw[thin, -stealth] (0,0) -- (2,0);
\end{tikzpicture}`, { margin: 0, mathRenderer: "svg-text" });
  const tipPath = result.svg.match(/class="tikz-arrow-tip tikz-arrow-stealth" d="([^"]+)"/)?.[1] || "";
  const values = [...tipPath.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));

  assert.ok(Math.abs(values[2] + lineWidthFromPt(3.191406)) < 0.02);
  assert.ok(Math.abs(values[3] + lineWidthFromPt(1.59375)) < 0.02);
  assert.ok(Math.abs(values[4] + lineWidthFromPt(1.996094)) < 0.02);
});

function mappedGlyphTransforms(svg) {
  const view = svg.match(/viewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number);
  const widthPt = Number(svg.match(/width="([^"]+)pt"/)?.[1]);
  assert.ok(Array.isArray(view) && view.length === 4, "expected viewBox");
  assert.ok(Number.isFinite(widthPt), "expected width in pt");
  const scaleToPt = widthPt / view[2];
  return [...svg.matchAll(/tikz-math-glyph-([a-z]+)"[^>]*transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)"/g)].map((match) => ({
    key: match[1],
    x: (Number(match[2]) - view[0]) * scaleToPt,
    y: (Number(match[3]) - view[1]) * scaleToPt,
    scale: Number(match[4]) * scaleToPt
  }));
}
