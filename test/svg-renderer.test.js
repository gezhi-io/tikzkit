import assert from "node:assert/strict";
import test from "node:test";
import {
  arrowMarkerId,
  blurShadowFilterId,
  collectArrowMarkerDefs,
  collectSvgDefs,
  createSvgDefs,
  createSvgTextEngine,
  createSvgView,
  escapeAttribute,
  escapeHtml,
  formatPlainTexText,
  formatSvgNumber,
  estimateMathBox,
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
import { measurePlainTextTeXBoxPt } from "../src/tikz/textMetrics.js";

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
  assert.equal(formatPlainTexText(String.raw`\strut \$ 1\,x`), "$1 x");
  assert.equal(renderPlainSvgTextContent("<x>"), "&lt;x&gt;");
  const compactMathBox = estimateMathBox("x", false, 100, 1);
  const compactForeignObjectBox = scopedMathForeignObjectBox(compactMathBox, false);
  assert.ok(compactMathBox.width < 35);
  assert.ok(compactForeignObjectBox.width < 60);
  assert.ok(compactForeignObjectBox.height < 42);
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

test("measures a supported plain Main-Regular logical TeX box", () => {
  const box = measurePlainTextTeXBoxPt("concatenate", { fontSizePt: 10 });
  const negativeDepth = measurePlainTextTeXBoxPt("=", { fontSizePt: 10 });
  const zeroDepthMixed = measurePlainTextTeXBoxPt("=a", { fontSizePt: 10 });
  const positiveDepthMixed = measurePlainTextTeXBoxPt("=g", { fontSizePt: 10 });

  assert.ok(box, "expected supported Main-Regular metrics");
  assert.ok(Math.abs(box.width - 51.666) < 0.01, `expected TeX width near 51.666pt, got ${box.width}`);
  assert.ok(Math.abs(box.height - 6.151) < 0.01, `expected TeX height near 6.151pt, got ${box.height}`);
  assert.ok(Math.abs(box.depth) < 1e-9, `expected zero TeX depth, got ${box.depth}`);
  assert.ok(Math.abs(negativeDepth.width - 7.7778) < 0.001, `expected equals width near 7.7778pt, got ${negativeDepth.width}`);
  assert.ok(Math.abs(negativeDepth.height - 3.6687) < 0.001, `expected equals height near 3.6687pt, got ${negativeDepth.height}`);
  assert.ok(Math.abs(negativeDepth.depth - -1.33125) < 0.001, `expected equals depth near -1.33125pt, got ${negativeDepth.depth}`);
  assert.ok(Math.abs(zeroDepthMixed.depth) < 1e-9, `expected mixed zero depth, got ${zeroDepthMixed.depth}`);
  assert.ok(Math.abs(positiveDepthMixed.depth - 1.9444) < 0.001, `expected mixed positive depth near 1.9444pt, got ${positiveDepthMixed.depth}`);
  assert.equal(measurePlainTextTeXBoxPt("caf\u00e9", { fontSizePt: 10 }), null);
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

test("svg text engine separates a logical TeX box from plain-text paint bounds", () => {
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
  assert.ok(payload.viewBox.width > 143 && payload.viewBox.width < 144, `expected retained paint width, got ${payload.viewBox.width}`);
  assert.ok(payload.viewBox.height > 40 && payload.viewBox.height < 41, `expected retained paint height, got ${payload.viewBox.height}`);
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

test("renders simple math variables as TeX-like glyph paths in svg-text mode", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
  \draw[thick, -stealth] (0,0) -- node[above] {$x$} (2,0);
\end{tikzpicture}`, { margin: 0, mathRenderer: "svg-text" });

  assert.match(result.svg, /class="tikz-math-glyph tikz-math-glyph-x"/);
  assert.doesNotMatch(result.svg, /<text[^>]*>\s*x\s*<\/text>/);
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
