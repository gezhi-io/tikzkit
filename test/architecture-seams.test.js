import assert from "node:assert/strict";
import { existsSync, statSync, readFileSync } from "node:fs";
import test from "node:test";
import { parseTikz } from "../src/frontend/index.js";
import { evaluateTikzAst, registerCoreTikz } from "../src/engine/index.js";
import { renderSvg } from "../src/renderers/svg/index.js";
import {
  appendSceneItem,
  createBoundingBoxShape,
  createMarkerShape,
  createPathShape,
  createSceneGraph,
  createTextShape,
  includePathCommandBounds,
  sceneItems
} from "../src/scene/index.js";
import {
  collectPgfplotsLibraries,
  collectPgfplotsSetOptions,
  createAxisModel,
  renderPgfplotsAxisAsTikz,
  stripPgfLibraryDeclarations
} from "../src/pgfplots/index.js";
import { capabilityMatrix, featureIds, featureRegistries } from "../src/capabilities/index.js";
import { computeSvgBounds, includeTextRenderBounds } from "../src/renderers/svg/bounds.js";
import { renderBpmnIcon, renderBpmnMarker } from "../src/renderers/svg/bpmnNodes.js";
import { isCircuitikzNodeShape, renderCircuitikzNodeBox } from "../src/renderers/svg/circuitikzNodes.js";
import { createArrowTip, TIKZ_UNIT } from "../src/tikz/metrics.js";
import { createArrowTip as compatCreateArrowTip } from "../src/tikz-metrics.js";
import { normalizeTikzText } from "../src/tikz/text.js";
import { normalizeTikzText as compatNormalizeTikzText } from "../src/tex-text.js";
import { estimateFormulaBox } from "../src/tikz/textMetrics.js";
import { estimateFormulaBox as compatEstimateFormulaBox } from "../src/math-metrics.js";
import { collectSvgDefs } from "../src/renderers/svg/defs.js";
import { createSvgView, renderSvgDocument, svgViewBox } from "../src/renderers/svg/document.js";
import { formatSvgNumber } from "../src/renderers/svg/format.js";
import { imagePlaceholderScale, renderImagePlaceholder } from "../src/renderers/svg/imagePlaceholders.js";
import { renderUnitScale, scaleStyleForRenderUnit } from "../src/renderers/svg/layout.js";
import { arrowMarkerId } from "../src/renderers/svg/markers.js";
import {
  mathFallbackFontStyle,
  mathFallbackFontWeight,
  normalizeKatexTex,
  readBalancedGroup,
  readMathScriptAtom
} from "../src/renderers/svg/mathFallbackSyntax.js";
import {
  estimateMathBox,
  mathStyleScale,
  renderMathNode,
  scopedMathForeignObjectBox,
  scopedMathHostFontSize
} from "../src/renderers/svg/mathNode.js";
import {
  coloredMathTextFallback,
  readStatefulColorCommand,
  readTextColorCommand,
  renderColoredMathTextFallback,
  renderSvgMathColorSegmentsContent,
  statefulColorMathTextFallback
} from "../src/renderers/svg/mathColorFallback.js";
import {
  inlineFractionFallback,
  renderFractionMathFallback,
  renderFractionPartContent,
  simpleFractionFallback
} from "../src/renderers/svg/mathFractionFallback.js";
import {
  renderSumLimitPartContent,
  renderSumLimitsContentFallback,
  renderSumLimitsInlineFallback,
  sumLimitsInlineFallback
} from "../src/renderers/svg/mathSumFallback.js";
import {
  hatAccentSubscriptFallback,
  renderHatSubscriptMathFallback,
  renderMathTextWithUprightOperators,
  renderScriptedSegmentsContent,
  renderSimpleSubscriptContent,
  scriptedMathFallback,
  simpleNumericSubscriptFallback
} from "../src/renderers/svg/mathScriptFallback.js";
import {
  inlineMatrixMathFallback,
  renderInlineMatrixMathFallback,
  splitSvgMatrixTopLevel
} from "../src/renderers/svg/mathMatrixFallback.js";
import { parseInlineMathMatrix } from "../src/tikz/mathMatrixSyntax.js";
import { renderScopedMathHtml } from "../src/renderers/svg/mathHtml.js";
import { scopeMathHtml, TIKZKIT_SCOPED_MATH_CSS } from "../src/renderers/svg/mathScopedCss.js";
import { nodeShapeCommands, renderLibraryShapeNodeBox } from "../src/renderers/svg/nodeShapes.js";
import { renderNodeBoxWithOverlay, renderPathPictureOverlay } from "../src/renderers/svg/nodeOverlays.js";
import { renderPathElement } from "../src/renderers/svg/paths.js";
import { estimatePlainTextRenderBounds, renderPlainTextNode } from "../src/renderers/svg/plainTextNode.js";
import { isRectangleSplitNodeShape, renderRectangleSplitNodeBox } from "../src/renderers/svg/rectangleSplitNodes.js";
import { renderEllipseSplitNodeBox } from "../src/renderers/svg/ellipseSplitNodes.js";
import { renderDiamondSplitNodeBox } from "../src/renderers/svg/diamondSplitNodes.js";
import { renderCircleSolidusNodeBox } from "../src/renderers/svg/circleSolidusNodes.js";
import {
  cleanRichTextSource,
  estimateRichTextBox,
  estimateRichTextWidthEm,
  renderInlineMathHtml,
  richTextSourceLines,
  wrapRichTextLine
} from "../src/renderers/svg/richText.js";
import {
  estimateRichTextRenderBounds,
  fitRichFontSizeToBox,
  renderRichTextNode
} from "../src/renderers/svg/richTextNode.js";
import {
  hasTextColorSegments,
  inlineBoxRects,
  parseTextColorSegments,
  renderSegmentedTextNode
} from "../src/renderers/svg/segmentedText.js";
import { styleAttributes, svgPaint } from "../src/renderers/svg/style.js";
import { applyTextContour, readContourColor } from "../src/renderers/svg/textContour.js";
import {
  formatTextLine,
  hasInlineMath as hasInlineMathNormalized,
  renderInlineSvgMathContent,
  renderSvgMathFallbackContent,
  renderSvgTextLineContent
} from "../src/renderers/svg/textLineContent.js";
import { fitFontSizeToBox } from "../src/renderers/svg/textFit.js";
import {
  baselineOffsets,
  hasInlineMathSource,
  mathLineFontStyleAttribute,
  normalizedTextAlign,
  svgTextAnchorPoint,
  textWidthScale,
  typewriterWidthScale,
  wrapTypewriterWidth,
  wrapStyledSvgTextLines,
  wrapSvgTextLine
} from "../src/renderers/svg/textLayout.js";
import {
  parseSmallMatrixBody,
  renderTensorMatrixFallback,
  tensorMatrixFallbackParts,
  tensorMatrixLabelText
} from "../src/renderers/svg/tensorMatrixFallback.js";
import { isTikzquadsNodeShape, renderTikzquadsNodeBox } from "../src/renderers/svg/tikzquadsNodes.js";
import { wrapNodeRotation } from "../src/renderers/svg/transforms.js";
import { TIKZKIT_SCOPED_MATH_CSS as compatScopedMathCss } from "../src/math-scoped-css.js";

test("exposes compiler-style frontend, engine, scene, and svg renderer seams", () => {
  const parsed = parseTikz(String.raw`
\begin{tikzpicture}
  \draw (0,0) -- (1,0);
\end{tikzpicture}`);
  const evaluated = evaluateTikzAst(parsed.ast);
  const svg = renderSvg(evaluated.ir);

  assert.equal(parsed.diagnostics.length, 0);
  assert.equal(evaluated.diagnostics.length, 0);
  assert.match(svg, /<svg class="tikz-render-svg"/);
});

test("public entry point crosses frontend, engine, and renderer seam indexes", () => {
  const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

  assert.match(source, /from "\.\/frontend\/index\.js"/);
  assert.match(source, /from "\.\/engine\/index\.js"/);
  assert.match(source, /from "\.\/renderers\/svg\/index\.js"/);
  assert.doesNotMatch(source, /from "\.\/frontend\/parser\.js"/);
  assert.doesNotMatch(source, /from "\.\/engine\/evaluate\.js"/);
  assert.doesNotMatch(source, /from "\.\/renderers\/svg\/renderSvg\.js"/);
  assert.doesNotMatch(source, /from "\.\/pgfplots\/index\.js"/);
  assert.doesNotMatch(source, /from "\.\/extensions\/index\.js"/);
  assert.doesNotMatch(source, /from "\.\/tikz\/libraries\/index\.js"/);
  assert.doesNotMatch(source, /from "\.\/packages\/index\.js"/);
});

test("internal entry point exposes implementation seams without widening public index", () => {
  const source = readFileSync(new URL("../src/internal.js", import.meta.url), "utf8");

  assert.match(source, /from "\.\/index\.js"/);
  assert.match(source, /from "\.\/pgfplots\/index\.js"/);
  assert.match(source, /from "\.\/extensions\/index\.js"/);
  assert.match(source, /from "\.\/tikz\/libraries\/index\.js"/);
  assert.match(source, /from "\.\/packages\/index\.js"/);
});

test("registers core TikZ commands and libraries behind a registry seam", () => {
  const registry = registerCoreTikz();

  assert.equal(registry.getCommand("draw").name, "draw");
  assert.equal(registry.getCommand("axis").kind, "environment");
  assert.equal(registry.getLibrary("calc").status, "builtin");
  assert.equal(registry.getLibrary("positioning").status, "builtin");
});

test("scene graph seam owns renderer-neutral drawing items", () => {
  const scene = createSceneGraph();
  appendSceneItem(scene, createPathShape([], { stroke: "black" }, { subtype: "test-path" }));
  appendSceneItem(scene, createTextShape("A", 0, 0, { fill: "black" }));
  appendSceneItem(scene, createBoundingBoxShape([{ type: "moveTo", x: 0, y: 0 }], { tightBezierBounds: true }));
  appendSceneItem(scene, createMarkerShape({ kind: "stealth", x: 1, y: 0 }));

  assert.equal(scene.type, "drawing");
  assert.equal(sceneItems(scene).length, 4);
  assert.equal(sceneItems(scene)[0].subtype, "test-path");
  assert.equal(sceneItems(scene)[2].type, "bbox");
  assert.equal(sceneItems(scene)[3].type, "marker");
});

test("scene graph seam owns path command bounding boxes", () => {
  const rendererSource = readFileSync(new URL("../src/renderers/svg/renderSvg.js", import.meta.url), "utf8");
  const boundsSource = readFileSync(new URL("../src/renderers/svg/bounds.js", import.meta.url), "utf8");
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const include = (x, y) => {
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);
  };

  includePathCommandBounds(
    [
      { type: "moveTo", x: 0, y: 0 },
      { type: "curveTo", x1: -1, y1: 1, x2: 1, y2: 2, x: 2, y: 0 }
    ],
    include,
    { tightBezierBounds: true }
  );

  assert.equal(bounds.minY, 0);
  assert.ok(bounds.maxY < 1.4);
  assert.match(boundsSource, /includePathCommandBounds/);
  assert.match(rendererSource, /from "\.\/bounds\.js"/);
  assert.doesNotMatch(rendererSource, /includePathCommandBounds/);
  assert.doesNotMatch(rendererSource, /function includeCubicBezierBounds/);
  assert.doesNotMatch(rendererSource, /function cubicExtremaParameters/);
});

test("pgfplots exposes an axis model seam before SceneGraph rendering", () => {
  const axis = createAxisModel({
    ranges: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
    geometry: { origin: { x: 0, y: 0 }, width: 2, height: 3 }
  });

  assert.equal(axis.type, "Axis");
  assert.deepEqual(axis.dataToCanvas.mapPoint({ x: 1, y: 1 }), { x: 2, y: 3 });
});

test("pgfplots owns library declarations and global option collection", () => {
  const source = String.raw`
\usepgfplotslibrary{groupplots,statistics}
\pgfplotsset{compat=newest,every axis/.style={grid=major}}
\begin{tikzpicture}\end{tikzpicture}`;

  const libraries = collectPgfplotsLibraries(source);
  const pgfplotsSet = collectPgfplotsSetOptions(source);

  assert.deepEqual(libraries.map((library) => library.name), ["groupplots", "statistics"]);
  assert.equal(libraries[0].status, "partial");
  assert.equal(libraries[1].status, "unsupported");
  assert.equal(pgfplotsSet.options.compat, "newest");
  assert.equal(pgfplotsSet.options["every axis/.style"], "grid=major");
  assert.doesNotMatch(pgfplotsSet.source, /\\pgfplotsset/);
  assert.doesNotMatch(stripPgfLibraryDeclarations(pgfplotsSet.source), /\\usepgfplotslibrary/);
});

test("pgfplots owns axis-to-tikz lowering orchestration", () => {
  const frontendSource = readFileSync(new URL("../src/frontend/latex-shell.js", import.meta.url), "utf8");
  const axisLoweringSource = readFileSync(new URL("../src/pgfplots/axisTikzLowering.js", import.meta.url), "utf8");
  const dependencies = {
    preparePgfplotsAxisOptions: (axisOptions) => axisOptions,
    parseAddplots: () => [],
    parseLegendEntries: () => [],
    isSurfacePlot: () => false,
    parsePgfplotsDeclaredFunctions: () => [],
    optionValues: () => [],
    renderTernaryAxisAsTikz: () => "",
    computeAxisRanges: () => ({ xMin: 0, xMax: 1, yMin: 0, yMax: 1 }),
    renderAddplot: () => [],
    renderAxisOverlayStatements: () => [],
    renderAxis3DBox: () => [],
    renderAxis3DTicks: () => [],
    renderAxisLabels3D: () => []
  };

  const lowered = renderPgfplotsAxisAsTikz({ grid: "major" }, "", {}, [], dependencies);

  assert.match(lowered, /axis bounds/);
  assert.match(lowered, /axis grid/);
  assert.match(axisLoweringSource, /createAxisModel/);
  assert.match(frontendSource, /renderPgfplotsAxisAsTikz/);
  assert.doesNotMatch(frontendSource, /function renderAxisAsTikz/);
  assert.doesNotMatch(frontendSource, /from "\.\.\/pgfplots\/axisLines\.js"/);
  assert.doesNotMatch(frontendSource, /from "\.\.\/pgfplots\/grid\.js"/);
});

test("capability matrix records supported and partial renderer seams", () => {
  assert.ok(featureIds.includes("path_statement"));
  assert.ok(featureIds.includes("arrow_tips"));
  assert.ok(featureIds.includes("node_text_measurement"));
  assert.ok(featureIds.includes("pgfplots_axis"));
  assert.ok(featureIds.includes("pgfplots_3d_surface"));

  for (const featureId of featureIds) {
    assert.ok(capabilityMatrix[featureId], `missing capability matrix entry for ${featureId}`);
    assert.equal(capabilityMatrix[featureId].id, featureId);
    assert.ok(["none", "partial", "stable"].includes(capabilityMatrix[featureId].parser));
    assert.ok(["none", "partial", "stable"].includes(capabilityMatrix[featureId].semantic));
    assert.ok(["none", "partial", "stable"].includes(capabilityMatrix[featureId].svg));
    assert.ok(Array.isArray(capabilityMatrix[featureId].modules));
    assert.ok(capabilityMatrix[featureId].modules.length > 0, `missing owner modules for ${featureId}`);
  }

  assert.equal(capabilityMatrix.arrow_tips.svg, "partial");
  assert.match(capabilityMatrix.arrow_tips.notes, /inline tip paths/);
  assert.equal(capabilityMatrix.pgfplots_axis.semantic, "partial");
  assert.equal(capabilityMatrix.pgfplots_3d_surface.svg, "partial");
  assert.ok(featureRegistries.tikz.includes("arrow_tips"));
  assert.ok(featureRegistries.pgfplots.includes("pgfplots_3d_surface"));
});

test("capability matrix feature fixtures point to concrete sources or checked manifests", () => {
  for (const featureId of featureIds) {
    const entry = capabilityMatrix[featureId];
    assert.ok(Array.isArray(entry.fixtures), `missing fixture list for ${featureId}`);
    assert.ok(entry.fixtures.length > 0, `missing concrete fixtures for ${featureId}`);
    for (const fixture of entry.fixtures) {
      assert.match(fixture, /^test\/fixtures\//, `${featureId} fixture must live under test/fixtures: ${fixture}`);
      assert.ok(existsSync(fixture), `${featureId} fixture does not exist: ${fixture}`);
      assert.equal(statSync(fixture).isFile(), true, `${featureId} fixture must be a file: ${fixture}`);
      if (/\.json$/.test(fixture)) {
        const manifest = JSON.parse(readFileSync(fixture, "utf8"));
        assert.ok(Array.isArray(manifest.caseIds) && manifest.caseIds.length > 0, `${featureId} manifest must name at least one case: ${fixture}`);
        assert.equal(typeof manifest.sourceManifest, "string", `${featureId} manifest must name its source manifest: ${fixture}`);
      } else {
        assert.ok(/\.(?:tex|tikz)$/.test(fixture), `${featureId} fixture must be a .tex, .tikz, or checked JSON manifest: ${fixture}`);
      }
    }
  }
});

test("tikz metrics live under the tikz seam with a legacy adapter", () => {
  assert.equal(TIKZ_UNIT, 100);
  assert.equal(createArrowTip("stealth").kind, "stealth");
  assert.equal(createArrowTip("stealth'").kind, "stealth-prime");
  assert.equal(compatCreateArrowTip, createArrowTip);
});

test("svg renderer owns scoped KaTeX CSS with a legacy adapter", () => {
  assert.equal(compatScopedMathCss, TIKZKIT_SCOPED_MATH_CSS);
  assert.match(TIKZKIT_SCOPED_MATH_CSS, /tikzkit-math-scope/);
  assert.doesNotMatch(TIKZKIT_SCOPED_MATH_CSS, /\.katex\b/);
  assert.match(scopeMathHtml('<span class="katex-html"></span>'), /tikzkit-math-html/);
  assert.match(renderScopedMathHtml("x"), /tikzkit-math-scope/);
});

test("svg renderer owns marker and arrow marker serialization", () => {
  assert.match(arrowMarkerId("stealth", { stroke: "black" }), /^arrow-stealth-/);
});

test("svg renderer owns path and inline arrow serialization", () => {
  const source = readFileSync(new URL("../src/renderers/svg/renderSvg.js", import.meta.url), "utf8");
  const arrowed = renderPathElement(
    {
      type: "path",
      commands: [{ type: "moveTo", x: 0, y: 0 }, { type: "lineTo", x: 1, y: 0 }],
      style: { stroke: "black", markerEnd: "stealth" }
    },
    100
  );

  assert.match(arrowed, /tikz-arrowed-path/);
  assert.match(source, /from "\.\/paths\.js"/);
  assert.doesNotMatch(source, /function renderArrowedPath/);
  assert.doesNotMatch(source, /function inlineArrowGeometry/);
});

test("svg renderer owns generic node shape serialization", () => {
  const source = readFileSync(new URL("../src/renderers/svg/renderSvg.js", import.meta.url), "utf8");
  const commands = nodeShapeCommands({ shape: "doubleArrow", x: 0, y: 0, width: 2, height: 1 });
  const svg = renderLibraryShapeNodeBox({ shape: "superellipse", x: 0, y: 0, width: 1, height: 1, style: { stroke: "black" } }, 100);

  assert.equal(commands.at(-1).type, "closePath");
  assert.match(svg, /tikz-node-superellipse/);
  assert.match(source, /from "\.\/nodeShapes\.js"/);
  assert.doesNotMatch(source, /function renderLibraryShapeNodeBox/);
  assert.doesNotMatch(source, /function regularPolygonNodePoints/);
  assert.doesNotMatch(source, /function cloudNodeCommands/);
});

test("svg renderer keeps circuitikz node serialization in its own module", () => {
  const source = readFileSync(new URL("../src/renderers/svg/renderSvg.js", import.meta.url), "utf8");
  const nodeBox = renderCircuitikzNodeBox(
    {
      shape: "opAmp",
      x: 0,
      y: 0,
      width: 2,
      height: 1,
      style: { stroke: "black", fill: "none", lineWidth: 1 }
    },
    100
  );

  assert.equal(isCircuitikzNodeShape("opAmp"), true);
  assert.match(nodeBox, /tikz-node-opAmp/);
  assert.match(source, /from "\.\/circuitikzNodes\.js"/);
  assert.doesNotMatch(source, /function renderCircuitikzOpAmpNodeBox/);
  assert.doesNotMatch(source, /function circuitikzTransformerCommands/);
});

test("svg renderer keeps BPMN icon and marker serialization in its own module", () => {
  const rendererSource = readFileSync(new URL("../src/renderers/svg/renderSvg.js", import.meta.url), "utf8");
  const overlaySource = readFileSync(new URL("../src/renderers/svg/nodeOverlays.js", import.meta.url), "utf8");
  const icon = renderBpmnIcon(
    {
      bpmnIcon: "message",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      style: { stroke: "black", fill: "none", lineWidth: 1 }
    },
    100
  );
  const marker = renderBpmnMarker(
    {
      bpmnMarker: "subprocess",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      style: { stroke: "black", fill: "none", lineWidth: 1 }
    },
    100
  );

  assert.match(icon, /tikz-bpmn-icon tikz-bpmn-message/);
  assert.match(marker, /tikz-bpmn-marker tikz-bpmn-subprocess/);
  assert.match(rendererSource, /from "\.\/nodeOverlays\.js"/);
  assert.match(overlaySource, /from "\.\/bpmnNodes\.js"/);
  assert.doesNotMatch(rendererSource, /function renderBpmnIcon/);
  assert.doesNotMatch(rendererSource, /function renderBpmnMarker/);
});

test("svg renderer keeps node overlays and node rotation in dedicated modules", () => {
  const source = readFileSync(new URL("../src/renderers/svg/renderSvg.js", import.meta.url), "utf8");
  const base = '<rect class="base" />';
  const item = {
    shape: "rectangle",
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    rx: 0,
    rotation: 30,
    style: { stroke: "black", fill: "none", lineWidth: 1 },
    pathPicture: "path picture bounding box"
  };

  assert.match(renderNodeBoxWithOverlay(item, base, 100), /transform="rotate\(-30 0 0\)"/);
  assert.match(renderPathPictureOverlay(item, 100), /stroke-width="1"/);
  assert.match(wrapNodeRotation(base, item, 100), /rotate\(-30 0 0\)/);
  assert.match(source, /from "\.\/nodeOverlays\.js"/);
  assert.match(source, /from "\.\/transforms\.js"/);
  assert.doesNotMatch(source, /function renderNodeBoxWithOverlay/);
  assert.doesNotMatch(source, /function renderNodeBoxShadow/);
  assert.doesNotMatch(source, /function wrapNodeRotation/);
});

test("svg renderer owns style attribute and paint serialization", () => {
  assert.equal(svgPaint("green!50!black"), "rgb(0 128 0)");
  assert.match(styleAttributes({ stroke: "black", fill: "none", lineWidth: 2 }), /stroke-width="2"/);
});

test("svg renderer keeps TeX contour text stroke handling in its own module", () => {
  const source = readFileSync(new URL("../src/renderers/svg/renderSvg.js", import.meta.url), "utf8");
  const contoured = applyTextContour('<text x="0">A</text>', String.raw`\contour{white}{A}`);

  assert.equal(readContourColor(String.raw`\contour{red}{A}`), "red");
  assert.match(contoured, /stroke="white"/);
  assert.match(contoured, /paint-order="stroke fill"/);
  assert.match(source, /from "\.\/textContour\.js"/);
  assert.doesNotMatch(source, /function applyTextContour/);
  assert.doesNotMatch(source, /function readContourColor/);
});

test("svg renderer keeps tikzquads node serialization in its own module", () => {
  const source = readFileSync(new URL("../src/renderers/svg/renderSvg.js", import.meta.url), "utf8");
  const nodeBox = renderTikzquadsNodeBox(
    {
      shape: "tikzquadsQuad",
      x: 0,
      y: 0,
      width: 2,
      height: 1,
      tikzquadsKind: "quad",
      tikzquadsOptions: { "label top center": "$Q$" },
      style: { stroke: "black", fill: "white", lineWidth: 1 }
    },
    100,
    {},
    {
      estimateMathBox: () => ({ width: 16 }),
      formatTextLine: String,
      normalizeKatexTex: (tex) => tex,
      renderMathNode: () => '<text class="label">Q</text>',
      renderPlainTextNode: (_item, normalized) => `<text>${normalized.text}</text>`
    }
  );

  assert.equal(isTikzquadsNodeShape("tikzquadsQuad"), true);
  assert.match(nodeBox, /tikz-node-tikzquadsQuad/);
  assert.match(nodeBox, /class="label"/);
  assert.match(source, /from "\.\/tikzquadsNodes\.js"/);
  assert.doesNotMatch(source, /function renderTikzquadsNodeBox/);
  assert.doesNotMatch(source, /function renderTikzquadsPorts/);
  assert.doesNotMatch(source, /function renderTikzquadsText/);
});

test("svg renderer keeps rectangle split node serialization in its own module", () => {
  const source = readFileSync(new URL("../src/renderers/svg/renderSvg.js", import.meta.url), "utf8");
  const nodeBox = renderRectangleSplitNodeBox(
    {
      shape: "rectangleSplit",
      x: 0,
      y: 0,
      width: 2,
      height: 1,
      parts: 3,
      partFills: ["red", "green", "blue"],
      rectangleSplitUsesCustomFill: true,
      style: { stroke: "black", lineWidth: 1 }
    },
    100
  );

  assert.equal(isRectangleSplitNodeShape("rectangleSplit"), true);
  assert.match(nodeBox, /tikz-rectangle-split/);
  assert.match(nodeBox, /tikz-split-part/);
  assert.match(source, /from "\.\/rectangleSplitNodes\.js"/);
  assert.doesNotMatch(source, /function renderRectangleSplit/);
});

test("svg renderer keeps ellipse split node serialization in its own module", () => {
  const source = readFileSync(new URL("../src/renderers/svg/renderSvg.js", import.meta.url), "utf8");
  const nodeBox = renderEllipseSplitNodeBox(
    {
      shape: "ellipseSplit",
      x: 0,
      y: 0,
      width: 2,
      height: 1,
      style: { fill: "white", stroke: "black", lineWidth: 1 }
    },
    100
  );

  assert.match(nodeBox, /tikz-node-ellipse-split/);
  assert.match(nodeBox, /<ellipse/);
  assert.match(source, /from "\.\/ellipseSplitNodes\.js"/);
  assert.doesNotMatch(source, /function renderEllipseSplit/);
});

test("svg renderer keeps diamond split node serialization in its own module", () => {
  const source = readFileSync(new URL("../src/renderers/svg/renderSvg.js", import.meta.url), "utf8");
  const nodeBox = renderDiamondSplitNodeBox(
    {
      shape: "diamondSplit",
      x: 0,
      y: 0,
      width: 2,
      height: 1,
      shapeData: { diamondSplit: { separatorRadiusX: 0.75 } },
      style: { fill: "white", stroke: "black", lineWidth: 1 }
    },
    100
  );

  assert.match(nodeBox, /tikz-node-diamond-split/);
  assert.match(nodeBox, /<polygon/);
  assert.match(source, /from "\.\/diamondSplitNodes\.js"/);
  assert.doesNotMatch(source, /function renderDiamondSplit/);
});

test("svg renderer keeps circle solidus node serialization in its own module", () => {
  const source = readFileSync(new URL("../src/renderers/svg/renderSvg.js", import.meta.url), "utf8");
  const nodeBox = renderCircleSolidusNodeBox(
    {
      shape: "circleSolidus",
      x: 0,
      y: 0,
      width: 2,
      height: 2,
      shapeData: { circleSolidus: { size: { width: 2 }, separatorComponent: 0.6 } },
      style: { fill: "white", stroke: "black", lineWidth: 1 }
    },
    100
  );

  assert.match(nodeBox, /tikz-node-circle-solidus/);
  assert.match(nodeBox, /<circle/);
  assert.match(source, /from "\.\/circleSolidusNodes\.js"/);
  assert.doesNotMatch(source, /function renderCircleSolidus/);
});

test("svg renderer keeps image placeholder serialization in its own module", () => {
  const source = readFileSync(new URL("../src/renderers/svg/renderSvg.js", import.meta.url), "utf8");
  const svg = renderImagePlaceholder(
    {
      x: 0,
      y: 0,
      style: { fill: "black", fontScale: 2 }
    },
    {
      fileName: "gaussian.pdf",
      plot: "gaussian",
      width: 1,
      height: 0.5,
      scale: 0.5,
      grid: true
    },
    100
  );

  assert.equal(imagePlaceholderScale({ style: { fontScale: 2 } }, { scale: 0.5 }), 1);
  assert.match(svg, /tikz-gaussian/);
  assert.match(svg, /tikz-axis-grid/);
  assert.match(source, /from "\.\/imagePlaceholders\.js"/);
  assert.doesNotMatch(source, /function renderImagePlaceholder/);
  assert.doesNotMatch(source, /function renderNetworkDeviceGraphic/);
  assert.doesNotMatch(source, /function gaussianPlaceholderFill/);
});

test("svg renderer keeps math fallback syntax helpers in their own module", () => {
  const source = readFileSync(new URL("../src/renderers/svg/renderSvg.js", import.meta.url), "utf8");

  assert.deepEqual(readBalancedGroup("{a{b}}", 0), { content: "a{b}", end: 6 });
  assert.deepEqual(readMathScriptAtom(String.raw`\vec{x}_1`, 0), { source: String.raw`\vec{x}`, end: 7 });
  assert.deepEqual(readMathScriptAtom(String.raw`\vec e_1`, 0), { source: String.raw`\vec e`, end: 6 });
  assert.equal(mathFallbackFontStyle(String.raw`\mathrm{x}`), "");
  assert.equal(mathFallbackFontStyle("x"), "italic");
  assert.equal(mathFallbackFontWeight(String.raw`\mathbf{x}`), "700");
  assert.equal(normalizeKatexTex(String.raw`\mathcal X`), String.raw`\mathcal{X}`);
  assert.match(source, /from "\.\/mathFallbackSyntax\.js"/);
  assert.doesNotMatch(source, /function readMathScriptAtom/);
  assert.doesNotMatch(source, /function readBalancedGroup/);
  assert.doesNotMatch(source, /function normalizeKatexTex/);
});

test("svg renderer keeps standalone math node serialization in its own module", () => {
  const source = readFileSync(new URL("../src/renderers/svg/renderSvg.js", import.meta.url), "utf8");
  const item = { x: 0, y: 0, style: { fill: "black" } };
  const box = estimateMathBox("x_i", false, 100, 1);
  const htmlBox = scopedMathForeignObjectBox(box, false);
  const svgText = renderMathNode(item, { tex: String.raw`\frac{1}{2}`, displayMode: false, scale: 1 }, 100, { mathRenderer: "svg-text" });
  const katexText = renderMathNode(item, { tex: "x_i", displayMode: false, scale: 1 }, 100, {});

  assert.ok(box.width > 0);
  assert.ok(htmlBox.width > box.width);
  assert.ok(scopedMathHostFontSize(12) < 12);
  assert.ok(mathStyleScale(String.raw`\displaystyle x`) > 1);
  assert.match(svgText, /tikz-fraction/);
  assert.match(katexText, /tikzkit-math-scope/);
  assert.match(source, /from "\.\/mathNode\.js"/);
  assert.doesNotMatch(source, /function renderMathNode/);
  assert.doesNotMatch(source, /function estimateMathBox/);
  assert.doesNotMatch(source, /function scopedMathForeignObjectBox/);
});

test("svg renderer keeps math script fallback parsing and rendering in its own module", () => {
  const source = readFileSync(new URL("../src/renderers/svg/renderSvg.js", import.meta.url), "utf8");
  const textLineContentSource = readFileSync(new URL("../src/renderers/svg/textLineContent.js", import.meta.url), "utf8");
  const simple = simpleNumericSubscriptFallback("x_1");
  const scripted = scriptedMathFallback(String.raw`x_i+\sin x`, { allowSimpleScripts: true });
  const hat = hatAccentSubscriptFallback(String.raw`\hat x_1`);

  assert.deepEqual(simple, { base: "x", subscript: "1" });
  assert.match(renderSimpleSubscriptContent(simple, 12), /baseline-shift="sub"/);
  assert.ok(scripted?.some((segment) => segment.kind === "script"));
  assert.match(renderScriptedSegmentsContent(scripted, 12), /baseline-shift="sub"/);
  assert.match(renderMathTextWithUprightOperators("sin x"), /font-style="normal">sin/);
  assert.deepEqual(hat, { base: "x", subscript: "1" });
  assert.match(renderHatSubscriptMathFallback({ x: 0, y: 0 }, hat, 12, 100, "black", "italic", ""), /tikz-math-hat/);
  assert.match(textLineContentSource, /from "\.\/mathScriptFallback\.js"/);
  assert.doesNotMatch(source, /from "\.\/mathScriptFallback\.js"/);
  assert.doesNotMatch(source, /function simpleNumericSubscriptFallback/);
  assert.doesNotMatch(source, /function renderScriptedSegmentsContent/);
  assert.doesNotMatch(source, /function renderMathTextWithUprightOperators/);
});

test("svg renderer keeps fraction math fallback parsing and rendering in its own module", () => {
  const source = readFileSync(new URL("../src/renderers/svg/renderSvg.js", import.meta.url), "utf8");
  const mathNodeSource = readFileSync(new URL("../src/renderers/svg/mathNode.js", import.meta.url), "utf8");
  const fraction = simpleFractionFallback(String.raw`\frac{x_i}{2}`);
  const inline = inlineFractionFallback(String.raw`A+\frac{1}{2}`);
  const svg = renderFractionMathFallback({ x: 0, y: 0 }, fraction, 18, 100, "black", "italic", "");

  assert.deepEqual(fraction, { numerator: "x_i", denominator: "2" });
  assert.deepEqual(inline, { prefix: "A+", numerator: "1", denominator: "2", suffix: "" });
  assert.match(renderFractionPartContent("x_i", 12), /baseline-shift="sub"/);
  assert.match(svg, /tikz-fraction/);
  assert.match(svg, /<line /);
  assert.match(mathNodeSource, /from "\.\/mathFractionFallback\.js"/);
  assert.doesNotMatch(source, /function simpleFractionFallback/);
  assert.doesNotMatch(source, /function renderFractionMathFallback/);
  assert.doesNotMatch(source, /function renderFractionPartContent/);
});

test("svg renderer keeps math color fallback parsing and rendering in its own module", () => {
  const source = readFileSync(new URL("../src/renderers/svg/renderSvg.js", import.meta.url), "utf8");
  const textLineContentSource = readFileSync(new URL("../src/renderers/svg/textLineContent.js", import.meta.url), "utf8");
  const textColor = coloredMathTextFallback(String.raw`A+\textcolor{red}{B}`);
  const stateful = statefulColorMathTextFallback(String.raw`A+\color{blue}B`);
  const content = renderSvgMathColorSegmentsContent(stateful, 12, (tex) => tex);
  const standalone = renderColoredMathTextFallback({ x: 0, y: 0 }, textColor, 12, 100, "black", "italic", "");

  assert.deepEqual(readTextColorCommand(String.raw`\textcolor{red}{B}`, 0), { color: "red", body: "B", end: 18 });
  assert.deepEqual(readStatefulColorCommand(String.raw`\color{blue}B`, 0), { color: "blue", end: 12 });
  assert.deepEqual(textColor, [{ tex: "A+", color: null }, { tex: "B", color: "red" }]);
  assert.deepEqual(stateful, [{ tex: "A+", color: null }, { tex: "B", color: "blue" }]);
  assert.match(content, /fill="blue"/);
  assert.match(standalone, /fill="red"/);
  assert.match(textLineContentSource, /from "\.\/mathColorFallback\.js"/);
  assert.doesNotMatch(source, /from "\.\/mathColorFallback\.js"/);
  assert.doesNotMatch(source, /function coloredMathTextFallback/);
  assert.doesNotMatch(source, /function statefulColorMathTextFallback/);
  assert.doesNotMatch(source, /function renderColoredMathTextFallback/);
});

test("svg renderer keeps sum limits math fallback parsing and rendering in its own module", () => {
  const source = readFileSync(new URL("../src/renderers/svg/renderSvg.js", import.meta.url), "utf8");
  const textLineContentSource = readFileSync(new URL("../src/renderers/svg/textLineContent.js", import.meta.url), "utf8");
  const parts = sumLimitsInlineFallback(String.raw`\sum\limits_{i=1}^{10}{x_i}`);
  const inlineSvg = renderSumLimitsInlineFallback({ x: 0, y: 0 }, parts, 18, 100, "black", "italic", "");
  const contentSvg = renderSumLimitsContentFallback(String.raw`\sum_{i=1}^{10}{x_i}`, 18);

  assert.deepEqual(parts, {
    prefix: "",
    hasLimits: true,
    lower: "i=1",
    upper: "10",
    term: "x_i",
    suffix: ""
  });
  assert.match(inlineSvg, /tikz-sum-limits-inline/);
  assert.match(contentSvg, /tikz-sum-sidescripts-content/);
  assert.match(renderSumLimitPartContent("x_i", 12), /baseline-shift="sub"/);
  assert.match(textLineContentSource, /from "\.\/mathSumFallback\.js"/);
  assert.doesNotMatch(source, /from "\.\/mathSumFallback\.js"/);
  assert.doesNotMatch(source, /function sumLimitsInlineFallback/);
  assert.doesNotMatch(source, /function renderSumLimitsInlineFallback/);
  assert.doesNotMatch(source, /function renderSumLimitsContentFallback/);
});

test("svg renderer keeps SVG text line content and inline math fallback rendering in their own module", () => {
  const source = readFileSync(new URL("../src/renderers/svg/renderSvg.js", import.meta.url), "utf8");

  assert.equal(hasInlineMathNormalized({ raw: String.raw`A $x_i$`, text: "A x_i" }), true);
  assert.match(formatTextLine(String.raw`A $x_i$`), /x/);
  assert.match(renderSvgTextLineContent(String.raw`$x_i$`, "x_i", 12, 100), /baseline-shift="sub"/);
  assert.match(renderInlineSvgMathContent(String.raw`A $x_i$`, "A x_i", 12, 100), /baseline-shift="sub"/);
  assert.match(renderSvgMathFallbackContent(String.raw`\sum_{i=1}^{10}{x_i}`, 12), /tikz-sum-sidescripts-content/);
  assert.match(source, /from "\.\/textLineContent\.js"/);
  assert.doesNotMatch(source, /function formatTextLine/);
  assert.doesNotMatch(source, /function renderSvgTextLineContent/);
  assert.doesNotMatch(source, /function renderInlineSvgMathContent/);
  assert.doesNotMatch(source, /function renderSvgMathFallbackContent/);
});

test("svg renderer keeps SVG viewBox bounds computation in its own module", () => {
  const source = readFileSync(new URL("../src/renderers/svg/renderSvg.js", import.meta.url), "utf8");
  const boundsSource = readFileSync(new URL("../src/renderers/svg/bounds.js", import.meta.url), "utf8");
  const pathBounds = computeSvgBounds([
    {
      type: "path",
      commands: [{ type: "moveTo", x: -1, y: -2 }, { type: "lineTo", x: 2, y: 3 }],
      style: { stroke: "black" }
    }
  ]);
  const textBounds = computeSvgBounds([
    {
      type: "textNode",
      x: 0,
      y: 0,
      text: String.raw`A $x_i$`,
      style: { fill: "black" }
    }
  ]);
  const included = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const include = (x, y) => {
    included.minX = Math.min(included.minX, x);
    included.minY = Math.min(included.minY, y);
    included.maxX = Math.max(included.maxX, x);
    included.maxY = Math.max(included.maxY, y);
  };

  includeTextRenderBounds({ x: 1, y: 2, svgTextAnchor: "start" }, 3, 1, include);

  assert.deepEqual(pathBounds, { minX: -1, minY: -2, maxX: 2, maxY: 3 });
  assert.ok(textBounds.maxX > textBounds.minX);
  assert.equal(included.minX, 1);
  assert.equal(included.maxX, 4);
  assert.equal(fitFontSizeToBox(18, { width: 0.2, height: 0.2 }, 100, ["long text"]) < 18, true);
  assert.match(source, /from "\.\/bounds\.js"/);
  assert.match(boundsSource, /export function computeSvgBounds/);
  assert.match(boundsSource, /export function includeTextRenderBounds/);
  assert.doesNotMatch(source, /function computeBounds/);
  assert.doesNotMatch(source, /function computeSvgBounds/);
  assert.doesNotMatch(source, /function includeTextRenderBounds/);
  assert.doesNotMatch(source, /function fitFontSizeToBox/);
});

test("shared matrix syntax feeds the SVG matrix fallback without renderer parser duplication", () => {
  const source = readFileSync(new URL("../src/renderers/svg/renderSvg.js", import.meta.url), "utf8");
  const mathNodeSource = readFileSync(new URL("../src/renderers/svg/mathNode.js", import.meta.url), "utf8");
  const syntaxSource = readFileSync(new URL("../src/tikz/mathMatrixSyntax.js", import.meta.url), "utf8");
  const matrix = inlineMatrixMathFallback(String.raw`A=\begin{pmatrix}1&0\\0&1\end{pmatrix}`);
  const parsed = parseInlineMathMatrix(String.raw`A=\begin{pmatrix}1&0\\0&1\end{pmatrix}`);
  const svg = renderInlineMatrixMathFallback({ x: 0, y: 0 }, matrix, 18, 100, "black", "italic", "");

  assert.deepEqual(splitSvgMatrixTopLevel(String.raw`1&0\\0&1`, "row"), ["1&0", "0&1"]);
  assert.equal(matrix.env, "pmatrix");
  assert.deepEqual(matrix.rows, [["1", "0"], ["0", "1"]]);
  assert.deepEqual(parsed.rows, [["1", "0"], ["0", "1"]]);
  assert.match(svg, /tikz-math-matrix-inline/);
  assert.match(svg, />A\s*=<\/text>/);
  assert.match(mathNodeSource, /from "\.\/mathMatrixFallback\.js"/);
  assert.match(syntaxSource, /export function parseInlineMathMatrix/);
  assert.doesNotMatch(source, /function inlineMatrixMathFallback/);
  assert.doesNotMatch(source, /function renderInlineMatrixMathFallback/);
  assert.doesNotMatch(source, /function splitSvgMatrixTopLevel/);
});

test("svg matrix fallback retains array column alignment and @{} zero spacing", () => {
  const array = inlineMatrixMathFallback(
    String.raw`f(x)=\left\lbrace\begin{array}{@{}l@{}r@{}}a&1\\bb&22\end{array}\right.`
  );

  assert.equal(array.env, "array");
  assert.equal(array.prefix, "f(x)=");
  assert.equal(array.suffix, "");
  assert.deepEqual(array.rows, [["a", "1"], ["bb", "22"]]);
  assert.deepEqual(array.columnAlignments, ["left", "right"]);
  assert.deepEqual(array.interColumnGaps, [0]);
  assert.deepEqual(array.delimiters, { left: "curly", right: null });
});

test("svg renderer keeps tensor matrix fallback parsing and rendering in its own module", () => {
  const source = readFileSync(new URL("../src/renderers/svg/renderSvg.js", import.meta.url), "utf8");
  const mathNodeSource = readFileSync(new URL("../src/renderers/svg/mathNode.js", import.meta.url), "utf8");
  const tex = String.raw`\left[\overmat{1 $\rightarrow$ 2}{\begin{matrix}1&0\\0&1\end{matrix}}{gray}\right] \left[\undermat{\textcolor{echodrk}Layer 2}{\begin{matrix}0&1\\1&0\end{matrix}}{echodrk}\right]`;
  const parts = tensorMatrixFallbackParts(tex);
  const svg = renderTensorMatrixFallback({ x: 0, y: 0 }, parts, 18, 100, "black");

  assert.deepEqual(parseSmallMatrixBody(String.raw`\begin{matrix}1&0\\0&1\end{matrix}`), [["1", "0"], ["0", "1"]]);
  assert.equal(tensorMatrixLabelText(String.raw`1 $\rightarrow$ 2`), "1 → 2");
  assert.equal(parts.length, 2);
  assert.match(svg, /tikz-tensor-matrix/);
  assert.match(svg, /tikz-tensor-brace/);
  assert.match(mathNodeSource, /from "\.\/tensorMatrixFallback\.js"/);
  assert.doesNotMatch(source, /function tensorMatrixFallbackParts/);
  assert.doesNotMatch(source, /function renderTensorMatrixFallback/);
  assert.doesNotMatch(source, /function tensorBracePath/);
});

test("svg renderer keeps rich text wrapping and inline math HTML helpers in their own module", () => {
  const source = readFileSync(new URL("../src/renderers/svg/renderSvg.js", import.meta.url), "utf8");
  const richTextNodeSource = readFileSync(new URL("../src/renderers/svg/richTextNode.js", import.meta.url), "utf8");

  assert.equal(cleanRichTextSource(String.raw`\scriptsize When $\alpha=\gamma$`), String.raw`When $\alpha=\gamma$`);
  assert.deepEqual(richTextSourceLines(String.raw`A\\B`, { lines: [], text: "" }), ["A", "B"]);
  assert.ok(estimateRichTextWidthEm("ABC") > estimateRichTextWidthEm("A"));
  assert.ok(wrapRichTextLine("When we assume that parallel lines have equal angles", 8).length > 1);
  assert.match(renderInlineMathHtml(String.raw`$x_i$`), /tikzkit-math-scope/);
  assert.ok(estimateRichTextBox([String.raw`When $\alpha=\gamma$`], 18).width > 42);
  assert.match(source, /from "\.\/richTextNode\.js"/);
  assert.match(richTextNodeSource, /from "\.\/richText\.js"/);
  assert.doesNotMatch(source, /from "\.\/richText\.js"/);
  assert.doesNotMatch(source, /function cleanRichTextSource/);
  assert.doesNotMatch(source, /function wrapRichTextLine/);
  assert.doesNotMatch(source, /function renderInlineMathHtml/);
});

test("svg renderer keeps rich text node foreignObject rendering and bounds in their own module", () => {
  const source = readFileSync(new URL("../src/renderers/svg/renderSvg.js", import.meta.url), "utf8");
  const normalized = { raw: String.raw`When $\alpha=\gamma$`, text: "When alpha=gamma", lines: [], scale: 1 };
  const item = { x: 0, y: 0, wrapWidth: 2, style: { fill: "black" } };
  const deps = {
    fitFontSizeToBox: (fontSize) => fontSize,
    formatTextLine: String,
    renderSvgTextLineContent: (_sourceLine, formattedLine) => formattedLine
  };
  const svg = renderRichTextNode(item, normalized, 100, deps);
  const bounds = estimateRichTextRenderBounds(item, normalized, 100, deps);

  assert.match(svg, /tikz-rich-text/);
  assert.match(svg, /foreignObject/);
  assert.ok(bounds.width > 0);
  assert.ok(bounds.height > 0);
  assert.ok(fitRichFontSizeToBox(18, { width: 1, height: 1 }, 100, ["long text"], [{}], deps) <= 18);
  assert.match(source, /from "\.\/richTextNode\.js"/);
  assert.doesNotMatch(source, /function renderRichTextNode/);
  assert.doesNotMatch(source, /function estimateRichTextRenderBounds/);
  assert.doesNotMatch(source, /function fitRichFontSizeToBox/);
});

test("svg renderer keeps plain SVG text layout helpers in their own module", () => {
  const source = readFileSync(new URL("../src/renderers/svg/renderSvg.js", import.meta.url), "utf8");
  const boundsSource = readFileSync(new URL("../src/renderers/svg/bounds.js", import.meta.url), "utf8");
  const textLineContentSource = readFileSync(new URL("../src/renderers/svg/textLineContent.js", import.meta.url), "utf8");
  const wrapped = wrapStyledSvgTextLines(["$x_i$ plus text"], ["x_i plus text"], [{}], 0.8, 100, 12);

  assert.equal(normalizedTextAlign("left"), "left");
  assert.equal(normalizedTextAlign("unknown"), "center");
  assert.deepEqual(svgTextAnchorPoint({ x: 1, y: 2, svgTextAnchor: "start", svgTextX: 3 }, 100), { x: 300, y: -200, anchor: "start" });
  assert.deepEqual(baselineOffsets(10, [{ scale: 1 }, { scale: 1 }]), [-5.75, 5.75]);
  assert.equal(hasInlineMathSource(String.raw`A $x_i$`), true);
  assert.match(mathLineFontStyleAttribute("$x$"), /font-style="italic"/);
  assert.ok(wrapSvgTextLine("alpha beta gamma", 8).length > 1);
  assert.ok(typewriterWidthScale("Courier") < 1);
  assert.equal(textWidthScale({ style: {} }, "serif"), 1);
  assert.equal(textWidthScale({ style: {} }, "TikZKitCMUSans, sans-serif"), 1);
  assert.equal(textWidthScale({ style: { textWidthScale: 1 } }, "serif"), 1);
  assert.equal(textWidthScale({ style: { textWidthScale: 2 } }, "serif"), 2);
  assert.match(wrapTypewriterWidth("<text />", { x: 1 }, 100, 0.8), /tikz-typewriter-text/);
  assert.match(
    wrapTypewriterWidth("<text />", { x: 10, svgTextAnchor: "start", svgTextX: 8 }, 100, 0.79),
    /translate\(800 0\) scale\(0\.79 1\) translate\(-800 0\)/
  );
  assert.ok(wrapped.contentLines.some((line) => line.includes(String.raw`$x_i$`)));
  assert.ok(wrapped.lines.some((line) => line.includes("x_i")));
  assert.match(boundsSource, /from "\.\/textLayout\.js"/);
  assert.match(textLineContentSource, /from "\.\/textLayout\.js"/);
  assert.doesNotMatch(source, /from "\.\/textLayout\.js"/);
  assert.doesNotMatch(source, /function normalizedTextAlign/);
  assert.doesNotMatch(source, /function wrapSvgTextLine/);
  assert.doesNotMatch(source, /function typewriterWidthScale/);
  assert.doesNotMatch(source, /function hasInlineMathSource/);
});

test("svg renderer keeps plain text node rendering and bounds in their own module", () => {
  const source = readFileSync(new URL("../src/renderers/svg/renderSvg.js", import.meta.url), "utf8");
  const normalized = { text: "Hello", raw: "Hello", lines: [], scale: 1 };
  const item = { x: 1, y: 2, style: { fill: "black" } };
  const svg = renderPlainTextNode(item, normalized, 100, {
    fitFontSizeToBox: (baseFontSize) => baseFontSize,
    formatTextLine: String,
    renderSvgTextLineContent: (_sourceLine, formattedLine) => formattedLine
  });
  const bounds = estimatePlainTextRenderBounds(item, normalized, 100, {
    fitFontSizeToBox: (baseFontSize) => baseFontSize,
    formatTextLine: String
  });

  assert.match(svg, /<text /);
  assert.match(svg, />Hello<\/text>/);
  assert.ok(bounds.width > 0);
  assert.ok(bounds.height > 0);
  assert.match(source, /from "\.\/plainTextNode\.js"/);
  assert.doesNotMatch(source, /function renderPlainTextNode/);
  assert.doesNotMatch(source, /function estimatePlainTextRenderBounds/);
});

test("svg renderer keeps segmented textcolor and inline-box rendering in its own module", () => {
  const rendererSource = readFileSync(new URL("../src/renderers/svg/renderSvg.js", import.meta.url), "utf8");
  const plainTextSource = readFileSync(new URL("../src/renderers/svg/plainTextNode.js", import.meta.url), "utf8");
  const parsed = parseTextColorSegments(String.raw`A \textcolor{red}{B} \tikzinlinebox{yellow}{C}`);
  const rects = inlineBoxRects([{ background: "yellow", text: "C" }], 0, 0, 10);
  const svg = renderSegmentedTextNode(
    { x: 0, y: 0, style: { fill: "black" } },
    {
      raw: String.raw`A \textcolor{red}{B} \tikzinlinebox{yellow}{C}`,
      text: "A B C",
      lines: [],
      scale: 1
    },
    100,
    {
      fitFontSizeToBox: (baseFontSize) => baseFontSize,
      formatTextLine: String
    }
  );

  assert.equal(hasTextColorSegments(String.raw`\textcolor{red}{B}`), true);
  assert.deepEqual(parsed, [{ text: "A " }, { color: "red", text: "B" }, { text: " " }, { background: "yellow", text: "C" }]);
  assert.match(rects[0], /fill="yellow"/);
  assert.match(svg, /fill="red"/);
  assert.match(svg, /fill="yellow"/);
  assert.match(plainTextSource, /from "\.\/segmentedText\.js"/);
  assert.doesNotMatch(rendererSource, /function renderSegmentedTextNode/);
  assert.doesNotMatch(rendererSource, /function parseTextColorSegments/);
  assert.doesNotMatch(rendererSource, /function inlineBoxRects/);
});

test("svg renderer owns defs collection for patterns, gradients, fadings, and filters", () => {
  const defs = collectSvgDefs([{ style: { pattern: "north west lines", stroke: "black" } }], 100);

  assert.equal(defs.length, 1);
  assert.match(defs[0], /<pattern/);
});

test("svg renderer owns numeric formatting for SVG modules", () => {
  assert.equal(formatSvgNumber(-0), "0");
  assert.equal(formatSvgNumber(1.23456789), "1.234568");
});

test("svg renderer owns SVG document shell and viewBox serialization", () => {
  const source = readFileSync(new URL("../src/renderers/svg/renderSvg.js", import.meta.url), "utf8");
  const view = createSvgView({ minX: 0, minY: 0, maxX: 1, maxY: 1 }, 100, 5);

  assert.equal(svgViewBox(view), "-5 -105 110 110");
  assert.match(renderSvgDocument("0 0 1 1", ["<path />"]), /^<svg class="tikz-render-svg"/);
  assert.match(source, /from "\.\/document\.js"/);
  assert.doesNotMatch(source, /<svg class="tikz-render-svg"/);
  assert.doesNotMatch(source, /class="tikz-background"/);
});

test("svg renderer owns render-unit scaling for layout-sensitive modules", () => {
  const source = readFileSync(new URL("../src/renderers/svg/renderSvg.js", import.meta.url), "utf8");

  assert.equal(renderUnitScale(50), 0.5);
  assert.equal(scaleStyleForRenderUnit({ lineWidth: 2 }, 0.5).lineWidth, 1);
  assert.match(source, /from "\.\/layout\.js"/);
  assert.doesNotMatch(source, /function scaleItemsForRenderUnit/);
  assert.doesNotMatch(source, /function renderUnitScale/);
});

test("tikz text normalization and metrics live under the tikz seam", () => {
  assert.equal(compatNormalizeTikzText, normalizeTikzText);
  assert.equal(compatEstimateFormulaBox, estimateFormulaBox);
  assert.equal(normalizeTikzText(String.raw`\textbf{A}`).text, "A");
  assert.ok(estimateFormulaBox(String.raw`\frac{1}{x}`).height > 0);
});
