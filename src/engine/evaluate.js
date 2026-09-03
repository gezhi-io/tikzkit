import { circleToPath, ellipseToPath, flattenPath, pathIntersectionDetails, pathLength, pointAtLength } from "./geometry.js";
import { resolveCalcExpression, resolveCalcOffsetExpression } from "../tikz/libraries/calc.js";
import { canvasPlaneSpec } from "../tikz/libraries/3d.js";
import { basicPlotMarkGeometry, plotMarkGeometryCommands } from "../tikz/libraries/plotmarks.js";
import {
  cylinderBorderPoint as geometricCylinderBorderPoint,
  cylinderGeometry as geometricCylinderGeometry,
  cylinderLayoutSize as geometricCylinderLayoutSize,
  starLayoutSize as geometricStarLayoutSize,
  starNodePoints as geometricStarNodePoints,
  trapeziumLayoutSize as geometricTrapeziumLayoutSize,
  trapeziumNodePoints as geometricTrapeziumNodePoints
} from "../tikz/libraries/shapes.geometric.js";
import {
  parseSignalDirections,
  signalBorderPoint as symbolSignalBorderPoint,
  signalGeometry as symbolSignalGeometry,
  signalLayoutSize as symbolSignalLayoutSize
} from "../tikz/libraries/shapes.symbols.js";
import { foreachIterationVariables } from "../tikz/commands/foreach.js";
import {
  addMatrixDelimiters as addMatrixLibraryDelimiters,
  isMatrixNodeOptions as isMatrixLibraryNodeOptions,
  matrixCellText as matrixLibraryCellText,
  matrixInheritedNodeOptions as matrixLibraryInheritedNodeOptions,
  matrixRowNodeOptions as matrixLibraryRowNodeOptions
} from "../tikz/libraries/matrix.js";
import {
  defaultPositioningDistance as positioningLibraryDefaultDistance,
  positioningDelta as positioningLibraryDelta,
  resolveExplicitAtPositioningOffsetPoint,
  resolvePositioningPoint,
  scalePositioningDistance as scalePositioningLibraryDistance
} from "../tikz/libraries/positioning.js";
import { evaluateMath, parseDimension, roundNumber, roundPoint, substituteTextVariables, substituteVariables } from "./math.js";
import {
  effectiveMathFontScale,
  estimateFormulaBox,
  formulaTotalHeight,
  mathTextMetricUnits,
  measurePlainTextTeXBoxPt,
  parseMathText,
  texTextWidthCm,
  wrapTeXTextLineByWidth
} from "../tikz/textMetrics.js";
import { parsePathSegments, parseStatements } from "../frontend/parser.js";
import {
  createBoundingBoxShape,
  createMarkerShape,
  createPathShape,
  createRasterImageShape,
  createSceneGraph,
  createTextShape,
  includePathCommandBounds
} from "../scene/index.js";
import { closePathCommand, curveToCommand, lineToCommand, moveToCommand } from "./pathBuilder.js";
import {
  codeDefinitionsFromOptions,
  edgeStyleHintsFromOptions,
  findTopLevel,
  normalizeColor,
  normalizeOptions,
  parseOptions,
  splitTopLevel,
  styleDefinitionsFromOptions,
  stripOuterBraces
} from "./options.js";
import {
  containsMathFallbackSpacedOperator,
  fontScaleFromTikzFont,
  mathFallbackText,
  normalizeTikzText,
  outerMinipageTextWidth
} from "../tikz/text.js";
import { createFontSpec, mergeFontSpec, parseTikzFontPatch, resolveFontSpec } from "../tex/fontSpec.js";
import {
  TIKZ_FONT_FAMILY,
  TIKZ_HELVETICA_FONT_FAMILY,
  TIKZ_MONOSPACE_FONT_FAMILY,
  TIKZ_SANS_SERIF_FONT_FAMILY,
  TIKZ_UNIT,
  createArrowTip,
  latexArrowGeometryFromLineWidth,
  lineWidthFromPt,
  lineWidthFromTikzDimension,
  stealthArrowLengthFromLineWidth,
  stealthMetaArrowGeometryFromLineWidth,
  stealthPrimeArrowDimensions,
  stealthArrowShortenFromLength
} from "../tikz/metrics.js";

const TIKZ_DEFAULT_INNER_SEP = ".3333em";
const TEX_PT_PER_CM = 28.4527559;
const EXPLICIT_NODE_FONT = Symbol("tikzkit.explicitNodeFont");
const EXPLICIT_PATH_NODE_FONT = Symbol("tikzkit.explicitPathNodeFont");
const PGF_DEFAULT_Z_VECTOR = { x: -0.385, y: -0.385 };
const DEFAULT_TEX_VARIABLES = {
  textwidth: parseDimension("345pt", {})
};

const BUILTIN_STYLES = {
  "every state": {},
  "state without output": { circle: true, draw: true, "minimum size": "2.5em", "every state": true },
  "state with output": { "circle split": true, draw: true, "minimum size": "2.5em", "every state": true },
  state: { "state without output": true },
  // tikzlibraryautomata.code.tex builds accepting states from the ordinary
  // state shape, then adds the double outline. Initial and accepting arrows
  // are after-node paths, so retain their direction until the node boundary
  // is known.
  "accepting by double": { double: true },
  accepting: { "accepting by double": true },
  "accepting by arrow": { "tikzkit automata accepting": true, "tikzkit automata accepting angle": 0 },
  "accepting above": { "accepting by arrow": true, "tikzkit automata accepting angle": 90 },
  "accepting below": { "accepting by arrow": true, "tikzkit automata accepting angle": 270 },
  "accepting left": { "accepting by arrow": true, "tikzkit automata accepting angle": 180 },
  "accepting right": { "accepting by arrow": true, "tikzkit automata accepting angle": 0 },
  "initial by diamond": { shape: "diamond" },
  "initial by arrow": { "tikzkit automata initial": true, "tikzkit automata initial angle": 180 },
  initial: { "initial by arrow": true },
  "initial above": { "initial by arrow": true, "tikzkit automata initial angle": 90 },
  "initial below": { "initial by arrow": true, "tikzkit automata initial angle": 270 },
  "initial left": { "initial by arrow": true, "tikzkit automata initial angle": 180 },
  "initial right": { "initial by arrow": true, "tikzkit automata initial angle": 0 },
  "every concept": {},
  concept: { circle: true, "tikzkit concept": true, "every concept": true },
  "extra concept": { "concept color": "black!50", "level 2 concept": true, concept: true, "every extra concept": true },
  "every extra concept": {},
  "concept connection": { "line width": "1mm", "shorten <=": "2mm", "shorten >=": "2mm", "line cap": "round", draw: "black!50" },
  mindmap: {
    "tikzkit mindmap": true,
    "grow cyclic": true,
    "very thick": true,
    "outer sep": "0pt",
    "inner sep": "1pt",
    "root concept": true,
    "text centered": true,
    "segment angle": "20",
    "every mindmap": true
  },
  "every mindmap": {},
  "root concept": { "minimum size": "4cm", "text width": "3.5cm", font: "\\large" },
  "level 1 concept": {
    "minimum size": "2.25cm",
    "level distance": "5cm",
    "text width": "2cm",
    "sibling angle": "60",
    font: "\\small"
  },
  "level 2 concept": {
    "minimum size": "1.75cm",
    "level distance": "2.9cm",
    "text width": "1.5cm",
    "sibling angle": "60",
    font: "\\footnotesize"
  },
  "level 3 concept": {
    "minimum size": "1.15cm",
    "level distance": "2.4cm",
    "text width": "1cm",
    "sibling angle": "30",
    font: "\\tiny"
  },
  "level 4 concept": {
    "minimum size": "0.9cm",
    "level distance": "1.85cm",
    "text width": "0.7cm",
    "sibling angle": "30",
    font: "\\tiny"
  },
  normalLine: { "line width": "1pt" },
  axisarrow: { ">": "open triangle 45", normalLine: true },
  "help lines": { draw: "gray", "line width": "0.2pt" },
  circ: { circle: true, draw: "black", fill: "black", "minimum size": "2.2pt", "inner sep": "0pt" }
};

export function interpretTikz(ast, options = {}) {
  const diagnostics = [];
  const ir = createSceneGraph({ backgroundItems: [], previewBorder: ast.previewBorder });
  const pictures = ast.pictures || [];
  const inlinePictureLayout = pictures.length > 1 && options.multiPictureLayout !== false;
  // PGF registers named nodes and coordinates at document scope. Keep that
  // semantic registry separate from the renderer's optional inline layout:
  // later pictures can refer to an earlier name without inheriting its
  // presentation-only translation.
  const documentCoordinates = {};
  const documentNodes = {};
  const tabularPictureIrs = new Map();
  let inlineCursorX = 0;
  let lastPictureBounds = null;

  for (let pictureIndex = 0; pictureIndex < pictures.length; pictureIndex += 1) {
    const picture = pictures[pictureIndex];
    const isTabularPicture = Boolean(picture.tabularLayout);
    const targetIr = inlinePictureLayout || isTabularPicture ? createSceneGraph({ backgroundItems: [] }) : ir;
    const pictureCoordinates = documentCoordinates;
    const baseStyles = { ...BUILTIN_STYLES, ...(picture.styles || {}) };
    const styles = { ...baseStyles, ...styleDefinitionsFromOptions(picture.options || {}, baseStyles) };
    const baseVariables = {
      ...evaluatePicturePgfMathMacros(picture.pgfMathMacros || [], DEFAULT_TEX_VARIABLES),
      ...(picture.storedVariables || {})
    };
    const pictureOptions = stripStyleDefinitionOptions(
      normalizeOptions("path", withImplicitStyleOption("every picture", picture.options || {}, styles), {
        variables: baseVariables,
        styles
      }).options
    );
    const pictureBasis = parsePictureBasis(pictureOptions, baseVariables);
    const pictureTransformEnv = {
      variables: { ...baseVariables },
      coordinates: pictureCoordinates,
      nodes: documentNodes,
      coordinateSystems: { ...(picture.coordinateSystems || {}) },
      basis: pictureBasis,
      textEngine: options.textEngine || null,
      textEngineUnit: Number(options.textEngineUnit) || TIKZ_UNIT,
      imageResolver: options.imageResolver || null,
      transform: identityTransform()
    };
    const pictureTransform = composeTransform(identityTransform(), pictureOptions, pictureTransformEnv);
    const pictureCanvasTransform = transformCanvasTransform(pictureOptions, pictureTransformEnv);
    const picturePlane = canvasPlaneEnvironment(pictureTransformEnv, pictureOptions, pictureTransform);
    const env = {
      variables: { ...baseVariables },
      coordinates: pictureCoordinates,
      nodes: documentNodes,
      coordinateSystems: { ...(picture.coordinateSystems || {}) },
      styles,
      codeHandlers: { ...(picture.codeHandlers || {}) },
      pics: { ...(picture.pics || {}) },
      circuitikz: circuitikzPackageSettings(picture.packages || ast.packages || []),
      randomLists: { ...(picture.randomLists || {}) },
      randomListCounters: {},
      patterns: { ...(picture.patterns || ast.patterns || {}) },
      shadings: { ...(picture.shadings || ast.shadings || {}) },
      textEngine: options.textEngine || null,
      textEngineUnit: Number(options.textEngineUnit) || TIKZ_UNIT,
      imageResolver: options.imageResolver || null,
      namedPaths: {},
      chains: initialChains(pictureOptions),
      activeChain: initialActiveChain(pictureOptions),
      toggles: {},
      transform: picturePlane?.transform || pictureTransform,
      // TikZ keeps coordinate and canvas transformations distinct. Coordinates
      // resolve through `transform`, then the drawing backend applies this
      // transform canvas matrix to the completed path/node geometry.
      canvasTransform: pictureCanvasTransform,
      canvasTrackingDisabled: hasTransformCanvas(pictureOptions),
      canvasScale: transformCanvasScale(pictureOptions, pictureTransformEnv),
      basis: picturePlane?.basis || pictureBasis,
      pictureOptions
    };
    for (const declaration of picture.patternDeclarations || []) {
      const pattern = pgfFormOnlyPatternDefinition(declaration, env);
      if (pattern) env.patterns[pattern.name] = pattern;
    }
    const pictureStart = { itemCount: targetIr.items.length, backgroundItemCount: targetIr.backgroundItems.length };
    for (const statement of picture.statements || []) {
      interpretStatement(statement, env, targetIr, diagnostics, options);
    }
    if (tikzBoolean(pictureOptions.framed)) {
      addFramedPicture(targetIr, pictureStart, env);
    }
    if (isTabularPicture) {
      tabularPictureIrs.set(picture.figureIndex ?? pictureIndex, targetIr);
    } else if (inlinePictureLayout) {
      const layout = appendInlinePicture(ir, targetIr, {
        ast,
        picture,
        pictureIndex,
        pictures,
        cursorX: inlineCursorX,
        previousBounds: lastPictureBounds
      });
      inlineCursorX = layout.cursorX;
      lastPictureBounds = layout.bounds;
    }
  }

  appendTabularPictureLayouts(ir, ast.tabularLayouts || [], tabularPictureIrs);

  // Keep the document-wide semantic coordinate registry observable on the
  // returned scene graph. Inline multi-picture placement can translate paint
  // items for presentation, but named TikZ coordinates retain document-space
  // values for later paths, bounds users, and public diagnostics.
  ir.coordinates = documentCoordinates;

  if (ir.backgroundItems.length) {
    ir.items = [...ir.backgroundItems, ...ir.items];
  }
  delete ir.backgroundItems;
  return { ir, diagnostics };
}

export function evaluateTikzAst(ast, options = {}) {
  return interpretTikz(ast, options);
}

function appendInlinePicture(documentIr, pictureIr, context) {
  const allPictureItems = [...(pictureIr.backgroundItems || []), ...(pictureIr.items || [])];
  const bounds = computeItemsBoundingBox(allPictureItems, null);
  let cursorX = context.cursorX;
  if (context.pictureIndex > 0) {
    cursorX = appendInterPictureText(documentIr, context, cursorX);
  }
  if (!bounds) {
    return { cursorX, bounds: context.previousBounds };
  }
  const dx = context.pictureIndex === 0 ? 0 : cursorX - bounds.minX;
  const dy = 0;
  translateItems(pictureIr.backgroundItems || [], dx, dy);
  translateItems(pictureIr.items || [], dx, dy);
  mergeTranslatedCoordinates(documentIr.coordinates, pictureIr.coordinates || {}, context.pictureIndex, dx, dy);
  documentIr.backgroundItems.push(...(pictureIr.backgroundItems || []));
  documentIr.items.push(...(pictureIr.items || []));
  const translatedBounds = translateBounds(bounds, dx, dy);
  return {
    cursorX: translatedBounds.maxX,
    bounds: translatedBounds
  };
}

const TABULAR_COLUMN_PADDING = parseDimension("6pt", {});
// LaTeX's normal tabular strut already occupies the 12pt text-box height;
// adding arbitrary vertical cell padding makes every regular row too tall.
const TABULAR_ROW_PADDING = 0;
const TABULAR_TEXT_HEIGHT = parseDimension("12pt", {});
const TABULAR_EMPTY_ROW_HEIGHT = parseDimension("11pt", {});
const TABULAR_BLOCK_GAP = 0.45;
// TeX's separate math fragments retain a small glyph side-bearing allowance
// even when a tabular r@{}l pair removes its inter-column material.
const TABULAR_SCIENTIFIC_FRAGMENT_PADDING = parseDimension("1.4pt", {});

// A document tabular is a measuring layout, not a TikZ transform. Evaluate
// every picture in its own local coordinate space, then reproduce TeX's
// column-width / row-height pass before translating paint items into the
// document scene. This keeps TikZ semantics in the engine and SVG details in
// the renderer.
function appendTabularPictureLayouts(documentIr, layouts, pictureIrs) {
  if (!layouts?.length) return;
  for (const layout of layouts) {
    const rendered = new Map();
    for (const row of layout.rows || []) {
      for (const cell of row.cells || []) {
        for (const pictureIndex of cell.pictureIndices || []) {
          const pictureIr = pictureIrs.get(pictureIndex);
          if (!pictureIr) continue;
          const items = [...(pictureIr.backgroundItems || []), ...(pictureIr.items || [])];
          const bounds = computeItemsBoundingBox(items, null);
          if (bounds) rendered.set(pictureIndex, { pictureIr, bounds });
        }
      }
    }
    appendSingleTabularPictureLayout(documentIr, layout, rendered);
  }
}

function appendSingleTabularPictureLayout(documentIr, layout, rendered) {
  const columns = layout.columns || [];
  if (!columns.length) return;
  const rows = layout.rows || [];
  const columnContentWidths = columns.map(() => 0);
  const columnPairedTextMetrics = columns.map(() => ({ left: 0, right: 0 }));
  const rowContentHeights = rows.map((row) => row.blank ? 0 : TABULAR_TEXT_HEIGHT);

  for (const row of rows) {
    for (const cell of row.cells || []) {
      const column = Number(cell.column);
      if (!Number.isInteger(column) || column < 0 || column >= columns.length) continue;
      let cellHeight = cell.text ? TABULAR_TEXT_HEIGHT : 0;
      const textLayout = tabularCellTextLayout(cell.text);
      let cellWidth = textLayout.width;
      if (textLayout.alignment) {
        columnPairedTextMetrics[column].left = Math.max(columnPairedTextMetrics[column].left, textLayout.leftWidth);
        columnPairedTextMetrics[column].right = Math.max(columnPairedTextMetrics[column].right, textLayout.rightWidth);
      }
      for (const pictureIndex of cell.pictureIndices || []) {
        const renderedPicture = rendered.get(pictureIndex);
        if (!renderedPicture) continue;
        cellWidth = Math.max(cellWidth, renderedPicture.bounds.maxX - renderedPicture.bounds.minX);
        cellHeight = Math.max(cellHeight, renderedPicture.bounds.maxY - renderedPicture.bounds.minY);
      }
      columnContentWidths[column] = Math.max(columnContentWidths[column], cellWidth);
      rowContentHeights[row.index] = Math.max(rowContentHeights[row.index], cellHeight || TABULAR_TEXT_HEIGHT);
    }
  }

  const columnWidths = columnContentWidths.map((width) => Math.max(TABULAR_TEXT_HEIGHT, width) + TABULAR_COLUMN_PADDING * 2);
  const rowHeights = rowContentHeights.map((height, index) => rows[index].blank
    ? TABULAR_EMPTY_ROW_HEIGHT
    : Math.max(TABULAR_TEXT_HEIGHT, height) + TABULAR_ROW_PADDING * 2);
  const existingBounds = computeItemsBoundingBox([
    ...(documentIr.backgroundItems || []),
    ...(documentIr.items || [])
  ], null);
  const originX = existingBounds ? existingBounds.maxX + TABULAR_BLOCK_GAP : 0;
  const originY = existingBounds ? existingBounds.maxY : 0;
  const columnStarts = [];
  let tableWidth = 0;
  for (const width of columnWidths) {
    columnStarts.push(tableWidth);
    tableWidth += width;
  }
  const tableHeight = rowHeights.reduce((total, height) => total + height, 0);
  // A tabular's TeX box includes its calculated column separation and row
  // struts, not merely the ink bounds of its glyphs. Keep that box in the
  // scene graph as a non-rendered bbox so SVG cropping follows TeX layout.
  documentIr.backgroundItems.push(createBoundingBoxShape([
    moveToCommand({ x: originX, y: originY }),
    lineToCommand({ x: originX + tableWidth, y: originY }),
    lineToCommand({ x: originX + tableWidth, y: originY - tableHeight }),
    lineToCommand({ x: originX, y: originY - tableHeight }),
    closePathCommand()
  ], { subtype: "tabular-layout-bounds" }));
  const rowCenters = [];
  let cursorY = originY;
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    if (row.rulesBefore) addTabularHorizontalRules(documentIr.backgroundItems, originX, cursorY, tableWidth, row.rulesBefore);
    const height = rowHeights[rowIndex];
    rowCenters[rowIndex] = cursorY - height / 2;
    cursorY -= height;
  }
  const lastRow = rows.at(-1);
  if (lastRow?.rulesAfter) addTabularHorizontalRules(documentIr.backgroundItems, originX, cursorY, tableWidth, lastRow.rulesAfter);
  addTabularVerticalRules(documentIr.backgroundItems, originX, originY, columns, columnWidths, tableHeight);

  for (const row of rows) {
    const centerY = rowCenters[row.index];
    for (const cell of row.cells || []) {
      const column = Number(cell.column);
      if (!Number.isInteger(column) || column < 0 || column >= columns.length) continue;
      const contentWidth = columnContentWidths[column];
      const contentLeft = originX + columnStarts[column] + TABULAR_COLUMN_PADDING;
      for (const pictureIndex of cell.pictureIndices || []) {
        const renderedPicture = rendered.get(pictureIndex);
        if (!renderedPicture) continue;
        const bounds = renderedPicture.bounds;
        const width = bounds.maxX - bounds.minX;
        const centerX = tabularContentAnchorX(columns[column].align, contentLeft, contentWidth, width);
        const dx = centerX - (bounds.minX + width / 2);
        const dy = centerY - (bounds.minY + (bounds.maxY - bounds.minY) / 2);
        translateItems(renderedPicture.pictureIr.backgroundItems || [], dx, dy);
        translateItems(renderedPicture.pictureIr.items || [], dx, dy);
        documentIr.backgroundItems.push(...(renderedPicture.pictureIr.backgroundItems || []));
        documentIr.items.push(...(renderedPicture.pictureIr.items || []));
      }
      if (cell.text) {
        const textLayout = tabularCellTextLayout(cell.text);
        if (textLayout.alignment) {
          const pairedMetrics = columnPairedTextMetrics[column];
          const pairedGroupWidth = pairedMetrics.left + pairedMetrics.right;
          const pairedAnchorX = contentLeft + Math.max(0, (contentWidth - pairedGroupWidth) / 2) + pairedMetrics.left;
          if (textLayout.left) {
            documentIr.items.push(createTextShape(
              textLayout.left,
              pairedAnchorX,
              centerY,
              tabularTextStyle(),
              { subtype: `tabular-${textLayout.alignment}-leading`, svgTextAnchor: "end", svgTextX: pairedAnchorX, font: createFontSpec() }
            ));
          }
          if (textLayout.right) {
            documentIr.items.push(createTextShape(
              textLayout.right,
              pairedAnchorX,
              centerY,
              tabularTextStyle(),
              { subtype: `tabular-${textLayout.alignment}-trailing`, svgTextAnchor: "start", svgTextX: pairedAnchorX, font: createFontSpec() }
            ));
          }
          continue;
        }
        const textX = tabularTextAnchorX(columns[column].align, contentLeft, contentWidth, textLayout.width);
        documentIr.items.push(createTextShape(
          textLayout.text,
          textX,
          centerY,
          tabularTextStyle(),
          {
            subtype: "tabular-text",
            svgTextAnchor: tabularSvgTextAnchor(columns[column].align),
            svgTextX: textX,
            font: createFontSpec()
          }
        ));
      }
    }
  }
}

function tabularContentAnchorX(align, left, width, itemWidth) {
  if (align === "l") return left + itemWidth / 2;
  if (align === "r") return left + width - itemWidth / 2;
  return left + width / 2;
}

function tabularTextWidthCm(text) {
  const source = String(text || "").trim();
  if (/^\$[\s\S]*\$$/.test(source)) {
    const formula = estimateFormulaBox(source, 1);
    if (Number.isFinite(formula?.width) && formula.width > 0) return formula.width;
  }
  return texTextWidthCm(source);
}

function tabularCellTextLayout(text) {
  const source = String(text || "").trim();
  const decimal = source.match(/^\\tikzkitdecimal\s*\{([^{}]*)\}\s*\{([^{}]*)\}$/);
  if (decimal) return tabularPairedTextLayout(source, "decimal", decimal[1], decimal[2]);
  const scientific = source.match(/^\\tikzkitscialign\s*\{([^{}]*)\}\s*\{(-?\d*)\}$/);
  if (scientific) {
    const exponent = scientific[2];
    return tabularPairedTextLayout(
      source,
      "scientific",
      `$${scientific[1]}$`,
      exponent ? `$\\cdot 10^{${exponent}}$` : ""
    );
  }
  return { text: source, width: source ? tabularTextWidthCm(source) : 0, alignment: null };
}

function tabularPairedTextLayout(source, alignment, left, right) {
  // A scientific cell has been deliberately split at TeX's exponent marker.
  // Formula-box padding belongs around the combined cell, not around both
  // fragments; otherwise the tabular's r@{}l-equivalent column grows twice.
  const width = alignment === "scientific" ? tabularScientificFragmentWidthCm : tabularTextWidthCm;
  const leftWidth = width(left);
  const rightWidth = width(right);
  return {
    text: source,
    width: leftWidth + rightWidth,
    alignment,
    left,
    right,
    leftWidth,
    rightWidth
  };
}

function tabularScientificFragmentWidthCm(text) {
  const source = String(text || "").trim();
  if (/^\$[\s\S]*\$$/.test(source)) {
    const formula = estimateFormulaBox(source, {
      minWidth: 0,
      widthPadding: TABULAR_SCIENTIFIC_FRAGMENT_PADDING
    });
    if (Number.isFinite(formula?.width) && formula.width > 0) return formula.width;
  }
  return texTextWidthCm(source);
}

function tabularTextAnchorX(align, left, width, textWidth) {
  if (align === "l") return left;
  if (align === "r") return left + width;
  return left + width / 2;
}

function tabularSvgTextAnchor(align) {
  if (align === "l") return "start";
  if (align === "r") return "end";
  return "middle";
}

function tabularTextStyle() {
  return {
    stroke: "none",
    fill: "black",
    textFill: "black",
    lineWidth: lineWidthFromPt(0.4),
    fontScale: 1,
    fontSizeBaseScale: 1,
    fontFamily: TIKZ_FONT_FAMILY
  };
}

function addTabularHorizontalRules(items, x, y, width, count) {
  for (let index = 0; index < count; index += 1) {
    const ruleY = y - index * parseDimension("2pt", {});
    items.push(createPathShape(
      [moveToCommand({ x, y: ruleY }), lineToCommand({ x: x + width, y: ruleY })],
      { stroke: "black", fill: "none", lineWidth: lineWidthFromPt(0.4) },
      { subtype: "tabular-hline" }
    ));
  }
}

function addTabularVerticalRules(items, x, top, columns, widths, height) {
  let cursorX = x;
  for (let index = 0; index < columns.length; index += 1) {
    cursorX += widths[index];
    if (!columns[index].rightRule) continue;
    items.push(createPathShape(
      [moveToCommand({ x: cursorX, y: top }), lineToCommand({ x: cursorX, y: top - height })],
      { stroke: "black", fill: "none", lineWidth: lineWidthFromPt(0.4) },
      { subtype: "tabular-vrule" }
    ));
  }
}

function appendInterPictureText(documentIr, context, cursorX) {
  const text = cleanInterPictureText(interPictureRawText(context));
  const gapBefore = 0.45;
  if (!text) return cursorX + gapBefore;
  const width = Math.max(0.2, texTextWidthCm(text));
  const vspace = interPictureVspace(interPictureRawText(context));
  const y = roundNumber((context.previousBounds?.minY ?? 0) - Math.max(0.35, vspace));
  documentIr.items.push(createTextShape(
    text,
    roundNumber(cursorX + gapBefore + width / 2),
    y,
    {
      stroke: "none",
      fill: "black",
      textFill: "black",
      lineWidth: lineWidthFromPt(0.4),
      fontScale: 1,
      fontSizeBaseScale: 1,
      fontFamily: TIKZ_FONT_FAMILY
    },
    { font: createFontSpec() }
  ));
  return roundNumber(cursorX + gapBefore + width + 0.45);
}

function interPictureRawText(context) {
  const previous = context.pictures?.[context.pictureIndex - 1];
  const current = context.picture;
  const start = Number.isFinite(previous?.endIndex) ? previous.endIndex : previous?.bodyEndIndex;
  const end = Number.isFinite(current?.beginIndex) ? current.beginIndex : start;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return "";
  return String(context.ast?.source || "").slice(start, end);
}

function cleanInterPictureText(raw = "") {
  const withoutCommands = String(raw)
    .replace(/%[^\n]*/g, "")
    .replace(/\\vspace\*?\s*\{[^}]*\}/g, "")
    .replace(/\\(?:smallskip|medskip|bigskip|par)\b/g, " ")
    .replace(/\\\\(?:\[[^\]]*\])?/g, " ");
  const text = withoutCommands.replace(/\s+/g, " ").trim();
  if (!/[A-Za-z0-9\u00A0-\uFFFF]/.test(text)) return "";
  return text;
}

function interPictureVspace(raw = "") {
  const match = String(raw).match(/\\vspace\*?\s*\{([^}]*)\}/);
  if (!match) return 0.35;
  const value = parseDimension(match[1], {});
  return Number.isFinite(value) ? Math.max(0, value) : 0.35;
}

function translateBounds(bounds, dx, dy) {
  return {
    minX: roundNumber(bounds.minX + dx),
    minY: roundNumber(bounds.minY + dy),
    maxX: roundNumber(bounds.maxX + dx),
    maxY: roundNumber(bounds.maxY + dy)
  };
}

function translateItems(items = [], dx = 0, dy = 0) {
  for (const item of items) translateItem(item, dx, dy);
}

function translateItem(item, dx, dy) {
  translatePointFields(item, dx, dy);
  if (Array.isArray(item.commands)) {
    for (const command of item.commands) translatePointFields(command, dx, dy);
  }
}

function translatePointFields(object, dx, dy) {
  if (!object || (!dx && !dy)) return;
  for (const [xKey, yKey] of [["x", "y"], ["cx", "cy"], ["x1", "y1"], ["x2", "y2"]]) {
    if (Number.isFinite(object[xKey])) object[xKey] = roundNumber(object[xKey] + dx);
    if (Number.isFinite(object[yKey])) object[yKey] = roundNumber(object[yKey] + dy);
  }
}

function mergeTranslatedCoordinates(target, coordinates, pictureIndex, dx, dy) {
  for (const [name, point] of Object.entries(coordinates || {})) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    const translated = roundPoint({ x: point.x + dx, y: point.y + dy });
    target[name] = translated;
    target[`picture${pictureIndex + 1}:${name}`] = translated;
  }
}

function evaluatePicturePgfMathMacros(macros = [], defaults = {}) {
  const variables = { ...(defaults || {}) };
  for (const macro of macros || []) {
    if (!macro?.name) continue;
    const value = evaluateMath(macro.expression, variables);
    variables[macro.name] = macro.type === "pgfmathtruncatemacro" ? Math.trunc(value) : value;
  }
  return variables;
}

function addFramedPicture(ir, pictureStart, env) {
  const items = [
    ...(ir.backgroundItems || []).slice(pictureStart.backgroundItemCount),
    ...(ir.items || []).slice(pictureStart.itemCount)
  ];
  const bounds = computeItemsBoundingBox(items, null);
  if (!bounds) return;
  const style = scaleCanvasStyle({ stroke: "black", fill: "none", lineWidth: lineWidthFromPt(0.4) }, env);
  ir.items.push(createPathShape(
    [
      moveToCommand(bounds.minX, bounds.minY),
      lineToCommand(bounds.maxX, bounds.minY),
      lineToCommand(bounds.maxX, bounds.maxY),
      lineToCommand(bounds.minX, bounds.maxY),
      closePathCommand()
    ],
    style,
    { subtype: "tikz-framed" }
  ));
}

function interpretStatement(statement, env, ir, diagnostics, options) {
  env.currentBoundingBox ||= () => computeCurrentBoundingBox(ir);
  if (statement.leadingFont) {
    applyFontSwitch(statement.leadingFont, env);
  }
  if (statement.type === "font") {
    applyFontSwitch(statement.font, env);
    return;
  }
  if (statement.type === "color") {
    applyColorDeclaration(statement.color, env);
    return;
  }
  if (statement.type === "unsupported") {
    diagnostics.push(statement.diagnostic);
    return;
  }
  if (statement.type === "noop") {
    applyNoopSideEffects(statement, env);
    return;
  }
  if (statement.type === "foreach") {
    materializeForeachPathIntersections(statement, env, diagnostics, ir);
    const foreachState = { breakRequested: false };
    for (const iteration of foreachIterationVariables(statement, env)) {
      const childVariables = iteration.variables;
      const childEnv = { ...env, variables: childVariables, currentForeach: foreachState };
      const substitutedBodySource = statement.bodySource
        ? substituteTextVariables(statement.bodySource, childVariables)
        : "";
      const children = statement.bodySource && hasDynamicForeachIfCases(substitutedBodySource)
        ? parseStatements(expandIfCaseConditionals(substitutedBodySource), diagnostics)
        : statement.body;
      for (const child of children) interpretStatement(child, childEnv, ir, diagnostics, options);
      if (foreachState.breakRequested) break;
    }
    return;
  }
  if (statement.type === "breakforeach") {
    if (env.currentForeach) env.currentForeach.breakRequested = true;
    return;
  }
  if (statement.type === "pgfmathsetmacro") {
    env.variables[statement.name] = evaluateMath(statement.expression, env.variables);
    return;
  }
  if (statement.type === "pgfmathsetlengthmacro") {
    env.variables[statement.name] = evaluateMath(statement.expression, env.variables);
    return;
  }
  if (statement.type === "pgfmathtruncatemacro") {
    env.variables[statement.name] = Math.trunc(evaluateMath(statement.expression, env.variables));
    return;
  }
  if (statement.type === "pgfmathdeclarerandomlist") {
    env.randomLists ||= {};
    env.randomListCounters ||= {};
    env.randomLists[statement.name] = statement.values || [];
    env.randomListCounters[statement.name] = 0;
    return;
  }
  if (statement.type === "pgfmathrandomitem") {
    env.randomLists ||= {};
    env.randomListCounters ||= {};
    const listName = resolveDynamicName(statement.listName, env);
    const values = env.randomLists[listName] || [];
    if (!values.length) {
      diagnostics.push({
        severity: "warning",
        message: `Unknown PGF random list ${listName}`
      });
      env.variables[statement.name] = "";
      return;
    }
    const index = env.randomListCounters[listName] || 0;
    env.variables[statement.name] = values[index % values.length];
    env.randomListCounters[listName] = index + 1;
    return;
  }
  if (statement.type === "pgfdeclarepatternformonly") {
    const declaration = pgfFormOnlyPatternDefinition(statement, env);
    if (declaration) env.patterns[declaration.name] = declaration;
    return;
  }
  if (statement.type === "pgftransformcm") {
    env.transform = composePgfTransform(env.transform, statement, env);
    return;
  }
  if (statement.type === "pgftransformreset") {
    env.transform = identityTransform();
    return;
  }
  if (statement.type === "pgfresetboundingbox") {
    excludeExistingItemsFromBoundingBox(ir);
    return;
  }
  if (statement.type === "chainin") {
    chainInExistingNode(statement, env, ir, diagnostics);
    return;
  }
  if (statement.type === "coordinate") {
    if (coordinateRendersAsNode(statement.options || {}, env)) {
      const node = createNode({ ...statement, text: "" }, env, ir, diagnostics);
      if (node && statement.children?.length) {
        createNodeTreeChildren(node, statement.children, env, ir, diagnostics, 1, statement.treeOptions || {});
      }
      return;
    }
    const point = statement.at
      ? resolveCoordinate(statement.at, env, diagnostics)
      : resolvePositioning(statement.options || {}, env) || applyCoordinateTransform({ x: 0, y: 0 }, env);
    const name = statement.name ? resolveDynamicName(statement.name, env) : null;
    if (name) env.coordinates[name] = point;
    addCoordinateLabels(statement.options || {}, point, env, ir);
    if (statement.children?.length) {
      createNodeTreeChildren(
        { name, point, width: 0, height: 0, shape: "coordinate", options: statement.options || {} },
        statement.children,
        env,
        ir,
        diagnostics,
        1,
        statement.treeOptions || {}
      );
    }
    return;
  }
  if (statement.type === "tikzset") {
    applyTikzsetStoredVariables(statement.styleOptions || {}, env);
    env.styles = {
      ...env.styles,
      ...(statement.styleOptions ? styleDefinitionsFromOptions(statement.styleOptions, env.styles) : statement.styles)
    };
    env.codeHandlers = codeDefinitionsFromOptions(statement.styleOptions || {}, env.codeHandlers || {});
    env.pics = {
      ...(env.pics || {}),
      ...(statement.pics || picDefinitionsFromOptions(statement.styleOptions || {}))
    };
    env.pictureOptions = {
      ...(env.pictureOptions || {}),
      ...tikzsetDirectOptions(statement.styleOptions || {})
    };
    return;
  }
  if (statement.type === "calendar") {
    createCalendar(statement, env, ir, diagnostics);
    return;
  }
  if (statement.type === "matrix") {
    createMatrix(statement, env, ir, diagnostics);
    return;
  }
  if (statement.type === "pic") {
    createPic(statement, env, ir, diagnostics);
    return;
  }
  if (statement.type === "spy") {
    createSpy(statement, env, ir, diagnostics);
    return;
  }
  if (statement.type === "node") {
    const node = createNode(statement, env, ir, diagnostics);
    if (node && statement.children?.length) {
      const treeEnv = statement.treeInheritedOptions
        ? {
            ...env,
            pictureOptions: {
              ...(env.pictureOptions || {}),
              ...statement.treeInheritedOptions
            }
          }
        : env;
      createNodeTreeChildren(node, statement.children, treeEnv, ir, diagnostics, 1, statement.treeOptions || {});
    }
    return;
  }
  if (statement.type === "ifnum") {
    const selected = evaluateIfNum(statement, env) ? statement.thenBody : statement.elseBody;
    for (const child of selected || []) interpretStatement(child, env, ir, diagnostics, options);
    return;
  }
  if (statement.type === "ifthenelse") {
    const selected = evaluateIfThenElseCondition(statement.condition, env.variables) ? statement.thenBody : statement.elseBody;
    for (const child of selected || []) interpretStatement(child, env, ir, diagnostics, options);
    return;
  }
  if (statement.type === "scope") {
    const scopedVariables = { ...env.variables };
    const scopeStyles = { ...env.styles, ...styleDefinitionsFromOptions(statement.options || {}, env.styles) };
    const codeEnv = { ...env, variables: scopedVariables, styles: scopeStyles };
    const scopeOptions = stripStyleDefinitionOptions(
      normalizeOptions("path", withImplicitStyleOption("every scope", statement.options || {}, scopeStyles), codeEnv).options
    );
    applyOptionCodeHandlers(scopeOptions, codeEnv);
    const scopedTransform = composeTransform(env.transform, scopeOptions, codeEnv);
    const scopedCanvasTransform = multiplyTransforms(
      env.canvasTransform || identityTransform(),
      transformCanvasTransform(scopeOptions, codeEnv)
    );
    const scopePlane = canvasPlaneEnvironment(env, scopeOptions, scopedTransform);
    const scopedEnv = {
      ...env,
      variables: scopedVariables,
      transform: scopePlane?.transform || scopedTransform,
      canvasTransform: scopedCanvasTransform,
      canvasTrackingDisabled: Boolean(env.canvasTrackingDisabled || hasTransformCanvas(scopeOptions)),
      canvasScale: env.canvasScale * transformCanvasScale(scopeOptions, codeEnv),
      basis: scopePlane?.basis || composeBasis(env.basis, scopeOptions, codeEnv),
      pictureOptions: mergeScopePictureOptions(env.pictureOptions || {}, scopeOptions),
      styles: scopeStyles
    };
    applyChainControlOptions(scopeOptions, scopedEnv, diagnostics);
    if (isBackgroundScope(scopeOptions)) {
      const backgroundIr = { ...ir, items: [], backgroundItems: [] };
      for (const child of statement.body) interpretStatement(child, scopedEnv, backgroundIr, diagnostics, options);
      ir.backgroundItems.push(...backgroundIr.backgroundItems, ...backgroundIr.items);
      return;
    }
    for (const child of statement.body) interpretStatement(child, scopedEnv, ir, diagnostics, options);
    return;
  }
  if (statement.type === "path") {
    interpretPathStatement(statement, env, ir, diagnostics);
  }
}

function materializeForeachPathIntersections(statement, env, diagnostics, ir) {
  const path = statement.body?.length === 1 && statement.body[0]?.type === "path"
    ? statement.body[0]
    : null;
  if (!path?.options) return;
  const normalized = normalizeOptions(
    path.command || "path",
    resolveDynamicOptions(path.options, env),
    env
  );
  if (!normalized.semantic["name intersections"]) return;
  for (const raw of repeatedSemanticValues(normalized.semantic["name intersections"])) {
    materializeIntersections(raw, env, diagnostics, ir);
  }
}

function hasDynamicForeachIfCases(source) {
  const text = String(source || "");
  return text.includes("\\ifcase");
}

function expandIfCaseConditionals(source) {
  let output = "";
  let cursor = 0;
  const marker = "\\ifcase";
  while (cursor < source.length) {
    const start = source.indexOf(marker, cursor);
    if (start === -1) {
      output += source.slice(cursor);
      break;
    }
    output += source.slice(cursor, start);
    const parsed = parseIfCaseConditional(source, start);
    if (!parsed) {
      output += marker;
      cursor = start + marker.length;
      continue;
    }
    output += parsed.selected;
    cursor = parsed.end;
  }
  return output;
}

function evaluateIfThenElseCondition(raw, variables = {}) {
  const condition = stripOuterBraces(String(raw || "").trim());
  if (condition.startsWith("\\lengthtest")) {
    const group = extractBalanced(condition, skipLocalWhitespace(condition, "\\lengthtest".length), "{", "}");
    return group ? evaluateLengthTest(group.content, variables) : false;
  }
  if (condition.startsWith("\\equal")) {
    let cursor = skipLocalWhitespace(condition, "\\equal".length);
    const left = extractBalanced(condition, cursor, "{", "}");
    if (!left) return false;
    cursor = skipLocalWhitespace(condition, left.end);
    const right = extractBalanced(condition, cursor, "{", "}");
    if (!right) return false;
    return substituteTextVariables(left.content, variables).trim() === substituteTextVariables(right.content, variables).trim();
  }
  const relation = findLengthTestOperator(condition);
  if (relation) {
    const left = evaluateMath(condition.slice(0, relation.index).trim(), variables);
    const right = evaluateMath(condition.slice(relation.index + relation.value.length).trim(), variables);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
    if (relation.value === "<") return left < right;
    if (relation.value === ">") return left > right;
    return Math.abs(left - right) < 1e-9;
  }
  return Math.abs(evaluateMath(condition, variables)) > 1e-12;
}

function evaluateLengthTest(raw, variables = {}) {
  const expression = substituteTextVariables(String(raw || "").trim(), variables);
  const operator = findLengthTestOperator(expression);
  if (!operator) return false;
  const left = parseDimension(expression.slice(0, operator.index).trim(), variables);
  const right = parseDimension(expression.slice(operator.index + operator.value.length).trim(), variables);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  if (operator.value === "<") return left < right;
  if (operator.value === ">") return left > right;
  return Math.abs(left - right) < 1e-9;
}

function findLengthTestOperator(expression) {
  let depth = 0;
  for (let index = 0; index < expression.length; index += 1) {
    const char = expression[index];
    if (char === "{" || char === "(" || char === "[") depth += 1;
    else if (char === "}" || char === ")" || char === "]") depth = Math.max(0, depth - 1);
    else if (depth === 0 && ["=", "<", ">"].includes(char)) {
      return { value: char, index };
    }
  }
  return null;
}

function parseIfCaseConditional(source, start) {
  let cursor = skipLocalWhitespace(source, start + "\\ifcase".length);
  const valueMatch = source.slice(cursor).match(/^-?\d+(?:\.\d+)?/);
  if (!valueMatch) return null;
  const caseIndex = Math.trunc(Number(valueMatch[0]));
  if (!Number.isFinite(caseIndex)) return null;
  cursor += valueMatch[0].length;
  const end = findMatchingIfCaseEnd(source, cursor);
  if (!end) return null;
  const branches = splitIfCaseBranches(source.slice(cursor, end.fiStart));
  return { selected: branches[caseIndex] ?? branches.elseBranch ?? "", end: end.fiEnd };
}

function findMatchingIfCaseEnd(source, start) {
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source.startsWith("\\ifcase", index)) {
      depth += 1;
      index += "\\ifcase".length - 1;
      continue;
    }
    if (source.startsWith("\\fi", index)) {
      if (depth === 0) return { fiStart: index, fiEnd: index + "\\fi".length };
      depth -= 1;
      index += "\\fi".length - 1;
    }
  }
  return null;
}

function splitIfCaseBranches(content) {
  const branches = [""];
  let active = 0;
  let elseMode = false;
  let depth = 0;
  for (let index = 0; index < content.length; index += 1) {
    if (content.startsWith("\\ifcase", index)) {
      appendIfCaseBranch(branches, active, elseMode, "\\ifcase");
      depth += 1;
      index += "\\ifcase".length - 1;
      continue;
    }
    if (content.startsWith("\\fi", index)) {
      appendIfCaseBranch(branches, active, elseMode, "\\fi");
      depth = Math.max(0, depth - 1);
      index += "\\fi".length - 1;
      continue;
    }
    if (depth === 0 && content.startsWith("\\or", index)) {
      active += 1;
      branches[active] ||= "";
      index += "\\or".length - 1;
      continue;
    }
    if (depth === 0 && content.startsWith("\\else", index)) {
      elseMode = true;
      branches.elseBranch = "";
      index += "\\else".length - 1;
      continue;
    }
    appendIfCaseBranch(branches, active, elseMode, content[index]);
  }
  return branches;
}

function appendIfCaseBranch(branches, active, elseMode, text) {
  if (elseMode) {
    branches.elseBranch = (branches.elseBranch || "") + text;
  } else {
    branches[active] = (branches[active] || "") + text;
  }
}

function skipLocalWhitespace(source, index) {
  while (index < source.length && /\s/.test(source[index])) index += 1;
  return index;
}

function isBackgroundScope(options = {}) {
  return String(options.layer || "").trim() === "background" || options["on background layer"] === true;
}

function evaluateIfNum(statement, env) {
  const left = Math.trunc(evaluateMath(statement.left, env.variables));
  const right = Math.trunc(evaluateMath(statement.right, env.variables));
  if (statement.operator === "<") return left < right;
  if (statement.operator === ">") return left > right;
  return left === right;
}

function withImplicitStyleOption(styleName, rawOptions = {}, styles = {}) {
  if (!styles?.[styleName]) return rawOptions || {};
  return { [styleName]: true, ...(rawOptions || {}) };
}

function applyOptionCodeHandlers(rawOptions = {}, env) {
  for (const [key, value] of Object.entries(rawOptions || {})) {
    const handler = env.codeHandlers?.[key];
    if (!handler) continue;
    const args = matchCodeArguments(handler.pattern, value === true ? "" : String(value));
    applyCodeHandlerBody(handler.body, args, env);
  }
}

function matchCodeArguments(pattern, rawArgument) {
  const tokens = [];
  const regexText = String(pattern || "")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/#(\d+)/g, (_match, index) => {
      tokens.push(Number(index));
      return "([\\s\\S]*?)";
    });
  const match = String(rawArgument || "").match(new RegExp(`^${regexText}$`));
  if (!match) return [rawArgument];
  const args = [];
  tokens.forEach((index, offset) => {
    args[index - 1] = match[offset + 1];
  });
  return args;
}

function applyCodeHandlerBody(body, args, env) {
  let index = 0;
  while (index < String(body || "").length) {
    const defIndex = String(body || "").indexOf("\\def\\", index);
    if (defIndex === -1) break;
    let cursor = defIndex + "\\def\\".length;
    const nameMatch = String(body).slice(cursor).match(/^[A-Za-z@]+/);
    if (!nameMatch) {
      index = cursor;
      continue;
    }
    const name = nameMatch[0];
    cursor += name.length;
    cursor = skipLocalWhitespace(body, cursor);
    const value = extractLocalBalanced(body, cursor, "{", "}");
    if (!value) {
      index = cursor;
      continue;
    }
    env.variables[name] = substituteCodeArguments(value.content, args);
    index = value.end;
  }
}

function substituteCodeArguments(value, args = []) {
  return String(value).replace(/#(\d+)/g, (_match, index) => {
    const arg = args[Number(index) - 1];
    return arg === undefined || arg === true ? "" : String(arg);
  });
}

function extractLocalBalanced(text, start, open, close) {
  if (String(text)[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < String(text).length; index += 1) {
    const char = String(text)[index];
    if (char === open) depth += 1;
    if (char === close) depth -= 1;
    if (depth === 0) {
      return {
        content: String(text).slice(start + 1, index),
        end: index + 1
      };
    }
  }
  return null;
}

function mergeScopePictureOptions(parentOptions = {}, scopeOptions = {}) {
  const merged = { ...parentOptions };
  for (const [key, value] of Object.entries(scopeOptions || {})) {
    if (isScopeTransformOption(key) || isScopeDefinitionOption(key)) continue;
    if (key === "font") {
      merged.font = [fontOptionText(merged.font), fontOptionText(value)].filter(Boolean).join(" ");
      continue;
    }
    merged[key] = value;
  }
  return merged;
}

function fontOptionText(value) {
  return value === undefined || value === null || value === true ? "" : String(value).trim();
}

function isScopeTransformOption(key) {
  const name = String(key).trim();
  if (
    ["plane origin", "plane x", "plane y", "canvas is plane"].includes(name) ||
    /^canvas is (?:xy|yx) plane at z$/.test(name) ||
    /^canvas is (?:xz|zx) plane at y$/.test(name) ||
    /^canvas is (?:yz|zy) plane at x$/.test(name)
  ) {
    return true;
  }
  return [
    "shift",
    "xshift",
    "yshift",
    "scale",
    "rotate",
    "xslant",
    "yslant",
    "transform canvas",
    "x",
    "y",
    "z",
    "layer",
    "on background layer"
  ].includes(name);
}

function isScopeDefinitionOption(key) {
  return /\/\.(?:style|code|append style|prefix style)$/.test(String(key).trim());
}

function stripStyleDefinitionOptions(options = {}) {
  const stripped = {};
  for (const [key, value] of Object.entries(options || {})) {
    if (isScopeDefinitionOption(key)) continue;
    stripped[key] = value;
  }
  return stripped;
}

function tikzsetDirectOptions(options = {}) {
  return Object.fromEntries(Object.entries(options || {}).filter(([key]) => !/\/\./.test(String(key))));
}

function applyTikzsetStoredVariables(options = {}, env = {}) {
  const styleOptions = options || {};
  for (const [rawKey, rawMacro] of Object.entries(styleOptions)) {
    const key = String(rawKey).trim();
    const storeMatch = key.match(/^(.+?)\s*\/\.store\s+in$/);
    if (!storeMatch || typeof rawMacro !== "string") continue;
    const macroMatch = rawMacro.trim().match(/^\\([A-Za-z@]+)$/);
    if (!macroMatch) continue;

    const sourceKey = storeMatch[1].trim();
    const value = styleOptions[sourceKey];
    if (value === undefined || value === null || value === true) continue;
    env.variables ||= {};
    env.variables[macroMatch[1]] = String(value).trim();
  }
}

function interpretPathStatement(statement, env, ir, diagnostics) {
  const firstItemIndex = ir.items.length;
  const pathStyles = {
    ...(env.styles || {}),
    ...styleDefinitionsFromOptions(statement.options || {}, env.styles || {})
  };
  const optionEnv = { ...env, styles: pathStyles };
  const inheritedPictureOptions = { ...(env.pictureOptions || {}) };
  for (const key of Object.keys(statement.options || {})) delete inheritedPictureOptions[key];
  const rawOptions = resolveDynamicOptions(
    withImplicitStyleOption("every path", { ...inheritedPictureOptions, ...(statement.options || {}) }, pathStyles),
    optionEnv
  );
  const normalized = normalizeOptions(statement.command, rawOptions, optionEnv);
  const { semantic, options } = normalized;
  const pathOptions = { ...options, ...semantic };
  const statementTransformOptions = normalizeOptions(
    statement.command,
    resolveDynamicOptions(statement.options || {}, optionEnv),
    optionEnv
  ).options;
  if (Object.hasOwn(statementTransformOptions, "font")) {
    pathOptions[EXPLICIT_PATH_NODE_FONT] = statementTransformOptions.font;
  }
  const pathTransform = shouldApplyStatementTransformToPath(statement)
    ? composeTransform(env.transform, statementTransformOptions, optionEnv)
    : env.transform;
  const pathCanvasScale = env.canvasScale * transformCanvasScale(statementTransformOptions, optionEnv);
  const pathCanvasTransform = multiplyTransforms(
    env.canvasTransform || identityTransform(),
    transformCanvasTransform(statementTransformOptions, optionEnv)
  );
  const pathStyleEnv = { ...optionEnv, canvasScale: pathCanvasScale };
  const scaledStyle = scaleCanvasStyle(normalized.style, pathStyleScaleEnv(pathStyleEnv, rawOptions));
  const patternDefinition = scaledStyle.pattern ? optionEnv.patterns?.[scaledStyle.pattern] : null;
  const style = patternDefinition ? { ...scaledStyle, patternDefinition } : scaledStyle;
  const pathPlane = canvasPlaneEnvironment(env, options, pathTransform);
  const pathEnv = {
    ...optionEnv,
    pathLet: { points: {}, numbers: {} },
    variables: { ...(env.variables || {}) },
    transform: pathPlane?.transform || pathTransform,
    canvasTransform: pathCanvasTransform,
    canvasTrackingDisabled: Boolean(env.canvasTrackingDisabled || hasTransformCanvas(statementTransformOptions)),
    canvasScale: pathCanvasScale,
    basis: pathPlane?.basis || composeBasis(env.basis, options, optionEnv)
  };
  const subtype = semanticSubtype(pathOptions);
  const clipRect = parseInternalClipRect(pathOptions["tikzkit clip rect"], pathEnv);
  const clipCircle = parseInternalClipCircle(pathOptions["tikzkit clip circle"], pathEnv);

  if (semantic["name intersections"]) {
    for (const raw of repeatedSemanticValues(semantic["name intersections"])) {
      materializeIntersections(raw, pathEnv, diagnostics, ir);
    }
  }

  const pathSegments = expandInlinePathForeachSegments(statement.path.segments, pathEnv);
  const built = buildPath(pathSegments, pathEnv, diagnostics, pathOptions, style);
  const namedPath = semantic["name path global"] ?? semantic["name path"];
  if (namedPath) {
    pathEnv.namedPaths[String(namedPath).trim()] = built.commands.length
      ? built.commands
      : built.shapes.flatMap((shape) => shape.commands || []);
  }

  const rasterImage = rasterImageFromPath(pathOptions, built, diagnostics);
  if (rasterImage) {
    ir.items.push({
      ...rasterImage,
      overlay: tikzBoolean(pathOptions.overlay)
    });
    for (const node of built.nodes) {
      addNodeItems(node, ir, pathEnv);
    }
    applyCanvasTransformBounds(ir, firstItemIndex, pathEnv.canvasTrackingDisabled);
    return;
  }

  if (tikzBoolean(pathOptions["use as bounding box"])) {
    const bboxCommands = built.commands.length ? built.commands : built.shapes.flatMap((shape) => shape.commands || []);
    if (bboxCommands.length) {
      ir.items.push(createBoundingBoxShape(bboxCommands, {
        tightBezierBounds: tikzBoolean(pathOptions["bezier bounding box"]),
      }));
    }
  }

  const includeStrokeBounds = built.nodes.length === 0;
  if (!tikzBoolean(pathOptions.overlay) && built.boundsCommands?.length) {
    ir.items.push(createBoundingBoxShape(built.boundsCommands, { includeStrokeBounds, style }));
  }

  const visible = isVisiblePath(statement.command, style, semantic, built.styleHints);
  const shadows = pathGeneralShadows(semantic, pathEnv, style);
  addDecorationTextItems(built, pathOptions, style, ir, pathEnv);
  addShowPathConstructionItems(built, pathOptions, pathEnv, ir, diagnostics);
  if (visible) {
    const doubleStyle = doublePathStyle(semantic, env);
    const shadingStyle = pathShadingStyle(style, semantic, pathEnv);
    const styledShapes = built.shapes.map((shape) => ({
      ...shape,
      subtype: shape.subtype || subtype,
      overlay: tikzBoolean(pathOptions.overlay),
      clipRect: shape.clipRect || clipRect,
      clipCircle: shape.clipCircle || clipCircle,
      shadows,
      style: { ...style, ...shadingStyle, ...doubleStyle, ...(shape.style || {}) }
    }));
    const compoundShape = compoundFillRuleShape(styledShapes, pathOptions, subtype, { allowShadows: Boolean(shadows?.length) });
    if (compoundShape && shadows) compoundShape.shadows = shadows;
    const shapesToRender = compoundShape ? [compoundShape] : styledShapes;
    for (const shape of shapesToRender) {
      ir.items.push(shape);
    }
    if (hasDrawableCommands(built.commands, built.shapes)) {
      const pathStyle = drawablePathStyle(style, { ...shadingStyle, ...built.styleHints, ...doubleStyle });
      const item = createPathShape(
        applyArrowEndpointShortening(built.commands, pathStyle, built.endpointRefs),
        pathStyle,
        {
          subtype: built.styleHints.subtype || subtype,
          shape: built.styleHints.shape,
          overlay: tikzBoolean(pathOptions.overlay),
          clipRect,
          clipCircle,
          includeStrokeBounds,
          includeArrowNormalBounds: includeStrokeBounds,
          includeArrowBounds: !decoratedSnakeOmitsArrowPaintBounds(pathOptions),
          tightBezierBounds: tikzBoolean(pathOptions["bezier bounding box"]),
          shadows
        }
      );
      ir.items.push(item);
      addDecorationMarkers(item, options, ir);
      for (const postactionDecoration of postactionDecorationPathItems(built, pathOptions, pathEnv)) {
        ir.items.push(postactionDecoration);
      }
      addPostactionShowPathConstructionItems(built, pathOptions, pathEnv, ir, diagnostics);
    }
    for (const shape of shapesToRender) {
      addDecorationMarkers(shape, options, ir);
    }
  }
  for (const node of built.nodes) {
    addNodeItems(node, ir, pathEnv);
  }
  applyCanvasTransformBounds(ir, firstItemIndex, pathEnv.canvasTrackingDisabled);
}

function parseInternalClipRect(raw, env = {}) {
  if (raw === undefined || raw === null || raw === true || raw === false) return undefined;
  const values = splitTopLevel(String(raw), ",")
    .map((value) => parseDimension(String(value).trim(), env.variables || {}));
  if (values.length !== 4 || !values.every(Number.isFinite)) return undefined;
  const [x1, y1, x2, y2] = values;
  return {
    minX: Math.min(x1, x2),
    minY: Math.min(y1, y2),
    maxX: Math.max(x1, x2),
    maxY: Math.max(y1, y2)
  };
}

function parseInternalClipCircle(raw, env = {}) {
  if (raw === undefined || raw === null || raw === true || raw === false) return undefined;
  const values = splitTopLevel(String(raw), ",")
    .map((value) => parseDimension(String(value).trim(), env.variables || {}));
  if (values.length !== 3 || !values.every(Number.isFinite)) return undefined;
  const [x, y, radius] = values;
  if (!(radius > 0)) return undefined;
  const center = applyCoordinateTransform({ x, y }, env);
  const transformedRadius = Math.hypot(...Object.values(applyCoordinateTransformVector({ x: radius, y: 0 }, env)));
  if (!(transformedRadius > 0)) return undefined;
  return { x: center.x, y: center.y, radius: transformedRadius };
}

function expandInlinePathForeachSegments(segments = [], env = {}) {
  const expanded = [];
  for (const segment of segments) {
    if (segment.kind !== "foreach") {
      expanded.push(segment);
      continue;
    }
    for (const iteration of foreachIterationVariables(segment, env)) {
      const childEnv = { ...env, variables: iteration.variables };
      const bodySource = substituteTextVariables(segment.bodyRaw || "", iteration.variables);
      expanded.push(...expandInlinePathForeachSegments(parsePathSegments(bodySource), childEnv));
    }
  }
  return expanded;
}

function shouldApplyStatementTransformToPath(statement) {
  if (!isCoordinateNodePlacementPath(statement.path?.segments || [])) return true;
  const options = statement.options || {};
  return !(Object.hasOwn(options, "xshift") || Object.hasOwn(options, "yshift") || Object.hasOwn(options, "shift"));
}

function isCoordinateNodePlacementPath(segments = []) {
  if (segments.length !== 2) return false;
  const [coordinate, node] = segments;
  if (coordinate?.kind !== "coordinate" || node?.kind !== "node" || node.at) return false;
  const raw = String(coordinate.raw || "").trim();
  return Boolean(raw && !raw.includes(",") && !raw.includes(":") && !raw.includes("$"));
}

function buildPath(segments, env, diagnostics, pathOptions = {}, pathStyle = {}) {
  const commands = [];
  const shapes = [];
  const nodes = [];
  const styleHints = {};
  const effectivePathOptions = { ...pathOptions };
  let current = null;
  let currentLocal = null;
  let currentBase = null;
  let relativeBase = null;
  let currentNodeRef = null;
  let start = null;
  let startNodeRef = null;
  let endNodeRef = null;
  let pending = null;
  let pendingInlineNodes = [];
  let lastSegment = null;
  let pendingPlotMark = null;

  for (const segment of segments) {
    if (segment.kind === "decorate") {
      const nestedOptions = {
        ...effectivePathOptions,
        ...resolveDynamicOptions(segment.options || {}, env),
        decorate: true
      };
      const nested = buildPath(segment.segments || [], env, diagnostics, nestedOptions, pathStyle);
      commands.push(...nested.commands);
      shapes.push(...nested.shapes);
      nodes.push(...nested.nodes);
      Object.assign(styleHints, nested.styleHints);
      const endpoints = pathCommandEndpoints(nested.commands);
      if (endpoints.start && !start) start = endpoints.start;
      if (endpoints.end) {
        current = endpoints.end;
        currentLocal = null;
        currentBase = endpoints.end;
        currentNodeRef = null;
        endNodeRef = null;
      }
      pending = null;
      continue;
    }
    if (segment.kind === "let") {
      applyPathLetBindings(segment.bindings, env, diagnostics);
      continue;
    }
    if (segment.kind === "unknown") {
      const mark = String(segment.raw || "").match(/\bplot\s*\[[^\]]*\bmark\s*=\s*([^\],\s]+)[^\]]*\]/);
      if (mark) pendingPlotMark = mark[1];
      continue;
    }
    if (segment.kind === "options") {
      const segmentOptions = resolveDynamicOptions(segment.options || {}, env);
      Object.assign(effectivePathOptions, segmentOptions);
      Object.assign(styleHints, pathOptionStyleHints(effectivePathOptions, pathStyle, env));
      continue;
    }
    if (segment.kind === "operator") {
      pending = { value: segment.value, options: segment.options || {} };
      continue;
    }
    if (segment.kind === "coordinate") {
      const pendingValue = pending?.value ?? pending;
      const pendingOptions = pending?.options || {};
      const relativeOrigin = relativeBase || currentBase || current || applyCoordinateTransform({ x: 0, y: 0 }, env);
      const turnedPoint = !segment.relative && currentBase && lastSegment
        ? resolveTurnCoordinate(segment.raw, currentBase, lastSegment, env, diagnostics)
        : null;
      const point = turnedPoint || (segment.relative
        ? resolveRelativeCoordinate(segment.raw, relativeOrigin, env, diagnostics)
        : resolveCoordinate(segment.raw, env, diagnostics));
      if (pendingPlotMark) {
        shapes.push(...plotMarkItems(point, pendingPlotMark, pathStyle, effectivePathOptions, env));
        pendingPlotMark = null;
      }
      const localPoint = segment.relative || !shouldResolveAsLocalRectangleCorner(segment.raw)
        ? null
        : resolveLocalCoordinate(segment.raw, env, diagnostics);
      const nodeRef = segment.relative ? null : defaultPathNodeReference(segment.raw, env);
      // Claude: 形如 \draw rectangle (8,8) / \draw grid (4,4)（没有显式起点）时，TikZ 以局部原点
      // (0,0) 作为第一个角。原代码因 current 为空直接走下面的 moveTo 分支、把矩形/网格丢掉了
      // （只剩一个 moveTo）。这里在遇到这类挂起操作且尚无当前点时，先把经过当前变换的局部原点
      // 设为起点，让后面的 rectangle/grid 分支正常生成图形（变换会把它剪成平行四边形，见 case 047）。
      if (!current && (pendingValue === "rectangle" || pendingValue === "grid")) {
        const origin = applyCoordinateTransform({ x: 0, y: 0 }, env);
        commands.push(moveToCommand(origin));
        current = origin;
        currentLocal = { x: 0, y: 0 };
        currentBase = origin;
        relativeBase = origin;
        start = origin;
        startNodeRef = null;
      }
      if (!current) {
        commands.push(moveToCommand(point));
        current = point;
        currentLocal = localPoint || point;
        currentBase = point;
        currentNodeRef = nodeRef;
        start = point;
        startNodeRef = nodeRef;
        endNodeRef = nodeRef;
      } else if (pendingValue === "grid") {
        const localGrid = Boolean(currentLocal && localPoint);
        shapes.push(...buildGrid(
          localGrid ? currentLocal : current,
          localGrid ? localPoint : point,
          effectivePathOptions,
          env,
          localGrid
        ));
        current = point;
        currentLocal = localPoint || point;
        currentBase = point;
        currentNodeRef = nodeRef;
        endNodeRef = nodeRef;
      } else if (pendingValue === "rectangle") {
        const corners =
          currentLocal && localPoint
            ? transformedRectangleCorners(currentLocal, localPoint, coordinateTransformForEnvironment(env))
            : [
                { x: point.x, y: current.y },
                point,
                { x: current.x, y: point.y }
              ];
        commands.push(lineToCommand(corners[0]));
        commands.push(lineToCommand(corners[1]));
        commands.push(lineToCommand(corners[2]));
        commands.push(closePathCommand());
        lastSegment = { from: current, to: point };
        current = point;
        currentLocal = localPoint || point;
        currentBase = point;
        currentNodeRef = nodeRef;
        endNodeRef = nodeRef;
      } else if (pendingValue === "--") {
        const clipped = clipNodeLineEndpoints(currentBase || current, currentNodeRef, point, nodeRef, env);
        if (shouldBreakAtNodeExit(currentNodeRef)) moveToNodeExit(commands, clipped.from);
        commands.push(lineToCommand(clipped.to));
        flushInlinePathNodes(pendingInlineNodes, clipped.from, clipped.to, nodes, env, pathStyle, effectivePathOptions);
        lastSegment = { from: clipped.from, to: clipped.to };
        pendingInlineNodes = [];
        current = clipped.to;
        currentLocal = localPoint || point;
        currentBase = point;
        currentNodeRef = nodeRef;
        endNodeRef = nodeRef;
      } else if (pendingValue === "|-" || pendingValue === "-|") {
        const elbow = pendingValue === "|-"
          ? { x: (currentBase || current).x, y: point.y }
          : { x: point.x, y: (currentBase || current).y };
        const first = clipNodeLineEndpoints(currentBase || current, currentNodeRef, elbow, null, env);
        const second = clipNodeLineEndpoints(elbow, null, point, nodeRef, env);
        if (shouldBreakAtNodeExit(currentNodeRef)) moveToNodeExit(commands, first.from);
        commands.push(lineToCommand(first.to));
        commands.push(lineToCommand(second.to));
        flushOrthogonalInlinePathNodes(
          pendingInlineNodes,
          first,
          second,
          nodes,
          env,
          pathStyle,
          effectivePathOptions
        );
        lastSegment = { from: second.from, to: second.to };
        pendingInlineNodes = [];
        current = second.to;
        currentLocal = localPoint || point;
        currentBase = point;
        currentNodeRef = nodeRef;
        endNodeRef = nodeRef;
      } else if (isTikzExtOrthoOperator(pendingValue)) {
        styleHints.subtype = "tikz-ext-ortho";
        const polyline = tikzExtOrthoPolyline(pendingValue, currentBase || current, point, pendingOptions, env);
        const drawn = drawPolyline(commands, polyline, currentNodeRef, nodeRef, env);
        flushInlinePathNodes(pendingInlineNodes, drawn.from, drawn.to, nodes, env, pathStyle, effectivePathOptions);
        lastSegment = { from: drawn.from, to: drawn.to };
        pendingInlineNodes = [];
        current = drawn.to;
        currentLocal = localPoint || point;
        currentBase = point;
        currentNodeRef = nodeRef;
        endNodeRef = nodeRef;
      } else {
        flushInlinePathNodes(pendingInlineNodes, current, current, nodes, env, pathStyle, effectivePathOptions);
        pendingInlineNodes = [];
        commands.push(moveToCommand(point));
        current = point;
        currentLocal = localPoint || point;
        currentBase = point;
        currentNodeRef = nodeRef;
        start = point;
        endNodeRef = nodeRef;
        lastSegment = null;
      }
      relativeBase = segment.relative === "temporary" ? relativeOrigin : point;
      pending = null;
      continue;
    }
    if (segment.kind === "coordinateName" && current) {
      const name = resolveDynamicName(segment.name, env);
      env.coordinates[name] = roundPoint(current);
      continue;
    }
    if (segment.kind === "pic") {
      const anglePic = buildAnglePic(segment, pathOptions, env, diagnostics, pathStyle);
      if (anglePic) {
        shapes.push(anglePic.shape);
        if (anglePic.label) nodes.push(anglePic.label);
        styleHints.visiblePic = true;
      }
      continue;
    }
    if ((segment.kind === "edge" || segment.kind === "to") && current) {
      const edgeOrigin = {
        current,
        currentLocal,
        currentBase,
        currentNodeRef,
        endNodeRef
      };
      const to = segment.relative
        ? resolveRelativeCoordinate(segment.to, currentBase || current, env, diagnostics)
        : resolveCoordinate(segment.to, env, diagnostics);
      const toNodeRef = segment.relative ? null : defaultPathNodeReference(segment.to, env);
      if (segment.nodes?.length) {
        for (const labelNode of segment.nodes) {
          pendingInlineNodes.push({
            ...labelNode,
            text: substituteTextVariables(labelNode.text, env.variables)
          });
        }
      }
      const combinedEdgeOptions = { ...effectivePathOptions, ...(segment.options || {}) };
      if (segment.kind === "to") {
        pendingInlineNodes.push(...toPathInlineNodes(combinedEdgeOptions["to path"]));
      }
      const circuitikz = appendCircuitikzToSegment({
        commands,
        shapes,
        nodes,
        from: currentBase || current,
        to,
        options: combinedEdgeOptions,
        env,
        pathStyle,
        styleHints
      });
      if (circuitikz) {
        flushInlinePathNodes(pendingInlineNodes, circuitikz.from, circuitikz.to, nodes, env, pathStyle, effectivePathOptions);
        lastSegment = { from: circuitikz.from, to: circuitikz.to };
        pendingInlineNodes = [];
        if (segment.kind === "edge") {
          ({ current, currentLocal, currentBase, currentNodeRef, endNodeRef } = edgeOrigin);
        } else {
          current = circuitikz.drawnTo;
          currentLocal = null;
          currentBase = to;
          currentNodeRef = toNodeRef;
          endNodeRef = toNodeRef;
        }
        pending = null;
        continue;
      }
      const edgeHints = edgeStyleHintsFromOptions(combinedEdgeOptions, env);
      Object.assign(styleHints, edgeHints);
      if (segment.kind === "edge" && !Object.hasOwn(edgeHints, "stroke") && !edgeExplicitlySuppressesDraw(combinedEdgeOptions)) {
        styleHints.stroke = pathStyle.stroke === "none" ? "black" : pathStyle.stroke || "black";
      }
      Object.assign(effectivePathOptions, edgePathOptions(combinedEdgeOptions));
      const loopDirection = loopDirectionFromOptions(combinedEdgeOptions);
      const arcThrough = parseTikzExtArcThrough(combinedEdgeOptions);
      if (arcThrough) {
        styleHints.subtype = "tikz-ext-arc";
        const through = resolveCoordinate(arcThrough.through, env, diagnostics);
        const arc = tikzExtArcThroughCommands(currentBase || current, through, to, arcThrough, env);
        if (arc.center) env.coordinates[`arc through center${arcThrough.suffix || ""}`] = arc.center;
        commands.push(...arc.commands);
        flushInlinePathNodes(pendingInlineNodes, currentBase || current, to, nodes, env, pathStyle, effectivePathOptions);
        lastSegment = { from: currentBase || current, to };
        pendingInlineNodes = [];
        if (segment.kind === "edge") {
          ({ current, currentLocal, currentBase, currentNodeRef, endNodeRef } = edgeOrigin);
        } else {
          current = to;
          currentLocal = null;
          currentBase = to;
          currentNodeRef = toNodeRef;
          endNodeRef = toNodeRef;
        }
        pending = null;
        continue;
      }
      if (loopDirection && pointsAlmostEqual(currentBase || current, to)) {
        const loop = buildSelfLoop(currentBase || current, currentNodeRef, loopDirection, combinedEdgeOptions, env);
        if (shouldBreakAtNodeExit(currentNodeRef)) moveToNodeExit(commands, loop.start);
        commands.push(...loop.commands);
        flushInlinePathNodesAt(pendingInlineNodes, loop.labelPoint, nodes, env, pathStyle, null, effectivePathOptions);
        lastSegment = { from: loop.start, to: loop.end };
        pendingInlineNodes = [];
        if (segment.kind === "edge") {
          ({ current, currentLocal, currentBase, currentNodeRef, endNodeRef } = edgeOrigin);
        } else {
          current = loop.end;
          currentBase = to;
          currentNodeRef = toNodeRef;
          endNodeRef = toNodeRef;
        }
        pending = null;
        continue;
      }
      const edgeFrom = currentBase || current;
      // Claude: 先按"直线弦"裁一次得到端点角度基准，再判断有没有弯（bend/out-in）。
      // 有弯时端点要沿曲线"切线方向"重新裁到节点边框，否则箭头会挂在角上（见 case 020 的两条 bend 弧）。
      const straightClipped = clipNodeLineEndpoints(edgeFrom, currentNodeRef, to, toNodeRef, env);
      const curve = edgeCurveSpec(combinedEdgeOptions, straightClipped.from, straightClipped.to, env, currentNodeRef, toNodeRef);
      const edgeStyle = segment.kind === "edge" ? edgeDrawableStyle(combinedEdgeOptions, pathStyle, env) : null;
      const curveStyle = edgeStyle || pathStyle;
      const clipped = curve
        ? clipNodeCurveEndpoints(
          edgeFrom,
          currentNodeRef,
          to,
          toNodeRef,
          curve,
          env,
          curveArrowTerminalBorderPadding(curveStyle)
        )
        : straightClipped;
      const targetCommands = segment.kind === "edge" ? [moveToCommand(clipped.from)] : commands;
      if (curve) {
        if (segment.kind !== "edge" && shouldBreakAtNodeExit(currentNodeRef)) moveToNodeExit(commands, clipped.from);
        const distance = tikzCurveControlDistance(clipped.from, clipped.to);
        const c1 = polarOffset(clipped.from, curve.out, curve.outDistance ?? distance * curve.outLooseness);
        const c2 = polarOffset(clipped.to, curve.in, curve.inDistance ?? distance * curve.inLooseness);
        targetCommands.push(curveToCommand(c1, c2, clipped.to));
        const labelGeometry = cubicLabelGeometry(clipped.from, c1, c2, clipped.to);
        flushInlinePathNodesAt(pendingInlineNodes, labelGeometry.point, nodes, env, pathStyle, labelGeometry.segment, effectivePathOptions);
        lastSegment = { from: clipped.from, to: clipped.to };
      } else {
        if (segment.kind !== "edge" && shouldBreakAtNodeExit(currentNodeRef)) moveToNodeExit(commands, clipped.from);
        targetCommands.push(lineToCommand(clipped.to));
        flushInlinePathNodes(pendingInlineNodes, clipped.from, clipped.to, nodes, env, pathStyle, effectivePathOptions);
        lastSegment = { from: clipped.from, to: clipped.to };
      }
      if (segment.kind === "edge") {
        const edgeCommands = applyPathMorphing(targetCommands, combinedEdgeOptions, env, edgeStyle);
        shapes.push({
          type: "path",
          subtype: "edge",
          commands: applyArrowEndpointShortening(edgeCommands, edgeStyle, {
            start: currentNodeRef,
            end: toNodeRef
          }),
          style: edgeStyle,
          includeArrowBounds: !decoratedSnakeOmitsArrowPaintBounds(combinedEdgeOptions)
        });
      }
      pendingInlineNodes = [];
      if (segment.kind === "edge") {
        ({ current, currentLocal, currentBase, currentNodeRef, endNodeRef } = edgeOrigin);
      } else {
        current = clipped.to;
        currentLocal = null;
        currentBase = to;
        currentNodeRef = toNodeRef;
        endNodeRef = toNodeRef;
      }
      pending = null;
      continue;
    }
    if (segment.kind === "arcTo" && current) {
      styleHints.subtype = "tikz-ext-arc";
      if (segment.nodes?.length) {
        for (const labelNode of segment.nodes) {
          pendingInlineNodes.push({
            ...labelNode,
            text: substituteTextVariables(labelNode.text, env.variables)
          });
        }
      }
      const to = resolveCoordinate(segment.to, env, diagnostics);
      const arc = tikzExtArcToCommands(currentBase || current, to, { ...pathOptions, ...segment.options }, env);
      commands.push(...arc.commands);
      flushInlinePathNodes(pendingInlineNodes, currentBase || current, to, nodes, env, pathStyle, effectivePathOptions);
      lastSegment = { from: currentBase || current, to };
      pendingInlineNodes = [];
      current = to;
      currentLocal = null;
      currentBase = to;
      currentNodeRef = null;
      pending = null;
      continue;
    }
    if (segment.kind === "curveTo" && current) {
      const curveFrom = currentBase || current;
      const to = resolveCurveEndpoint(segment.to, curveFrom, env, diagnostics);
      const toNodeRef = defaultPathNodeReference(segment.to, env);
      const c1 = resolveControlPoint(segment.c1, curveFrom, env, diagnostics);
      const c2 = resolveControlPoint(segment.c2, to, env, diagnostics);
      const clipped = clipNodeCubicEndpoints(curveFrom, currentNodeRef, c1, c2, to, toNodeRef, env);
      if (shouldBreakAtNodeExit(currentNodeRef)) moveToNodeExit(commands, clipped.from);
      commands.push(curveToCommand(c1, c2, clipped.to));
      lastSegment = {
        from: clipped.from,
        to: clipped.to,
        c1,
        c2,
        tangent: { x: clipped.to.x - c2.x, y: clipped.to.y - c2.y }
      };
      current = clipped.to;
      currentLocal = null;
      currentBase = to;
      currentNodeRef = toNodeRef;
      endNodeRef = toNodeRef;
      continue;
    }
    if (segment.kind === "sineCosine" && current) {
      const to = resolveCoordinate(segment.to, env, diagnostics);
      commands.push(sineCosineCurveCommand(current, to, segment.op));
      lastSegment = { from: current, to };
      current = to;
      currentLocal = null;
      currentBase = to;
      currentNodeRef = null;
      endNodeRef = null;
      pending = null;
      continue;
    }
    if (segment.kind === "circle") {
      const center = current || applyCoordinateTransform({ x: 0, y: 0 }, env);
      const r = parseDimension(segment.radius, env.variables);
      const commands = circleCommands(center, r, env);
      shapes.push(
        decoratedShape(
          {
            type: "path",
            shape: "circle",
            projected: usesProjectedLocalGeometry(env),
            subtype: semanticSubtype(pathOptions),
            cx: center.x,
            cy: center.y,
            r,
            commands,
            style: {}
          },
          effectivePathOptions,
          env
        )
      );
      continue;
    }
    if (segment.kind === "ellipse" && current) {
      const [rxRaw, ryRaw] = segment.radius.split(/\s+and\s+/);
      const rx = parseDimension(segment.options?.["x radius"] || rxRaw, env.variables);
      const ry = parseDimension(segment.options?.["y radius"] || ryRaw || rxRaw, env.variables);
      const commands = ellipseCommands(current, rx, ry, env);
      shapes.push(
        decoratedShape(
          {
            type: "path",
            shape: "ellipse",
            projected: usesProjectedLocalGeometry(env),
            cx: current.x,
            cy: current.y,
            rx,
            ry,
            commands
          },
          effectivePathOptions,
          env
        )
      );
      continue;
    }
    if (segment.kind === "arc" && current) {
      const arc = buildArc(current, segment.options, env);
      const arcCommands = commands.length ? arc.commands.slice(1) : arc.commands;
      commands.push(...arcCommands);
      styleHints.shape = styleHints.shape || "arc";
      lastSegment = {
        from: current,
        to: arc.endPoint,
        tangent: incomingTangentFromCommands(arc.commands, current, arc.endPoint)
      };
      current = arc.endPoint;
      currentLocal = null;
      currentBase = current;
      currentNodeRef = null;
      endNodeRef = null;
      continue;
    }
    if (segment.kind === "plot") {
      const plot = buildPlot(segment.coordinate, env, { ...pathOptions, ...(segment.options || {}) });
      for (const command of plot) commands.push(command);
      current = plot.at(-1) ? { x: plot.at(-1).x, y: plot.at(-1).y } : current;
      currentLocal = null;
      currentBase = current;
      currentNodeRef = null;
      continue;
    }
    if (segment.kind === "plotFunction") {
      const plot = buildPlotFunction(segment.expression, env, { ...pathOptions, ...(segment.options || {}) });
      for (const command of plot.commands) commands.push(command);
      if (plot.points.length) {
        current = plot.points.at(-1);
        currentLocal = null;
        currentBase = current;
        currentNodeRef = null;
        endNodeRef = null;
        if (!start) {
          start = plot.points[0];
          startNodeRef = null;
        }
      }
      continue;
    }
    if (segment.kind === "plotCoordinates") {
      const plot = buildPlotCoordinates(segment.coordinates || [], env, diagnostics, { ...pathOptions, ...(segment.options || {}) });
      const mark = segment.options?.mark ?? pathOptions.mark;
      if (mark && String(mark).trim().toLowerCase() !== "none") {
        const markOptions = { ...pathOptions, ...(segment.options || {}) };
        shapes.push(...plot.points.flatMap((point) => plotMarkItems(point, mark, pathStyle, markOptions, env)));
      }
      if (!pathOptions["only marks"] && !segment.options?.["only marks"]) {
        for (const command of plot.commands) commands.push(command);
      }
      if (plot.points.length) {
        current = plot.points.at(-1);
        currentLocal = null;
        currentBase = current;
        currentNodeRef = null;
        endNodeRef = null;
        if (!start) {
          start = plot.points[0];
          startNodeRef = null;
        }
      }
      continue;
    }
    if (segment.kind === "node") {
      const text = substituteTextVariables(segment.text, env.variables);
      if (!segment.at && current && pending) {
        pendingInlineNodes.push({ ...segment, text });
        continue;
      }
      const placementOptions = inlineNodeResolvedOptions(segment.options, env, pathStyle, effectivePathOptions);
      const point = segment.at
        ? resolveCoordinate(segment.at, env, diagnostics)
        : inlineNodePathPoint(placementOptions, lastSegment) || current || applyCoordinateTransform({ x: 0, y: 0 }, env);
      addInlinePathNode(segment, text, point, nodes, env, pathStyle, lastSegment, effectivePathOptions);
      continue;
    }
    if (segment.kind === "close" && start) {
      commands.push(closePathCommand());
      if (current) lastSegment = { from: current, to: start };
      current = start;
      endNodeRef = startNodeRef;
    }
  }

  flushInlinePathNodes(pendingInlineNodes, current, current, nodes, env, pathStyle, effectivePathOptions);
  const roundedCommands = applyRoundedCornersToPath(commands, effectivePathOptions, env);
  return {
    commands: applyPathMorphing(roundedCommands, effectivePathOptions, env, pathStyle),
    decorationInputCommands: roundedCommands,
    boundsCommands: roundedCommands === commands ? null : commands,
    shapes,
    nodes,
    styleHints,
    endpointRefs: { start: startNodeRef, end: endNodeRef }
  };
}

function rasterImageFromPath(pathOptions = {}, built = {}, diagnostics = []) {
  if (!pathOptions["axis surface raster image"]) return null;
  const payload = decodeRasterImagePayload(pathOptions["axis surface raster image"], diagnostics);
  if (!payload?.href) return null;
  const bounds = pathCommandBounds(built.commands || []);
  if (!bounds) {
    diagnostics.push({ severity: "warning", message: "axis surface raster image path has no bounds" });
    return null;
  }
  return createRasterImageShape({
    x: roundNumber(bounds.minX),
    y: roundNumber(bounds.minY),
    width: roundNumber(bounds.maxX - bounds.minX),
    height: roundNumber(bounds.maxY - bounds.minY),
    href: String(payload.href),
    preserveAspectRatio: payload.preserveAspectRatio || "none",
    imageRendering: payload.imageRendering,
    opacity: Number.isFinite(Number(payload.opacity)) ? Number(payload.opacity) : undefined
  });
}

function decodeRasterImagePayload(raw, diagnostics = []) {
  try {
    const encoded = String(stripOuterBraces(raw) || "").trim();
    const json = decodeBase64UrlText(encoded);
    return JSON.parse(json);
  } catch (error) {
    diagnostics.push({ severity: "warning", message: `Invalid axis surface raster image payload: ${error.message}` });
    return null;
  }
}

function decodeBase64UrlText(encoded) {
  const base64 = String(encoded)
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(String(encoded).length / 4) * 4, "=");
  if (typeof Buffer !== "undefined") return Buffer.from(base64, "base64").toString("utf8");
  const binary = globalThis.atob(base64);
  return decodeURIComponent(
    Array.from(binary)
      .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
      .join("")
  );
}

function pathCommandBounds(commands = []) {
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  includePathCommandBounds(commands, (x, y) => {
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);
  });
  if (!Number.isFinite(bounds.minX)) return null;
  return bounds;
}

function applyRoundedCornersToPath(commands = [], options = {}, env = {}) {
  const radius = roundedCornerRadius(options, env);
  if (!Number.isFinite(radius) || radius <= 0) return commands;
  if (!commands.length || commands.some((command) => command.type !== "moveTo" && command.type !== "lineTo" && command.type !== "closePath")) {
    return commands;
  }
  if (commands[0]?.type !== "moveTo") return commands;
  const closed = commands.at(-1)?.type === "closePath";
  const points = commands
    .filter((command) => command.type === "moveTo" || command.type === "lineTo")
    .map((command) => ({ x: command.x, y: command.y }));
  const uniquePoints = removeDuplicateNeighborPoints(points, closed);
  if (uniquePoints.length < (closed ? 3 : 3)) return commands;

  return closed
    ? roundedClosedPolylineCommands(uniquePoints, radius)
    : roundedOpenPolylineCommands(uniquePoints, radius);
}

function roundedCornerRadius(options = {}, env = {}) {
  if (Object.hasOwn(options, "sharp corners")) return 0;
  if (!Object.hasOwn(options, "rounded corners")) return 0;
  const value = options["rounded corners"];
  const raw = value === true || value === "" || value === undefined || value === null ? "4pt" : value;
  const parsed = parseDimension(raw, env.variables);
  return Number.isFinite(parsed) && parsed > 0 ? parsed * canvasLengthScale(env) : 0;
}

function removeDuplicateNeighborPoints(points = [], closed = false) {
  const result = [];
  for (const point of points) {
    const previous = result.at(-1);
    if (!previous || pointDistance(previous, point) > 1e-9) result.push(point);
  }
  if (closed && result.length > 1 && pointDistance(result[0], result.at(-1)) <= 1e-9) result.pop();
  return result;
}

function roundedClosedPolylineCommands(points, radius) {
  const corners = points.map((point, index) => roundedCorner(points[(index - 1 + points.length) % points.length], point, points[(index + 1) % points.length], radius));
  const commands = [moveToCommand(corners[0].exit)];
  for (let index = 1; index < corners.length; index += 1) {
    commands.push(lineToCommand(corners[index].entry));
    commands.push(roundedCornerCurve(corners[index]));
  }
  commands.push(lineToCommand(corners[0].entry));
  commands.push(roundedCornerCurve(corners[0]));
  commands.push(closePathCommand());
  return commands;
}

function roundedOpenPolylineCommands(points, radius) {
  const commands = [moveToCommand(points[0])];
  for (let index = 1; index < points.length - 1; index += 1) {
    const corner = roundedCorner(points[index - 1], points[index], points[index + 1], radius);
    commands.push(lineToCommand(corner.entry));
    commands.push(roundedCornerCurve(corner));
  }
  commands.push(lineToCommand(points.at(-1)));
  return commands;
}

function roundedCorner(previous, point, next, radius) {
  const incoming = unitVector(previous, point);
  const outgoing = unitVector(point, next);
  const incomingLength = pointDistance(previous, point);
  const outgoingLength = pointDistance(point, next);
  const distance = Math.min(radius, incomingLength / 2, outgoingLength / 2);
  const entry = {
    x: point.x - incoming.x * distance,
    y: point.y - incoming.y * distance
  };
  const exit = {
    x: point.x + outgoing.x * distance,
    y: point.y + outgoing.y * distance
  };
  const controlDistance = distance * 0.5;
  return {
    entry: roundPoint(entry),
    exit: roundPoint(exit),
    c1: roundPoint({ x: entry.x + incoming.x * controlDistance, y: entry.y + incoming.y * controlDistance }),
    c2: roundPoint({ x: exit.x - outgoing.x * controlDistance, y: exit.y - outgoing.y * controlDistance })
  };
}

function roundedCornerCurve(corner) {
  return curveToCommand(corner.c1, corner.c2, corner.exit);
}

function unitVector(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-12) return { x: 0, y: 0 };
  return { x: dx / length, y: dy / length };
}

function pointDistance(a, b) {
  return Math.hypot((b?.x || 0) - (a?.x || 0), (b?.y || 0) - (a?.y || 0));
}

function inlineNodePathPoint(options = {}, lastSegment) {
  if (!lastSegment) return null;
  const pos = inlineNodePosition(options);
  if (!Number.isFinite(pos)) return null;
  if (lastSegment.c1 && lastSegment.c2) {
    return roundPoint(cubicPointAt(lastSegment.from, lastSegment.c1, lastSegment.c2, lastSegment.to, pos));
  }
  return roundPoint({
    x: lastSegment.from.x + (lastSegment.to.x - lastSegment.from.x) * pos,
    y: lastSegment.from.y + (lastSegment.to.y - lastSegment.from.y) * pos
  });
}

function inlineNodePathTangent(options = {}, lastSegment) {
  if (!lastSegment?.from || !lastSegment?.to) return null;
  const pos = inlineNodePosition(options, 1);
  if (lastSegment.c1 && lastSegment.c2) {
    return cubicTangentAt(lastSegment.from, lastSegment.c1, lastSegment.c2, lastSegment.to, pos);
  }
  const dx = lastSegment.to.x - lastSegment.from.x;
  const dy = lastSegment.to.y - lastSegment.from.y;
  const length = Math.hypot(dx, dy);
  return length < 1e-9 ? null : { x: dx / length, y: dy / length };
}

function inlineNodePosition(options = {}, fallback = null) {
  let pos = fallback;
  if (Object.hasOwn(options, "pos")) pos = Number(options.pos);
  else if (Object.hasOwn(options, "at start")) pos = 0;
  else if (Object.hasOwn(options, "at end")) pos = 1;
  else if (Object.hasOwn(options, "midway")) pos = 0.5;
  else if (Object.hasOwn(options, "very near start")) pos = 0.125;
  else if (Object.hasOwn(options, "near start")) pos = 0.25;
  else if (Object.hasOwn(options, "near end")) pos = 0.75;
  else if (Object.hasOwn(options, "very near end")) pos = 0.875;
  return Number.isFinite(pos) ? pos : null;
}

function toPathInlineNodes(value) {
  if (value === undefined || value === null || value === true || value === "") return [];
  return parsePathSegments(String(value)).filter((segment) => segment.kind === "node");
}

function isTikzExtOrthoOperator(value) {
  return ["|-|", "-|-", "r-ud", "r-du", "r-lr", "r-rl"].includes(value);
}

function tikzExtOrthoPolyline(operator, from, to, options = {}, env) {
  const distance = tikzExtOrthoDistance(operator, options, env);
  if (operator === "-|-") {
    const midX = tikzExtMiddleCoordinate(from.x, to.x, options["hvh distance"] ?? options["distance"], options["hvh ratio"] ?? options["ratio"], env);
    return [from, { x: midX, y: from.y }, { x: midX, y: to.y }, to].map(roundPoint);
  }
  if (operator === "|-|") {
    const midY = tikzExtMiddleCoordinate(from.y, to.y, options["vhv distance"] ?? options["distance"], options["vhv ratio"] ?? options["ratio"], env);
    return [from, { x: from.x, y: midY }, { x: to.x, y: midY }, to].map(roundPoint);
  }
  if (operator === "r-ud") return [from, { x: from.x, y: from.y + distance }, { x: to.x, y: from.y + distance }, to].map(roundPoint);
  if (operator === "r-du") return [from, { x: from.x, y: from.y - distance }, { x: to.x, y: from.y - distance }, to].map(roundPoint);
  if (operator === "r-lr") return [from, { x: from.x - distance, y: from.y }, { x: from.x - distance, y: to.y }, to].map(roundPoint);
  if (operator === "r-rl") return [from, { x: from.x + distance, y: from.y }, { x: from.x + distance, y: to.y }, to].map(roundPoint);
  return [from, to].map(roundPoint);
}

function tikzExtMiddleCoordinate(start, end, distanceRaw, ratioRaw, env) {
  if (distanceRaw !== undefined && distanceRaw !== null && distanceRaw !== true && distanceRaw !== "") {
    const text = String(distanceRaw).replace(/\s+/g, "");
    const parsed = parseDimension(text.replace(/^\+\-/, "-").replace(/^\+/, ""), env.variables);
    if (Number.isFinite(parsed)) return parsed < 0 ? end + parsed : start + parsed;
  }
  const ratio = evaluateMath(ratioRaw ?? 0.5, env.variables);
  const t = Number.isFinite(ratio) ? ratio : 0.5;
  return start + (end - start) * t;
}

function tikzExtOrthoDistance(operator, options = {}, env) {
  const key = operator === "r-ud" ? "ud distance" : operator === "r-du" ? "du distance" : operator === "r-lr" ? "lr distance" : "rl distance";
  const raw = options[key] ?? options["udlr distance"] ?? options["distance"] ?? ".5cm";
  const parsed = parseDimension(String(raw).replace(/\s+/g, ""), env.variables);
  return Number.isFinite(parsed) ? Math.abs(parsed) : 0.5;
}

function drawPolyline(commands, points, startNodeRef, endNodeRef, env) {
  let firstFrom = points[0];
  let lastTo = points.at(-1);
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const clipped = clipNodeLineEndpoints(from, index === 1 ? startNodeRef : null, to, index === points.length - 1 ? endNodeRef : null, env);
    if (index === 1) {
      firstFrom = clipped.from;
      if (shouldBreakAtNodeExit(startNodeRef)) moveToNodeExit(commands, clipped.from);
    }
    commands.push(lineToCommand(clipped.to));
    lastTo = clipped.to;
  }
  return { from: firstFrom, to: lastTo };
}

function appendCircuitikzToSegment({ commands, shapes, nodes, from, to, options = {}, env, pathStyle = {}, styleHints = null }) {
  const spec = circuitikzBipoleSpec(options, env);
  if (!spec || !from || !to) return null;
  const geometry = circuitikzSegmentGeometry(from, to);
  if (!geometry) return null;

  if (spec.kind === "short") {
    commands.push(lineToCommand(to));
  } else if (spec.kind === "resistor") {
    const settings = circuitikzResistorSettings(options, env);
    const bodyLength = circuitikzBodyLength("resistor", geometry.length, env, settings);
    const split = appendCircuitikzSplitWire(
      commands,
      from,
      to,
      geometry,
      bodyLength,
      pathStyle,
      styleHints,
      options,
      env
    );
    shapes.push(circuitikzResistorItem(geometry, bodyLength, settings, pathStyle));
    if (split.postLead) shapes.push(split.postLead);
  } else if (spec.kind === "capacitor") {
    const settings = spec.variable ? circuitikzVariableCapacitorSettings(options, env) : null;
    const bodyLength = spec.variable
      ? Math.min(settings.bodyLength, geometry.length * 0.78)
      : circuitikzBodyLength("capacitor", geometry.length, env);
    const split = appendCircuitikzSplitWire(
      commands,
      from,
      to,
      geometry,
      bodyLength,
      pathStyle,
      styleHints,
      options,
      env
    );
    if (spec.variable) {
      shapes.push(...circuitikzVariableCapacitorItems(geometry, settings, pathStyle));
      registerCircuitikzVariableCapacitorNode(spec, geometry, settings, bodyLength, env);
    } else {
      shapes.push(circuitikzCapacitorItem(from, to, geometry, pathStyle, env));
    }
    if (split.postLead) shapes.push(split.postLead);
  } else if (spec.kind === "diode") {
    const settings = circuitikzDiodeSettings(spec, options, env);
    const split = appendCircuitikzSplitWire(
      commands,
      from,
      to,
      geometry,
      circuitikzBodyLength("diode", geometry.length, env, settings),
      pathStyle,
      styleHints,
      options,
      env
    );
    shapes.push(...circuitikzDiodeItems(geometry, spec, settings, pathStyle, options, env));
    if (split.postLead) shapes.push(split.postLead);
  } else if (spec.kind === "battery") {
    const split = appendCircuitikzSplitWire(
      commands,
      from,
      to,
      geometry,
      circuitikzBodyLength("battery", geometry.length, env),
      pathStyle,
      styleHints,
      options,
      env
    );
    shapes.push(...circuitikzBatteryItems(geometry, spec, pathStyle, env));
    if (split.postLead) shapes.push(split.postLead);
  } else if (spec.kind === "inductor" || spec.kind === "choke") {
    const settings = circuitikzInductorSettings(spec, options, env);
    const bodyLength = circuitikzBodyLength("inductor", geometry.length, env, settings);
    const split = appendCircuitikzSplitWire(
      commands,
      from,
      to,
      geometry,
      bodyLength,
      pathStyle,
      styleHints,
      options,
      env
    );
    shapes.push(...circuitikzInductorItems(from, to, geometry, spec, settings, pathStyle));
    if (split.postLead) shapes.push(split.postLead);
    registerCircuitikzInductorNode(spec, geometry, settings, bodyLength, options, env);
  } else if (spec.kind === "voltageSource" || spec.kind === "controlledVoltageSource") {
    const split = appendCircuitikzSplitWire(
      commands,
      from,
      to,
      geometry,
      circuitikzBodyLength(spec.kind === "controlledVoltageSource" ? "controlledSource" : "voltageSource", geometry.length, env, spec),
      pathStyle,
      styleHints,
      options,
      env
    );
    shapes.push(...circuitikzVoltageSourceItems(from, to, geometry, spec, pathStyle, env));
    appendCircuitikzVoltageSourceSymbolNodes(nodes, spec, geometry, env);
    if (split.postLead) shapes.push(split.postLead);
  } else if (spec.kind === "isource" || spec.kind === "controlledCurrentSource") {
    const split = appendCircuitikzSplitWire(
      commands,
      from,
      to,
      geometry,
      circuitikzBodyLength(spec.kind === "controlledCurrentSource" ? "controlledSource" : "isource", geometry.length, env, spec),
      pathStyle,
      styleHints,
      options,
      env
    );
    shapes.push(...circuitikzCurrentSourceItems(from, to, geometry, spec, pathStyle, options, env));
    if (split.postLead) shapes.push(split.postLead);
  } else if (spec.kind === "mosfet") {
    commands.push(moveToCommand(to));
    shapes.push(...circuitikzMosfetItems(from, to, geometry, spec, pathStyle, env));
    registerCircuitikzMosfetNode(spec, from, to, geometry, env);
  }

  for (const terminal of circuitikzTerminals(options, from, to)) {
    shapes.push(circuitikzTerminalItem(terminal, pathStyle, env));
  }
  appendCircuitikzComponentLabel(nodes, spec, from, to, geometry, env);
  appendCircuitikzAnnotationLabel(nodes, spec, geometry, options, env);
  appendCircuitikzCurrentLabel(nodes, shapes, spec, from, to, geometry, options, pathStyle, env);
  appendCircuitikzFlowLabel(nodes, shapes, spec, from, to, geometry, options, pathStyle, env);
  appendCircuitikzVoltageLabel(nodes, shapes, spec, from, to, geometry, options, pathStyle, env);

  return { from: roundPoint(from), to: roundPoint(to), drawnTo: roundPoint(to) };
}

function circuitikzPackageSettings(packages = []) {
  const circuitikzPackage = (packages || []).find((pkg) => pkg?.name === "circuitikz");
  const options = circuitikzPackage?.options || {};
  const optionKeys = Object.keys(options).map((key) => key.toLowerCase());
  const hasOption = (name) => optionKeys.includes(String(name).toLowerCase());
  return {
    packageOptions: { ...options },
    siunitx: hasOption("siunitx"),
    RPvoltages: hasOption("RPvoltages"),
    voltageMode: hasOption("RPvoltages") ? "RPvoltages" : null
  };
}

function circuitikzBipoleSpec(options = {}, env = {}) {
  const name = circuitikzComponentName(options);
  const resistorLabel = circuitikzFirstLabel(options, ["R", "resistor", "american resistor", "european resistor"]);
  if (resistorLabel !== null) return { kind: "resistor", label: resistorLabel, name };
  // `vC` is case-sensitive at the Circuitikz level: it is a tunable capacitor,
  // while the uppercase `VC` alias belongs to the diode-like varcap family.
  // Resolve it before the case-insensitive diode alias matcher below.
  const variableCapacitorLabel = circuitikzFirstLabel(options, ["vC", "variable capacitor"]);
  if (variableCapacitorLabel !== null) {
    return {
      kind: "capacitor",
      variable: true,
      label: circuitikzLabelValue(options.l) || variableCapacitorLabel,
      name
    };
  }
  const capacitorLabel = circuitikzFirstLabel(options, ["C", "capacitor"]);
  if (capacitorLabel !== null) return { kind: "capacitor", label: capacitorLabel, name };
  const diode = circuitikzDiodeSpec(options, env);
  if (diode) return { ...diode, name };
  const battery = circuitikzFirstMatchingOption(options, /^battery(?:1|2)?$/i);
  if (battery) {
    return {
      kind: "battery",
      batteryKind: battery.key.toLowerCase(),
      label: circuitikzLabelValue(options.l) || battery.label,
      name
    };
  }
  const chokeLabel = circuitikzFirstLabel(options, ["cute choke", "cutechoke"]);
  if (chokeLabel !== null) {
    return {
      kind: "choke",
      choke: true,
      variable: false,
      inductorKind: "cute",
      label: circuitikzLabelValue(options.l) || chokeLabel,
      name
    };
  }
  const variableInductor = circuitikzFirstLabel(options, ["vL", "variable inductor", "variable cute inductor", "variable american inductor", "variable european inductor"]);
  if (variableInductor !== null) {
    return {
      kind: "inductor",
      variable: true,
      inductorKind: circuitikzInductorKind(options, env),
      label: circuitikzLabelValue(options.l) || variableInductor,
      name
    };
  }
  const inductor = circuitikzFirstLabel(options, ["L", "inductor", "cute inductor", "american inductor", "european inductor"]);
  if (inductor !== null) {
    return {
      kind: "inductor",
      variable: false,
      inductorKind: circuitikzInductorKind(options, env),
      label: circuitikzLabelValue(options.l) || inductor,
      name
    };
  }
  const dcVoltage = circuitikzFirstMatchingOption(options, /^(?:dcvsource|dc voltage source)$/i);
  if (dcVoltage) {
    return {
      kind: "voltageSource",
      sourceKind: "dc",
      componentFill: circuitikzComponentFill(options),
      label: circuitikzLabelValue(options.l) || dcVoltage.label,
      voltageKey: dcVoltage.key,
      voltageLabel: dcVoltage.label
    };
  }
  const dcCurrent = circuitikzFirstMatchingOption(options, /^(?:dcisource|dc current source)$/i);
  if (dcCurrent) {
    return {
      kind: "isource",
      sourceKind: "dc",
      componentFill: circuitikzComponentFill(options),
      label: circuitikzLabelValue(options.l) || dcCurrent.label,
      currentKey: dcCurrent.key,
      currentLabel: dcCurrent.label
    };
  }
  const sinusoidalVoltage = circuitikzFirstMatchingOption(options, /^(?:sV[<>_^]*|vsourcesin|sinusoidal voltage source)$/i);
  if (sinusoidalVoltage) {
    return {
      kind: "voltageSource",
      sourceKind: "sinusoidal",
      label: circuitikzLabelValue(options.l) || sinusoidalVoltage.label,
      voltageKey: sinusoidalVoltage.key
    };
  }
  const sinusoidalCurrent = circuitikzFirstMatchingOption(options, /^(?:sI[<>_^]*|isourcesin|sinusoidal current source)$/i);
  if (sinusoidalCurrent) {
    return {
      kind: "isource",
      sourceKind: "sinusoidal",
      label: circuitikzLabelValue(options.l) || sinusoidalCurrent.label,
      currentLabel: sinusoidalCurrent.label,
      currentKey: sinusoidalCurrent.key
    };
  }
  const squareVoltage = circuitikzFirstMatchingOption(
    options,
    /^(?:sqV[<>_^]*|vsourcesquare|square voltage source)$/i
  );
  if (squareVoltage) {
    return {
      kind: "voltageSource",
      sourceKind: "square",
      label: circuitikzLabelValue(options.l) || squareVoltage.label,
      voltageKey: squareVoltage.key,
      voltageLabel: squareVoltage.label
    };
  }
  const triangularVoltage = circuitikzFirstMatchingOption(
    options,
    /^(?:tV[<>_^]*|vsourcetri|triangle voltage source)$/i
  );
  if (triangularVoltage) {
    return {
      kind: "voltageSource",
      sourceKind: "triangular",
      label: circuitikzLabelValue(options.l) || triangularVoltage.label,
      voltageKey: triangularVoltage.key,
      voltageLabel: triangularVoltage.label
    };
  }
  const controlledSinusoidalVoltage = circuitikzFirstMatchingOption(
    options,
    /^(?:csV[<>_^]*|cvsourcesin|controlled vsourcesin|controlled sinusoidal voltage source)$/i
  );
  if (controlledSinusoidalVoltage) {
    return {
      kind: "controlledVoltageSource",
      sourceKind: "sinusoidal",
      sourceStyle: "sinusoidal",
      label: circuitikzLabelValue(options.l) || controlledSinusoidalVoltage.label,
      voltageKey: controlledSinusoidalVoltage.key,
      voltageLabel: controlledSinusoidalVoltage.label
    };
  }
  const controlledSinusoidalCurrent = circuitikzFirstMatchingOption(
    options,
    /^(?:csI[<>_^]*|cisourcesin|controlled isourcesin|controlled sinusoidal current source)$/i
  );
  if (controlledSinusoidalCurrent) {
    return {
      kind: "controlledCurrentSource",
      sourceKind: "sinusoidal",
      sourceStyle: "sinusoidal",
      label: circuitikzLabelValue(options.l) || null,
      currentKey: controlledSinusoidalCurrent.key,
      currentLabel: controlledSinusoidalCurrent.label
    };
  }
  const voltage = circuitikzFirstMatchingOption(options, /^V[<>_^]*$/);
  if (voltage) return { kind: "voltageSource", sourceKind: "plain", label: voltage.label, voltageKey: voltage.key };
  const controlledVoltage = circuitikzFirstMatchingOption(options, /^cV[<>_^]*$/);
  const controlledVoltageStyle = circuitikzFirstMatchingOption(
    options,
    /^(?:controlled voltage source|controlled vsource|cvsource|cvsourceEU|cvsourceAM|european controlled voltage source|american controlled voltage source)$/
  );
  if (controlledVoltage || controlledVoltageStyle) {
    return {
      kind: "controlledVoltageSource",
      sourceKind: "controlled",
      sourceStyle: circuitikzControlledSourceStyle(options, env, "voltage"),
      label: circuitikzLabelValue(options.l) || controlledVoltageStyle?.label || null,
      voltageKey: controlledVoltage?.key || null,
      voltageLabel: controlledVoltage?.label || null
    };
  }
  const controlledCurrent = circuitikzFirstMatchingOption(options, /^cI[<>_^]*$/);
  const controlledCurrentStyle = circuitikzFirstMatchingOption(
    options,
    /^(?:controlled current source|controlled isource|cisource|cisourceEU|cisourceAM|european controlled current source|american controlled current source)$/
  );
  if (controlledCurrent || controlledCurrentStyle) {
    return {
      kind: "controlledCurrentSource",
      sourceKind: "controlled",
      sourceStyle: circuitikzControlledSourceStyle(options, env, "current"),
      label: circuitikzLabelValue(options.l) || controlledCurrentStyle?.label || null,
      currentKey: controlledCurrent?.key || null,
      currentLabel: controlledCurrent?.label || null
    };
  }
  const americanCurrentSource = circuitikzFirstLabel(options, ["american current source", "isourceAM"]);
  if (americanCurrentSource !== null) {
    return {
      kind: "isource",
      sourceKind: "plain",
      sourceStyle: "american",
      label: circuitikzLabelValue(options.l) || americanCurrentSource
    };
  }
  const europeanCurrentSource = circuitikzFirstLabel(options, ["european current source", "isourceEU"]);
  if (europeanCurrentSource !== null) {
    return {
      kind: "isource",
      sourceKind: "plain",
      sourceStyle: "european",
      label: circuitikzLabelValue(options.l) || europeanCurrentSource
    };
  }
  const sourceLabel = circuitikzFirstLabel(options, ["isource", "I", "current source"]);
  if (sourceLabel !== null) {
    return {
      kind: "isource",
      sourceKind: "plain",
      sourceStyle: circuitikzUsesAmericanCurrentSource(env) ? "american" : "european",
      label: circuitikzLabelValue(options.l) || sourceLabel
    };
  }
  const pmosLabel = circuitikzFirstLabel(options, ["Tpmos", "pmos", "tpmos"]);
  if (pmosLabel !== null) return { kind: "mosfet", mosfetKind: "pmos", label: pmosLabel, name: circuitikzComponentName(options, pmosLabel) };
  const nmosLabel = circuitikzFirstLabel(options, ["Tnmos", "nmos", "tnmos"]);
  if (nmosLabel !== null) return { kind: "mosfet", mosfetKind: "nmos", label: nmosLabel, name: circuitikzComponentName(options, nmosLabel) };
  if (options.short !== undefined) return { kind: "short", label: circuitikzLabelValue(options.l) };
  return null;
}

function circuitikzDiodeSpec(options = {}, env = {}) {
  for (const [rawKey, rawValue] of Object.entries(options || {})) {
    const key = String(rawKey).trim().replace(/\s+/g, " ");
    const short = key.match(/^(tvsD|zzD|lasD|shD|biD|tD|pD|zD|leD|sD|VC|D)([o*-])?$/i);
    if (short) {
      const diodeKind = circuitikzDiodeKind(short[1]);
      return {
        kind: "diode",
        diodeKind,
        variant: circuitikzDiodeVariant(short[2], options, env),
        label: circuitikzLabelValue(options.l) || circuitikzLabelValue(rawValue)
      };
    }
    const long = key.match(/^(?:(full|empty|stroke) )?(tvs diode|zzener diode|zener diode|laser diode|photodiode|varcap|led|schottky diode|tunnel diode|shockley diode|bidirectional diode|bidirectionaldiode|diode)$/i);
    if (!long) continue;
    const diodeKind = circuitikzDiodeKind(long[2]);
    return {
      kind: "diode",
      diodeKind,
      variant: circuitikzDiodeVariant(long[1], options, env),
      label: circuitikzLabelValue(options.l) || circuitikzLabelValue(rawValue)
    };
  }
  return null;
}

function circuitikzDiodeKind(raw = "") {
  const kind = String(raw).trim().toLowerCase().replace(/\s+/g, " ");
  if (kind === "led" || kind === "lediode") return "led";
  if (kind === "pd" || kind === "photodiode") return "photodiode";
  if (kind === "lasd" || kind === "laser diode") return "laser";
  if (kind === "vc" || kind === "varcap") return "varcap";
  if (kind === "sd" || kind === "schottky diode") return "schottky";
  if (kind === "zd" || kind === "zener diode") return "zener";
  if (kind === "zzd" || kind === "zzener diode") return "zzener";
  if (kind === "tvsd" || kind === "tvs diode") return "tvs";
  if (kind === "td" || kind === "tunnel diode") return "tunnel";
  if (kind === "shd" || kind === "shockley diode") return "shockley";
  if (kind === "bid" || kind === "bidirectional diode" || kind === "bidirectionaldiode") return "bidirectional";
  return "diode";
}

function circuitikzDiodeVariant(explicit, options = {}, env = {}) {
  if (explicit === "*" || explicit === "full") return "full";
  if (explicit === "o" || explicit === "empty") return "empty";
  if (explicit === "-" || explicit === "stroke") return "stroke";
  const sources = [options, env.circuitikz || {}, env.pictureOptions || {}];
  for (const source of sources) {
    const configured = String(source.diode ?? source.diodes ?? "").trim().toLowerCase();
    if (configured === "full" || configured === "empty" || configured === "stroke") return configured;
    if (source["full diodes"] !== undefined) return "full";
    if (source["empty diodes"] !== undefined) return "empty";
    if (source["stroke diodes"] !== undefined) return "stroke";
  }
  // circuitikz initializes its auto-selecting `diode` key to empty. Explicit
  // `*`, `o`, and `-` aliases select full, empty, and stroke respectively.
  return "empty";
}

function circuitikzComponentName(options = {}, fallback = "") {
  for (const key of ["n", "name"]) {
    if (options[key] === undefined) continue;
    const value = circuitikzLabelValue(options[key]);
    return value || fallback || "";
  }
  return fallback || "";
}

function circuitikzFirstLabel(options = {}, keys = []) {
  for (const key of keys) {
    if (options[key] === undefined) continue;
    return circuitikzLabelValue(options[key]) || "";
  }
  return null;
}

function circuitikzFirstMatchingLabel(options = {}, pattern) {
  return circuitikzFirstMatchingOption(options, pattern)?.label ?? null;
}

function circuitikzFirstMatchingOption(options = {}, pattern) {
  for (const [key, value] of Object.entries(options || {})) {
    pattern.lastIndex = 0;
    if (!pattern.test(key)) continue;
    return { key, label: circuitikzLabelValue(value) || "" };
  }
  return null;
}

function circuitikzLabelValue(value) {
  if (value === undefined || value === null || value === true || value === false) return "";
  return String(value).trim();
}

function circuitikzComponentFill(options = {}) {
  const raw = options.fill;
  if (raw === undefined || raw === null || raw === true || raw === false || raw === "") return null;
  return normalizeColor(String(raw));
}

const CIRCUITIKZ_UNIT_SYMBOLS = {
  ohm: "Ω",
  volt: "V",
  ampere: "A",
  amp: "A",
  farad: "F",
  henry: "H",
  siemens: "S",
  watt: "W",
  second: "s",
  hertz: "Hz"
};

function circuitikzTextLabel(value, env = {}) {
  const text = circuitikzLabelValue(value);
  if (!text) return "";
  return circuitikzFormatSiunitxLabel(text, env);
}

function circuitikzFormatSiunitxLabel(text, env = {}) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  if (!env.circuitikz?.siunitx && !/<\\[A-Za-z]+>/.test(raw) && !/\\SI\b|\\(?:ohm|volt|ampere|farad|henry|siemens|watt)\b/.test(raw)) {
    return raw;
  }
  return raw
    .replace(/\\SI\{([^{}]+)\}\{\\([A-Za-z]+)\}/g, (_match, value, unit) => `${value.trim()} ${circuitikzUnitSymbol(unit)}`)
    .replace(/([+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?)\s*<\\([A-Za-z]+)>/g, (_match, value, unit) => {
      return `${value.trim()} ${circuitikzUnitSymbol(unit)}`;
    })
    .replace(/\\([A-Za-z]+)\b/g, (match, unit) => CIRCUITIKZ_UNIT_SYMBOLS[unit] || match)
    .replace(/\s+/g, " ")
    .trim();
}

function circuitikzUnitSymbol(unit) {
  return CIRCUITIKZ_UNIT_SYMBOLS[String(unit || "").trim()] || String(unit || "").trim();
}

function circuitikzSegmentGeometry(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-9) return null;
  const ux = dx / length;
  const uy = dy / length;
  return {
    length,
    u: { x: ux, y: uy },
    n: { x: -uy, y: ux },
    mid: roundPoint({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 })
  };
}

function circuitikzLengthScale(env = {}) {
  const scale = canvasLengthScale(env);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function circuitikzOpAmpSize(env = {}) {
  return { width: 1.7, height: 1.4 };
}

function circuitikzGroundSize(env = {}) {
  const scale = circuitikzLengthScale(env);
  return { width: roundNumber(0.44 * scale), height: roundNumber(0.36 * scale) };
}

function circuitikzTransistorSize(env = {}) {
  const scale = circuitikzLengthScale(env);
  return { width: roundNumber(1.75 * scale), height: roundNumber(1.55 * scale) };
}

function circuitikzMosfetNodeSize(env = {}) {
  const scale = circuitikzLengthScale(env);
  // pgfcirctripoles.tex gives the plain MOS body a width of .7 Rlen and a
  // height of 1.1 Rlen. Its origin is the right-hand D/S spine.
  return { width: roundNumber(0.7 * scale), height: roundNumber(1.1 * scale) };
}

function circuitikzTubeSize(env = {}, options = {}) {
  const scale = circuitikzLengthScale(env);
  const rlenScale = 1.4;
  return {
    width: roundNumber(circuitikzTubeNumber("width", options, env, 1) * rlenScale * scale),
    height: roundNumber(circuitikzTubeNumber("height", options, env, 1.4) * rlenScale * scale)
  };
}

function circuitikzQuadpoleSize(env = {}, options = {}) {
  const kind = circuitikzQuadpoleKind(options) || "transformer";
  const scale = circuitikzLengthScale(env);
  const rlenScale = 1.4;
  return {
    width: roundNumber(circuitikzQuadpoleNumber(kind, "width", options, env, 1.5) * rlenScale * scale),
    height: roundNumber(circuitikzQuadpoleNumber(kind, "height", options, env, 1.5) * rlenScale * scale)
  };
}

function circuitikzQuadpoleRawOption(kind, key, options = {}, env = {}) {
  const names = [`circuitikz/quadpoles/${kind}/${key}`, `quadpoles/${kind}/${key}`];
  for (const name of names) {
    if (options[name] !== undefined) return options[name];
  }
  for (const name of names) {
    if (env.pictureOptions?.[name] !== undefined) return env.pictureOptions[name];
  }
  for (const name of names) {
    if (env.circuitikz?.[name] !== undefined) return env.circuitikz[name];
  }
  return undefined;
}

function circuitikzQuadpoleNumber(kind, key, options = {}, env = {}, fallback = 0) {
  const raw = circuitikzQuadpoleRawOption(kind, key, options, env);
  if (raw === undefined || raw === null || raw === true || raw === "") return fallback;
  const parsed = evaluateMath(String(raw), env.variables);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function circuitikzQuadpoleSettings(options = {}, env = {}) {
  const kind = circuitikzQuadpoleKind(options) || "transformer";
  return {
    kind,
    inner: circuitikzQuadpoleNumber(kind, "inner", options, env, 0.4),
    width: circuitikzQuadpoleNumber(kind, "width", options, env, 1.5),
    height: circuitikzQuadpoleNumber(kind, "height", options, env, 1.5),
    coils: {
      L1: circuitikzTransformerCoilStyle("L1", options, env),
      L2: circuitikzTransformerCoilStyle("L2", options, env)
    },
    core: kind === "transformer core" ? circuitikzTransformerCoreSettings(options, env) : null,
    inductorKind: env.circuitikz?.["inductors/kind"] || null
  };
}

function circuitikzTransformerCoreSettings(options = {}, env = {}) {
  const rawColor = circuitikzTransformerCoreRawOption("color", options, env);
  const rawDash = circuitikzTransformerCoreRawOption("dash", options, env);
  const dash = circuitikzTransformerCoreDash(rawDash, env);
  return {
    relativeThickness: Math.max(0, circuitikzTransformerCoreNumber("relative thickness", options, env, 1)),
    color: rawColor === undefined || String(rawColor).trim().toLowerCase() === "default"
      ? null
      : normalizeColor(String(rawColor)),
    dashMode: dash.mode,
    dashArray: dash.array
  };
}

function circuitikzTransformerCoreRawOption(key, options = {}, env = {}) {
  const names = [`circuitikz/transformer core/${key}`, `transformer core/${key}`];
  for (const source of [options, env.pictureOptions || {}, env.circuitikz || {}]) {
    for (const name of names) {
      if (source[name] !== undefined) return source[name];
    }
  }
  return undefined;
}

function circuitikzTransformerCoreNumber(key, options = {}, env = {}, fallback = 0) {
  const raw = circuitikzTransformerCoreRawOption(key, options, env);
  if (raw === undefined || raw === null || raw === true || raw === "") return fallback;
  const parsed = evaluateMath(String(raw), env.variables || {});
  return Number.isFinite(parsed) ? parsed : fallback;
}

function circuitikzTransformerCoreDash(raw, env = {}) {
  if (raw === undefined || raw === null || raw === true) return { mode: "inherit", array: undefined };
  const value = String(raw).trim();
  const normalized = value.toLowerCase();
  if (!value || normalized === "default") return { mode: "inherit", array: undefined };
  if (normalized === "none") return { mode: "solid", array: undefined };
  const parts = [...value.matchAll(/\{([^{}]+)\}/g)]
    .map((match) => lineWidthFromTikzDimension(match[1], NaN))
    .filter(Number.isFinite);
  return parts.length >= 2
    ? { mode: "custom", array: parts }
    : { mode: "inherit", array: undefined };
}

function circuitikzTransformerCoilStyle(coil, options = {}, env = {}) {
  const merged = {};
  const keys = [`transformer ${coil}/.style`, `transformer ${coil}`, `circuitikz/transformer ${coil}/.style`, `circuitikz/transformer ${coil}`];
  for (const source of [env.pictureOptions || {}, env.circuitikz || {}, options || {}]) {
    for (const key of keys) {
      if (source[key] === undefined) continue;
      Object.assign(merged, parseCtikzStyleValue(source[key]));
    }
  }
  if (!merged["inductors/kind"] && env.circuitikz?.["inductors/kind"]) merged["inductors/kind"] = env.circuitikz["inductors/kind"];
  return merged;
}

function parseCtikzStyleValue(value) {
  if (!value || value === true) return {};
  if (typeof value === "object") return { ...value };
  return parseOptions(stripOuterBraces(String(value)));
}

function circuitikzTubeRawOption(key, options = {}, env = {}) {
  const names = [`circuitikz/tubes/${key}`, `tubes/${key}`];
  for (const name of names) {
    if (options[name] !== undefined) return options[name];
  }
  for (const name of names) {
    if (env.pictureOptions?.[name] !== undefined) return env.pictureOptions[name];
  }
  for (const name of names) {
    if (env.circuitikz?.[name] !== undefined) return env.circuitikz[name];
  }
  return undefined;
}

function circuitikzTubeNumber(key, options = {}, env = {}, fallback = 0) {
  const raw = circuitikzTubeRawOption(key, options, env);
  if (raw === undefined || raw === null || raw === true || raw === "") return fallback;
  const parsed = evaluateMath(String(raw), env.variables);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function circuitikzTubePartialBorders(options = {}, env = {}) {
  const raw = circuitikzTubeRawOption("partial borders", options, env);
  if (raw === undefined || raw === null || raw === true) return "none";
  const value = String(raw).trim();
  return /^[012]{6}$/.test(value) ? value : "none";
}

function circuitikzTubeFill(options = {}, style = {}, env = {}) {
  if (style.fill && style.fill !== "none") return style.fill;
  const raw = circuitikzTubeRawOption("fill", options, env);
  if (raw === undefined || raw === null || raw === true || raw === "") return "none";
  return normalizeColor(String(raw));
}

function circuitikzTubeKind(options = {}) {
  const shape = normalizeShapeName(options.shape);
  if (options.pentode || shape === "pentode") return "pentode";
  if (options.tetrode || shape === "tetrode") return "tetrode";
  if (options.triode || shape === "triode") return "triode";
  if (options.diodetube || shape === "diodetube") return "diodetube";
  return null;
}

function circuitikzQuadpoleKind(options = {}) {
  const shape = normalizeShapeName(options.shape);
  if (options["transformer core"] || shape === "transformer core") return "transformer core";
  if (options.transformer || shape === "transformer") return "transformer";
  if (options.gyrator || shape === "gyrator") return "gyrator";
  return null;
}

function circuitikzTubeShape(kind) {
  if (kind === "pentode") return "circuitikzPentode";
  if (kind === "tetrode") return "circuitikzTetrode";
  if (kind === "diodetube") return "circuitikzDiodeTube";
  return "circuitikzTriode";
}

function circuitikzBodyLength(kind, segmentLength, env = {}, settings = null) {
  const scale = circuitikzLengthScale(env);
  const controlledScale = kind === "controlledSource" ? circuitikzControlledSourceScale(env) : 1;
  const batteryScale = kind === "battery" ? circuitikzBatteryScale(env) : 1;
  const sourceScale = kind === "voltageSource" || kind === "isource" ? circuitikzSourceScale(env) : 1;
  if (kind === "diode") {
    return Math.min(settings?.bodyLength || 0.56 * scale, Math.max(0, segmentLength * 0.78));
  }
  if (kind === "resistor") {
    return Math.min(settings?.bodyLength || 1.12 * scale, Math.max(0, segmentLength * 0.78));
  }
  const desired = kind === "inductor"
    ? (settings?.bodyLength || 0.84 * scale)
    : (kind === "capacitor" ? 0.28 : kind === "controlledSource" ? 0.98 * controlledScale : kind === "battery" ? 0.42 * batteryScale : (kind === "voltageSource" || kind === "isource") ? 0.84 * sourceScale : 0.84) * scale;
  return Math.min(desired, Math.max(0, segmentLength * 0.78));
}

function circuitikzControlledSourceScale(env = {}) {
  for (const source of [env.pictureOptions || {}, env.circuitikz || {}]) {
    for (const key of ["circuitikz/csources/scale", "csources/scale"]) {
      const value = source[key];
      if (value === undefined || value === null || value === true || value === "") continue;
      const parsed = evaluateMath(String(value), env.variables || {});
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }
  return 1;
}

function circuitikzCurrentArrowScale(options = {}, env = {}) {
  for (const source of [options, env.pictureOptions || {}, env.circuitikz || {}]) {
    for (const key of ["circuitikz/current arrow scale", "current arrow scale"]) {
      const value = source[key];
      if (value === undefined || value === null || value === true || value === "") continue;
      const parsed = evaluateMath(String(value), env.variables || {});
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }
  return 16;
}

function circuitikzBatteryScale(env = {}) {
  for (const source of [env.pictureOptions || {}, env.circuitikz || {}]) {
    for (const key of ["circuitikz/batteries/scale", "batteries/scale"]) {
      const value = source[key];
      if (value === undefined || value === null || value === true || value === "") continue;
      const parsed = evaluateMath(String(value), env.variables || {});
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }
  return 1;
}

function circuitikzSourceScale(env = {}) {
  for (const source of [env.pictureOptions || {}, env.circuitikz || {}]) {
    for (const key of ["circuitikz/sources/scale", "sources/scale"]) {
      const value = source[key];
      if (value === undefined || value === null || value === true || value === "") continue;
      const parsed = evaluateMath(String(value), env.variables || {});
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }
  return 1;
}

function circuitikzSourceSymbolThickness(env = {}, sourceClass = "sources") {
  const normalizedClass = sourceClass === "csources" ? "csources" : "sources";
  for (const source of [env.pictureOptions || {}, env.circuitikz || {}]) {
    for (const key of [
      `circuitikz/${normalizedClass}/symbol/thickness`,
      `${normalizedClass}/symbol/thickness`
    ]) {
      const value = source[key];
      if (value === undefined || value === null || value === true || value === "") continue;
      const parsed = evaluateMath(String(value), env.variables || {});
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }
  return 1;
}

function circuitikzSourceSymbolRotation(geometry, env = {}, sourceClass = "sources") {
  const normalizedClass = sourceClass === "csources" ? "csources" : "sources";
  let raw = null;
  for (const source of [env.pictureOptions || {}, env.circuitikz || {}]) {
    for (const key of [
      `circuitikz/${normalizedClass}/symbol/rotate`,
      `${normalizedClass}/symbol/rotate`
    ]) {
      const value = source[key];
      if (value === undefined || value === null || value === true || value === "") continue;
      raw = String(value).trim();
      break;
    }
    if (raw != null) break;
  }
  if (raw?.toLowerCase() === "auto") {
    return roundNumber((-Math.atan2(geometry.u.y, geometry.u.x) * 180) / Math.PI);
  }
  const parsed = evaluateMath(raw || "90", env.variables || {});
  return Number.isFinite(parsed) ? roundNumber(parsed) : 90;
}

function circuitikzSourceSignRotation(geometry, env = {}) {
  let raw = null;
  for (const source of [env.pictureOptions || {}, env.circuitikz || {}]) {
    for (const key of [
      "circuitikz/sources/symbol/sign rotation",
      "sources/symbol/sign rotation"
    ]) {
      const value = source[key];
      if (value === undefined || value === null || value === true || value === "") continue;
      raw = String(value).trim();
      break;
    }
    if (raw != null) break;
  }

  // pgfcircbipoles.tex keeps the traditional American-source signs vertical
  // by default. The auto and straight modes use the current path transform.
  const mode = String(raw || "default").trim().toLowerCase();
  if (mode === "default") return 90;
  const pathRotation = roundNumber((-Math.atan2(geometry.u.y, geometry.u.x) * 180) / Math.PI);
  if (mode === "auto") {
    const absolute = Math.abs(pathRotation);
    return absolute < 46 || absolute > 134 ? 0 : 90;
  }
  if (mode === "straight") return pathRotation;
  const parsed = evaluateMath(raw, env.variables || {});
  return Number.isFinite(parsed) ? roundNumber(parsed) : 90;
}

function circuitikzWaveformBasis(geometry, rotation) {
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    axis: {
      x: geometry.u.x * cos + geometry.n.x * sin,
      y: geometry.u.y * cos + geometry.n.y * sin
    },
    lateral: {
      x: -geometry.u.x * sin + geometry.n.x * cos,
      y: -geometry.u.y * sin + geometry.n.y * cos
    }
  };
}

function circuitikzSinusoidalCurrentAngle(env = {}) {
  for (const source of [env.pictureOptions || {}, env.circuitikz || {}]) {
    for (const key of ["circuitikz/bipoles/isourcesin/angle", "bipoles/isourcesin/angle"]) {
      const value = source[key];
      if (value === undefined || value === null || value === true || value === "") continue;
      const parsed = evaluateMath(String(value), env.variables || {});
      if (Number.isFinite(parsed)) return Math.max(0, Math.min(90, parsed));
    }
  }
  return 90;
}

function circuitikzDcCurrentAngle(env = {}) {
  for (const source of [env.pictureOptions || {}, env.circuitikz || {}]) {
    for (const key of ["circuitikz/bipoles/dcisource/angle", "bipoles/dcisource/angle"]) {
      const value = source[key];
      if (value === undefined || value === null || value === true || value === "") continue;
      const parsed = evaluateMath(String(value), env.variables || {});
      if (Number.isFinite(parsed)) return Math.max(0, Math.min(90, parsed));
    }
  }
  return 80;
}

function circuitikzControlledSourceStyle(options = {}, env = {}, kind = "voltage") {
  const americanKeys = kind === "voltage"
    ? ["american controlled voltage source", "cvsourceAM"]
    : ["american controlled current source", "cisourceAM"];
  const europeanKeys = kind === "voltage"
    ? ["european controlled voltage source", "cvsourceEU"]
    : ["european controlled current source", "cisourceEU"];
  for (const key of americanKeys) {
    if (options[key] !== undefined) return "american";
  }
  for (const key of europeanKeys) {
    if (options[key] !== undefined) return "european";
  }
  return kind === "voltage"
    ? circuitikzUsesAmericanVoltageSource(env) ? "american" : "european"
    : circuitikzUsesAmericanCurrentSource(env) ? "american" : "european";
}

function circuitikzInductorKind(options = {}, env = {}) {
  if (options["european inductor"] !== undefined || options["variable european inductor"] !== undefined) return "european";
  if (options["american inductor"] !== undefined || options["variable american inductor"] !== undefined) return "american";
  if (options["cute inductor"] !== undefined || options["variable cute inductor"] !== undefined) return "cute";
  // Segment options inherit tikzpicture defaults, so the mutable \ctikzset
  // state must be considered before them. Explicit component styles returned
  // above remain the most specific choice.
  for (const source of [env.circuitikz || {}, options, env.pictureOptions || {}]) {
    const configured = source.inductor ?? source["inductors/kind"];
    const kind = String(configured === true ? "" : configured || "").trim().toLowerCase();
    if (kind === "european" || kind === "american" || kind === "cute") return kind;
    if (source["european inductors"] !== undefined || source.european !== undefined) return "european";
    if (source["american inductors"] !== undefined || source.american !== undefined) return "american";
    if (source["cute inductors"] !== undefined || source.cute !== undefined) return "cute";
  }
  return "cute";
}

function circuitikzInductorRawOption(key, options = {}, env = {}) {
  const names = [`circuitikz/inductors/${key}`, `inductors/${key}`];
  for (const source of [options, env.pictureOptions || {}, env.circuitikz || {}]) {
    for (const name of names) {
      if (source[name] !== undefined) return source[name];
    }
  }
  return undefined;
}

function circuitikzInductorNumber(key, options = {}, env = {}, fallback = 0) {
  const raw = circuitikzInductorRawOption(key, options, env);
  if (raw === undefined || raw === null || raw === true || raw === "") return fallback;
  const parsed = evaluateMath(String(raw), env.variables || {});
  return Number.isFinite(parsed) ? parsed : fallback;
}

function circuitikzInductorSettings(spec, options = {}, env = {}) {
  const kind = spec.choke ? "cute" : spec.inductorKind || "cute";
  const scale = circuitikzLengthScale(env);
  const defaultWidth = kind === "cute" ? 0.6 : 0.8;
  const defaultCoils = kind === "cute" ? 5 : kind === "american" ? 4 : 0;
  const width = Math.max(0.05, circuitikzInductorNumber("width", options, env, defaultWidth));
  const inductorScale = Math.max(0.05, circuitikzInductorNumber("scale", options, env, 1));
  const minCoils = kind === "cute" ? 2 : kind === "american" ? 1 : 0;
  const coils = kind === "european"
    ? 0
    : Math.max(minCoils, Math.round(circuitikzInductorNumber("coils", options, env, defaultCoils)));
  const modifierThickness = Math.max(0.05, circuitikzInductorNumber("modifier thickness", options, env, 1));
  const rlen = 1.4 * scale * inductorScale;
  const bodyLength = width * rlen;
  const settings = {
    kind,
    coils,
    width,
    scale: inductorScale,
    bodyLength,
    upperAmplitude: kind === "american"
      ? 0.15 * rlen
      : kind === "european" && spec.variable
        ? 0.14 * rlen
        : 0.15 * rlen,
    lowerAmplitude: kind === "american"
      ? 0.15 * rlen
      : kind === "european" && spec.variable
        ? 0.14 * rlen
        : kind === "cute"
          ? 0.075 * rlen
          : 0.15 * rlen,
    tunableUpperAmplitude: kind === "european"
      ? 0.35 * rlen
      : 0.3 * rlen,
    tunableLowerAmplitude: kind === "european"
      ? 0.35 * rlen
      : kind === "american"
        ? 0.1 * rlen
        : 0.15 * rlen,
    modifierThickness,
    // vcuteinductor always keeps its original diagonal. The generic European
    // and American variable bodies explicitly honor this global Circuitikz key.
    fixedTunableDirection: kind === "cute" || circuitikzFixedTunableDirection(options, env)
  };
  if (spec.choke) {
    settings.choke = {
      coreLines: circuitikzChokeCoreLineCount(options, env),
      coreDistance: circuitikzChokeNumber("cdist", options, env, 1.3),
      coreStep: circuitikzChokeNumber("cstep", options, env, 0.3),
      coreThickness: Math.max(0.05, circuitikzChokeNumber("cthick", options, env, 1))
    };
  }
  return settings;
}

function circuitikzChokeCoreLineCount(options = {}, env = {}) {
  const sources = [options, env.pictureOptions || {}, env.circuitikz || {}];
  for (const source of sources) {
    if (source.onelinechoke !== undefined) return 1;
    if (source.twolineschoke !== undefined) return 2;
  }
  return 1;
}

function circuitikzChokeNumber(key, options = {}, env = {}, fallback = 0) {
  const names = [
    `circuitikz/bipoles/cutechoke/${key}`,
    `bipoles/cutechoke/${key}`,
    `cutechoke/${key}`
  ];
  for (const source of [options, env.pictureOptions || {}, env.circuitikz || {}]) {
    for (const name of names) {
      const raw = source[name];
      if (raw === undefined || raw === null || raw === true || raw === "") continue;
      const value = evaluateMath(String(raw), env.variables || {});
      if (Number.isFinite(value)) return value;
    }
  }
  return fallback;
}

function circuitikzInductorCoreDistance(options = {}, env = {}) {
  const names = [
    "circuitikz/bipoles/inductors/core distance",
    "bipoles/inductors/core distance"
  ];
  for (const source of [options, env.pictureOptions || {}, env.circuitikz || {}]) {
    for (const name of names) {
      const raw = source[name];
      if (raw === undefined || raw === null || raw === true || raw === "") continue;
      const value = parseDimension(String(raw), env.variables || {}) * canvasLengthScale(env);
      if (Number.isFinite(value)) return Math.max(0, value);
    }
  }
  return parseDimension("2pt", env.variables || {}) * canvasLengthScale(env);
}

function appendCircuitikzSplitWire(commands, from, to, geometry, bodyLength, pathStyle = {}, styleHints = null, options = {}, env = {}) {
  const half = bodyLength / 2;
  const start = pointAlong(geometry.mid, geometry.u, -half);
  const end = pointAlong(geometry.mid, geometry.u, half);
  const postLead = circuitikzPostLeadEndpoints(end, to, geometry, options, env);
  commands.push(lineToCommand(start));
  if (circuitikzPathHasMarkers(pathStyle)) {
    suppressCircuitikzPathMarkers(styleHints);
    commands.push(moveToCommand(postLead.to));
    return {
      start,
      end,
      postLead: circuitikzLeadItem(postLead.from, postLead.to, pathStyle)
    };
  }
  commands.push(moveToCommand(postLead.from));
  commands.push(lineToCommand(postLead.to));
  return { start, end, postLead: null };
}

function circuitikzPostLeadEndpoints(from, to, geometry, options = {}, env = {}) {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (length < 1e-9) return { from, to };
  const startShorten = Math.min(circuitikzShortenLength(options["shorten <="] ?? options["shorten <"], env), length);
  const endShorten = Math.min(circuitikzShortenLength(options["shorten >="] ?? options["shorten >"], env), Math.max(0, length - startShorten));
  return {
    from: pointAlong(from, geometry.u, startShorten),
    to: pointAlong(to, geometry.u, -endShorten)
  };
}

function circuitikzShortenLength(value, env = {}) {
  if (value === undefined || value === null || value === true || value === "") return 0;
  const parsed = parseDimension(String(value), env.variables || {});
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function circuitikzPathHasMarkers(pathStyle = {}) {
  return Boolean(pathStyle.markerStart || pathStyle.markerEnd);
}

function suppressCircuitikzPathMarkers(styleHints) {
  if (!styleHints) return;
  styleHints.markerStart = undefined;
  styleHints.markerEnd = undefined;
}

function circuitikzLeadItem(from, to, pathStyle = {}) {
  if (pointsAlmostEqual(from, to)) return null;
  return {
    type: "path",
    subtype: "circuitikz-post-lead",
    style: {
      ...pathStyle,
      fill: "none"
    },
    commands: [
      { type: "moveTo", x: from.x, y: from.y },
      { type: "lineTo", x: to.x, y: to.y }
    ]
  };
}

function circuitikzResistorKind(options = {}, env = {}) {
  // `options` contains inherited tikzpicture keys. Only an explicit
  // resistor selector there may override mutable \ctikzset state; an
  // inherited `[american]` must not hide a later `resistor=european`.
  for (const source of [options]) {
    const selected = String(source.resistor === true ? "" : source.resistor || "").trim().toLowerCase();
    if (selected === "european") return "european";
    if (selected === "american") return "american";
    if (source["european resistor"] !== undefined || source["european resistors"] !== undefined) return "european";
    if (source["american resistor"] !== undefined || source["american resistors"] !== undefined) return "american";
  }
  for (const source of [env.circuitikz || {}, env.pictureOptions || {}]) {
    const selected = String(source.resistor === true ? "" : source.resistor || "").trim().toLowerCase();
    if (selected === "european") return "european";
    if (selected === "american") return "american";
    if (source["european resistor"] !== undefined || source["european resistors"] !== undefined || source.european !== undefined) return "european";
    if (source["american resistor"] !== undefined || source["american resistors"] !== undefined || source.american !== undefined) return "american";
  }
  // Circuitikz's resistor choice starts in the American (zigzag) state.
  return "american";
}

function circuitikzResistorRawOption(key, options = {}, env = {}) {
  const names = [
    `circuitikz/bipoles/resistor/${key}`,
    `bipoles/resistor/${key}`,
    `circuitikz/resistors/${key}`,
    `resistors/${key}`
  ];
  for (const source of [options, env.pictureOptions || {}, env.circuitikz || {}]) {
    for (const name of names) {
      if (source[name] !== undefined) return source[name];
    }
  }
  return undefined;
}

function circuitikzResistorNumber(key, options = {}, env = {}, fallback = 0) {
  const raw = circuitikzResistorRawOption(key, options, env);
  if (raw === undefined || raw === null || raw === true || raw === "") return fallback;
  const parsed = evaluateMath(String(raw), env.variables || {});
  return Number.isFinite(parsed) ? parsed : fallback;
}

function circuitikzResistorSettings(options = {}, env = {}) {
  const kind = circuitikzResistorKind(options, env);
  const rlen = 1.4 * circuitikzLengthScale(env);
  const width = Math.max(0.05, circuitikzResistorNumber("width", options, env, 0.8));
  const height = Math.max(0.05, circuitikzResistorNumber("height", options, env, 0.3));
  return {
    kind,
    width,
    height,
    zigs: Math.max(1, Math.round(circuitikzResistorNumber("zigs", options, env, 3))),
    bodyLength: width * rlen,
    // pgfcircdeclarebipolescaled turns the declared height into a symmetric
    // north/south bound, so each zig peak is half the configured full height.
    amplitude: height * rlen * 0.5
  };
}

function circuitikzResistorItem(geometry, bodyLength, settings = {}, pathStyle = {}) {
  const start = pointAlong(geometry.mid, geometry.u, -bodyLength / 2);
  const end = pointAlong(geometry.mid, geometry.u, bodyLength / 2);
  const commands = [{ type: "moveTo", ...roundPoint(start) }];
  if (settings.kind === "european") {
    // The shared bipole declaration has already converted the configured
    // `bipoles/resistor/height` into a north/south half extent.
    const halfHeight = settings.amplitude;
    const upperStart = pointNormal(start, geometry.n, halfHeight);
    const upperEnd = pointNormal(end, geometry.n, halfHeight);
    const lowerEnd = pointNormal(end, geometry.n, -halfHeight);
    const lowerStart = pointNormal(start, geometry.n, -halfHeight);
    commands.push(
      { type: "lineTo", ...roundPoint(upperStart) },
      { type: "lineTo", ...roundPoint(upperEnd) },
      { type: "lineTo", ...roundPoint(lowerEnd) },
      { type: "lineTo", ...roundPoint(lowerStart) },
      { type: "lineTo", ...roundPoint(upperStart) }
    );
  } else {
    // pgfcircbipoles.tex divides the resistor body into 4 * zigs equal steps:
    // a one-step ramp, alternating two-step peaks, then one final step to zero.
    const step = bodyLength / (4 * settings.zigs);
    for (let index = 0; index < settings.zigs * 2; index += 1) {
      const along = -bodyLength / 2 + (2 * index + 1) * step;
      const side = index % 2 === 0 ? -1 : 1;
      commands.push({
        type: "lineTo",
        ...roundPoint({
          x: geometry.mid.x + geometry.u.x * along + geometry.n.x * settings.amplitude * side,
          y: geometry.mid.y + geometry.u.y * along + geometry.n.y * settings.amplitude * side
        })
      });
    }
    commands.push({ type: "lineTo", ...roundPoint(end) });
  }
  return {
    type: "path",
    subtype: "circuitikz-resistor",
    resistorKind: settings.kind,
    zigs: settings.zigs,
    style: circuitikzComponentStyle(pathStyle),
    commands
  };
}

function circuitikzCapacitorItem(from, to, geometry, pathStyle = {}, env = {}) {
  const scale = circuitikzLengthScale(env);
  const plateHalf = 0.3 * scale;
  const gap = circuitikzBodyLength("capacitor", geometry.length, env) / 2;
  const leftCenter = pointAlong(geometry.mid, geometry.u, -gap / 2);
  const rightCenter = pointAlong(geometry.mid, geometry.u, gap / 2);
  const plate = (center) => [
    pointNormal(center, geometry.n, plateHalf),
    pointNormal(center, geometry.n, -plateHalf)
  ];
  const [l1, l2] = plate(leftCenter);
  const [r1, r2] = plate(rightCenter);
  return {
    type: "path",
    subtype: "circuitikz-capacitor",
    style: circuitikzComponentStyle(pathStyle),
    commands: [
      { type: "moveTo", x: l1.x, y: l1.y },
      { type: "lineTo", x: l2.x, y: l2.y },
      { type: "moveTo", x: r1.x, y: r1.y },
      { type: "lineTo", x: r2.x, y: r2.y }
    ]
  };
}

function circuitikzCapacitorRawOption(key, options = {}, env = {}) {
  const names = [
    `circuitikz/bipoles/vcapacitor/${key}`,
    `bipoles/vcapacitor/${key}`,
    `circuitikz/capacitors/${key}`,
    `capacitors/${key}`
  ];
  if (key === "fix tunable direction") {
    names.unshift("circuitikz/bipoles/fix tunable direction", "bipoles/fix tunable direction");
  }
  for (const source of [options, env.pictureOptions || {}, env.circuitikz || {}]) {
    for (const name of names) {
      if (source[name] !== undefined) return source[name];
    }
  }
  return undefined;
}

function circuitikzFixedTunableDirection(options = {}, env = {}) {
  const names = ["circuitikz/bipoles/fix tunable direction", "bipoles/fix tunable direction"];
  for (const source of [options, env.pictureOptions || {}, env.circuitikz || {}]) {
    for (const name of names) {
      if (source[name] === undefined) continue;
      const raw = source[name];
      if (raw === null || raw === true || raw === "") return true;
      return !/^(?:false|0|no)$/i.test(String(raw).trim());
    }
  }
  return true;
}

function circuitikzCapacitorNumber(key, options = {}, env = {}, fallback = 0) {
  const raw = circuitikzCapacitorRawOption(key, options, env);
  if (raw === undefined || raw === null || raw === true || raw === "") return fallback;
  const parsed = evaluateMath(String(raw), env.variables || {});
  return Number.isFinite(parsed) ? parsed : fallback;
}

function circuitikzVariableCapacitorSettings(options = {}, env = {}) {
  const scale = Math.max(0.05, circuitikzCapacitorNumber("scale", options, env, 1));
  const width = Math.max(0.02, circuitikzCapacitorNumber("width", options, env, 0.2));
  const height = Math.max(0.02, circuitikzCapacitorNumber("height", options, env, 0.6));
  const tunableWidth = Math.max(0.1, circuitikzCapacitorNumber("tunable width", options, env, 3));
  const modifierThickness = Math.max(0.05, circuitikzCapacitorNumber("modifier thickness", options, env, 1));
  // pgfcircbipoles.tex uses a capacitor-class Rlen. The plate centres are
  // +/- width*Rlen/2, and the control line extends tunable-width times farther.
  const rlen = 1.4 * circuitikzLengthScale(env) * scale;
  const plateGap = width * rlen;
  const halfHeight = (height * rlen) / 2;
  const fixedDirection = circuitikzFixedTunableDirection(options, env);
  const rawFill = circuitikzCapacitorRawOption("fill", options, env);
  const fill = rawFill === undefined || rawFill === null || rawFill === true || rawFill === "" || String(rawFill).trim().toLowerCase() === "none"
    ? "none"
    : normalizeColor(String(rawFill));
  return {
    scale,
    width,
    height,
    plateGap,
    halfHeight,
    bodyLength: plateGap,
    tunableHalf: (tunableWidth * plateGap) / 2,
    modifierThickness,
    fixedDirection,
    fill
  };
}

function circuitikzVariableCapacitorPoint(geometry, along, normal) {
  return roundPoint({
    x: geometry.mid.x + geometry.u.x * along + geometry.n.x * normal,
    y: geometry.mid.y + geometry.u.y * along + geometry.n.y * normal
  });
}

function circuitikzVariableCapacitorItems(geometry, settings = {}, pathStyle = {}) {
  const bodyLength = Math.min(settings.bodyLength || 0, geometry.length * 0.78);
  const plateGap = bodyLength;
  const halfPlateGap = plateGap / 2;
  const halfHeight = settings.halfHeight || 0;
  const tunableHalf = Math.max(halfPlateGap, settings.tunableHalf || halfPlateGap);
  const componentStyle = circuitikzComponentStyle(pathStyle, settings.fill);
  const outlineStyle = { ...componentStyle, fill: "none", lineCap: "butt", lineJoin: "miter" };
  const left = circuitikzVariableCapacitorPoint(geometry, -halfPlateGap, 0);
  const right = circuitikzVariableCapacitorPoint(geometry, halfPlateGap, 0);
  const leftTop = pointNormal(left, geometry.n, halfHeight);
  const leftBottom = pointNormal(left, geometry.n, -halfHeight);
  const rightTop = pointNormal(right, geometry.n, halfHeight);
  const rightBottom = pointNormal(right, geometry.n, -halfHeight);
  const arrowStart = circuitikzVariableCapacitorPoint(
    geometry,
    -tunableHalf,
    settings.fixedDirection ? -halfHeight : halfHeight
  );
  const arrowEnd = circuitikzVariableCapacitorPoint(
    geometry,
    tunableHalf,
    settings.fixedDirection ? halfHeight : -halfHeight
  );
  const items = [];
  if (settings.fill && settings.fill !== "none") {
    items.push({
      type: "path",
      subtype: "circuitikz-variable-capacitor-fill",
      style: { ...componentStyle, stroke: "none", lineWidth: 0 },
      commands: [moveToCommand(leftTop), lineToCommand(leftBottom), lineToCommand(rightBottom), lineToCommand(rightTop), closePathCommand()]
    });
  }
  items.push({
    type: "path",
    subtype: "circuitikz-variable-capacitor",
    plateGap: roundNumber(plateGap),
    plateSpan: roundNumber(halfHeight * 2),
    style: outlineStyle,
    commands: [
      moveToCommand(leftTop), lineToCommand(leftBottom),
      moveToCommand(rightTop), lineToCommand(rightBottom)
    ]
  });
  items.push({
    type: "path",
    subtype: "circuitikz-variable-capacitor-arrow",
    direction: settings.fixedDirection ? "bottom-left-to-top-right" : "top-left-to-bottom-right",
    lineWidth: roundNumber(outlineStyle.lineWidth * settings.modifierThickness),
    style: {
      ...circuitikzLatexSlimArrowStyle(pathStyle),
      lineWidth: roundNumber(outlineStyle.lineWidth * settings.modifierThickness)
    },
    commands: [moveToCommand(arrowStart), lineToCommand(arrowEnd)]
  });
  return items;
}

function registerCircuitikzVariableCapacitorNode(spec, geometry, settings = {}, requestedBodyLength = 0, env = {}) {
  const name = spec.name ? resolveDynamicName(spec.name, env) : "";
  if (!name) return;
  const bodyLength = Math.min(Number(requestedBodyLength) || settings.bodyLength || 0, geometry.length * 0.78);
  const node = {
    point: roundPoint(geometry.mid),
    width: roundNumber(bodyLength),
    height: roundNumber((settings.halfHeight || 0) * 2),
    layoutWidth: roundNumber(bodyLength),
    layoutHeight: roundNumber((settings.halfHeight || 0) * 2),
    shape: "circuitikzVariableCapacitor",
    shapeData: {
      tunableHalf: roundNumber(Math.max(bodyLength / 2, settings.tunableHalf || bodyLength / 2)),
      halfHeight: roundNumber(settings.halfHeight || 0),
      fixedDirection: settings.fixedDirection !== false
    },
    rotation: (Math.atan2(geometry.u.y, geometry.u.x) * 180) / Math.PI
  };
  env.nodes[name] = node;
  env.coordinates[name] = roundPoint(geometry.mid);
  materializeCircuitikzNodeAnchors(name, env);
}

function circuitikzDiodeRawOption(key, options = {}, env = {}) {
  const names = [`circuitikz/diodes/${key}`, `diodes/${key}`];
  for (const source of [options, env.pictureOptions || {}, env.circuitikz || {}]) {
    for (const name of names) {
      if (source[name] !== undefined) return source[name];
    }
  }
  return undefined;
}

function circuitikzDiodeNumber(key, options = {}, env = {}, fallback = 0) {
  const raw = circuitikzDiodeRawOption(key, options, env);
  if (raw === undefined || raw === null || raw === true || raw === "") return fallback;
  const parsed = evaluateMath(String(raw), env.variables || {});
  return Number.isFinite(parsed) ? parsed : fallback;
}

function circuitikzDiodeSettings(spec = {}, options = {}, env = {}) {
  const scale = Math.max(0.05, circuitikzDiodeNumber("scale", options, env, 1));
  // pgfcirc.defines.tex establishes the diodes scale class. The diode shape
  // then uses width=.40 Rlen and height=.50 Rlen (pgfcircbipoles.tex).
  const rlen = 1.4 * circuitikzLengthScale(env) * scale;
  const tvs = spec.diodeKind === "tvs";
  const varcap = spec.diodeKind === "varcap";
  const bidirectional = spec.diodeKind === "bidirectional";
  const rawFill = circuitikzDiodeRawOption("fill", options, env);
  const fill = rawFill === undefined || rawFill === null || rawFill === true || rawFill === "" || String(rawFill).trim().toLowerCase() === "none"
    ? "none"
    : normalizeColor(String(rawFill));
  return {
    scale,
    bodyLength: (bidirectional ? 1 : tvs ? 0.8 : varcap ? 0.45 : 0.4) * rlen,
    halfWidth: (bidirectional ? 0.5 : tvs ? 0.4 : varcap ? 0.225 : 0.2) * rlen,
    halfHeight: (bidirectional ? 0.55 : 0.25) * rlen,
    fill,
    whiskers: circuitikzDiodeWhiskers(options, env)
  };
}

function circuitikzDiodeWhiskers(options = {}, env = {}) {
  for (const source of [options, env.pictureOptions || {}, env.circuitikz || {}]) {
    const configured = String(source["diodes/whiskers"] ?? "").trim().toLowerCase();
    if (configured === "straight" || configured === "sloped") return configured;
    if (source["diode straight whiskers"] !== undefined) return "straight";
    if (source["diode sloped whiskers"] !== undefined) return "sloped";
  }
  return "sloped";
}

function circuitikzDiodeItems(geometry, spec = {}, settings = {}, pathStyle = {}, options = {}, env = {}) {
  const bodyLength = Math.min(settings.bodyLength || 0, geometry.length * 0.78);
  const halfWidth = Math.min(settings.halfWidth || bodyLength / 2, bodyLength / 2);
  const halfHeight = settings.halfHeight || halfWidth * 1.25;
  const base = pointAlong(geometry.mid, geometry.u, -halfWidth);
  const cathode = pointAlong(geometry.mid, geometry.u, halfWidth);
  const baseTop = pointNormal(base, geometry.n, halfHeight);
  const baseBottom = pointNormal(base, geometry.n, -halfHeight);
  const outlineStyle = { ...circuitikzComponentStyle(pathStyle), fill: "none", lineJoin: "miter" };
  const fill = spec.variant === "full" ? outlineStyle.stroke : spec.variant === "empty" ? settings.fill : "none";
  if (spec.diodeKind === "varcap") {
    return circuitikzVarcapItems(geometry, spec, settings, outlineStyle, fill);
  }
  if (spec.diodeKind === "bidirectional") {
    return circuitikzBidirectionalDiodeItems(geometry, spec, settings, outlineStyle, fill);
  }
  if (spec.diodeKind === "tvs") {
    const mid = geometry.mid;
    const rightTop = pointNormal(cathode, geometry.n, halfHeight);
    const rightBottom = pointNormal(cathode, geometry.n, -halfHeight);
    return [
      {
        type: "path",
        subtype: "circuitikz-tvs-diode",
        diodeKind: "tvs",
        variant: spec.variant,
        whiskers: settings.whiskers,
        fill,
        label: spec.label || "",
        bodyLength: roundNumber(bodyLength),
        orientation: Math.abs(geometry.u.y) > Math.abs(geometry.u.x) ? "vertical" : "horizontal",
        style: { ...outlineStyle, fill },
        commands: [
          moveToCommand(baseTop), lineToCommand(mid), lineToCommand(baseBottom), closePathCommand(),
          moveToCommand(rightTop), lineToCommand(mid), lineToCommand(rightBottom), closePathCommand()
        ]
      },
      {
        type: "path",
        subtype: "circuitikz-diode-cathode",
        diodeKind: "tvs",
        whiskers: settings.whiskers,
        style: outlineStyle,
        commands: circuitikzTvsCathodeCommands(geometry, halfWidth, halfHeight, settings.whiskers)
      }
    ];
  }
  const diode = {
    type: "path",
    subtype: "circuitikz-diode",
    diodeKind: spec.diodeKind,
    variant: spec.variant,
    fill,
    label: spec.label || "",
    bodyLength: roundNumber(bodyLength),
    orientation: Math.abs(geometry.u.y) > Math.abs(geometry.u.x) ? "vertical" : "horizontal",
    whiskers: spec.diodeKind === "zzener" ? settings.whiskers : undefined,
    style: { ...outlineStyle, fill },
    commands: spec.diodeKind === "shockley"
      ? [moveToCommand(baseBottom), lineToCommand(baseTop), lineToCommand(cathode), lineToCommand(base), closePathCommand()]
      : [moveToCommand(baseTop), lineToCommand(cathode), lineToCommand(baseBottom), closePathCommand()]
  };
  const cathodeCommands = spec.diodeKind === "schottky"
    ? circuitikzSchottkyCathodeCommands(geometry, cathode, halfWidth, halfHeight)
    : spec.diodeKind === "zener"
      ? circuitikzZenerCathodeCommands(geometry, cathode, halfWidth, halfHeight)
      : spec.diodeKind === "zzener"
        ? circuitikzZzenerCathodeCommands(geometry, cathode, halfWidth, halfHeight, settings.whiskers)
        : spec.diodeKind === "tunnel"
          ? circuitikzTunnelCathodeCommands(geometry, cathode, halfWidth, halfHeight)
        : [moveToCommand(pointNormal(cathode, geometry.n, -halfHeight)), lineToCommand(pointNormal(cathode, geometry.n, halfHeight))];
  const cathodeItem = {
    type: "path",
    subtype: "circuitikz-diode-cathode",
    diodeKind: spec.diodeKind,
    style: outlineStyle,
    commands: cathodeCommands
  };
  const items = [diode, cathodeItem];
  if (spec.diodeKind === "laser") {
    items.push({
      type: "path",
      subtype: "circuitikz-laser-cathode",
      diodeKind: "laser",
      style: outlineStyle,
      commands: circuitikzLaserCathodeCommands(geometry, cathode, halfWidth, halfHeight)
    });
  }
  if (spec.variant === "stroke") {
    items.push({
      type: "path",
      subtype: "circuitikz-diode-stroke",
      diodeKind: spec.diodeKind,
      style: outlineStyle,
      commands: [moveToCommand(base), lineToCommand(cathode)]
    });
  }
  if (spec.diodeKind === "led") items.push(...circuitikzLedArrowItems(geometry, halfWidth, halfHeight, outlineStyle, options, env));
  if (spec.diodeKind === "photodiode") items.push(...circuitikzPhotodiodeArrowItems(geometry, halfWidth, halfHeight, outlineStyle, options, env));
  if (spec.diodeKind === "laser") items.push(...circuitikzLaserArrowItems(geometry, halfWidth, halfHeight, outlineStyle, options, env));
  return items;
}

function circuitikzBidirectionalDiodeItems(geometry, spec = {}, settings = {}, outlineStyle = {}, fill = "none") {
  const bodyLength = Math.min(settings.bodyLength || 0, geometry.length * 0.78);
  const halfWidth = Math.min(settings.halfWidth || bodyLength / 2, bodyLength / 2);
  // `emptybidirectionaldiode` in pgfcircbipoles.tex derives both compound
  // triangles from the half-width. Keeping that local-coordinate geometry
  // here makes the result rotate with the containing bipole without a
  // separate horizontal/vertical implementation.
  const other = -0.3 * halfWidth;
  const step = 0.3 * halfWidth;
  const delta = other - step;
  const point = (along, normal = 0) => pointNormal(pointAlong(geometry.mid, geometry.u, along), geometry.n, normal);
  const left = point(-halfWidth);
  const right = point(halfWidth);
  const firstStart = point(other);
  const firstLower = point(0.95 * step, Math.SQRT1_2 * delta);
  const firstTop = point(other, Math.SQRT2 * delta);
  const firstBottom = point(other, -Math.SQRT2 * delta);
  const secondStart = point(step);
  const secondUpper = point(0.95 * other, -Math.SQRT1_2 * delta);
  const secondBottom = point(step, -Math.SQRT2 * delta);
  const secondTop = point(step, Math.SQRT2 * delta);
  const common = {
    type: "path",
    subtype: "circuitikz-bidirectional-diode",
    diodeKind: "bidirectional",
    variant: spec.variant,
    fill,
    label: spec.label || "",
    bodyLength: roundNumber(bodyLength),
    orientation: Math.abs(geometry.u.y) > Math.abs(geometry.u.x) ? "vertical" : "horizontal",
    style: { ...outlineStyle, fill },
    commands: [
      moveToCommand(firstStart), lineToCommand(firstLower), lineToCommand(firstTop), lineToCommand(firstBottom),
      moveToCommand(secondStart), lineToCommand(secondUpper), lineToCommand(secondBottom), lineToCommand(secondTop)
    ]
  };
  return [
    common,
    {
      type: "path",
      subtype: "circuitikz-bidirectional-diode-leads",
      diodeKind: "bidirectional",
      style: outlineStyle,
      commands: [moveToCommand(left), lineToCommand(firstStart), moveToCommand(secondStart), lineToCommand(right)]
    }
  ];
}

function circuitikzTunnelCathodeCommands(geometry, cathode, halfWidth, halfHeight) {
  const inner = pointAlong(cathode, geometry.u, -0.4 * halfWidth);
  return [
    moveToCommand(pointNormal(inner, geometry.n, -halfHeight)),
    lineToCommand(pointNormal(cathode, geometry.n, -halfHeight)),
    lineToCommand(pointNormal(cathode, geometry.n, halfHeight)),
    lineToCommand(pointNormal(inner, geometry.n, halfHeight))
  ];
}

function circuitikzVarcapItems(geometry, spec = {}, settings = {}, outlineStyle = {}, fill = "none") {
  const bodyLength = Math.min(settings.bodyLength || 0, geometry.length * 0.78);
  const halfWidth = Math.min(settings.halfWidth || bodyLength / 2, bodyLength / 2);
  const halfHeight = settings.halfHeight || halfWidth * 1.1;
  const base = pointAlong(geometry.mid, geometry.u, -halfWidth);
  const rightPlate = pointAlong(geometry.mid, geometry.u, halfWidth);
  // pgfcircbipoles.tex places the triangular plate's apex two temporary
  // bipole line widths before the second vertical plate. The component style
  // already carries that temporary doubled width in screen units.
  const plateGap = Math.min(halfWidth * 0.65, Math.max(0, (Number(outlineStyle.lineWidth) || 0) * 2 / TIKZ_UNIT));
  const leftPlate = pointAlong(rightPlate, geometry.u, -plateGap);
  const baseTop = pointNormal(base, geometry.n, halfHeight);
  const baseBottom = pointNormal(base, geometry.n, -halfHeight);
  const leftTop = pointNormal(leftPlate, geometry.n, halfHeight);
  const leftBottom = pointNormal(leftPlate, geometry.n, -halfHeight);
  const rightTop = pointNormal(rightPlate, geometry.n, halfHeight);
  const rightBottom = pointNormal(rightPlate, geometry.n, -halfHeight);
  const body = {
    type: "path",
    subtype: "circuitikz-varcap",
    diodeKind: "varcap",
    variant: spec.variant,
    fill,
    label: spec.label || "",
    bodyLength: roundNumber(bodyLength),
    orientation: Math.abs(geometry.u.y) > Math.abs(geometry.u.x) ? "vertical" : "horizontal",
    style: { ...outlineStyle, fill },
    commands: [moveToCommand(leftPlate), lineToCommand(baseTop), lineToCommand(baseBottom), closePathCommand()]
  };
  const plates = {
    type: "path",
    subtype: "circuitikz-varcap-plates",
    diodeKind: "varcap",
    style: outlineStyle,
    commands: [
      moveToCommand(leftBottom), lineToCommand(leftTop),
      moveToCommand(rightBottom), lineToCommand(rightTop)
    ]
  };
  const items = [body, plates];
  if (spec.variant === "stroke") {
    items.push({
      type: "path",
      subtype: "circuitikz-diode-stroke",
      diodeKind: "varcap",
      style: outlineStyle,
      commands: [moveToCommand(base), lineToCommand(leftPlate)]
    });
  }
  return items;
}

function circuitikzSchottkyCathodeCommands(geometry, cathode, halfWidth, halfHeight) {
  const point = (along, normal) => pointNormal(pointAlong(cathode, geometry.u, along), geometry.n, normal);
  return [
    moveToCommand(point(-0.4 * halfWidth, -0.6 * halfHeight)),
    lineToCommand(point(0, -halfHeight)),
    lineToCommand(point(0, halfHeight)),
    lineToCommand(point(0.4 * halfWidth, halfHeight)),
    lineToCommand(point(0.4 * halfWidth, 0.6 * halfHeight))
  ];
}

function circuitikzZenerCathodeCommands(geometry, cathode, halfWidth, halfHeight) {
  return [
    moveToCommand(pointNormal(cathode, geometry.n, -halfHeight)),
    lineToCommand(pointNormal(cathode, geometry.n, halfHeight)),
    lineToCommand(pointNormal(pointAlong(cathode, geometry.u, -0.4 * halfWidth), geometry.n, halfHeight))
  ];
}

function circuitikzZzenerCathodeCommands(geometry, cathode, halfWidth, halfHeight, whiskers = "sloped") {
  const multiplier = whiskers === "straight" ? 1 : 1.5;
  return [
    moveToCommand(pointNormal(pointAlong(cathode, geometry.u, 0.8 * halfWidth), geometry.n, -multiplier * halfHeight)),
    lineToCommand(pointNormal(cathode, geometry.n, -halfHeight)),
    lineToCommand(pointNormal(cathode, geometry.n, halfHeight)),
    lineToCommand(pointNormal(pointAlong(cathode, geometry.u, -0.8 * halfWidth), geometry.n, multiplier * halfHeight))
  ];
}

function circuitikzTvsCathodeCommands(geometry, halfWidth, halfHeight, whiskers = "sloped") {
  const multiplier = whiskers === "straight" ? 1 : 1.3;
  const top = pointNormal(geometry.mid, geometry.n, halfHeight);
  const bottom = pointNormal(geometry.mid, geometry.n, -halfHeight);
  return [
    moveToCommand(pointNormal(pointAlong(geometry.mid, geometry.u, -0.4 * halfWidth), geometry.n, multiplier * halfHeight)),
    lineToCommand(top),
    lineToCommand(bottom),
    lineToCommand(pointNormal(pointAlong(geometry.mid, geometry.u, 0.4 * halfWidth), geometry.n, -multiplier * halfHeight))
  ];
}

function circuitikzLaserCathodeCommands(geometry, cathode, halfWidth, halfHeight) {
  const secondBar = pointAlong(cathode, geometry.u, -halfWidth);
  return [
    moveToCommand(pointNormal(secondBar, geometry.n, -halfHeight)),
    lineToCommand(pointNormal(secondBar, geometry.n, halfHeight))
  ];
}

function circuitikzLedArrowItems(geometry, halfWidth, halfHeight, outlineStyle, options = {}, env = {}) {
  const point = (along, normal) => pointNormal(pointAlong(geometry.mid, geometry.u, along), geometry.n, normal);
  const arrowStyle = circuitikzOptoArrowStyle(outlineStyle, options, env);
  const fromCathode = circuitikzOptoArrowDirection("led", options, env) === "cathode";
  const segments = fromCathode
    ? [[point(0, 0.8 * halfHeight), point(-0.6 * halfWidth, 1.8 * halfHeight)], [point(0.6 * halfWidth, 0.6 * halfHeight), point(0, 1.6 * halfHeight)]]
    : [[point(-0.4 * halfWidth, halfHeight), point(0.6 * halfWidth, 2 * halfHeight)], [point(0.2 * halfWidth, 0.8 * halfHeight), point(1.2 * halfWidth, 1.8 * halfHeight)]];
  return [
    {
      type: "path",
      subtype: "circuitikz-led-arrow",
      direction: fromCathode ? "cathode" : "anode",
      style: arrowStyle,
      commands: [moveToCommand(segments[0][0]), lineToCommand(segments[0][1])]
    },
    {
      type: "path",
      subtype: "circuitikz-led-arrow",
      direction: fromCathode ? "cathode" : "anode",
      style: arrowStyle,
      commands: [moveToCommand(segments[1][0]), lineToCommand(segments[1][1])]
    }
  ];
}

function circuitikzPhotodiodeArrowItems(geometry, halfWidth, halfHeight, outlineStyle, options = {}, env = {}) {
  const point = (along, normal) => pointNormal(pointAlong(geometry.mid, geometry.u, along), geometry.n, normal);
  const toCathode = circuitikzOptoArrowDirection("pd", options, env) === "cathode";
  const segments = toCathode
    ? [[point(-0.6 * halfWidth, 1.8 * halfHeight), point(0, 0.8 * halfHeight)], [point(0, 1.6 * halfHeight), point(0.6 * halfWidth, 0.6 * halfHeight)]]
    : [[point(0.6 * halfWidth, 2 * halfHeight), point(-0.4 * halfWidth, halfHeight)], [point(1.2 * halfWidth, 1.8 * halfHeight), point(0.2 * halfWidth, 0.8 * halfHeight)]];
  const style = circuitikzOptoArrowStyle(outlineStyle, options, env);
  return segments.map(([from, to]) => ({
    type: "path",
    subtype: "circuitikz-opto-arrow",
    diodeKind: "photodiode",
    direction: toCathode ? "outward" : "inward",
    style,
    commands: [moveToCommand(from), lineToCommand(to)]
  }));
}

function circuitikzLaserArrowItems(geometry, halfWidth, halfHeight, outlineStyle, options = {}, env = {}) {
  const point = (along, normal) => pointNormal(pointAlong(geometry.mid, geometry.u, along), geometry.n, normal);
  const style = circuitikzOptoArrowStyle(outlineStyle, options, env);
  return [-0.4, 0.2].map((along) => ({
    type: "path",
    subtype: "circuitikz-opto-arrow",
    diodeKind: "laser",
    direction: "outward",
    style,
    commands: [moveToCommand(point(along * halfWidth, 1.1 * halfHeight)), lineToCommand(point(along * halfWidth, 2.1 * halfHeight))]
  }));
}

function circuitikzOptoArrowDirection(kind, options = {}, env = {}) {
  const prefix = kind === "led" ? "led" : "pd";
  const canonicalKey = `diodes/${prefix}-arrows`;
  for (const source of [options, env.pictureOptions || {}, env.circuitikz || {}]) {
    const canonical = String(source[canonicalKey] ?? "").trim().toLowerCase();
    if (canonical === "anode" || canonical === "cathode") return canonical;
    if (source[`${prefix} arrows from cathode`] !== undefined || source[`${prefix} arrows to cathode`] !== undefined) return "cathode";
    if (source[`${prefix} arrows from anode`] !== undefined || source[`${prefix} arrows to anode`] !== undefined) return "anode";
  }
  return "anode";
}

function circuitikzOptoArrowStyle(outlineStyle = {}, options = {}, env = {}) {
  const color = circuitikzOptoArrowOption("color", options, env);
  const thickness = Math.max(0.05, circuitikzOptoArrowNumber("relative thickness", options, env, 1));
  const stroke = color === undefined || color === null || color === true || String(color).trim().toLowerCase() === "default"
    ? outlineStyle.stroke
    : normalizeColor(String(color));
  return {
    ...outlineStyle,
    stroke,
    lineWidth: roundNumber((Number(outlineStyle.lineWidth) || 1) * thickness),
    markerEnd: createArrowTip("Latex", { fill: stroke, stroke, scale: 0.42 })
  };
}

function circuitikzOptoArrowOption(key, options = {}, env = {}) {
  const names = [`circuitikz/opto arrows/${key}`, `opto arrows/${key}`];
  for (const source of [options, env.pictureOptions || {}, env.circuitikz || {}]) {
    for (const name of names) {
      if (source[name] !== undefined) return source[name];
    }
  }
  return undefined;
}

function circuitikzOptoArrowNumber(key, options = {}, env = {}, fallback = 0) {
  const raw = circuitikzOptoArrowOption(key, options, env);
  if (raw === undefined || raw === null || raw === true || raw === "") return fallback;
  const value = evaluateMath(String(raw), env.variables || {});
  return Number.isFinite(value) ? value : fallback;
}

function circuitikzBatteryItems(geometry, spec = {}, pathStyle = {}, env = {}) {
  const scale = circuitikzLengthScale(env) * circuitikzBatteryScale(env);
  const style = { ...circuitikzComponentStyle(pathStyle), lineCap: "butt", lineJoin: "miter" };
  const longHalf = 0.42 * scale;
  const shortHalf = 0.21 * scale;
  const outerAlong = 0.21 * scale;
  const innerAlong = 0.069 * scale;
  const plate = (along, halfSpan, name, lineWidth = style.lineWidth) => {
    const center = pointAlong(geometry.mid, geometry.u, along);
    return {
      type: "path",
      subtype: "circuitikz-battery-plate",
      batteryKind: spec.batteryKind,
      plate: name,
      style: { ...style, lineWidth: roundNumber(lineWidth) },
      commands: [
        { type: "moveTo", ...pointNormal(center, geometry.n, -halfSpan) },
        { type: "lineTo", ...pointNormal(center, geometry.n, halfSpan) }
      ]
    };
  };
  const connector = (fromAlong, toAlong) => ({
    type: "path",
    subtype: "circuitikz-battery-connector",
    batteryKind: spec.batteryKind,
    style,
    commands: [
      { type: "moveTo", ...pointAlong(geometry.mid, geometry.u, fromAlong) },
      { type: "lineTo", ...pointAlong(geometry.mid, geometry.u, toAlong) }
    ]
  });

  if (spec.batteryKind === "battery1" || spec.batteryKind === "battery2") {
    const shortLineWidth = spec.batteryKind === "battery2" ? style.lineWidth * 3 : style.lineWidth;
    return [
      connector(-outerAlong, -innerAlong),
      connector(innerAlong, outerAlong),
      plate(-innerAlong, longHalf, "long"),
      plate(innerAlong, shortHalf, "short", shortLineWidth)
    ];
  }

  return [
    plate(-outerAlong, longHalf, "long"),
    plate(-innerAlong, shortHalf, "short"),
    plate(innerAlong, longHalf, "long"),
    plate(outerAlong, shortHalf, "short")
  ];
}

function circuitikzInductorItems(from, to, geometry, spec, settings, pathStyle = {}) {
  const bodyLength = Math.min(settings.bodyLength, geometry.length * 0.78);
  const startAlong = -bodyLength / 2;
  const style = {
    ...circuitikzComponentStyle(pathStyle),
    ...(settings.kind === "european" ? { fill: pathStyle.fill && pathStyle.fill !== "none" ? pathStyle.fill : pathStyle.stroke || "black" } : {}),
    lineCap: "butt"
  };
  const commands = settings.kind === "european"
    ? circuitikzEuropeanInductorCommands(geometry, startAlong, bodyLength, settings)
    : circuitikzCoilInductorCommands(geometry, startAlong, bodyLength, settings, style.lineWidth);
  const items = [{
    type: "path",
    subtype: spec.choke ? "circuitikz-choke" : "circuitikz-inductor",
    inductorKind: settings.kind,
    coils: settings.coils,
    bodyLength: roundNumber(bodyLength),
    style,
    commands
  }];
  if (spec.choke) {
    items.push(...circuitikzChokeCoreItems(geometry, startAlong, bodyLength, settings, style));
  }
  if (spec.variable) {
    const fixedDirection = settings.fixedTunableDirection !== false;
    const arrowStyle = circuitikzLatexSlimArrowStyle(pathStyle);
    const arrowLineWidth = roundNumber(arrowStyle.lineWidth * (settings.modifierThickness || 1));
    const arrowStart = circuitikzInductorPoint(
      geometry,
      -bodyLength * 0.2,
      fixedDirection ? -settings.tunableLowerAmplitude : settings.tunableUpperAmplitude
    );
    const arrowEnd = circuitikzInductorPoint(
      geometry,
      bodyLength * 0.2,
      fixedDirection ? settings.tunableUpperAmplitude : -settings.tunableLowerAmplitude
    );
    items.push({
      type: "path",
      subtype: "circuitikz-inductor-tunable-arrow",
      direction: fixedDirection ? "bottom-left-to-top-right" : "top-left-to-bottom-right",
      lineWidth: arrowLineWidth,
      style: { ...arrowStyle, lineWidth: arrowLineWidth },
      commands: [moveToCommand(arrowStart), lineToCommand(arrowEnd)]
    });
  }
  return items;
}

function circuitikzChokeCoreItems(geometry, startAlong, bodyLength, settings, componentStyle = {}) {
  const choke = settings.choke;
  if (!choke) return [];
  const style = {
    ...componentStyle,
    lineWidth: roundNumber(componentStyle.lineWidth * choke.coreThickness),
    lineCap: "butt",
    lineJoin: "bevel"
  };
  // circuitikz starts both coil and core paths 0.4 of the incoming line
  // width below the component baseline. Its bipole body stroke is twice that
  // incoming width, hence the -0.2 component-stroke correction here.
  const baselineOffset = -0.2 * (Number(componentStyle.lineWidth) || 0) / TIKZ_UNIT;
  const offsets = Array.from({ length: choke.coreLines }, (_unused, index) => {
    return baselineOffset + settings.upperAmplitude * (choke.coreDistance + index * choke.coreStep);
  });
  return offsets.map((normal, index) => ({
    type: "path",
    subtype: "circuitikz-choke-core",
    coreIndex: index + 1,
    style,
    commands: [
      moveToCommand(circuitikzInductorPoint(geometry, startAlong, normal)),
      lineToCommand(circuitikzInductorPoint(geometry, startAlong + bodyLength, normal))
    ]
  }));
}

function circuitikzEuropeanInductorCommands(geometry, startAlong, bodyLength, settings) {
  const endAlong = startAlong + bodyLength;
  const topLeft = circuitikzInductorPoint(geometry, startAlong, settings.upperAmplitude);
  const topRight = circuitikzInductorPoint(geometry, endAlong, settings.upperAmplitude);
  const bottomRight = circuitikzInductorPoint(geometry, endAlong, -settings.lowerAmplitude);
  const bottomLeft = circuitikzInductorPoint(geometry, startAlong, -settings.lowerAmplitude);
  return [
    moveToCommand(topLeft),
    lineToCommand(topRight),
    lineToCommand(bottomRight),
    lineToCommand(bottomLeft),
    closePathCommand()
  ];
}

function circuitikzCoilInductorCommands(geometry, startAlong, bodyLength, settings, lineWidth = 0) {
  // pgfcircbipoles extends its coil path by half a bipole line width on each
  // side. The line width also contributes to each outer coil step, while the
  // inner return arcs retain their source-defined width.
  const componentLineWidth = Math.max(0, Number(lineWidth) || 0) / TIKZ_UNIT;
  const baselineOffset = -0.2 * componentLineWidth;
  const drawingLength = bodyLength + componentLineWidth;
  const drawingStart = startAlong - componentLineWidth / 2;
  const pointAt = (along, normal = 0) => circuitikzInductorPoint(geometry, along, normal + baselineOffset);
  const commands = [moveToCommand(pointAt(drawingStart))];
  let along = drawingStart;
  if (settings.kind === "american") {
    const halfStep = drawingLength / settings.coils / 2;
    for (let index = 0; index < settings.coils; index += 1) {
      const next = along + halfStep * 2;
      circuitikzAppendHalfEllipse(commands, geometry, along, next, settings.upperAmplitude, baselineOffset);
      along = next;
    }
    return commands;
  }

  const smallHalfWidth = (0.5 * 0.5 * bodyLength) / Math.max(1, settings.coils - 1);
  const largeHalfWidth = (drawingLength + (settings.coils - 1) * smallHalfWidth * 2) / settings.coils / 2;
  for (let index = 1; index < settings.coils; index += 1) {
    const outerEnd = along + largeHalfWidth * 2;
    circuitikzAppendHalfEllipse(commands, geometry, along, outerEnd, settings.upperAmplitude, baselineOffset);
    along = outerEnd;
    const innerEnd = along - smallHalfWidth * 2;
    circuitikzAppendHalfEllipse(commands, geometry, along, innerEnd, -settings.lowerAmplitude, baselineOffset);
    along = innerEnd;
  }
  circuitikzAppendHalfEllipse(commands, geometry, along, along + largeHalfWidth * 2, settings.upperAmplitude, baselineOffset);
  return commands;
}

function circuitikzAppendHalfEllipse(commands, geometry, fromAlong, toAlong, amplitude, baselineOffset = 0) {
  const start = circuitikzInductorPoint(geometry, fromAlong, baselineOffset);
  const end = circuitikzInductorPoint(geometry, toAlong, baselineOffset);
  const midpoint = circuitikzInductorPoint(geometry, (fromAlong + toAlong) / 2, amplitude + baselineOffset);
  const halfAlong = (toAlong - fromAlong) / 2;
  const k = 0.5522847498;
  const startControl = pointNormal(start, geometry.n, amplitude * k);
  const midpointInControl = circuitikzInductorPoint(geometry, (fromAlong + toAlong) / 2 - halfAlong * k, amplitude + baselineOffset);
  const midpointOutControl = circuitikzInductorPoint(geometry, (fromAlong + toAlong) / 2 + halfAlong * k, amplitude + baselineOffset);
  const endControl = pointNormal(end, geometry.n, amplitude * k);
  commands.push(curveToCommand(
    startControl,
    midpointInControl,
    midpoint
  ));
  commands.push(curveToCommand(
    midpointOutControl,
    endControl,
    end
  ));
}

function circuitikzInductorPoint(geometry, along, normal = 0) {
  return roundPoint({
    x: geometry.mid.x + geometry.u.x * along + geometry.n.x * normal,
    y: geometry.mid.y + geometry.u.y * along + geometry.n.y * normal
  });
}

function registerCircuitikzInductorNode(spec, geometry, settings, requestedBodyLength, options = {}, env = {}) {
  const name = spec.name ? resolveDynamicName(spec.name, env) : "";
  if (!name) return;
  const bodyLength = Math.min(Number(requestedBodyLength) || settings.bodyLength, geometry.length * 0.78);
  const upperAmplitude = Number(settings.upperAmplitude) || 0;
  const lowerAmplitude = Number(settings.lowerAmplitude) || 0;
  const height = Math.max(upperAmplitude, lowerAmplitude) * 2;
  const rotation = (Math.atan2(geometry.u.y, geometry.u.x) * 180) / Math.PI;
  const node = {
    point: roundPoint(geometry.mid),
    width: roundNumber(bodyLength),
    height: roundNumber(height),
    layoutWidth: roundNumber(bodyLength),
    layoutHeight: roundNumber(height),
    shape: "circuitikzInductor",
    shapeData: {
      inductorKind: settings.kind,
      coils: settings.coils,
      upperAmplitude: roundNumber(upperAmplitude),
      lowerAmplitude: roundNumber(lowerAmplitude),
      coreDistance: roundNumber(circuitikzInductorCoreDistance(options, env))
    },
    rotation
  };
  env.nodes[name] = node;
  env.coordinates[name] = roundPoint(geometry.mid);
  materializeCircuitikzNodeAnchors(name, env);
}

function circuitikzCurrentSourceItems(from, to, geometry, spec = {}, pathStyle = {}, options = {}, env = {}) {
  const scale = circuitikzLengthScale(env);
  if (spec.kind === "controlledCurrentSource") {
    const halfExtent = 0.49 * scale * circuitikzControlledSourceScale(env);
    const style = { ...circuitikzComponentStyle(pathStyle), lineJoin: "miter" };
    const sinusoidal = spec.sourceKind === "sinusoidal";
    const items = [{
      type: "path",
      subtype: sinusoidal ? "circuitikz-controlled-sinusoidal-source" : "circuitikz-controlled-current-source",
      sourceKind: spec.sourceKind,
      shape: "diamond",
      style,
      commands: circuitikzDiamondPath(geometry, halfExtent)
    }];
    if (sinusoidal) {
      items.push(circuitikzSinusoidalSourceWaveItem(geometry, halfExtent, style, env, "csources", "controlled"));
      return items;
    }
    if (spec.sourceStyle === "european") {
      const start = pointAlong(geometry.mid, geometry.n, -halfExtent);
      const end = pointAlong(geometry.mid, geometry.n, halfExtent);
      items.push({
        type: "path",
        subtype: "circuitikz-controlled-current-source-line",
        style,
        commands: [{ type: "moveTo", x: start.x, y: start.y }, { type: "lineTo", x: end.x, y: end.y }]
      });
    } else {
      items.push(...circuitikzControlledCurrentArrowItems(geometry, halfExtent, pathStyle, options, env));
    }
    return items;
  }
  if (spec.sourceKind === "sinusoidal") {
    return circuitikzWaveformSourceItems(geometry, "current", "sinusoidal", pathStyle, env);
  }
  const radius = 0.42 * scale * circuitikzSourceScale(env);
  if (spec.sourceKind === "dc") {
    const sourceAngle = circuitikzDcCurrentAngle(env);
    const style = circuitikzComponentStyle(pathStyle);
    const items = [];
    if (spec.componentFill) {
      items.push({
        type: "path",
        subtype: "circuitikz-dc-current-source-fill",
        sourceKind: "dc",
        shape: "circle",
        cx: geometry.mid.x,
        cy: geometry.mid.y,
        r: radius,
        style: { ...style, stroke: "none", fill: spec.componentFill, lineWidth: 0 },
        commands: circleToPath(geometry.mid.x, geometry.mid.y, radius)
      });
    }
    items.push({
        type: "path",
        subtype: "circuitikz-dc-current-source",
        sourceKind: "dc",
        sourceShape: "open",
        sourceAngle,
        shape: "circle",
        cx: geometry.mid.x,
        cy: geometry.mid.y,
        r: radius,
        style,
        commands: circuitikzOpenSinusoidalCurrentOutline(geometry, radius, sourceAngle)
      });
    items.push(...circuitikzCurrentArrowItems(geometry, radius, pathStyle, options, env, {
      shaftStart: -0.7,
      shaftEnd: 0.6,
      arrowOrigin: 0.5,
      shaftSubtype: "circuitikz-dc-current-source-arrow",
      headSubtype: "circuitikz-dc-current-source-arrow-head"
    }));
    return items;
  }
  const style = circuitikzComponentStyle(pathStyle);
  const items = [{
      type: "path",
      subtype: "circuitikz-isource",
      shape: "circle",
      cx: geometry.mid.x,
      cy: geometry.mid.y,
      r: radius,
      sourceStyle: spec.sourceStyle,
      style,
      commands: circleToPath(geometry.mid.x, geometry.mid.y, radius)
    }];
  if (spec.sourceStyle !== "american") {
    const lineStart = pointNormal(geometry.mid, geometry.n, -radius);
    const lineEnd = pointNormal(geometry.mid, geometry.n, radius);
    items.push({
      type: "path",
      subtype: "circuitikz-isource-line",
      style: { ...style, lineJoin: "miter" },
      commands: [
        { type: "moveTo", x: lineStart.x, y: lineStart.y },
        { type: "lineTo", x: lineEnd.x, y: lineEnd.y }
      ]
    });
    return items;
  }
  items.push(...circuitikzCurrentArrowItems(geometry, radius, pathStyle, options, env, {
    shaftStart: -0.7,
    shaftEnd: 0.7,
    arrowOrigin: 0.5,
    shaftSubtype: "circuitikz-isource-arrow-shaft",
    headSubtype: "circuitikz-isource-arrow-head"
  }));
  return items;
}

function circuitikzVoltageSourceItems(from, to, geometry, spec, pathStyle = {}, env = {}) {
  const scale = circuitikzLengthScale(env);
  if (spec.kind === "controlledVoltageSource") {
    const halfExtent = 0.49 * scale * circuitikzControlledSourceScale(env);
    const style = { ...circuitikzComponentStyle(pathStyle), lineJoin: "miter" };
    const sinusoidal = spec.sourceKind === "sinusoidal";
    const items = [{
      type: "path",
      subtype: sinusoidal ? "circuitikz-controlled-sinusoidal-source" : "circuitikz-controlled-voltage-source",
      sourceKind: spec.sourceKind,
      shape: "diamond",
      style,
      commands: circuitikzDiamondPath(geometry, halfExtent)
    }];
    if (sinusoidal) {
      items.push(circuitikzSinusoidalSourceWaveItem(geometry, halfExtent, style, env, "csources", "controlled"));
      return items;
    }
    if (spec.sourceStyle === "european") {
      const start = pointAlong(geometry.mid, geometry.u, -halfExtent);
      const end = pointAlong(geometry.mid, geometry.u, halfExtent);
      items.push({
        type: "path",
        subtype: "circuitikz-controlled-voltage-source-line",
        style,
        commands: [{ type: "moveTo", x: start.x, y: start.y }, { type: "lineTo", x: end.x, y: end.y }]
      });
    }
    return items;
  }
  if (["sinusoidal", "square", "triangular"].includes(spec.sourceKind)) {
    return circuitikzWaveformSourceItems(geometry, "voltage", spec.sourceKind, pathStyle, env);
  }
  const radius = 0.42 * scale * circuitikzSourceScale(env);
  const style = circuitikzComponentStyle(pathStyle, spec.componentFill);
  const items = [
    {
      type: "path",
      subtype: "circuitikz-voltage-source",
      sourceKind: spec.sourceKind,
      shape: "circle",
      cx: geometry.mid.x,
      cy: geometry.mid.y,
      r: radius,
      style,
      commands: circleToPath(geometry.mid.x, geometry.mid.y, radius)
    }
  ];
  if (spec.sourceKind === "dc") {
    for (const along of [-0.2 * radius, 0.2 * radius]) {
      const start = pointAlong(pointAlong(geometry.mid, geometry.u, along), geometry.n, -0.5 * radius);
      const end = pointAlong(pointAlong(geometry.mid, geometry.u, along), geometry.n, 0.5 * radius);
      items.push({
        type: "path",
        subtype: "circuitikz-dc-voltage-source-plate",
        sourceKind: "dc",
        style,
        commands: [
          { type: "moveTo", x: start.x, y: start.y },
          { type: "lineTo", x: end.x, y: end.y }
        ]
      });
    }
    items[0].subtype = "circuitikz-dc-voltage-source";
    return items;
  }
  if (!circuitikzUsesAmericanVoltageSource(env)) {
    const lineHalf = 0.24 * scale;
    const start = pointAlong(geometry.mid, geometry.u, -lineHalf);
    const end = pointAlong(geometry.mid, geometry.u, lineHalf);
    items.push({
      type: "path",
      subtype: "circuitikz-voltage-source-line",
      style,
      commands: [
        { type: "moveTo", x: start.x, y: start.y },
        { type: "lineTo", x: end.x, y: end.y }
      ]
    });
  }
  return items;
}

function circuitikzWaveformSourceItems(geometry, sourceType, waveform, pathStyle = {}, env = {}) {
  const scale = circuitikzLengthScale(env) * circuitikzSourceScale(env);
  const radius = 0.42 * scale;
  const style = { ...circuitikzComponentStyle(pathStyle), lineJoin: "miter" };
  const currentAngle = sourceType === "current" && waveform === "sinusoidal" ? circuitikzSinusoidalCurrentAngle(env) : 90;
  const sourceShape = sourceType === "current" && currentAngle < 89.999 ? "open" : "closed";
  const outlineCommands = sourceShape === "open"
    ? circuitikzOpenSinusoidalCurrentOutline(geometry, radius, currentAngle)
    : circleToPath(geometry.mid.x, geometry.mid.y, radius);
  const sourceName = sourceType === "voltage" ? "voltage" : "current";
  const waveformName = waveform === "sinusoidal" ? "sinusoidal" : waveform;
  return [
    {
      type: "path",
      subtype: `circuitikz-${waveformName}-${sourceName}-source`,
      sourceShape,
      shape: "circle",
      cx: geometry.mid.x,
      cy: geometry.mid.y,
      r: radius,
      style,
      commands: outlineCommands
    },
    circuitikzWaveformSymbolItem(geometry, radius, waveform, style, env)
  ];
}

function circuitikzWaveformSymbolItem(geometry, radius, waveform, sourceStyle, env = {}, sourceClass = "sources", sourceOwner = "independent") {
  const rotation = circuitikzSourceSymbolRotation(geometry, env, sourceClass);
  const { axis, lateral } = circuitikzWaveformBasis(geometry, rotation);
  const point = (axisOffset, lateralOffset) => roundPoint({
    x: geometry.mid.x + axis.x * axisOffset + lateral.x * lateralOffset,
    y: geometry.mid.y + axis.y * axisOffset + lateral.y * lateralOffset
  });
  const waveSubtype = sourceOwner === "controlled"
    ? "circuitikz-controlled-sinusoidal-source-wave"
    : `circuitikz-${waveform}-source-wave`;
  const style = {
    ...sourceStyle,
    lineWidth: roundNumber(sourceStyle.lineWidth * circuitikzSourceSymbolThickness(env, sourceClass))
  };
  const innerRadius = radius / 2;
  if (waveform === "square") {
    return {
      type: "path",
      subtype: waveSubtype,
      rotation,
      style,
      commands: [
        { type: "moveTo", ...point(-innerRadius, 0) },
        { type: "lineTo", ...point(-innerRadius, innerRadius) },
        { type: "lineTo", ...point(0, innerRadius) },
        { type: "lineTo", ...point(0, -innerRadius) },
        { type: "lineTo", ...point(innerRadius, -innerRadius) },
        { type: "lineTo", ...point(innerRadius, 0) }
      ]
    };
  }
  if (waveform === "triangular") {
    return {
      type: "path",
      subtype: waveSubtype,
      rotation,
      style,
      commands: [
        { type: "moveTo", ...point(-innerRadius, 0) },
        { type: "lineTo", ...point(-innerRadius / 2, innerRadius * 0.75) },
        { type: "lineTo", ...point(innerRadius / 2, -innerRadius * 0.75) },
        { type: "lineTo", ...point(innerRadius, 0) }
      ]
    };
  }
  // Circuitikz halves the source radius, then applies PGF's sine/cosine
  // primitives. These are the exact cubic coefficients from
  // pgfcorepathconstruct.code.tex (\pgfpathsine and \pgfpathcosine).
  const unit = radius / 4;
  const start = point(-2 * unit, 0);
  const first = point(-unit, unit);
  const second = point(0, 0);
  const third = point(unit, -unit);
  const end = point(2 * unit, 0);
  return {
    type: "path",
    subtype: waveSubtype,
    rotation,
    style,
    commands: [
      { type: "moveTo", x: start.x, y: start.y },
      curveToCommand(point(-2 * unit + 0.326 * unit, 0.512 * unit), point(-2 * unit + 0.638 * unit, unit), first),
      curveToCommand(point(-unit + 0.362 * unit, unit), point(-unit + 0.674 * unit, 0.512 * unit), second),
      curveToCommand(point(0.326 * unit, -0.512 * unit), point(0.638 * unit, -unit), third),
      curveToCommand(point(unit + 0.362 * unit, -unit), point(unit + 0.674 * unit, -0.512 * unit), end)
    ]
  };
}

function circuitikzSinusoidalSourceWaveItem(geometry, radius, sourceStyle, env = {}, sourceClass = "sources", sourceOwner = "independent") {
  return circuitikzWaveformSymbolItem(geometry, radius, "sinusoidal", sourceStyle, env, sourceClass, sourceOwner);
}

function circuitikzOpenSinusoidalCurrentOutline(geometry, radius, angle) {
  return [
    ...circuitikzCircularArcCommands(geometry, radius, angle, -angle),
    ...circuitikzCircularArcCommands(geometry, radius, 180 - angle, 180 + angle)
  ];
}

function circuitikzCircularArcCommands(geometry, radius, startAngle, endAngle) {
  const radians = (angle) => (angle * Math.PI) / 180;
  const pointAt = (angle) => {
    const rad = radians(angle);
    return roundPoint({
      x: geometry.mid.x + geometry.u.x * radius * Math.cos(rad) + geometry.n.x * radius * Math.sin(rad),
      y: geometry.mid.y + geometry.u.y * radius * Math.cos(rad) + geometry.n.y * radius * Math.sin(rad)
    });
  };
  const derivativeAt = (angle) => {
    const rad = radians(angle);
    return {
      x: -geometry.u.x * radius * Math.sin(rad) + geometry.n.x * radius * Math.cos(rad),
      y: -geometry.u.y * radius * Math.sin(rad) + geometry.n.y * radius * Math.cos(rad)
    };
  };
  const parts = Math.max(1, Math.ceil(Math.abs(endAngle - startAngle) / 90));
  const commands = [{ type: "moveTo", ...pointAt(startAngle) }];
  for (let index = 0; index < parts; index += 1) {
    const a0 = startAngle + ((endAngle - startAngle) * index) / parts;
    const a1 = startAngle + ((endAngle - startAngle) * (index + 1)) / parts;
    const tangent = (4 / 3) * Math.tan(radians(a1 - a0) / 4);
    const p0 = pointAt(a0);
    const p1 = pointAt(a1);
    const d0 = derivativeAt(a0);
    const d1 = derivativeAt(a1);
    commands.push(curveToCommand(
      roundPoint({ x: p0.x + tangent * d0.x, y: p0.y + tangent * d0.y }),
      roundPoint({ x: p1.x - tangent * d1.x, y: p1.y - tangent * d1.y }),
      p1
    ));
  }
  return commands;
}

function circuitikzUsesAmericanVoltageSource(env = {}) {
  const sources = [env.pictureOptions || {}, env.circuitikz || {}];
  for (const source of sources) {
    if (source["european voltage source"] !== undefined || source["european voltages"] !== undefined) return false;
    if (
      source.american !== undefined ||
      source["american voltage source"] !== undefined ||
      source["american voltages"] !== undefined
    ) return true;
  }
  return false;
}

function circuitikzUsesAmericanCurrentSource(env = {}) {
  const sources = [env.pictureOptions || {}, env.circuitikz || {}];
  for (const source of sources) {
    if (source["european current source"] !== undefined || source["european currents"] !== undefined) return false;
    if (
      source.american !== undefined ||
      source["american current source"] !== undefined ||
      source["american currents"] !== undefined
    ) return true;
  }
  return false;
}

function appendCircuitikzVoltageSourceSymbolNodes(nodes, spec, geometry, env = {}) {
  const controlled = spec.kind === "controlledVoltageSource";
  if ((spec.sourceKind !== "plain" && !controlled) || (controlled ? spec.sourceStyle !== "american" : !circuitikzUsesAmericanVoltageSource(env))) return;
  const sourceScale = controlled ? circuitikzControlledSourceScale(env) : 1;
  const signOffset = 0.18 * circuitikzLengthScale(env) * sourceScale;
  const backward = String(spec.voltageKey || "").includes("<");
  const plusDirection = backward ? geometry.u : { x: -geometry.u.x, y: -geometry.u.y };
  const plusPoint = pointAlong(geometry.mid, plusDirection, signOffset);
  const minusPoint = pointAlong(geometry.mid, plusDirection, -signOffset);
  const signOptions = {
    "inner sep": "0pt",
    anchor: "center",
    rotate: circuitikzSourceSignRotation(geometry, env)
  };
  addCircuitikzTextNode(nodes, plusPoint, "+", signOptions);
  addCircuitikzTextNode(nodes, minusPoint, "-", signOptions);
}

function circuitikzDiamondPath(geometry, halfExtent) {
  const left = pointAlong(geometry.mid, geometry.u, -halfExtent);
  const top = pointAlong(geometry.mid, geometry.n, halfExtent);
  const right = pointAlong(geometry.mid, geometry.u, halfExtent);
  const bottom = pointAlong(geometry.mid, geometry.n, -halfExtent);
  return [
    { type: "moveTo", x: left.x, y: left.y },
    { type: "lineTo", x: top.x, y: top.y },
    { type: "lineTo", x: right.x, y: right.y },
    { type: "lineTo", x: bottom.x, y: bottom.y },
    { type: "closePath" }
  ];
}

function circuitikzMosfetItems(from, to, geometry, spec, pathStyle = {}, env = {}) {
  const scale = circuitikzLengthScale(env);
  const leadInset = Math.min(0.08 * scale, geometry.length * 0.08);
  const channelOffset = Math.min(0.49 * scale, geometry.length * 0.34);
  const gateOffset = Math.min(0.61 * scale, geometry.length * 0.42);
  const gateEndOffset = Math.min(0.99 * scale, geometry.length * 0.68);
  const channelTop = pointAlong(from, geometry.u, Math.max(leadInset, geometry.length * 0.34));
  const channelBottom = pointAlong(from, geometry.u, Math.min(geometry.length - leadInset, geometry.length * 0.67));
  const channelTopInner = pointNormal(channelTop, geometry.n, channelOffset);
  const channelBottomInner = pointNormal(channelBottom, geometry.n, channelOffset);
  const gateTop = pointNormal(channelTop, geometry.n, gateOffset);
  const gateBottom = pointNormal(channelBottom, geometry.n, gateOffset);
  const gateMid = pointNormal(geometry.mid, geometry.n, gateOffset);
  const gateEnd = pointNormal(geometry.mid, geometry.n, gateEndOffset);
  const sourceLeadEnd = pointAlong(from, geometry.u, leadInset);
  const drainLeadStart = pointAlong(to, geometry.u, -leadInset);
  const stroke = pathStyle.stroke || "black";
  const baseStyle = circuitikzComponentStyle(pathStyle);
  const channelStyle = {
    ...baseStyle,
    lineWidth: roundNumber(Math.max(Number(baseStyle.lineWidth) || 1, (Number(pathStyle.lineWidth) || 1) * 2))
  };
  const bodyCommands = [
    { type: "moveTo", x: from.x, y: from.y },
    { type: "lineTo", x: sourceLeadEnd.x, y: sourceLeadEnd.y },
    { type: "moveTo", x: to.x, y: to.y },
    { type: "lineTo", x: drainLeadStart.x, y: drainLeadStart.y },
    { type: "moveTo", x: sourceLeadEnd.x, y: sourceLeadEnd.y },
    { type: "lineTo", x: channelTop.x, y: channelTop.y },
    { type: "lineTo", x: channelTopInner.x, y: channelTopInner.y },
    { type: "moveTo", x: channelBottomInner.x, y: channelBottomInner.y },
    { type: "lineTo", x: channelBottom.x, y: channelBottom.y },
    { type: "lineTo", x: drainLeadStart.x, y: drainLeadStart.y },
    { type: "moveTo", x: gateMid.x, y: gateMid.y },
    { type: "lineTo", x: gateEnd.x, y: gateEnd.y }
  ];
  const channelCommands = [
    { type: "moveTo", x: channelTopInner.x, y: channelTopInner.y },
    { type: "lineTo", x: channelBottomInner.x, y: channelBottomInner.y },
    { type: "moveTo", x: gateTop.x, y: gateTop.y },
    { type: "lineTo", x: gateBottom.x, y: gateBottom.y }
  ];
  const items = [
    {
      type: "path",
      subtype: "circuitikz-mosfet",
      mosfetKind: spec.mosfetKind,
      style: baseStyle,
      commands: bodyCommands.map(roundPathCommand)
    },
    {
      type: "path",
      subtype: "circuitikz-mosfet-channel",
      mosfetKind: spec.mosfetKind,
      style: channelStyle,
      commands: channelCommands.map(roundPathCommand)
    }
  ];
  if (spec.mosfetKind === "pmos") {
    items.push(circuitikzTerminalItem({ point: gateMid, kind: "filled" }, { ...pathStyle, stroke }, env));
  }
  addCircuitikzTextNode(items, pointNormal(geometry.mid, geometry.n, -0.38 * scale), spec.label);
  return items;
}

function roundPathCommand(command) {
  if (!Number.isFinite(command.x) || !Number.isFinite(command.y)) return command;
  return { ...command, x: roundNumber(command.x), y: roundNumber(command.y) };
}

function registerCircuitikzMosfetNode(spec, from, to, geometry, env) {
  const name = spec.name ? resolveDynamicName(spec.name, env) : "";
  if (!name) return;
  const scale = circuitikzLengthScale(env);
  const gateDistance = Math.min(0.99 * scale, geometry.length * 0.68);
  const rotation = (Math.atan2(geometry.n.y, geometry.n.x) * 180) / Math.PI;
  env.nodes[name] = {
    point: roundPoint(geometry.mid),
    width: roundNumber(gateDistance * 2),
    height: roundNumber(geometry.length),
    layoutWidth: roundNumber(gateDistance * 2),
    layoutHeight: roundNumber(geometry.length),
    shape: "circuitikzMosfet",
    shapeData: {
      mosfetKind: spec.mosfetKind,
      gateDistance
    },
    rotation
  };
  env.coordinates[name] = roundPoint(geometry.mid);
}

function circuitikzComponentStyle(pathStyle = {}, componentFill = null) {
  const lineWidth = Number(pathStyle.lineWidth) || 1;
  return {
    stroke: pathStyle.stroke || "black",
    fill: pathStyle.fill && pathStyle.fill !== "none" ? pathStyle.fill : componentFill || "none",
    lineWidth: roundNumber(lineWidth * 2),
    markerStart: undefined,
    markerEnd: undefined,
    lineJoin: "bevel"
  };
}

function circuitikzOpAmpNodeStyle(style = {}, env = {}) {
  const configuredFill = env.circuitikz?.["amplifiers/fill"];
  const fill = style.fill && style.fill !== "none"
    ? style.fill
    : configuredFill && configuredFill !== true
      ? normalizeColor(configuredFill)
      : "none";
  return {
    stroke: style.stroke && style.stroke !== "none" ? style.stroke : "black",
    fill,
    lineWidth: Math.max(0.8, Number(style.lineWidth) || 1),
    lineJoin: "miter"
  };
}

function circuitikzTransistorNodeStyle(style = {}, env = {}) {
  return {
    stroke: style.stroke && style.stroke !== "none" ? style.stroke : "black",
    fill: "none",
    lineWidth: Math.max(0.8, Number(style.lineWidth) || 1),
    ...(Array.isArray(style.dashArray) ? { dashArray: style.dashArray, dashLineCap: style.dashLineCap } : {}),
    lineCap: "butt",
    lineJoin: "miter"
  };
}

function circuitikzTubeNodeStyle(style = {}, options = {}, env = {}) {
  return {
    stroke: style.stroke && style.stroke !== "none" ? style.stroke : "black",
    fill: circuitikzTubeFill(options, style, env),
    lineWidth: Math.max(0.8, Number(style.lineWidth) || 1),
    lineCap: "butt",
    lineJoin: "round"
  };
}

function circuitikzTransistorTerminalY(kind, terminal, halfHeight) {
  const y = halfHeight;
  if (terminal === "C") return kind === "pnp" ? -y : y;
  if (terminal === "E") return kind === "pnp" ? y : -y;
  return 0;
}

function circuitikzTransistorLocalAnchor(anchorRaw, size = {}) {
  const anchor = String(anchorRaw || "").trim().toUpperCase();
  const halfWidth = (Number(size.width) || 0) / 2;
  const halfHeight = (Number(size.height) || 0) / 2;
  const kind = size.shapeData?.transistorKind || "npn";
  const xSign = size.shapeData?.transistorXScale < 0 ? -1 : 1;
  const scale = halfHeight > 0 ? halfHeight / 0.775 : 1;
  const baseLeadDistance = Math.min(halfWidth, 0.844 * scale);
  if (anchor === "B" || anchor === "BASE") return { x: -xSign * baseLeadDistance, y: 0 };
  if (anchor === "C" || anchor === "COLLECTOR") {
    return { x: 0, y: circuitikzTransistorTerminalY(kind, "C", halfHeight) };
  }
  if (anchor === "E" || anchor === "EMITTER") {
    return { x: 0, y: circuitikzTransistorTerminalY(kind, "E", halfHeight) };
  }
  return null;
}

function circuitikzMosfetLocalAnchor(anchorRaw, size = {}) {
  const anchor = String(anchorRaw || "").trim().toUpperCase();
  const halfWidth = (Number(size.width) || 0) / 2;
  const halfHeight = (Number(size.height) || 0) / 2;
  const kind = size.shapeData?.mosfetKind || "nmos";
  if (size.shapeData?.mosfetNode) {
    if (anchor === "G" || anchor === "GATE" || anchor === "B" || anchor === "BASE") {
      return { x: -(Number(size.width) || 0), y: 0 };
    }
    if (anchor === "S" || anchor === "SOURCE") return { x: 0, y: kind === "pmos" ? halfHeight : -halfHeight };
    if (anchor === "D" || anchor === "DRAIN") return { x: 0, y: kind === "pmos" ? -halfHeight : halfHeight };
    return null;
  }
  const gateDistance = Number(size.shapeData?.gateDistance) || halfWidth;
  if (anchor === "G" || anchor === "GATE") return { x: gateDistance, y: 0 };
  if (anchor === "S" || anchor === "SOURCE") return { x: 0, y: halfHeight };
  if (anchor === "D" || anchor === "DRAIN") return { x: 0, y: -halfHeight };
  return null;
}

function circuitikzTriodeLocalAnchor(anchorRaw, size = {}) {
  const anchor = String(anchorRaw || "").trim().toLowerCase().replace(/-/g, " ");
  const halfWidth = (Number(size.width) || 0) / 2;
  const halfHeight = (Number(size.height) || 0) / 2;
  const cathodeX = halfWidth * 0.4;
  const anchors = {
    anode: { x: 0, y: halfHeight },
    plate: { x: 0, y: halfHeight },
    cathode: { x: cathodeX, y: -halfHeight },
    "cathode 1": { x: cathodeX, y: -halfHeight },
    control: { x: -halfWidth, y: 0 },
    grid: { x: -halfWidth, y: 0 },
    east: { x: halfWidth, y: 0 },
    west: { x: -halfWidth, y: 0 },
    north: { x: 0, y: halfHeight },
    south: { x: 0, y: -halfHeight },
    "north east": { x: halfWidth, y: halfHeight },
    "north west": { x: -halfWidth, y: halfHeight },
    "south east": { x: halfWidth, y: -halfHeight },
    "south west": { x: -halfWidth, y: -halfHeight }
  };
  return anchors[anchor] || null;
}

function circuitikzTubeLocalAnchor(anchorRaw, size = {}) {
  const anchor = String(anchorRaw || "").trim().toLowerCase().replace(/-/g, " ");
  const halfWidth = (Number(size.width) || 0) / 2;
  const halfHeight = (Number(size.height) || 0) / 2;
  const gridShift = 0;
  const gridSeparation = 0.2;
  const cathodeX = -halfWidth * 0.4;
  const geo = {
    n: { x: 0, y: halfHeight },
    north: { x: 0, y: halfHeight },
    s: { x: 0, y: -halfHeight },
    south: { x: 0, y: -halfHeight },
    e: { x: halfWidth, y: 0 },
    east: { x: halfWidth, y: 0 },
    w: { x: -halfWidth, y: 0 },
    west: { x: -halfWidth, y: 0 },
    ne: { x: halfWidth, y: halfHeight },
    "north east": { x: halfWidth, y: halfHeight },
    nw: { x: -halfWidth, y: halfHeight },
    "north west": { x: -halfWidth, y: halfHeight },
    se: { x: halfWidth, y: -halfHeight },
    "south east": { x: halfWidth, y: -halfHeight },
    sw: { x: -halfWidth, y: -halfHeight },
    "south west": { x: -halfWidth, y: -halfHeight }
  };
  const component = {
    anode: { x: 0, y: halfHeight },
    plate: { x: 0, y: halfHeight },
    cathode: { x: cathodeX, y: -halfHeight },
    "cathode 1": { x: cathodeX, y: -halfHeight },
    "cathode 2": { x: -cathodeX, y: -halfHeight },
    control: { x: -halfWidth, y: (-gridSeparation + gridShift) * halfHeight },
    grid: { x: -halfWidth, y: (-gridSeparation + gridShift) * halfHeight },
    screen: { x: -halfWidth, y: gridShift * halfHeight },
    suppressor: { x: -halfWidth, y: (gridSeparation + gridShift) * halfHeight },
    "tube top": { x: 0, y: halfHeight * 0.8 },
    "tube bottom": { x: 0, y: -halfHeight * 0.8 },
    "tube right": { x: halfWidth * 0.8, y: 0 },
    "tube left": { x: -halfWidth * 0.8, y: 0 }
  };
  return geo[anchor] || component[anchor] || null;
}

function circuitikzQuadpoleLocalAnchor(anchorRaw, size = {}) {
  const anchor = String(anchorRaw || "").trim().toLowerCase().replace(/-/g, " ");
  const halfWidth = (Number(size.width) || 0) / 2;
  const halfHeight = (Number(size.height) || 0) / 2;
  const terminalY = halfHeight * 0.56;
  const innerX = halfWidth * circuitikzQuadpoleInnerRatio(size);
  const outerX = halfWidth * 0.72;
  const dotY = halfHeight * 0.42;
  const anchors = {
    a1: { x: -halfWidth, y: terminalY },
    a2: { x: -halfWidth, y: -terminalY },
    b1: { x: halfWidth, y: terminalY },
    b2: { x: halfWidth, y: -terminalY },
    base: { x: 0, y: 0 },
    "inner dot a1": { x: -innerX, y: dotY },
    "inner dot a2": { x: -innerX, y: -dotY },
    "inner dot b1": { x: innerX, y: dotY },
    "inner dot b2": { x: innerX, y: -dotY },
    "outer dot a1": { x: -outerX, y: dotY },
    "outer dot a2": { x: -outerX, y: -dotY },
    "outer dot b1": { x: outerX, y: dotY },
    "outer dot b2": { x: outerX, y: -dotY },
    north: { x: 0, y: halfHeight },
    south: { x: 0, y: -halfHeight },
    east: { x: halfWidth, y: 0 },
    west: { x: -halfWidth, y: 0 },
    "north east": { x: halfWidth, y: halfHeight },
    "north west": { x: -halfWidth, y: halfHeight },
    "south east": { x: halfWidth, y: -halfHeight },
    "south west": { x: -halfWidth, y: -halfHeight }
  };
  return anchors[anchor] || null;
}

function circuitikzQuadpoleInnerRatio(size = {}) {
  const raw = Number(size.shapeData?.quadpoleSettings?.inner);
  return Number.isFinite(raw) ? Math.max(0.12, Math.min(1.1, raw)) : 0.4;
}

function circuitikzTransformerCoilLocalAnchor(coilRaw, anchorRaw, size = {}) {
  const coil = String(coilRaw || "").trim().toUpperCase();
  const anchor = String(anchorRaw || "").trim().toLowerCase();
  if (!["L1", "L2"].includes(coil) || !["a", "b"].includes(anchor)) return null;
  const halfWidth = (Number(size.width) || 0) / 2;
  const coilX = halfWidth * circuitikzQuadpoleInnerRatio(size) * (coil === "L1" ? -1 : 1);
  const topAnchor = coil === "L1" ? "b" : "a";
  const y = anchor === topAnchor ? circuitikzTransformerCoilHalfSpan(size, coil) : -circuitikzTransformerCoilHalfSpan(size, coil);
  return { x: coilX, y };
}

function circuitikzTransformerCoilHalfSpan(size = {}, coil = "L1") {
  const halfHeight = (Number(size.height) || 0) / 2;
  const spec = size.shapeData?.quadpoleSettings?.coils?.[coil] || {};
  const rlen = halfHeight / 0.75;
  const turnsRaw = Number(spec["inductors/coils"] ?? spec.coils ?? 5);
  const turns = Number.isFinite(turnsRaw) ? Math.max(1, Math.min(12, Math.round(turnsRaw))) : 5;
  const widthRaw = Number(spec["inductors/width"] ?? spec.width ?? 0.6);
  const width = Number.isFinite(widthRaw) ? Math.max(0.1, Math.min(1.5, widthRaw)) : 0.6;
  const aspectRaw = Number(spec["inductors/coil aspect"] ?? spec["coil aspect"] ?? 0.5);
  const aspect = Number.isFinite(aspectRaw) ? Math.max(0, Math.min(1, aspectRaw)) : 0.5;
  const smallStep = turns > 1 ? (0.5 * aspect * width * rlen) / (turns - 1) : 0;
  const wideStep = (width * rlen + (turns - 1) * 2 * smallStep) / turns / 2;
  return turns * wideStep - (turns - 1) * smallStep;
}

function circuitikzTransistorTextPoint(point, size = {}, shapeData = {}) {
  const xSign = shapeData.transistorXScale < 0 ? -1 : 1;
  return roundPoint({ x: point.x + xSign * 0.18, y: point.y - 0.08 });
}

function circuitikzMosfetNodeKind(options = {}) {
  const shape = normalizeShapeName(options.shape);
  if (options.nmos || shape === "nmos") return "nmos";
  if (options.pmos || shape === "pmos") return "pmos";
  return null;
}

function circuitikzMosfetNodeArrows(options = {}, env = {}) {
  const local = String(options["tripoles/mos style"] || "").trim();
  if (options.noarrowmos || local === "no arrows") return false;
  if (options.arrowmos || local === "arrows") return true;
  return String(env.circuitikz?.["tripoles/mos style"] || "").trim() === "arrows";
}

function materializeCircuitikzNodeAnchors(name, env) {
  const node = env.nodes?.[name];
  if (!node) return;
  const anchorsByShape = {
    circuitikzMosfet: ["G", "gate", "D", "drain", "S", "source"],
    circuitikzTriode: ["anode", "plate", "cathode", "control", "grid", "east", "west", "north west", "south east"],
    circuitikzPentode: ["anode", "cathode", "control", "screen", "suppressor", "n", "e", "s", "w", "ne", "se", "sw", "nw"],
    circuitikzTetrode: ["anode", "cathode", "control", "screen", "n", "e", "s", "w", "ne", "se", "sw", "nw"],
    circuitikzDiodeTube: ["anode", "cathode", "n", "e", "s", "w", "ne", "se", "sw", "nw"],
    circuitikzQuadpole: [
      "A1",
      "A2",
      "B1",
      "B2",
      "base",
      "inner dot A1",
      "inner dot A2",
      "inner dot B1",
      "inner dot B2",
      "outer dot A1",
      "outer dot A2",
      "outer dot B1",
      "outer dot B2"
    ],
    circuitikzInductor: ["midtap", "core west", "core east"],
    circuitikzVariableCapacitor: ["wiper", "W", "tip"]
  };
  const anchors = anchorsByShape[node.shape] || [];
  for (const anchor of anchors) {
    env.coordinates[`${name}.${anchor}`] = nodeAnchorCoordinate(node, anchor);
  }
  materializeCircuitikzTransformerCoilAnchors(name, node, env);
}

function materializeCircuitikzTransformerCoilAnchors(name, node, env) {
  if (node.shape !== "circuitikzQuadpole") return;
  const kind = String(node.shapeData?.quadpoleKind || "").trim().toLowerCase();
  if (!kind.startsWith("transformer")) return;
  const rotation = Number(node.rotation) || 0;
  const size = { width: node.width, height: node.height, shapeData: node.shapeData };
  for (const coil of ["L1", "L2"]) {
    const centerLocal = { x: (node.width / 2) * circuitikzQuadpoleInnerRatio(size) * (coil === "L1" ? -1 : 1), y: 0 };
    const centerRotated = rotateVector(centerLocal.x, centerLocal.y, rotation);
    const center = roundPoint({ x: node.point.x + centerRotated.x, y: node.point.y + centerRotated.y });
    env.coordinates[`${name}-${coil}`] = center;
    env.nodes[`${name}-${coil}`] = {
      point: center,
      width: Math.max(0.001, node.width * 0.12),
      height: Math.max(0.001, node.height * 0.76),
      shape: "rectangle",
      shapeData: {}
    };
    for (const anchor of ["a", "b"]) {
      const local = circuitikzTransformerCoilLocalAnchor(coil, anchor, size);
      if (!local) continue;
      const rotated = rotateVector(local.x, local.y, rotation);
      env.coordinates[`${name}-${coil}.${anchor}`] = roundPoint({ x: node.point.x + rotated.x, y: node.point.y + rotated.y });
    }
  }
}

function circuitikzArrowStyle(pathStyle = {}) {
  const stroke = pathStyle.stroke || "black";
  return {
    stroke,
    fill: "none",
    lineWidth: roundNumber((Number(pathStyle.lineWidth) || 1) * 2),
    markerEnd: createArrowTip("latex", { fill: stroke, stroke })
  };
}

function circuitikzLatexSlimArrowStyle(pathStyle = {}) {
  const stroke = pathStyle.stroke || "black";
  return {
    stroke,
    fill: "none",
    lineWidth: roundNumber((Number(pathStyle.lineWidth) || 1) * 2),
    // Circuitikz uses its own qfill-only latexslim declaration for tunable
    // bipoles. Deliberately omit `stroke` from the tip to preserve that fill.
    markerEnd: createArrowTip("latexslim", { fill: stroke })
  };
}

function circuitikzTerminals(options, from, to) {
  const terminals = [];
  for (const key of Object.keys(options || {})) {
    const match = String(key).trim().match(/^([*oOdD])?-(?:([*oOdD]))?$/);
    if (!match) continue;
    if (match[1]) terminals.push({ point: roundPoint(from), kind: circuitikzTerminalKind(match[1]) });
    if (match[2]) terminals.push({ point: roundPoint(to), kind: circuitikzTerminalKind(match[2]) });
  }
  return terminals;
}

function circuitikzTerminalKind(raw) {
  if (raw === "o") return "open";
  if (raw === "d") return "diamond";
  if (raw === "D") return "openDiamond";
  return "filled";
}

function circuitikzTerminalItem(terminal, pathStyle = {}, env = {}) {
  const stroke = pathStyle.stroke || "black";
  const open = terminal.kind === "open";
  const point = terminal.point;
  if (terminal.kind === "diamond" || terminal.kind === "openDiamond") {
    const half = 0.08 * circuitikzLengthScale(env);
    const commands = [
      { type: "moveTo", x: point.x, y: roundNumber(point.y + half) },
      { type: "lineTo", x: roundNumber(point.x - half), y: point.y },
      { type: "lineTo", x: point.x, y: roundNumber(point.y - half) },
      { type: "lineTo", x: roundNumber(point.x + half), y: point.y },
      { type: "closePath" }
    ];
    return {
      type: "path",
      subtype: terminal.kind === "openDiamond" ? "circuitikz-terminal-open-diamond" : "circuitikz-terminal-diamond",
      shape: "diamond",
      cx: point.x,
      cy: point.y,
      r: half,
      style: {
        stroke,
        fill: terminal.kind === "openDiamond" ? "white" : stroke,
        lineWidth: Number(pathStyle.lineWidth) || 1,
        markerStart: undefined,
        markerEnd: undefined
      },
      commands
    };
  }
  const radius = (open ? 0.07 : 0.056) * circuitikzLengthScale(env);
  return {
    type: "path",
    subtype: open ? "circuitikz-terminal-open" : "circuitikz-terminal-dot",
    shape: "circle",
    cx: point.x,
    cy: point.y,
    r: radius,
    style: {
      stroke,
      fill: open ? "white" : stroke,
      lineWidth: Number(pathStyle.lineWidth) || 1,
      markerStart: undefined,
      markerEnd: undefined
    },
    commands: circleToPath(point.x, point.y, radius)
  };
}

function circuitikzGroundItem(point, style = {}, env = {}) {
  const scale = circuitikzLengthScale(env);
  const stroke = style.stroke && style.stroke !== "none" ? style.stroke : "black";
  const top = point;
  const stem = pointAlong(top, { x: 0, y: -1 }, 0.12 * scale);
  const y1 = stem.y;
  const y2 = stem.y - 0.09 * scale;
  const y3 = stem.y - 0.17 * scale;
  const w1 = 0.32 * scale;
  const w2 = 0.22 * scale;
  const w3 = 0.12 * scale;
  return {
    type: "path",
    subtype: "circuitikz-ground",
    style: {
      stroke,
      fill: "none",
      lineWidth: Math.max(0.8, Number(style.lineWidth) || 1),
      lineCap: "butt"
    },
    commands: [
      { type: "moveTo", x: top.x, y: top.y },
      { type: "lineTo", x: stem.x, y: stem.y },
      { type: "moveTo", x: top.x - w1 / 2, y: y1 },
      { type: "lineTo", x: top.x + w1 / 2, y: y1 },
      { type: "moveTo", x: top.x - w2 / 2, y: y2 },
      { type: "lineTo", x: top.x + w2 / 2, y: y2 },
      { type: "moveTo", x: top.x - w3 / 2, y: y3 },
      { type: "lineTo", x: top.x + w3 / 2, y: y3 }
    ]
  };
}

function appendCircuitikzComponentLabel(nodes, spec, from, to, geometry, env = {}) {
  if ((spec.kind === "voltageSource" || spec.kind === "controlledVoltageSource") && circuitikzVoltageSpec({}, spec, env)) return;
  if (spec.kind === "isource" && spec.sourceKind === "sinusoidal") return;
  const label = circuitikzTextLabel(spec.label, env);
  if (!label) return;
  if (spec.kind === "controlledVoltageSource" || spec.kind === "controlledCurrentSource") {
    const { point, anchor } = circuitikzControlledSourceLabelPlacement(geometry, env);
    addCircuitikzTextNode(nodes, point, label, { anchor });
    return;
  }
  if (spec.kind === "battery") {
    const { point, anchor } = circuitikzBatteryLabelPlacement(geometry, env);
    addCircuitikzTextNode(nodes, point, label, { anchor });
    return;
  }
  const scale = circuitikzLengthScale(env);
  const opticalDiode = spec.kind === "diode" && ["led", "photodiode", "laser"].includes(spec.diodeKind);
  const offset = (spec.kind === "isource" || spec.kind === "controlledCurrentSource"
    ? 0.7
    : spec.kind === "inductor" && spec.variable
      ? 0.8
      : spec.kind === "capacitor" && spec.variable
        ? 0.75
      : opticalDiode
        ? 0.78
        : 0.46) * scale;
  addCircuitikzTextNode(nodes, pointNormal(geometry.mid, geometry.n, offset), label, {
    // circuitikz labels start from the component's outer shape anchor and
    // attach their inner text edge there. A centered SVG text node makes the
    // glyph overlap the component, most visibly for compact diode bodies.
    anchor: opticalDiode
      ? circuitikzOuterTextAnchor(geometry.n)
      : circuitikzOuterTextAnchor(geometry.n)
  });
}

function circuitikzBatteryLabelPlacement(geometry, env = {}) {
  const scale = circuitikzLengthScale(env) * circuitikzBatteryScale(env);
  const normal = geometry.n;
  return {
    point: pointNormal(geometry.mid, normal, 0.42 * scale + 0.17 * circuitikzLengthScale(env)),
    anchor: circuitikzOuterTextAnchor(normal)
  };
}

function circuitikzControlledSourceLabelPlacement(geometry, env = {}) {
  const scale = circuitikzLengthScale(env);
  const sourceScale = circuitikzControlledSourceScale(env);
  // circuitikz begins l= at the rotated source's outline (shape.90), then
  // applies its .75ex label space. The SVG text anchor must face outward.
  const distance = (0.49 * sourceScale + 0.17) * scale;
  return {
    point: pointNormal(geometry.mid, geometry.n, distance),
    anchor: circuitikzOuterTextAnchor(geometry.n)
  };
}

function appendCircuitikzAnnotationLabel(nodes, spec, geometry, options = {}, env = {}) {
  const annotation = circuitikzAnnotationSpec(options, env);
  if (!annotation) return;
  const scale = circuitikzLengthScale(env);
  const sideNormal = annotation.side > 0
    ? geometry.n
    : { x: -geometry.n.x, y: -geometry.n.y };
  const offset = (spec.kind === "isource" || spec.kind === "controlledCurrentSource" ? 0.7 : 0.46) * scale;
  addCircuitikzTextNode(
    nodes,
    pointNormal(geometry.mid, sideNormal, offset),
    annotation.label,
    { anchor: circuitikzOuterTextAnchor(sideNormal) }
  );
}

function circuitikzAnnotationSpec(options = {}, env = {}) {
  for (const [key, value] of Object.entries(options || {})) {
    const normalized = String(key || "").trim().toLowerCase();
    if (!/^(?:a|annotation)(?:\^|_|\s+(?:above|below))?$/.test(normalized)) continue;
    const label = circuitikzTextLabel(value, env);
    if (!label) continue;
    return {
      key,
      label,
      side: normalized.includes("_") || normalized.endsWith(" below") ? -1 : 1
    };
  }
  return null;
}

function circuitikzOuterTextAnchor(normal) {
  if (Math.abs(normal.x) >= Math.abs(normal.y)) return normal.x >= 0 ? "west" : "east";
  return normal.y >= 0 ? "south" : "north";
}

function appendCircuitikzCurrentLabel(nodes, shapes, spec, from, to, geometry, options = {}, pathStyle = {}, env = {}) {
  const current = circuitikzCurrentSpec(options, spec, env);
  if (!current) return;
  const scale = circuitikzLengthScale(env);
  const bodyLength = spec.kind === "short" ? 0 : circuitikzBodyLength(spec.kind, geometry.length, env);
  const leadLength = Math.max(0, (geometry.length - bodyLength) / 2);
  let center = geometry.mid;
  if (spec.kind !== "short" && leadLength > 0.02) {
    const before = current.key.includes(">_") || current.key.includes(">^") || current.key.includes("^>") || current.key.includes("_>");
    if (before) {
      center = pointAlong(from, geometry.u, Math.min(leadLength * 0.65, leadLength - 0.08 * scale));
    } else if (current.key === "i") {
      center = pointAlong(geometry.mid, geometry.u, bodyLength / 2 + Math.min(leadLength * 0.42, 0.18 * scale));
    } else {
      center = pointAlong(geometry.mid, geometry.u, 0);
    }
  }
  const arrowHalf = 0.18 * scale;
  shapes.push(circuitikzCurrentTriangleItem(pointAlong(center, geometry.u, arrowHalf * 0.25), geometry, pathStyle, env));
  const side = current.key.includes("_") ? -1 : 1;
  const labelCenter = current.key === "i" && spec.kind !== "short" ? pointAlong(center, geometry.u, 0.2 * scale) : center;
  addCircuitikzTextNode(nodes, pointNormal(labelCenter, geometry.n, side * 0.34 * scale), current.label);
}

function appendCircuitikzFlowLabel(nodes, shapes, spec, from, to, geometry, options = {}, pathStyle = {}, env = {}) {
  const flow = circuitikzFlowSpec(options, env);
  if (!flow) return;
  const scale = circuitikzLengthScale(env);
  const bodyLength = spec.kind === "short" ? 0 : circuitikzBodyLength(spec.kind, geometry.length, env);
  const leadLength = Math.max(0, (geometry.length - bodyLength) / 2);
  const segmentStart = spec.kind !== "short" && flow.before
    ? from
    : spec.kind !== "short"
      ? pointAlong(geometry.mid, geometry.u, bodyLength / 2)
      : from;
  const segmentLength = spec.kind === "short" ? geometry.length : leadLength;
  const baseCenter = pointAlong(segmentStart, geometry.u, Math.max(0, segmentLength) * 0.5);
  const offset = 0.2 * scale;
  const arrowCenter = pointNormal(baseCenter, geometry.n, flow.side * offset);
  shapes.push(circuitikzFlowArrowItem(arrowCenter, geometry, flow, pathStyle, env));
  addCircuitikzTextNode(nodes, pointNormal(baseCenter, geometry.n, flow.side * (offset + 0.22 * scale)), flow.label);
}

function circuitikzCurrentTriangleItem(center, geometry, pathStyle = {}, env = {}) {
  const scale = circuitikzLengthScale(env);
  const stroke = pathStyle.stroke || "black";
  const length = 0.15 * scale;
  const width = 0.14 * scale;
  const tip = pointAlong(center, geometry.u, length / 2);
  const base = pointAlong(center, geometry.u, -length / 2);
  const left = pointNormal(base, geometry.n, width / 2);
  const right = pointNormal(base, geometry.n, -width / 2);
  return {
    type: "path",
    subtype: "circuitikz-current-arrow",
    style: {
      stroke,
      fill: stroke,
      lineWidth: Number(pathStyle.lineWidth) || 1,
      lineJoin: "miter"
    },
    commands: [
      { type: "moveTo", x: left.x, y: left.y },
      { type: "lineTo", x: tip.x, y: tip.y },
      { type: "lineTo", x: right.x, y: right.y },
      { type: "closePath" }
    ]
  };
}

function circuitikzControlledCurrentArrowItems(geometry, halfExtent, pathStyle = {}, options = {}, env = {}) {
  return circuitikzCurrentArrowItems(geometry, halfExtent, pathStyle, options, env, {
    shaftStart: -0.7,
    shaftEnd: 0.7,
    arrowOrigin: 0.5,
    shaftSubtype: "circuitikz-controlled-current-source-arrow-shaft",
    headSubtype: "circuitikz-controlled-current-source-arrow"
  });
}

function circuitikzCurrentArrowItems(geometry, extent, pathStyle = {}, options = {}, env = {}, config = {}) {
  const style = { ...circuitikzComponentStyle(pathStyle), lineJoin: "miter" };
  const shaftStart = pointAlong(geometry.mid, geometry.u, (config.shaftStart ?? -0.7) * extent);
  const shaftEnd = pointAlong(geometry.mid, geometry.u, (config.shaftEnd ?? 0.7) * extent);
  const step = (1.4 * circuitikzLengthScale(env)) / circuitikzCurrentArrowScale(options, env);
  const arrowOrigin = pointAlong(geometry.mid, geometry.u, (config.arrowOrigin ?? 0.5) * extent);
  const base = pointAlong(arrowOrigin, geometry.u, -0.7 * step);
  const tip = pointAlong(arrowOrigin, geometry.u, step);
  const lower = pointNormal(base, geometry.n, -0.8 * step);
  const upper = pointNormal(base, geometry.n, 0.8 * step);

  return [
    {
      type: "path",
      subtype: config.shaftSubtype || "circuitikz-current-source-arrow-shaft",
      style,
      commands: [{ type: "moveTo", x: shaftStart.x, y: shaftStart.y }, { type: "lineTo", x: shaftEnd.x, y: shaftEnd.y }]
    },
    {
      type: "path",
      subtype: config.headSubtype || "circuitikz-current-source-arrow-head",
      style: { ...style, fill: style.stroke },
      commands: [
        { type: "moveTo", x: base.x, y: base.y },
        { type: "lineTo", x: lower.x, y: lower.y },
        { type: "lineTo", x: tip.x, y: tip.y },
        { type: "lineTo", x: upper.x, y: upper.y },
        { type: "closePath" }
      ]
    }
  ];
}

function circuitikzFlowArrowItem(center, geometry, flow, pathStyle = {}, env = {}) {
  const direction = flow.backward ? { x: -geometry.u.x, y: -geometry.u.y } : geometry.u;
  const orientedGeometry = { ...geometry, u: direction, n: { x: -direction.y, y: direction.x } };
  return {
    ...circuitikzCurrentTriangleItem(center, orientedGeometry, pathStyle, env),
    subtype: "circuitikz-flow-arrow"
  };
}

function circuitikzCurrentSpec(options = {}, spec = {}, env = {}) {
  for (const [key, value] of Object.entries(options)) {
    if (!/^i(?:[<>_^]*)?$/.test(key)) continue;
    const label = circuitikzTextLabel(value, env);
    if (label) return { key, label };
  }
  if (spec.kind === "controlledCurrentSource" && spec.currentLabel) {
    const label = circuitikzTextLabel(spec.currentLabel, env);
    if (label) return { key: circuitikzCurrentAnnotationKey(spec.currentKey || "cI"), label };
  }
  if (spec.kind === "isource" && spec.sourceKind === "sinusoidal" && spec.currentLabel) {
    const label = circuitikzTextLabel(spec.currentLabel, env);
    if (label) return { key: circuitikzCurrentAnnotationKey(spec.currentKey || "sI"), label };
  }
  return null;
}

function circuitikzCurrentAnnotationKey(key) {
  return String(key || "i").replace(/^(?:c)?(?:s)?I/, "i");
}

function circuitikzFlowSpec(options = {}, env = {}) {
  for (const [key, value] of Object.entries(options)) {
    if (!/^f(?:[<>_^]*)?$/.test(key)) continue;
    const label = circuitikzTextLabel(value, env);
    if (!label) continue;
    return {
      key,
      label,
      backward: key.includes("<"),
      before: /[<>][_^]/.test(key),
      side: key.includes("_") ? -1 : 1
    };
  }
  return null;
}

function appendCircuitikzVoltageLabel(nodes, shapes, spec, from, to, geometry, options = {}, pathStyle = {}, env = {}) {
  const voltage = circuitikzVoltageSpec(options, spec, env);
  if (!voltage) return;
  const { label } = voltage;
  const scale = circuitikzLengthScale(env);
  const normal = circuitikzVoltageNormal(geometry, voltage, spec);
  if (spec.kind === "controlledVoltageSource") {
    if (spec.sourceKind === "sinusoidal" && circuitikzUsesAmericanVoltageSource(env)) {
      appendCircuitikzAmericanSinusoidalVoltagePolarity(nodes, geometry, voltage, spec, normal, env);
    }
    const { point, anchor } = circuitikzControlledSourceLabelPlacement(
      { ...geometry, n: normal },
      env
    );
    const labelOptions = spec.sourceKind === "sinusoidal"
      ? { anchor, "tikzkit layout bbox": true, "minimum height": "0.38cm" }
      : { anchor };
    addCircuitikzTextNode(nodes, point, label, labelOptions);
    return;
  }
  if (!circuitikzUsesAmericanVoltageSource(env)) {
    shapes.push(circuitikzRpVoltageArrowItem(spec, geometry, voltage, normal, pathStyle, env));
    const labelOffset = (spec.kind === "voltageSource" ? 0.78 : 0.78) * scale;
    addCircuitikzTextNode(nodes, pointNormal(geometry.mid, normal, labelOffset), label);
    return;
  }

  // Sinusoidal voltage sources use the generic circuitikz voltage-label routine:
  // their polarity signs sit outside the source symbol, underneath the label.
  if (spec.kind === "voltageSource") {
    if (spec.sourceKind === "sinusoidal") {
      appendCircuitikzAmericanSinusoidalVoltagePolarity(nodes, geometry, voltage, spec, normal, env);
    }
    const sourceDistance = spec.sourceKind === "sinusoidal"
      ? 0.8 * circuitikzSourceScale(env)
      : 0.62;
    const labelOptions = spec.sourceKind === "sinusoidal"
      ? { "tikzkit layout bbox": true, "minimum height": "0.38cm" }
      : {};
    addCircuitikzTextNode(nodes, pointNormal(geometry.mid, normal, sourceDistance * scale), label, labelOptions);
    return;
  }

  const signOffset = (spec.kind === "isource" || spec.kind === "controlledCurrentSource" ? 0.28 : 0.38) * scale;
  const labelOffset = (spec.kind === "isource" || spec.kind === "controlledCurrentSource" ? 0.72 : 0.62) * scale;
  const along = 0.55 * scale;
  const backward = circuitikzVoltageDirectionIsBackward(voltage, spec, env);
  const plusAlong = backward ? -along : along;
  addCircuitikzTextNode(nodes, pointNormal(pointAlong(geometry.mid, geometry.u, plusAlong), normal, signOffset), "+", { "inner sep": "0pt" });
  addCircuitikzTextNode(nodes, pointNormal(pointAlong(geometry.mid, geometry.u, -plusAlong), normal, signOffset), "-", { "inner sep": "0pt" });
  addCircuitikzTextNode(nodes, pointNormal(geometry.mid, normal, labelOffset), label);
}

function appendCircuitikzAmericanSinusoidalVoltagePolarity(nodes, geometry, voltage, spec, normal, env = {}) {
  const scale = circuitikzLengthScale(env);
  const sourceScale = spec.kind === "controlledVoltageSource"
    ? circuitikzControlledSourceScale(env)
    : circuitikzSourceScale(env);
  const signOffset = 0.58 * sourceScale * scale;
  const along = 0.37 * sourceScale * scale;
  const backward = circuitikzVoltageDirectionIsBackward(voltage, spec, env);
  const plusAlong = backward ? along : -along;
  const signOptions = {
    anchor: "center",
    "inner sep": "0pt",
    "tikzkit layout bbox": true
  };
  addCircuitikzTextNode(
    nodes,
    pointNormal(pointAlong(geometry.mid, geometry.u, plusAlong), normal, signOffset),
    "+",
    signOptions
  );
  addCircuitikzTextNode(
    nodes,
    pointNormal(pointAlong(geometry.mid, geometry.u, -plusAlong), normal, signOffset),
    "-",
    signOptions
  );
}

function circuitikzVoltageSpec(options = {}, spec = {}, env = {}) {
  for (const [key, value] of Object.entries(options || {})) {
    if (!/^v(?:[<>_^]*)?$/.test(key)) continue;
    const label = circuitikzTextLabel(value, env);
    if (label) return { key, label };
  }
  if (spec.kind === "voltageSource" && spec.label) {
    const label = circuitikzTextLabel(spec.label, env);
    if (label) return { key: spec.voltageKey || "V", label };
  }
  if (spec.kind === "controlledVoltageSource" && spec.voltageLabel) {
    const label = circuitikzTextLabel(spec.voltageLabel, env);
    if (label) return { key: spec.voltageKey || "cV", label };
  }
  return null;
}

function circuitikzUsesRPVoltages(env = {}) {
  const settings = env.circuitikz || {};
  return Boolean(settings.RPvoltages || /^RPvoltages$/i.test(String(settings.voltageMode || settings.voltage || "")));
}

function circuitikzVoltageDirectionIsBackward(voltage = {}, spec = {}, env = {}) {
  const key = String(voltage.key || "");
  if (key.includes("<")) return true;
  if (key.includes(">")) return false;
  return spec.kind !== "voltageSource" && spec.kind !== "controlledVoltageSource" && circuitikzUsesRPVoltages(env);
}

function circuitikzVoltageNormal(geometry, voltage = {}, spec = {}) {
  const key = String(voltage.key || "");
  const above = key.includes("^") || (!key.includes("_") && (spec.kind === "voltageSource" || spec.kind === "controlledVoltageSource"));
  return above ? geometry.n : { x: -geometry.n.x, y: -geometry.n.y };
}

function circuitikzRpVoltageArrowItem(spec, geometry, voltage, normal, pathStyle = {}, env = {}) {
  const scale = circuitikzLengthScale(env);
  const direction = voltage.key.includes(">") ? geometry.u : { x: -geometry.u.x, y: -geometry.u.y };
  const offset = (spec.kind === "voltageSource" ? 0.56 : 0.42) * scale;
  const center = pointNormal(geometry.mid, normal, offset);
  const half = (spec.kind === "voltageSource" ? 0.32 : 0.74) * scale;
  const start = pointAlong(center, direction, -half);
  const end = pointAlong(center, direction, half);
  const commands = spec.kind === "voltageSource"
    ? [
        { type: "moveTo", x: start.x, y: start.y },
        { type: "lineTo", x: end.x, y: end.y }
      ]
    : circuitikzCurvedVoltageArrowCommands(start, end, normal, scale);
  const stroke = pathStyle.stroke || "black";
  return {
    type: "path",
    subtype: "circuitikz-voltage-arrow",
    style: {
      stroke,
      fill: "none",
      lineWidth: Math.max(0.8, Number(pathStyle.lineWidth) || 1),
      lineCap: "butt",
      lineJoin: "miter",
      markerEnd: createArrowTip("latex", { fill: stroke, stroke })
    },
    commands
  };
}

function circuitikzCurvedVoltageArrowCommands(start, end, normal, scale) {
  const sag = 0.26 * scale;
  const c1 = pointNormal(start, normal, sag);
  const c2 = pointNormal(end, normal, sag);
  return [
    { type: "moveTo", x: start.x, y: start.y },
    { type: "curveTo", x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y, x: end.x, y: end.y }
  ];
}

function addCircuitikzTextNode(nodes, point, text, options = {}) {
  nodes.push({
    at: point,
    ...(options.anchor ? {} : { displayPoint: point }),
    text,
    options: {
      "inner sep": "1pt",
      ...options
    }
  });
}

function pointAlong(point, direction, distance) {
  return roundPoint({
    x: point.x + direction.x * distance,
    y: point.y + direction.y * distance
  });
}

function pointNormal(point, normal, distance) {
  return roundPoint({
    x: point.x + normal.x * distance,
    y: point.y + normal.y * distance
  });
}

function parseTikzExtArcThrough(options = {}) {
  const value = options["ext/arc through"] ?? options["arc through"];
  if (value === undefined || value === null || value === false) return null;
  const text = stripOuterBraces(value === true ? "" : String(value)).trim();
  const parts = splitTopLevel(text);
  let through = "";
  let clockwise = false;
  let suffix = "";
  for (const part of parts.length ? parts : [text]) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (/^clockwise$/i.test(trimmed)) {
      clockwise = true;
      continue;
    }
    if (/^counter clockwise$/i.test(trimmed)) {
      clockwise = false;
      continue;
    }
    const suffixMatch = trimmed.match(/^center suffix\s*=\s*(.+)$/);
    if (suffixMatch) {
      suffix = suffixMatch[1].trim();
      continue;
    }
    const throughMatch = trimmed.match(/^through\s*=\s*(.+)$/);
    through = throughMatch ? throughMatch[1].trim() : trimmed;
  }
  return { through: through || "(0,0)", clockwise, suffix };
}

function tikzExtArcToCommands(from, to, options = {}, env) {
  const chord = Math.hypot(to.x - from.x, to.y - from.y);
  if (chord < 1e-9) return { commands: [], center: from };
  let radius = parseDimension(options.radius ?? options["x radius"] ?? options["y radius"] ?? "1cm", env.variables);
  if (!Number.isFinite(radius) || radius <= 0) radius = 1;
  radius = Math.max(radius, chord / 2 + 1e-6);
  const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const h = Math.sqrt(Math.max(0, radius * radius - (chord * chord) / 4));
  const nx = -(to.y - from.y) / chord;
  const ny = (to.x - from.x) / chord;
  const clockwise = tikzBoolean(options.clockwise);
  const large = tikzBoolean(options.large);
  const sign = clockwise === large ? -1 : 1;
  const center = { x: midpoint.x + nx * h * sign, y: midpoint.y + ny * h * sign };
  return { commands: arcSampleCommands(center, from, to, clockwise, large), center: roundPoint(center) };
}

function tikzExtArcThroughCommands(from, through, to, options = {}, env) {
  const center = circleCenterThroughPoints(from, through, to);
  if (!center) return { commands: [{ type: "lineTo", x: to.x, y: to.y }], center: null };
  const clockwise = options.clockwise;
  return { commands: arcSampleCommands(center, from, to, clockwise, false, through), center: roundPoint(center) };
}

function circleCenterThroughPoints(a, b, c) {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-9) return null;
  const ax = a.x * a.x + a.y * a.y;
  const bx = b.x * b.x + b.y * b.y;
  const cx = c.x * c.x + c.y * c.y;
  return {
    x: (ax * (b.y - c.y) + bx * (c.y - a.y) + cx * (a.y - b.y)) / d,
    y: (ax * (c.x - b.x) + bx * (a.x - c.x) + cx * (b.x - a.x)) / d
  };
}

function arcSampleCommands(center, from, to, clockwise = false, large = false, through = null) {
  const start = Math.atan2(from.y - center.y, from.x - center.x);
  let end = Math.atan2(to.y - center.y, to.x - center.x);
  if (through) {
    const throughAngle = Math.atan2(through.y - center.y, through.x - center.x);
    const ccwContains = angleBetweenCcw(throughAngle, start, end);
    clockwise = !ccwContains;
  }
  let delta = end - start;
  if (clockwise && delta > 0) delta -= Math.PI * 2;
  if (!clockwise && delta < 0) delta += Math.PI * 2;
  if (large && Math.abs(delta) < Math.PI) delta += (clockwise ? -1 : 1) * Math.PI * 2;
  if (!large && Math.abs(delta) > Math.PI) delta -= (clockwise ? -1 : 1) * Math.PI * 2;
  const radius = Math.hypot(from.x - center.x, from.y - center.y);
  const steps = Math.max(8, Math.ceil(Math.abs(delta) / (Math.PI / 16)));
  const commands = [];
  for (let index = 1; index <= steps; index += 1) {
    const angle = start + (delta * index) / steps;
    commands.push({
      type: "lineTo",
      x: roundNumber(center.x + Math.cos(angle) * radius),
      y: roundNumber(center.y + Math.sin(angle) * radius)
    });
  }
  if (commands.length) commands[commands.length - 1] = { type: "lineTo", x: to.x, y: to.y };
  return commands;
}

function angleBetweenCcw(angle, start, end) {
  const tau = Math.PI * 2;
  const normalize = (value) => ((value % tau) + tau) % tau;
  const a = normalize(angle - start);
  const b = normalize(end - start);
  return a <= b;
}

function resolveLocalCoordinate(raw, env, diagnostics) {
  return resolveCoordinate(raw, localCoordinateEnvironment(env), diagnostics);
}

function shouldResolveAsLocalRectangleCorner(raw) {
  let text = String(raw || "").trim();
  if (text.startsWith("(") && text.endsWith(")")) text = text.slice(1, -1).trim();
  if (text.startsWith("[")) return false;
  // Calc expressions and named nodes already resolve to transformed canvas
  // coordinates. Reconstructing their rectangle in local space would apply
  // the picture transform a second time and turn a rectangle into a diagonal
  // quadrilateral. Only literal Cartesian/polar corners need local geometry.
  if (text.startsWith("$")) return false;
  return looksLikeExplicitCoordinate(text);
}

function transformedRectangleCorners(fromLocal, toLocal, transform) {
  return [
    applyTransform({ x: toLocal.x, y: fromLocal.y }, transform),
    applyTransform({ x: toLocal.x, y: toLocal.y }, transform),
    applyTransform({ x: fromLocal.x, y: toLocal.y }, transform)
  ];
}

function decoratedShape(shape, pathOptions, env) {
  if (!pathOptions.decorate || !shape.commands?.length) return shape;
  return {
    ...shape,
    shape: "decoratedPath",
    commands: applyPathMorphing(shape.commands, pathOptions, env)
  };
}

function circleCommands(center, r, env) {
  return usesProjectedLocalGeometry(env) ? projectLocalPathCommands(circleToPath(0, 0, r), center, env) : circleToPath(center.x, center.y, r);
}

function ellipseCommands(center, rx, ry, env) {
  return usesProjectedLocalGeometry(env)
    ? projectLocalPathCommands(ellipseToPath(0, 0, rx, ry), center, env)
    : ellipseToPath(center.x, center.y, rx, ry);
}

function projectLocalPathCommands(commands, center, env) {
  return commands.map((command) => {
    if (command.type === "closePath") return command;
    if (command.type === "curveTo") {
      const p1 = projectLocalOffset(command.x1, command.y1, env);
      const p2 = projectLocalOffset(command.x2, command.y2, env);
      const p = projectLocalOffset(command.x, command.y, env);
      return {
        ...command,
        x1: roundNumber(center.x + p1.x),
        y1: roundNumber(center.y + p1.y),
        x2: roundNumber(center.x + p2.x),
        y2: roundNumber(center.y + p2.y),
        x: roundNumber(center.x + p.x),
        y: roundNumber(center.y + p.y)
      };
    }
    if ("x" in command && "y" in command) {
      const p = projectLocalOffset(command.x, command.y, env);
      return { ...command, x: roundNumber(center.x + p.x), y: roundNumber(center.y + p.y) };
    }
    return command;
  });
}

function projectLocalOffset(x, y, env) {
  const projected = projectBasisPoint(x, y, 0, env.basis);
  return applyCoordinateTransformVector(projected, env);
}

function usesCustomBasis(basis = parsePictureBasis()) {
  return (
    Math.abs((basis.x?.x ?? 1) - 1) > 1e-9 ||
    Math.abs(basis.x?.y ?? 0) > 1e-9 ||
    Math.abs(basis.y?.x ?? 0) > 1e-9 ||
    Math.abs((basis.y?.y ?? 1) - 1) > 1e-9 ||
    Math.abs((basis.z?.x ?? PGF_DEFAULT_Z_VECTOR.x) - PGF_DEFAULT_Z_VECTOR.x) > 1e-9 ||
    Math.abs((basis.z?.y ?? PGF_DEFAULT_Z_VECTOR.y) - PGF_DEFAULT_Z_VECTOR.y) > 1e-9
  );
}

function usesProjectedLocalGeometry(env = {}) {
  if (usesCustomBasis(env.basis)) return true;
  const transform = coordinateTransformForEnvironment(env);
  return (
    Math.abs(transform.a - 1) > 1e-9 ||
    Math.abs(transform.b) > 1e-9 ||
    Math.abs(transform.c) > 1e-9 ||
    Math.abs(transform.d - 1) > 1e-9
  );
}

function flushInlinePathNodes(pendingInlineNodes, from, to, nodes, env, pathStyle = {}, pathOptions = {}) {
  if (!pendingInlineNodes.length || !from || !to) return;
  const pathSegment = { from, to };
  for (const segment of pendingInlineNodes) {
    const placementOptions = inlineNodeResolvedOptions(segment.options, env, pathStyle, pathOptions);
    const point = inlineNodePathPoint(placementOptions, pathSegment) || roundPoint({
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2
    });
    addInlinePathNode(segment, segment.text, point, nodes, env, pathStyle, pathSegment, pathOptions);
  }
}

function flushOrthogonalInlinePathNodes(
  pendingInlineNodes,
  first,
  second,
  nodes,
  env,
  pathStyle = {},
  pathOptions = {}
) {
  if (!pendingInlineNodes.length || !first?.from || !first?.to || !second?.from || !second?.to) return;
  for (const segment of pendingInlineNodes) {
    // PGF's vh/hv timer gives each leg half of the [0,1] interval. At the
    // default pos=.5 the node is at the elbow and uses the second leg tangent.
    const placementOptions = inlineNodeResolvedOptions(segment.options, env, pathStyle, pathOptions);
    const pos = inlineNodePosition(placementOptions, 0.5);
    const active = pos < 0.5 ? first : second;
    const legPos = pos < 0.5 ? pos * 2 : pos * 2 - 1;
    const point = roundPoint({
      x: active.from.x + (active.to.x - active.from.x) * legPos,
      y: active.from.y + (active.to.y - active.from.y) * legPos
    });
    addInlinePathNode(segment, segment.text, point, nodes, env, pathStyle, active, pathOptions);
  }
}

function flushInlinePathNodesAt(pendingInlineNodes, point, nodes, env, pathStyle = {}, pathSegment = null, pathOptions = {}) {
  if (!pendingInlineNodes.length || !point) return;
  for (const segment of pendingInlineNodes) {
    addInlinePathNode(segment, segment.text, point, nodes, env, pathStyle, pathSegment, pathOptions);
  }
}

function addInlinePathNode(segment, text, point, nodes, env, pathStyle = {}, pathSegment = null, pathOptions = {}) {
  const rawOptions = resolveDynamicOptions(segment.options || {}, env);
  const localOptions = normalizeOptions("node", inlineNodeOptions(rawOptions, pathStyle, pathOptions), env).options;
  const normalizedOptions = normalizeOptions("node", {
    ...inlineNodeInheritedOptions(env, rawOptions),
    ...inlineNodeOptions(rawOptions, pathStyle, pathOptions)
  }, env);
  let expandedOptions = applyInlineBareFillCurrentColor(normalizedOptions.options, normalizedOptions.semantic, pathStyle);
  expandedOptions[EXPLICIT_NODE_FONT] = resolvedNodeLayerFont(localOptions, env);
  const rawText = resolveNodeTextContent(text, expandedOptions);
  expandedOptions = applyOuterMinipageTextWidth(expandedOptions, rawText, env);
  text = resolveTextContent(rawText, env);
  const nodeEnv = nodeCanvasEnv(env, expandedOptions);
  if (inlinePathLabelNeedsTexMetrics(text, rawOptions, expandedOptions)) {
    expandedOptions["tikzkit inline math label metrics"] = true;
  }
  const size = estimateNodeLayoutSize(text, expandedOptions, nodeEnv);
  const anchorSize = estimateNodeAnchorSize(text, expandedOptions, nodeEnv, size);
  const positioningSize = estimatePositioningSelfSize(text, expandedOptions, nodeEnv, anchorSize);
  const scaledSize = scaleSize(size, nodeEnv.canvasScale);
  const scaledAnchorSize = scaleSize(anchorSize, nodeEnv.canvasScale);
  const scaledPositioningSize = scaleSize(positioningSize, nodeEnv.canvasScale);
  const textAnchorOffsets = nodeTextAnchorOffsets(text, expandedOptions, nodeEnv, scaledSize);
  const slopedRotation = slopedInlineNodeRotation(expandedOptions, pathSegment, nodeEnv);
  const recordRotation = slopedRotation ?? nodeRotation(expandedOptions, nodeEnv);
  const positioningPoint = resolvePositioning(expandedOptions, nodeEnv, { ...scaledPositioningSize, ...textAnchorOffsets });
  const basePoint = positioningPoint || point;
  const anchoredPoint = expandedOptions.anchor
    ? resolveNodeAnchorPoint(basePoint, expandedOptions, text, nodeEnv, scaledSize)
    : null;
  const displayPoint =
    anchoredPoint ||
    positioningPoint ||
    (slopedRotation === null
      ? resolveAutoInlineNodePoint(basePoint, expandedOptions, scaledSize, nodeEnv, pathSegment)
      : resolveSlopedInlineNodePoint(basePoint, expandedOptions, scaledSize, nodeEnv, slopedRotation));
  const nodePoint = displayPoint || resolveNodeAnchorPoint(basePoint, expandedOptions, text, nodeEnv, scaledSize);
  let nodeName = null;
  const rawNodeName = segment.name || (expandedOptions.name && expandedOptions.name !== true ? String(expandedOptions.name) : "");
  if (rawNodeName) {
    nodeName = resolvePicScopedName(resolveDynamicName(rawNodeName, env), env);
    env.nodes[nodeName] = {
      point: nodePoint,
      width: scaledSize.width,
      height: scaledSize.height,
      layoutWidth: scaledAnchorSize.width,
      layoutHeight: scaledAnchorSize.height,
      layoutMinX: scaledAnchorSize.minX,
      layoutMinY: scaledAnchorSize.minY,
      layoutMaxX: scaledAnchorSize.maxX,
      layoutMaxY: scaledAnchorSize.maxY,
      ...textAnchorOffsets,
      shape: nodeShape(expandedOptions),
      shapeData: nodeShapeData(expandedOptions, nodeEnv, text),
      rotation: recordRotation
    };
    env.coordinates[nodeName] = nodePoint;
    materializeCircuitikzNodeAnchors(nodeName, env);
  }
  nodes.push({
    at: point,
    displayPoint: nodePoint,
    text,
    options: expandedOptions,
    inlinePathStyle: pathStyle,
    name: nodeName,
    size: scaledSize,
    anchorSize: scaledAnchorSize,
    canvasScale: nodeEnv.canvasScale,
    rotation: slopedRotation ?? undefined,
    fitTextToBox: shouldFitTextToNodeBox(expandedOptions)
  });
}

function circuitikzInlinePathNodeStyle(style = {}, pathStyle = {}, options = {}) {
  if (Object.hasOwn(options || {}, "draw")) return style;
  const inherited = {};
  if (pathStyle.stroke && pathStyle.stroke !== "none") inherited.stroke = pathStyle.stroke;
  if (Number.isFinite(Number(pathStyle.lineWidth))) inherited.lineWidth = pathStyle.lineWidth;
  if (Array.isArray(pathStyle.dashArray)) inherited.dashArray = pathStyle.dashArray;
  if (pathStyle.dashLineCap) inherited.dashLineCap = pathStyle.dashLineCap;
  return { ...style, ...inherited };
}

function resolveNodeTextContent(text, options = {}) {
  const rawText = text ?? "";
  if (String(rawText).length === 0 && Object.hasOwn(options, "node contents")) {
    const nodeContents = options["node contents"];
    if (nodeContents === true || nodeContents === false || nodeContents === null || nodeContents === undefined) return "";
    return String(nodeContents);
  }
  return rawText;
}

function applyOuterMinipageTextWidth(options = {}, rawText, env = {}) {
  if (Object.hasOwn(options, "text width")) return options;
  const width = outerMinipageTextWidth(rawText);
  if (!width) return options;
  const parsedWidth = parseDimension(width, env.variables || {});
  if (!Number.isFinite(parsedWidth) || parsedWidth <= 0) return options;
  return { ...options, "text width": width, "tikzkit minipage text width": true };
}

function inlinePathLabelNeedsTexMetrics(text, rawOptions = {}, expandedOptions = {}) {
  if (!/\$[^$]+\$/.test(String(text || ""))) return false;
  if (!Object.hasOwn(rawOptions, "fill")) return false;
  const fill = expandedOptions.fill ?? rawOptions.fill;
  if (fill === undefined || fill === null || fill === false) return false;
  return !/^(none|transparent)$/i.test(String(fill).trim());
}

function resolveAutoInlineNodePoint(point, options = {}, size, env, pathSegment = null) {
  if (!pathSegment?.from || !pathSegment?.to || !isTruthyTikzOption(options.auto) || nodeDirection(options) || options.anchor) return null;
  const dx = pathSegment.to.x - pathSegment.from.x;
  const dy = pathSegment.to.y - pathSegment.from.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-9) return null;
  const side = String(options.auto === true ? "left" : options.auto || "left").trim().toLowerCase();
  const normalSign = side === "right" || options.swap ? -1 : 1;
  const nx = (-dy / length) * normalSign;
  const ny = (dx / length) * normalSign;
  const halfProjectedExtent = Math.abs(nx) * (size.width / 2) + Math.abs(ny) * (size.height / 2);
  const explicitShift = nodeExplicitShift(options, env);
  return roundPoint({
    x: point.x + nx * halfProjectedExtent + explicitShift.x,
    y: point.y + ny * halfProjectedExtent + explicitShift.y
  });
}

function slopedInlineNodeRotation(options = {}, pathSegment = null, env) {
  if (!isTruthyTikzOption(options.sloped) || !pathSegment?.from || !pathSegment?.to) return null;
  const tangent = inlineNodePathTangent(options, pathSegment);
  if (!tangent) return null;
  const base = (Math.atan2(tangent.y, tangent.x) * 180) / Math.PI;
  const upright = isTruthyTikzOption(options["allow upside down"]) ? base : keepTextAngleUpright(base);
  return roundNumber(upright + nodeRotation(options, env));
}

function keepTextAngleUpright(angle) {
  let normalized = ((angle % 360) + 360) % 360;
  if (normalized > 180) normalized -= 360;
  if (normalized > 90) normalized -= 180;
  if (normalized < -90) normalized += 180;
  return normalized;
}

function resolveSlopedInlineNodePoint(point, options = {}, size, env, rotation) {
  const directionEntries = nodeDirectionEntries(options);
  const explicitShift = nodeExplicitShift(options, env);
  // TikZ applies shifts in the node's local coordinate frame. For a sloped
  // label that frame follows the path, so a yshift moves normal to the line.
  const rotatedExplicitShift = rotateVector(explicitShift.x, explicitShift.y, rotation);
  if (!directionEntries.length) {
    return roundPoint({
      x: point.x + rotatedExplicitShift.x,
      y: point.y + rotatedExplicitShift.y
    });
  }
  let localX = 0;
  let localY = 0;
  for (const [direction, value] of directionEntries) {
    const distance = value === true ? 0 : nodeDirectionDistance(value, 0, env);
    if (direction.includes("right")) localX += distance;
    if (direction.includes("left")) localX -= distance;
    if (direction.includes("above")) localY += distance;
    if (direction.includes("below")) localY -= distance;
  }
  const [anchorDirection] = directionEntries.at(-1);
  const local = {
    x: localX + (anchorDirection.includes("right") ? size.width / 2 : anchorDirection.includes("left") ? -size.width / 2 : 0),
    y: localY + (anchorDirection.includes("above") ? size.height / 2 : anchorDirection.includes("below") ? -size.height / 2 : 0)
  };
  const rotated = rotateVector(local.x, local.y, rotation);
  return roundPoint({
    x: point.x + rotated.x + rotatedExplicitShift.x,
    y: point.y + rotated.y + rotatedExplicitShift.y
  });
}

function isTruthyTikzOption(value) {
  if (value === undefined || value === null || value === false) return false;
  if (value === true || value === "") return true;
  return !/^(false|0|no)$/i.test(String(value).trim());
}

function inlineNodeOptions(options = {}, pathStyle = {}, pathOptions = {}) {
  const merged = {
    ...inlineNodePathPlacementOptions(pathOptions),
    ...options
  };
  if (hasExplicitTextColor(merged)) return merged;
  const inheritedText = inheritedInlinePathTextColor(pathStyle);
  if (!inheritedText) return merged;
  return {
    text: inheritedText,
    "tikzkit inherited path text": inheritedText,
    ...merged
  };
}

function inlineNodeResolvedOptions(options = {}, env, pathStyle = {}, pathOptions = {}) {
  const rawOptions = resolveDynamicOptions(options || {}, env);
  return normalizeOptions("node", {
    ...inlineNodeInheritedOptions(env, rawOptions),
    ...inlineNodeOptions(rawOptions, pathStyle, pathOptions)
  }, env).options;
}

function inlineNodePathPlacementOptions(pathOptions = {}) {
  const inherited = {};
  for (const key of [
    "above", "below", "left", "right",
    "above left", "above right", "below left", "below right",
    "anchor", "auto", "swap", "sloped", "allow upside down",
    "xshift", "yshift", "shift",
    "pos", "midway", "near start", "near end", "very near start", "very near end", "at start", "at end"
  ]) {
    if (Object.hasOwn(pathOptions, key)) inherited[key] = pathOptions[key];
  }
  if (Object.hasOwn(pathOptions, EXPLICIT_PATH_NODE_FONT)) {
    inherited.font = pathOptions[EXPLICIT_PATH_NODE_FONT];
  }
  return inherited;
}

function applyInlineBareFillCurrentColor(options = {}, semantic = {}, pathStyle = {}) {
  if (!semantic["tikzkit bare fill"]) return options;
  const inheritedFill = inheritedInlinePathTextColor(pathStyle);
  if (!inheritedFill) return options;
  return {
    ...options,
    fill: inheritedFill
  };
}

function inlineNodeInheritedOptions(env = {}, rawOptions = {}) {
  const options = inheritedNodeOptions(env);
  if (!Object.hasOwn(rawOptions, "draw")) delete options.draw;
  if (!Object.hasOwn(rawOptions, "fill")) delete options.fill;
  return options;
}

function inheritedInlinePathTextColor(pathStyle = {}) {
  return [pathStyle.textFill, pathStyle.stroke, pathStyle.fill]
    .find((value) => value && value !== "none" && value !== "transparent");
}

function hasExplicitTextColor(options = {}) {
  return Object.hasOwn(options, "text") || Object.hasOwn(options, "color");
}

function createNode(statement, env, ir, diagnostics) {
  const statementOptions = resolveDynamicOptions(statement.options || {}, env);
  const localOptions = normalizeOptions("node", statementOptions, env).options;
  applyChainControlOptions(localOptions, env, diagnostics);
  let expandedOptions = normalizeOptions("node", {
    ...inheritedNodeOptions(env),
    ...statementOptions
  }, env).options;
  expandedOptions[EXPLICIT_NODE_FONT] = resolvedNodeLayerFont(localOptions, env);
  expandedOptions = applyConceptNodeOptions(expandedOptions, env);
  const rawText = resolveNodeTextContent(statement.text, expandedOptions);
  expandedOptions = applyOuterMinipageTextWidth(expandedOptions, rawText, env);
  const textMarks = extractTikzmarkNodes(resolveTextContent(rawText, env));
  const text = textMarks.text;
  if (isMatrixNodeOptions(expandedOptions)) {
    const name = statement.name
      ? resolvePicScopedName(resolveDynamicName(statement.name, env), env)
      : expandedOptions.name && expandedOptions.name !== true
        ? resolvePicScopedName(resolveDynamicName(String(expandedOptions.name), env), env)
        : null;
    createMatrix(
      {
        type: "matrix",
        name,
        at: statement.at,
        options: expandedOptions,
        body: text,
        raw: statement.raw
      },
      env,
      ir,
      diagnostics
    );
    const record = name ? env.nodes[name] : null;
    return {
      name,
      text,
      point: record?.point || null,
      width: record?.width || 0,
      height: record?.height || 0,
      shape: record?.shape || "rectangle",
      shapeData: record?.shapeData || {},
      options: expandedOptions
    };
  }
  const nodeEnv = nodeCanvasEnv(env, expandedOptions);
  const fitLayout = resolveFitNodeLayout(expandedOptions, env, nodeEnv);
  const rectangleSplit = rectangleSplitLayout(text, expandedOptions, nodeEnv);
  const circleSplit = circleSplitLayout(text, expandedOptions, nodeEnv);
  const rawSize = fitLayout?.rawSize || rectangleSplit?.size || circleSplit?.size || estimateNodeLayoutSize(text, expandedOptions, nodeEnv);
  const rawAnchorSize = fitLayout?.rawSize || estimateNodeAnchorSize(text, expandedOptions, nodeEnv, rawSize);
  const rawPositioningSize = fitLayout?.rawSize || estimatePositioningSelfSize(text, expandedOptions, nodeEnv, rawAnchorSize);
  const size = scaleSize(rawSize, nodeEnv.canvasScale);
  const anchorSize = scaleSize(rawAnchorSize, nodeEnv.canvasScale);
  const positioningSize = scaleSize(rawPositioningSize, nodeEnv.canvasScale);
  const textAnchorOffsets = nodeTextAnchorOffsets(text, expandedOptions, nodeEnv, size);
  const arrowGeometry = scaleArrowNodeGeometry(
    arrowNodeShapeGeometry(text, expandedOptions, nodeEnv),
    nodeEnv.canvasScale
  );
  const point = fitLayout?.point || resolveNodePoint({ ...statement, options: expandedOptions }, env, diagnostics, { ...positioningSize, ...textAnchorOffsets });
  const displayPoint = resolveNodeAnchorPoint(point, expandedOptions, text, nodeEnv, size);
  const name = statement.name
    ? resolvePicScopedName(resolveDynamicName(statement.name, env), env)
    : expandedOptions.name && expandedOptions.name !== true
      ? resolvePicScopedName(resolveDynamicName(String(expandedOptions.name), env), env)
      : null;
  const node = {
    at: point,
    text,
    options: expandedOptions,
    name,
    size,
    anchorSize,
    canvasScale: nodeEnv.canvasScale,
    displayPoint,
    rectangleSplit,
    circleSplit,
    shapeData: arrowGeometry ? { arrowGeometry } : null,
    fitTextToBox: shouldFitTextToNodeBox(expandedOptions)
  };
  const nodeRecord = {
    point: displayPoint,
    width: size.width,
    height: size.height,
    layoutWidth: anchorSize.width,
    layoutHeight: anchorSize.height,
    layoutMinX: anchorSize.minX,
    layoutMinY: anchorSize.minY,
    layoutMaxX: anchorSize.maxX,
    layoutMaxY: anchorSize.maxY,
    ...textAnchorOffsets,
    shape: nodeShape(expandedOptions),
    shapeData: {
      ...nodeShapeData(expandedOptions, nodeEnv, text),
      rectangleSplit,
      circleSplit,
      ...(arrowGeometry ? { arrowGeometry } : {})
    },
    rotation: nodeRotation(expandedOptions, nodeEnv)
  };
  if (name) {
    registerNodeRecord(name, nodeRecord, env);
  }
  registerTikzmarkNodeAnchors(textMarks.marks, {
    text,
    point: displayPoint,
    size,
    options: expandedOptions
  }, env);
  const chainUpdate = updateChainState(expandedOptions, env, displayPoint, positioningSize, { name, nodeRecord });
  addNodeItems(node, ir, nodeEnv);
  addChainJoinPath(chainUpdate, expandedOptions, env, ir, diagnostics);
  if (name && statement.path?.segments?.length) {
    addNodeAttachedPath(name, statement.path.segments, expandedOptions, env, ir, diagnostics);
  }
  return {
    name,
    text,
    point: displayPoint,
    width: size.width,
    height: size.height,
    // Tree growth and explicit edge anchors are evaluated against PGF's
    // anchor box, which can differ slightly from the painted text box after
    // inner separation and text metrics are applied.
    layoutWidth: anchorSize.width,
    layoutHeight: anchorSize.height,
    ...textAnchorOffsets,
    shape: nodeShape(expandedOptions),
    shapeData: nodeShapeData(expandedOptions, nodeEnv, text),
    rotation: nodeRotation(expandedOptions, nodeEnv),
    options: expandedOptions
  };
}

function isMatrixNodeOptions(options = {}) {
  return isMatrixLibraryNodeOptions(options);
}

function registerNodeRecord(name, record, env) {
  if (!name) return;
  env.nodes[name] = { ...record };
  env.coordinates[name] = record.point;
  materializeCircuitikzNodeAnchors(name, env);
}

function extractTikzmarkNodes(rawText) {
  const input = String(rawText ?? "");
  const marks = [];
  let text = "";
  let cursor = 0;
  while (cursor < input.length) {
    const index = input.indexOf("\\tikzmarknode", cursor);
    if (index < 0) {
      text += input.slice(cursor);
      break;
    }
    text += input.slice(cursor, index);
    const outputIndex = text.length;
    let readIndex = index + "\\tikzmarknode".length;
    readIndex = skipWhitespace(input, readIndex);
    let optionalOptions = "";
    if (input[readIndex] === "[") {
      const optional = readBalancedPrefix(input.slice(readIndex), "[", "]");
      if (!optional) {
        text += input.slice(index);
        break;
      }
      optionalOptions = optional.content;
      readIndex += optional.end;
      readIndex = skipWhitespace(input, readIndex);
    }
    const name = readBalancedPrefix(input.slice(readIndex), "{", "}");
    if (!name) {
      text += input.slice(index);
      break;
    }
    readIndex += name.end;
    readIndex = skipWhitespace(input, readIndex);
    const body = readBalancedPrefix(input.slice(readIndex), "{", "}");
    if (!body) {
      text += input.slice(index);
      break;
    }
    const content = body.content;
    marks.push({
      name: name.content.trim(),
      content,
      outputIndex,
      options: optionalOptions || "",
      verticalRole: tikzmarkNodeVerticalRole(input, index)
    });
    text += content;
    cursor = readIndex + body.end;
  }
  return { text, marks: marks.filter((mark) => mark.name) };
}

function tikzmarkNodeVerticalRole(input, index) {
  let cursor = index - 1;
  while (cursor >= 0 && /[\s{]/.test(input[cursor])) cursor -= 1;
  if (input[cursor] === "_") return "subscript";
  if (input[cursor] === "^") return "superscript";
  return "baseline";
}

function skipWhitespace(text, index) {
  let cursor = index;
  while (cursor < text.length && /\s/.test(text[cursor])) cursor += 1;
  return cursor;
}

function registerTikzmarkNodeAnchors(marks, node, env) {
  if (!marks?.length) return;
  const textLength = Math.max(1, String(node.text || "").length);
  for (const mark of marks) {
    const contentLength = Math.max(1, String(mark.content || "").length);
    const fraction = Math.max(0, Math.min(1, (mark.outputIndex + contentLength / 2) / textLength));
    const yOffset = tikzmarkNodeYOffset(mark.verticalRole, node.size.height);
    const shift = tikzmarkNodeShift(mark.options, env);
    const point = roundPoint({
      x: node.point.x + (fraction - 0.5) * node.size.width * 0.86 + shift.x,
      y: node.point.y + yOffset + shift.y
    });
    const markSize = scaleSize(estimateNodeLayoutSize(mark.content, { "inner sep": "0pt" }, env), env.canvasScale);
    const width = Math.max(0.06, markSize.width);
    const height = Math.max(0.12, markSize.height);
    env.nodes[mark.name] = {
      point,
      width,
      height,
      layoutWidth: width,
      layoutHeight: height,
      shape: "rectangle",
      shapeData: {},
      rotation: 0
    };
    env.coordinates[mark.name] = point;
  }
}

function tikzmarkNodeShift(rawOptions = "", env = {}) {
  if (!rawOptions) return { x: 0, y: 0 };
  const options = parseOptions(rawOptions);
  return {
    x: parseShiftDimension(String(options.xshift ?? "0pt"), env.variables || {}),
    y: parseShiftDimension(String(options.yshift ?? "0pt"), env.variables || {})
  };
}

function tikzmarkNodeYOffset(role, height) {
  if (role === "subscript") return -Math.max(0.08, height * 0.22);
  if (role === "superscript") return Math.max(0.08, height * 0.22);
  return 0;
}

function resolvePicScopedName(name, env = {}) {
  if (!name || !env.picNamePrefix || !String(name).startsWith("-")) return name;
  return `${env.picNamePrefix}${name}`;
}

function coordinateRendersAsNode(options = {}, env = {}) {
  let expandedOptions = normalizeOptions("node", {
    ...inheritedNodeOptions(env),
    ...resolveDynamicOptions(options || {}, env)
  }, env).options;
  expandedOptions = applyConceptNodeOptions(expandedOptions, env);
  return nodeUsesBoxSizing(expandedOptions, env);
}

function applyConceptNodeOptions(options = {}, env = {}) {
  if (!isConceptNodeOptions(options)) return options;
  const conceptColor = options["concept color"] ?? env.pictureOptions?.["concept color"] ?? "black";
  const withConcept = { ...options, circle: true };
  if (withConcept.fill === undefined || withConcept.fill === true) withConcept.fill = conceptColor;
  if (withConcept.draw === undefined || withConcept.draw === true) withConcept.draw = conceptColor;
  return withConcept;
}

function isConceptNodeOptions(options = {}) {
  return Boolean(options["tikzkit concept"] || options.concept);
}

function createNodeTreeChildren(parentNode, children = [], env, ir, diagnostics, level = 1, treeOptions = {}) {
  if (!parentNode || !children.length) return;
  const resolvedTreeOptions = normalizeOptions("node", resolveDynamicOptions(treeOptions || {}, env), env).options;
  // Options written between a node and its `child` clauses configure this
  // one generation. Consume them before descendants are created so a nested
  // `[clockwise from=...]` neither disappears nor leaks to all later levels.
  const childBaseEnv = {
    ...env,
    pictureOptions: treeDescendantPictureOptions(env.pictureOptions, resolvedTreeOptions)
  };
  const levelOptions = treeLevelOptions(level, childBaseEnv);
  const layouts = children.map((child) => {
    const childTreeOptions = normalizeOptions("node", resolveDynamicOptions(child.options || {}, childBaseEnv), childBaseEnv).options;
    const layoutOptions = { ...levelOptions, ...resolvedTreeOptions, ...childTreeOptions };
    const grow = treeGrowDirection(childBaseEnv, layoutOptions);
    return { child, childTreeOptions, layoutOptions, grow };
  });
  for (const [index, layout] of layouts.entries()) {
    const { child, childTreeOptions, layoutOptions, grow } = layout;
    const childEdgeOptions = resolveDynamicOptions(child.edgeOptions || {}, childBaseEnv);
    const siblings = treeUsesFixedLateralShift(layoutOptions)
      ? [layout]
      : layouts.filter((candidate) => treeGrowKey(candidate.grow) === treeGrowKey(grow));
    const siblingIndex = siblings.indexOf(layout);
    const siblingDistance = treeSiblingDistance(level, childBaseEnv, layoutOptions);
    const levelDistance = treeLevelDistance(level, childBaseEnv, layoutOptions);
    const offset = treeChildOffset(siblingIndex, siblings.length, siblingDistance, levelDistance, grow, layoutOptions, childBaseEnv);
    offset.x += parseTreeDimension(childTreeOptions.xshift, "0pt", childBaseEnv);
    offset.y += parseTreeDimension(childTreeOptions.yshift, "0pt", childBaseEnv);
    const projected = projectLocalOffset(offset.x, offset.y, childBaseEnv);
    const growthParentPoint = treeGrowthParentPoint(parentNode, layoutOptions, childBaseEnv);
    const point = roundPoint({
      x: growthParentPoint.x + projected.x,
      y: growthParentPoint.y + projected.y
    });
    const childEnv = {
      ...childBaseEnv,
      pictureOptions: {
        ...(childBaseEnv.pictureOptions || {}),
        ...levelOptions,
        ...childTreeOptions
      }
    };
    const childNode = child.node.type === "coordinate"
      ? { name: null, point, width: 0, height: 0, shape: "coordinate", options: child.node.options || {} }
      : createNode(
          {
            ...child.node,
            options: {
              ...treeEveryChildNodeOptions(childBaseEnv),
              ...(child.node.options || {})
            },
            at: null,
            absolutePoint: point,
            path: null
          },
          childEnv,
          ir,
          diagnostics
    );
    if (!childNode) continue;
    addTreeEdge(parentNode, childNode, { ...layoutOptions, ...childEdgeOptions }, childEnv, ir);
    const descendantEnv = {
      ...childEnv,
      pictureOptions: treeDescendantPictureOptions(childEnv.pictureOptions, childTreeOptions)
    };
    createNodeTreeChildren(childNode, child.children || child.node.children || [], descendantEnv, ir, diagnostics, level + 1, child.node.treeOptions || {});
  }
}

function treeUsesFixedLateralShift(options = {}) {
  const edgePath = String(options["edge from parent path"] || "");
  return /tikzparentnode\.south/.test(edgePath) && /\|-/.test(edgePath) && /tikzchildnode\.west/.test(edgePath);
}

function treeGrowKey(grow) {
  return typeof grow === "number" ? `angle:${roundNumber(grow)}` : String(grow);
}

function treeDescendantPictureOptions(pictureOptions = {}, childOptions = {}) {
  const placementKeys = [
    "level distance",
    "sibling distance",
    "sibling angle",
    "clockwise from",
    "counterclockwise from",
    "grow",
    "grow cyclic",
    "xshift",
    "yshift",
    "shift",
    "anchor",
    "growth parent anchor",
    "parent anchor",
    "child anchor"
  ];
  const inherited = { ...pictureOptions };
  for (const key of placementKeys) {
    if (Object.hasOwn(childOptions, key)) delete inherited[key];
  }
  return inherited;
}

function treeEveryChildNodeOptions(env = {}) {
  return resolveDynamicOptions(env.styles?.["every child node"] || {}, env);
}

function treeGrowthParentPoint(parentNode, options = {}, env = {}) {
  const anchor = options["growth parent anchor"] ?? env.pictureOptions?.["growth parent anchor"] ?? "center";
  return nodeAnchorCoordinate(parentNode, anchor);
}

function treeGrowDirection(env, options = {}) {
  if (isMindmapOptions(options) || isMindmapOptions(env.pictureOptions || {})) {
    return "cyclic";
  }
  const grow = String(options.grow ?? env.pictureOptions?.grow ?? "down").trim().toLowerCase();
  if (["up", "down", "left", "right"].includes(grow)) return grow;
  const angle = evaluateMath(grow, env.variables);
  if (Number.isFinite(angle)) return angle;
  return "down";
}

function treeLevelOptions(level, env) {
  const options = {
    ...instantiateTreeLevelStyle(env.styles?.level || {}, level),
    ...(env.styles?.[`level ${level}`] || {})
  };
  if (isMindmapOptions(env.pictureOptions || {})) {
    Object.assign(options, env.styles?.[`level ${level} concept`] || {});
  }
  return options;
}

function instantiateTreeLevelStyle(style = {}, level) {
  const replacement = String(level);
  return Object.fromEntries(
    Object.entries(style).map(([key, value]) => [
      key,
      typeof value === "string" ? value.replace(/#1/g, replacement) : value
    ])
  );
}

function treeLevelDistance(level, env, overrides = {}) {
  const options = { ...treeLevelOptions(level, env), ...overrides };
  return parseTreeDimension(options["level distance"] ?? env.pictureOptions?.["level distance"], "15mm", env);
}

function treeSiblingDistance(level, env, overrides = {}) {
  const options = { ...treeLevelOptions(level, env), ...overrides };
  return parseTreeDimension(options["sibling distance"] ?? env.pictureOptions?.["sibling distance"], "15mm", env);
}

function parseTreeDimension(value, fallback, env) {
  const parsed = parseDimension(value ?? fallback, env.variables);
  if (Number.isFinite(parsed)) return parsed;
  return parseDimension(fallback, env.variables);
}

function treeChildOffset(index, count, siblingDistance, levelDistance, grow, options = {}, env = { variables: {} }) {
  if (grow === "cyclic") {
    const angle = cyclicTreeChildAngle(index, count, options, env);
    const radians = (angle * Math.PI) / 180;
    return {
      x: Math.cos(radians) * levelDistance,
      y: Math.sin(radians) * levelDistance
    };
  }
  if (typeof grow === "number") {
    const radians = (grow * Math.PI) / 180;
    return {
      x: Math.cos(radians) * levelDistance,
      y: Math.sin(radians) * levelDistance
    };
  }
  const siblingOffset = ((count - 1) / 2 - index) * siblingDistance;
  if (grow === "up") return { x: siblingOffset, y: levelDistance };
  if (grow === "left") return { x: -levelDistance, y: siblingOffset };
  if (grow === "right") return { x: levelDistance, y: siblingOffset };
  return { x: -siblingOffset, y: -levelDistance };
}

function cyclicTreeChildAngle(index, count, options = {}, env = { variables: {} }) {
  const siblingAngle = parseTreeAngle(options["sibling angle"] ?? env.pictureOptions?.["sibling angle"], 360 / Math.max(1, count), env);
  if (options["clockwise from"] !== undefined || env.pictureOptions?.["clockwise from"] !== undefined) {
    return parseTreeAngle(options["clockwise from"] ?? env.pictureOptions?.["clockwise from"], 90, env) - index * siblingAngle;
  }
  if (options["counterclockwise from"] !== undefined || env.pictureOptions?.["counterclockwise from"] !== undefined) {
    return parseTreeAngle(options["counterclockwise from"] ?? env.pictureOptions?.["counterclockwise from"], 90, env) + index * siblingAngle;
  }
  return 90 - (index - (count - 1) / 2) * siblingAngle;
}

function parseTreeAngle(value, fallback, env) {
  if (value === undefined || value === null || value === true || value === "") return fallback;
  const angle = evaluateMath(value, env.variables);
  return Number.isFinite(angle) ? angle : fallback;
}

function isMindmapOptions(options = {}) {
  return Boolean(options.mindmap || options["tikzkit mindmap"] || options["grow cyclic"]);
}

function addTreeEdge(parentNode, childNode, options, env, ir) {
  const rawOptions = resolveDynamicOptions(
    withImplicitStyleOption(
      "every path",
      { ...(env.pictureOptions || {}), ...(options || {}) },
      env.styles
    ),
    env
  );
  const normalized = normalizeOptions("draw", rawOptions, env);
  const style = scaleCanvasStyle(normalized.style, env);
  let mindmapConnection = null;
  if (isMindmapOptions(env.pictureOptions || {}) || isMindmapOptions(options || {})) {
    const parentColor = mindmapConceptColor(parentNode, env.pictureOptions?.["concept color"]);
    const childColor = mindmapConceptColor(childNode, options?.["concept color"] ?? env.pictureOptions?.["concept color"]);
    if (childColor) style.stroke = childColor;
    if (parentColor && childColor) {
      mindmapConnection = {
        id: `tree-${ir.items.length}`,
        from: parentColor,
        to: childColor
      };
    }
    style.lineWidth = Math.max(Number(style.lineWidth) || 0, 0.1 * TIKZ_UNIT * canvasLengthScale(env));
    style.lineCap = "round";
  }
  const parentClipNode = treeEdgeClipNode(parentNode, env);
  const childClipNode = treeEdgeClipNode(childNode, env);
  const edgeEndpoints = treeEdgeEndpoints(parentClipNode, childClipNode, rawOptions, env);
  const connectionBar = mindmapConnection
    ? mindmapConnectionBarCommands(parentNode, childNode)
    : null;
  if (connectionBar) {
    style.stroke = "none";
    style.fill = "none";
    style.mindmapConnection = {
      ...mindmapConnection,
      paint: "fill",
      fromPoint: parentNode.point,
      toPoint: childNode.point
    };
  } else if (mindmapConnection) {
    style.mindmapConnection = { ...mindmapConnection, paint: "stroke" };
  }
  const commands = connectionBar || treeEdgeCommands(parentClipNode, childClipNode, edgeEndpoints, rawOptions);
  ir.items.push({
    type: "path",
    subtype: "tree-edge",
    style,
    commands
  });
}

function treeEdgeEndpoints(parentNode, childNode, options = {}, env = {}) {
  const parent = treeEdgeEndpoint(parentNode, options["parent anchor"]);
  const child = treeEdgeEndpoint(childNode, options["child anchor"]);
  return clipNodeLineEndpoints(parent.point, parent.ref, child.point, child.ref, env);
}

function treeEdgeEndpoint(node, rawAnchor) {
  const anchor = String(rawAnchor ?? "border").trim().toLowerCase();
  if (anchor && anchor !== "border") {
    return {
      point: nodeAnchorCoordinate(node, anchor),
      ref: { node, mode: "anchor", anchor }
    };
  }
  return {
    point: node.point,
    ref: { node, mode: "center" }
  };
}

function mindmapConnectionBarCommands(parentNode, childNode) {
  if (parentNode?.shape !== "circle" || childNode?.shape !== "circle") return null;
  const from = parentNode.point;
  const to = childNode.point;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const parentRadius = Math.max(Number(parentNode.width) || 0, Number(parentNode.height) || 0) / 2;
  const childRadius = Math.max(Number(childNode.width) || 0, Number(childNode.height) || 0) / 2;
  if (!Number.isFinite(distance) || distance <= 1e-6 || parentRadius <= 0 || childRadius <= 0) return null;

  const ux = dx / distance;
  const uy = dy / distance;
  const nx = -uy;
  const ny = ux;
  const segmentAngle = (20 * Math.PI) / 180;
  const parentHalf = Math.min(parentRadius * Math.sin(segmentAngle), distance * 0.22);
  const childHalf = Math.min(childRadius * Math.sin(segmentAngle), distance * 0.22);
  const parentAlong = Math.sqrt(Math.max(0, parentRadius * parentRadius - parentHalf * parentHalf));
  const childAlong = Math.sqrt(Math.max(0, childRadius * childRadius - childHalf * childHalf));
  const openDistance = Math.max(0, distance - parentRadius - childRadius);
  const parentNeck = parentRadius + Math.min(parentRadius * 0.38, openDistance * 0.38);
  const childNeck = childRadius + Math.min(childRadius * 0.38, openDistance * 0.38);
  const neckHalf = Math.max(0.03, 0.175 * Math.min(parentRadius, childRadius));

  const point = (origin, along, lateral) => roundPoint({
    x: origin.x + ux * along + nx * lateral,
    y: origin.y + uy * along + ny * lateral
  });
  const parentTop = point(from, parentAlong, parentHalf);
  const parentBottom = point(from, parentAlong, -parentHalf);
  const parentInnerTop = point(from, parentNeck, neckHalf);
  const parentInnerBottom = point(from, parentNeck, -neckHalf);
  const childTop = point(to, -childAlong, childHalf);
  const childBottom = point(to, -childAlong, -childHalf);
  const childInnerTop = point(to, -childNeck, neckHalf);
  const childInnerBottom = point(to, -childNeck, -neckHalf);
  const parentControl = Math.max(parentRadius * 0.3, 0.08);
  const childControl = Math.max(childRadius * 0.3, 0.08);

  return [
    { type: "moveTo", x: parentTop.x, y: parentTop.y },
    {
      type: "curveTo",
      x1: parentTop.x + ux * parentControl,
      y1: parentTop.y + uy * parentControl,
      x2: parentInnerTop.x - ux * parentControl,
      y2: parentInnerTop.y - uy * parentControl,
      x: parentInnerTop.x,
      y: parentInnerTop.y
    },
    { type: "lineTo", x: childInnerTop.x, y: childInnerTop.y },
    {
      type: "curveTo",
      x1: childInnerTop.x + ux * childControl,
      y1: childInnerTop.y + uy * childControl,
      x2: childTop.x - ux * childControl,
      y2: childTop.y - uy * childControl,
      x: childTop.x,
      y: childTop.y
    },
    { type: "lineTo", x: childBottom.x, y: childBottom.y },
    {
      type: "curveTo",
      x1: childBottom.x - ux * childControl,
      y1: childBottom.y - uy * childControl,
      x2: childInnerBottom.x + ux * childControl,
      y2: childInnerBottom.y + uy * childControl,
      x: childInnerBottom.x,
      y: childInnerBottom.y
    },
    { type: "lineTo", x: parentInnerBottom.x, y: parentInnerBottom.y },
    {
      type: "curveTo",
      x1: parentInnerBottom.x - ux * parentControl,
      y1: parentInnerBottom.y - uy * parentControl,
      x2: parentBottom.x + ux * parentControl,
      y2: parentBottom.y + uy * parentControl,
      x: parentBottom.x,
      y: parentBottom.y
    },
    { type: "closePath" }
  ];
}

function mindmapConceptColor(node, fallback) {
  const value = node?.options?.["concept color"] ?? fallback;
  return value === undefined || value === null || value === true
    ? null
    : normalizeColor(String(value));
}

function treeEdgeCommands(parentNode, childNode, endpoints, options = {}) {
  const edgePath = String(options["edge from parent path"] || "");
  if (/tikzparentnode\.south/.test(edgePath) && /\|-/.test(edgePath) && /tikzchildnode\.west/.test(edgePath)) {
    const from = nodeAnchorCoordinate(parentNode, "south");
    const to = nodeAnchorCoordinate(childNode, "west");
    return [
      { type: "moveTo", x: from.x, y: from.y },
      { type: "lineTo", x: from.x, y: to.y },
      { type: "lineTo", x: to.x, y: to.y }
    ];
  }
  if (options["edge from parent fork down"] || options["edge from parent fork up"]) {
    const { from, to } = endpoints;
    const forkY = roundNumber((from.y + to.y) / 2);
    return [
      { type: "moveTo", x: from.x, y: from.y },
      { type: "lineTo", x: from.x, y: forkY },
      { type: "lineTo", x: to.x, y: forkY },
      { type: "lineTo", x: to.x, y: to.y }
    ];
  }
  if (options["edge from parent fork left"] || options["edge from parent fork right"]) {
    const { from, to } = endpoints;
    const forkX = roundNumber((from.x + to.x) / 2);
    return [
      { type: "moveTo", x: from.x, y: from.y },
      { type: "lineTo", x: forkX, y: from.y },
      { type: "lineTo", x: forkX, y: to.y },
      { type: "lineTo", x: to.x, y: to.y }
    ];
  }
  return [
    { type: "moveTo", x: endpoints.from.x, y: endpoints.from.y },
    { type: "lineTo", x: endpoints.to.x, y: endpoints.to.y }
  ];
}

function treeEdgeClipNode(node, env) {
  if (!nodeUsesMonospaceFont(node.text, node.options, env)) return node;
  const normalized = normalizeTikzText(node.text, env);
  const textBox = scaleTextMetricBox(estimateTextMetricBox(normalized, {
    ...textEngineMetricOptions(env, node.text, node.options || {}, normalized),
    widthFactor: 0.184,
    lineHeight: 0.32,
    minHeight: 0.18,
    formulaMinWidth: 0.08,
    formulaWidthPadding: 0
  }), nodeFontScaleForText(normalized, node.options || {}, env));
  const innerSep = parseNodeLengthDimension(node.options?.["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env);
  return {
    ...node,
    width: roundNumber(Math.max(Number(node.width) || 0, textBox.width + innerSep * 2)),
    height: roundNumber(Math.max(Number(node.height) || 0, textBox.height + innerSep * 2))
  };
}

function addNodeAttachedPath(name, segments, nodeOptions, env, ir, diagnostics) {
  const rawOptions = { ...(env.pictureOptions || {}), ...(nodeOptions || {}) };
  const normalized = normalizeOptions("path", rawOptions, env);
  const style = scaleCanvasStyle(normalized.style, env);
  const { semantic, options } = normalized;
  const pathOptions = { ...options, ...semantic };
  for (const segment of splitAttachedPathSegments(segments)) {
    const built = buildPath([{ kind: "coordinate", raw: name }, ...segment], env, diagnostics, pathOptions, style);
    const visible = isVisiblePath("path", style, semantic, built.styleHints);
    for (const shape of built.shapes) {
      ir.items.push(shape);
      addDecorationMarkers(shape, options, ir);
    }
    if (visible && hasDrawableCommands(built.commands, built.shapes)) {
      const pathStyle = drawablePathStyle(style, built.styleHints);
      const item = {
        type: "path",
        subtype: semanticSubtype(pathOptions),
        style: pathStyle,
        commands: applyArrowEndpointShortening(built.commands, pathStyle, built.endpointRefs)
      };
      ir.items.push(item);
      addDecorationMarkers(item, options, ir);
    }
    for (const node of built.nodes) {
      addNodeItems(node, ir, env);
    }
  }
}

function resolveTextContent(raw, env = {}) {
  const substituted = substituteTextVariables(String(raw ?? ""), env.variables || {});
  return expandInlinePgfMathResults(substituted, env.variables || {});
}

function expandInlinePgfMathResults(text, variables = {}) {
  return String(text ?? "").replace(/\\pgfmathparse\s*\{([^{}]*)\}\s*\\pgfmathresult/g, (_match, expression) => {
    const value = evaluateMath(expression, variables);
    if (!Number.isFinite(value)) return "0";
    const rounded = roundNumber(value, 8);
    return Number.isInteger(rounded) ? String(rounded) : String(rounded);
  });
}

function splitAttachedPathSegments(segments = []) {
  if (!segments.every((segment) => segment.kind === "edge" || segment.kind === "to")) return [segments];
  return segments.map((segment) => [segment]);
}

function createCalendar(statement, env, ir, diagnostics = []) {
  const spec = parseCalendarSpec(statement.raw || "");
  if (!spec) {
    diagnostics.push({ severity: "warning", message: "Malformed \\calendar statement" });
    return;
  }
  const origin = spec.at
    ? resolveCoordinate(spec.at, env, diagnostics)
    : resolvePositioning(spec.options || {}, env) || applyCoordinateTransform({ x: 0, y: 0 }, env);
  createCalendarItems(spec, origin, env, ir, diagnostics);
}

function createCalendarItems(spec, center, env, ir, diagnostics = []) {
  const layout = calendarLayout(spec, env);
  if (!layout) {
    diagnostics.push({ severity: "warning", message: `Unsupported \\calendar dates ${spec.options?.dates || ""}`.trim() });
    return;
  }
  const calendarEnv = { ...env, styles: layout.styles };
  if (calendarHasMonthLabels(layout.options)) {
    for (const month of layout.months) {
      addCalendarNode({
        point: calendarMonthLabelPoint(layout, month, center, env),
        text: calendarMonthText(layout, month.date),
        options: calendarMonthLabelOptions(layout.options, calendarEnv)
      }, ir, calendarEnv);
    }
  }

  for (const date of layout.dates) {
    const point = roundPoint({
      x: center.x + date.point.x,
      y: center.y + date.point.y
    });
    const name = spec.name ? `${resolveDynamicName(spec.name, env)}-${date.iso}` : date.iso;
    const options = calendarDayOptions(layout, date, calendarEnv);
    addCalendarNode({ point, text: calendarDayText(layout, date), options, name }, ir, calendarEnv);
  }
}

function addCalendarNode(node, ir, env) {
  const text = substituteTextVariables(String(node.text ?? ""), env.variables);
  const expandedOptions = normalizeOptions("node", {
    ...inheritedNodeOptions(env),
    ...resolveDynamicOptions(node.options || {}, env)
  }, env).options;
  const size = scaleSize(estimateNodeLayoutSize(text, expandedOptions, env), env.canvasScale);
  const displayPoint = resolveNodeAnchorPoint(node.point, expandedOptions, text, env, size);
  if (node.name) {
    env.nodes[node.name] = {
      point: displayPoint,
      width: size.width,
      height: size.height,
      layoutWidth: size.width,
      layoutHeight: size.height,
      shape: nodeShape(expandedOptions),
      shapeData: nodeShapeData(expandedOptions, env)
    };
    env.coordinates[node.name] = displayPoint;
  }
  addNodeItems({ at: node.point, displayPoint, text, options: expandedOptions, name: node.name || null, size }, ir, env);
}

function estimateCalendarSize(spec, env) {
  const layout = calendarLayout(spec, env);
  if (!layout) return { width: 1, height: 1 };
  return {
    width: roundNumber((layout.columns - 1) * layout.dayX + 0.35),
    height: roundNumber(layout.height + layout.dayY * 1.45)
  };
}

function calendarLayout(spec, env) {
  const styles = { ...(env.styles || {}), ...styleDefinitionsFromOptions(spec.options || {}, env.styles || {}) };
  const calendarEnv = { ...env, styles };
  const options = calendarEffectiveOptions(spec, calendarEnv);
  const dates = calendarDateRange(options.dates || spec.options?.dates);
  if (!dates.length) return null;
  const dayX = parseFiniteDimension(options["day xshift"], env, parseDimension("3.5ex", env.variables));
  const dayY = parseFiniteDimension(options["day yshift"], env, parseDimension("3ex", env.variables));
  const monthX = parseFiniteDimension(options["month xshift"], env, parseDimension("9ex", env.variables));
  const monthY = parseFiniteDimension(options["month yshift"], env, parseDimension("9ex", env.variables));
  const sundayFirst = options["week list sunday"] === true || String(options["week list"] || "").trim().toLowerCase() === "sunday";
  const arrangement = calendarArrangement(options);
  let cursorY = 0;
  let cursorX = 0;
  const months = [];
  const positioned = dates.map((date, index) => {
    const startsMonth = index > 0 && date.day === 1;
    if (arrangement === "day-down" && startsMonth) cursorY -= monthY;
    if (arrangement === "day-up" && startsMonth) cursorY += monthY;
    if (arrangement === "day-right" && startsMonth) cursorX += monthX;
    if (arrangement === "day-left" && startsMonth) cursorX -= monthX;
    if (arrangement === "month" && startsMonth) cursorY -= monthY;
    if (arrangement === "week" && startsMonth) cursorY -= monthY;

    const weekday = sundayFirst ? date.date.getUTCDay() : calendarWeekdayMonday(date.date);
    let point;
    if (arrangement === "day-down" || arrangement === "day-up") {
      point = { x: 0, y: cursorY };
    } else if (arrangement === "day-right" || arrangement === "day-left") {
      point = { x: cursorX, y: 0 };
    } else if (arrangement === "month") {
      // PGF's month-list style bases the row offset on the weekday of the
      // first day of the containing month, even when the range starts later.
      const monthStart = calendarMonthStartWeekday(date.date, sundayFirst);
      point = { x: (monthStart + date.day - 1) * dayX, y: cursorY };
    } else {
      point = { x: weekday * dayX, y: cursorY };
    }
    const positionedDate = { ...date, weekday, point };
    if (date.day === 1) months.push({ date: positionedDate, point: arrangement === "week" || arrangement === "month" ? { x: 0, y: cursorY } : { ...point } });
    if (arrangement === "day-down") cursorY -= dayY;
    if (arrangement === "day-up") cursorY += dayY;
    if (arrangement === "day-right") cursorX += dayX;
    if (arrangement === "day-left") cursorX -= dayX;
    if (arrangement === "week" && weekday === 6) cursorY -= dayY;
    return positionedDate;
  });
  const horizontalPoints = positioned.map((date) => date.point.x);
  const verticalPoints = positioned.map((date) => date.point.y);
  const minimumY = Math.min(...verticalPoints);
  const maximumY = Math.max(...verticalPoints);
  const minimumX = Math.min(...horizontalPoints);
  const maximumX = Math.max(...horizontalPoints);
  return {
    options,
    styles,
    conditions: [...calendarConditionsFromOptions(options), ...(spec.conditions || [])],
    dates: positioned,
    months,
    arrangement,
    columns: arrangement === "month" ? 37 : arrangement === "week" ? 7 : 1,
    dayX,
    dayY,
    monthX,
    monthY,
    sundayFirst,
    rowCount: Math.round((maximumY - minimumY) / dayY) + 1,
    minimumX,
    maximumX,
    minimumY,
    maximumY,
    height: Math.max(Math.abs(minimumY), Math.abs(maximumY))
  };
}

function calendarArrangement(options = {}) {
  if (tikzBoolean(options["month list"])) return "month";
  if (tikzBoolean(options["day list downward"])) return "day-down";
  if (tikzBoolean(options["day list upward"])) return "day-up";
  if (tikzBoolean(options["day list right"])) return "day-right";
  if (tikzBoolean(options["day list left"])) return "day-left";
  return "week";
}

function calendarMonthStartWeekday(date, sundayFirst) {
  const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  return sundayFirst ? first.getUTCDay() : calendarWeekdayMonday(first);
}

function calendarWeekdayMonday(date) {
  return (date.getUTCDay() + 6) % 7;
}

function calendarMonthLabelPoint(layout, month, center, env) {
  if (layout.options["month label left"]) {
    return roundPoint({
      x: center.x + month.point.x - parseDimension("3.5ex", env.variables),
      y: center.y + month.point.y
    });
  }
  return roundPoint({
    x: center.x + month.point.x + ((layout.columns - 1) * layout.dayX) / 2 - parseDimension("1.5ex", env.variables),
    y: center.y + month.point.y + layout.dayY * 1.25
  });
}

function calendarHasMonthLabels(options = {}) {
  return Boolean(
    options["month label above centered"] ||
      options["month label above left"] ||
      options["month label above right"] ||
      options["month label left"]
  );
}

function calendarMonthLabelOptions(calendarOptions, env) {
  const options = { "every month": true };
  if (calendarOptions["month label left"]) {
    options.anchor = "base east";
  }
  return calendarTextNodeOptions(calendarOptions, options, env);
}

function calendarEffectiveOptions(spec, env) {
  const normalized = normalizeOptions(
    "node",
    withImplicitStyleOption("every calendar", spec.options || {}, env.styles || {}),
    env
  ).options;
  return normalized;
}

function calendarTextNodeOptions(calendarOptions, extraOptions = {}, env) {
  const options = { ...calendarOptions, ...extraOptions };
  for (const key of calendarOnlyOptionKeys()) delete options[key];
  return options;
}

function calendarDayOptions(layout, date, env) {
  let options = calendarTextNodeOptions(layout.options, { "every day": true }, env);
  for (const condition of layout.conditions) {
    if (calendarConditionMatches(condition.condition, date)) {
      options = { ...options, ...(condition.options || {}) };
    }
  }
  return options;
}

function calendarOnlyOptionKeys() {
  return [
    "dates",
    "if",
    "day xshift",
    "day yshift",
    "month xshift",
    "month yshift",
    "month text",
    "month label above centered",
    "month label above left",
    "month label above right",
    "month label left",
    "month label left vertical",
    "month label right vertical",
    "week list",
    "week list sunday",
    "month list",
    "tikz@lib@cal@width",
    "execute before day scope",
    "execute at begin day scope",
    "execute after day scope"
  ];
}

function calendarConditionsFromOptions(options = {}) {
  if (options.if === undefined) return [];
  return optionValueList(options.if).map(parseCalendarIfValue).filter(Boolean);
}

function parseCalendarIfValue(value) {
  const text = String(value || "").trim();
  const condition = extractBalanced(text, 0, "(", ")");
  if (!condition) return null;
  let index = calendarSkipWhitespace(text, condition.end);
  let options = {};
  if (text[index] === "[") {
    const parsedOptions = extractBalanced(text, index, "[", "]");
    if (parsedOptions) options = parseOptions(parsedOptions.content);
  }
  return { condition: condition.content.trim(), options };
}

function calendarConditionMatches(condition, date) {
  const text = stripOuterBraces(String(condition || "").trim());
  const alternatives = splitTopLevel(text, ",").map((value) => value.trim()).filter(Boolean);
  if (alternatives.length > 1) return alternatives.some((alternative) => calendarConditionMatches(alternative, date));
  const lower = text.toLowerCase();
  if (lower === "weekend") return date.weekday === 5 || date.weekday === 6;
  if (lower === "workday") return date.weekday >= 0 && date.weekday <= 4;
  if (lower === "sunday" || lower === "monday" || lower === "tuesday" || lower === "wednesday" || lower === "thursday" || lower === "friday" || lower === "saturday") {
    return lower === date.weekdayName.toLowerCase();
  }
  const equals = text.match(/^equals\s*=\s*(.+)$/i);
  if (equals) return calendarDateSelectorMatches(equals[1], date);
  const between = text.match(/^between\s*=\s*(.+?)\s+and\s+(.+)$/i);
  if (between) {
    const current = calendarComparableDate(date.iso);
    const start = calendarComparableSelector(between[1], date.iso.slice(0, 4));
    const end = calendarComparableSelector(between[2], date.iso.slice(0, 4));
    return start !== null && end !== null && current >= start && current <= end;
  }
  const dayOfMonth = text.match(/^day of month\s*=\s*(\d+)$/i);
  if (dayOfMonth) return date.day === Number(dayOfMonth[1]);
  return false;
}

function calendarDateSelectorMatches(selector, date) {
  const wanted = String(selector || "").trim();
  return wanted === date.iso || wanted === date.monthDay || `${date.year}-${wanted}` === date.iso;
}

function calendarComparableSelector(selector, fallbackYear) {
  const text = String(selector || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return calendarComparableDate(text);
  if (/^\d{2}-\d{2}$/.test(text)) return calendarComparableDate(`${fallbackYear}-${text}`);
  return null;
}

function calendarComparableDate(iso) {
  return Number(String(iso).replace(/-/g, ""));
}

function calendarDayText(layout, date) {
  const template = layout.options["day text"];
  if (!template || template === true) return String(date.day);
  return calendarTemplateText(template, date);
}

function calendarMonthText(layout, date = layout.dates[0]) {
  const template = layout.options["month text"] || "\\%mt";
  return calendarTemplateText(template, date);
}

function calendarTemplateText(template, date) {
  let text = stripOuterBraces(String(template || ""));
  text = text.replace(/\\textit\{([^{}]*)\}/g, "$1");
  text = text.replace(/\\%mt/g, calendarMonthName(date.month));
  text = text.replace(/\\%m\./g, calendarMonthAbbrev(date.month));
  text = text.replace(/\\%m0/g, String(date.month).padStart(2, "0"));
  text = text.replace(/\\%m-/g, String(date.month));
  text = text.replace(/\\%wt/g, date.weekdayName);
  text = text.replace(/\\%w\./g, calendarWeekdayAbbrev(date.weekday));
  text = text.replace(/\\%d0/g, String(date.day).padStart(2, "0"));
  text = text.replace(/\\%d-/g, String(date.day));
  text = text.replace(/\\%y(?:0|-|=)/g, String(date.year));
  return text.trim() || String(date.day);
}

function calendarMonthAbbrev(month) {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month - 1] || String(month);
}

function calendarMonthName(month) {
  return ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][month - 1] || String(month);
}

function calendarWeekdayAbbrev(weekday) {
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][weekday] || "";
}

function calendarDateRange(rawDates) {
  const text = String(rawDates || "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})\s+to\s+(\d{4})-(\d{2})-(\d{2}|last)$/i);
  if (!match) return [];
  const startYear = Number(match[1]);
  const startMonth = Number(match[2]);
  const startDay = Number(match[3]);
  const endYear = Number(match[4]);
  const endMonth = Number(match[5]);
  const endDay = match[6].toLowerCase() === "last" ? daysInMonth(endYear, endMonth) : Number(match[6]);
  const dates = [];
  let current = Date.UTC(startYear, startMonth - 1, startDay);
  const end = Date.UTC(endYear, endMonth - 1, endDay);
  while (current <= end) {
    const date = new Date(current);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const monthText = String(month).padStart(2, "0");
    const dayText = String(day).padStart(2, "0");
    dates.push({
      date,
      year,
      month,
      day,
      iso: `${year}-${monthText}-${dayText}`,
      monthDay: `${monthText}-${dayText}`,
      weekday: calendarWeekdayMonday(date),
      weekdayName: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getUTCDay()]
    });
    current += 24 * 60 * 60 * 1000;
  }
  return dates;
}

function calendarOrdinal(date) {
  return Math.floor(date.getTime() / (24 * 60 * 60 * 1000));
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parseCalendarSpec(raw) {
  const text = String(raw || "").trim().replace(/;\s*$/, "");
  if (!text.startsWith("\\calendar")) return null;
  let index = "\\calendar".length;
  let name = null;
  let at = null;
  let options = {};
  const conditions = [];
  while (index < text.length) {
    index = calendarSkipWhitespace(text, index);
    if (text[index] === "(") {
      const parsedName = extractBalanced(text, index, "(", ")");
      if (!parsedName) return null;
      name = parsedName.content.trim();
      index = parsedName.end;
      continue;
    }
    if (text[index] === "[") {
      const parsedOptions = extractBalanced(text, index, "[", "]");
      if (!parsedOptions) return null;
      options = { ...options, ...parseOptions(parsedOptions.content) };
      index = parsedOptions.end;
      continue;
    }
    if (calendarStartsWord(text, index, "at")) {
      index = calendarSkipWhitespace(text, index + 2);
      if (text[index] !== "(") return null;
      const parsedAt = extractBalanced(text, index, "(", ")");
      if (!parsedAt) return null;
      at = `(${parsedAt.content.trim()})`;
      index = parsedAt.end;
      continue;
    }
    if (calendarStartsWord(text, index, "if")) {
      const parsedIf = parseCalendarStatementIf(text, index);
      if (!parsedIf) return null;
      conditions.push(parsedIf.condition);
      index = parsedIf.end;
      continue;
    }
    break;
  }
  return { name, at, options, conditions, raw: text };
}

function parseCalendarStatementIf(text, start) {
  let index = calendarSkipWhitespace(text, start + 2);
  if (text[index] !== "(") return null;
  const condition = extractBalanced(text, index, "(", ")");
  if (!condition) return null;
  index = calendarSkipWhitespace(text, condition.end);
  let options = {};
  if (text[index] === "[") {
    const parsedOptions = extractBalanced(text, index, "[", "]");
    if (!parsedOptions) return null;
    options = parseOptions(parsedOptions.content);
    index = parsedOptions.end;
  }
  return {
    condition: { condition: condition.content.trim(), options },
    end: index
  };
}

function calendarStartsWord(text, index, word) {
  if (!text.startsWith(word, index)) return false;
  const before = index > 0 ? text[index - 1] : "";
  const after = text[index + word.length] || "";
  return !/[A-Za-z]/.test(before) && !/[A-Za-z]/.test(after);
}

function calendarSkipWhitespace(text, index) {
  let cursor = index;
  while (/\s/.test(text[cursor] || "")) cursor += 1;
  return cursor;
}

function createMatrix(statement, env, ir, diagnostics = []) {
  const name = statement.name ? resolveDynamicName(statement.name, env) : null;
  const matrixOptions = normalizeOptions("node", statement.options || {}, env).options;
  const matrixNodeOptions = matrixOptions.nodes ? parseOptions(matrixOptions.nodes) : {};
  const inheritedNodeOptions = matrixInheritedNodeOptions(matrixOptions);
  const cellBaseOptions = { ...inheritedNodeOptions, ...matrixNodeOptions };
  const keepEmptyCells = Boolean(matrixOptions["nodes in empty cells"]);
  const rows = splitMatrixRows(statement.body)
    .map((row) => splitMatrixCells(row).map(parseMatrixCell))
    .filter((row) => keepEmptyCells || row.some((cell) => cell.explicitName || cell.calendar || cell.text.length || Object.keys(cell.options).length));
  if (!rows.length) return;

  const cols = Math.max(...rows.map((row) => row.length));
  const cellOptionsByRow = rows.map((row, rowIndex) => {
    const rowOptions = matrixRowNodeOptions(matrixOptions, rowIndex + 1);
    return row.map((cell) => normalizeOptions("node", {
      ...cellBaseOptions,
      ...rowOptions,
      ...cell.options
    }, env).options);
  });
  const rawCellSizes = rows.map((row, rowIndex) => row.map((cell, columnIndex) => {
    const cellText = matrixCellText(cell.text, matrixOptions);
    const options = cellOptionsByRow[rowIndex][columnIndex];
    return cell.calendar
      ? estimateCalendarSize(cell.calendar, env)
      : estimateMatrixCellLayoutSize(cellText, options, env);
  }));

  const matrixScale = parseMatrixScale(matrixOptions, env);
  const cellSizes = rawCellSizes.map((row) => row.map((size) => scaleSize(size, matrixScale)));
  // PGF lays a matrix out from each cell picture's bounding box. For a drawn
  // node that box includes the automatic outer separation, even though the
  // visible node shape itself does not. Keep visible dimensions for rendering,
  // but use the expanded box while resolving between-borders row/column gaps.
  const placementCellSizes = cellSizes.map((row, rowIndex) => row.map((size, columnIndex) =>
    matrixPlacementSize(size, cellOptionsByRow[rowIndex][columnIndex], env, matrixScale)
  ));
  const columnWidths = Array.from({ length: cols }, (_value, columnIndex) => Math.max(
    0.02,
    ...placementCellSizes.map((row) => Number(row[columnIndex]?.width) || 0)
  ));
  const rowHeights = placementCellSizes.map((row) => Math.max(0.02, ...row.map((size) => Number(size.height) || 0)));
  const columnSeparation = parseMatrixSeparation(matrixOptions["column sep"], env, matrixScale);
  const rowSeparation = parseMatrixSeparation(matrixOptions["row sep"], env, matrixScale);
  const columnLayout = matrixAxisLayout(columnWidths, columnSeparation);
  const rowLayout = matrixAxisLayout(rowHeights, rowSeparation, -1);
  const totalWidth = columnLayout.span;
  const totalHeight = rowLayout.span;
  const visibleInnerXSep = matrixInnerSepForAxis(matrixOptions, "x", env, matrixScale, 0);
  const visibleInnerYSep = matrixInnerSepForAxis(matrixOptions, "y", env, matrixScale, 0);
  const layoutInnerXSep = matrixInnerSepForAxis(matrixOptions, "x", env, matrixScale, parseDimension(TIKZ_DEFAULT_INNER_SEP, env.variables));
  const layoutInnerYSep = matrixInnerSepForAxis(matrixOptions, "y", env, matrixScale, parseDimension(TIKZ_DEFAULT_INNER_SEP, env.variables));
  const boundsWidth = roundNumber(totalWidth + visibleInnerXSep * 2);
  const boundsHeight = roundNumber(totalHeight + visibleInnerYSep * 2);
  const layoutWidth = roundNumber(totalWidth + layoutInnerXSep * 2);
  const layoutHeight = roundNumber(totalHeight + layoutInnerYSep * 2);
  const requestedOrigin =
    (statement.at ? resolveCoordinate(statement.at, env, diagnostics) : null) ||
    resolvePositioning(matrixOptions || {}, env, { width: layoutWidth, height: layoutHeight }) ||
    applyCoordinateTransform({ x: 0, y: 0 }, env);
  const anchorCell = findMatrixAnchorCell(rows, matrixOptions.anchor);
  const anchorOffset = anchorCell
    ? {
        x: columnLayout.offsets[anchorCell.columnIndex],
        y: rowLayout.offsets[anchorCell.rowIndex]
      }
    : { x: 0, y: 0 };
  const origin = roundPoint({
    x: requestedOrigin.x - anchorOffset.x,
    y: requestedOrigin.y - anchorOffset.y
  });
  if (name) {
    env.nodes[name] = {
      point: origin,
      width: boundsWidth,
      height: boundsHeight,
      layoutWidth,
      layoutHeight,
      shape: "rectangle"
    };
    env.coordinates[name] = origin;
    materializeMatrixGridCoordinates(name, env, origin, columnWidths, columnLayout, rowHeights, rowLayout, boundsWidth, boundsHeight);
  }

  const { style: rawMatrixStyle, semantic: matrixSemantic } = normalizeOptions("node", matrixOptions, env);
  const matrixStyle = scaleCanvasStyle(rawMatrixStyle, env);
  const matrixShape = nodeShape(matrixOptions);
  const matrixFrameStyle = {
    lineWidth: matrixStyle.lineWidth || 1,
    dashArray: matrixStyle.dashArray,
    opacity: matrixStyle.opacity,
    fillOpacity: matrixStyle.fillOpacity,
    strokeOpacity: matrixStyle.strokeOpacity
  };
  const matrixFrameItem = (style) => ({
    type: "nodeBox",
    shape: matrixShape,
    x: origin.x,
    y: origin.y,
    width: boundsWidth,
    height: boundsHeight,
    rx: nodeCornerRadius(matrixShape, matrixSemantic, { width: boundsWidth, height: boundsHeight }, env),
    style: { ...matrixFrameStyle, ...style }
  });
  const matrixFill = matrixStyle.fill || "none";
  const matrixStroke = matrixSemantic.draw || matrixStyle.stroke !== "none" ? matrixStyle.stroke || "black" : "none";
  if (matrixFill !== "none") {
    ir.items.push(matrixFrameItem({ stroke: "none", fill: matrixFill }));
  }

  rows.forEach((row, rowIndex) => {
    row.forEach((cell, columnIndex) => {
      const cellName = name ? `${name}-${rowIndex + 1}-${columnIndex + 1}` : null;
      const point = roundPoint({
        x: origin.x + columnLayout.offsets[columnIndex],
        y: origin.y + rowLayout.offsets[rowIndex]
      });
      const options = cellOptionsByRow[rowIndex][columnIndex];
      const size = cellSizes[rowIndex][columnIndex];
      if (/^\\phantom\s*\{/.test(cell.text)) options["tikzkit layout bbox"] = true;
      if (cellName) {
        env.nodes[cellName] = {
          point,
          width: size.width,
          height: size.height,
          shape: nodeShape(options),
          shapeData: nodeShapeData(options, env)
        };
        env.coordinates[cellName] = point;
      }
      if (cell.explicitName) {
        const explicitName = resolveDynamicName(cell.explicitName, env);
        env.nodes[explicitName] = {
          point,
          width: size.width,
          height: size.height,
          shape: nodeShape(options),
          shapeData: nodeShapeData(options, env)
        };
        env.coordinates[explicitName] = point;
      }
	      const renderCell = keepEmptyCells || cell.calendar || cell.text.length || Object.keys(cell.options).length;
	      if (!renderCell) return;
	      if (cell.calendar) {
	        createCalendarItems(cell.calendar, point, env, ir, diagnostics);
	        return;
	      }
	      const cellText = matrixCellText(cell.text, matrixOptions);
	      addNodeItems(
	        {
	          at: point,
	          text: cellText,
	          options,
	          name: cellName,
	          size,
	          fitTextToBox: !tikzBoolean(options["tikzkit preserve math size"])
	        },
        ir,
        env
      );
	    });
	  });

	  addMatrixDelimiters(ir, matrixOptions, origin, boundsWidth, boundsHeight, matrixStyle, env);

	  if (matrixStroke !== "none") {
	    ir.items.push(matrixFrameItem({ stroke: matrixStroke, fill: "none" }));
	  }
	}

function matrixCellText(text, matrixOptions = {}) {
  return matrixLibraryCellText(text, matrixOptions);
}

function materializeMatrixGridCoordinates(name, env, origin, columnWidths, columnLayout, rowHeights, rowLayout, boundsWidth, boundsHeight) {
  const left = roundNumber(origin.x - boundsWidth / 2);
  const right = roundNumber(origin.x + boundsWidth / 2);
  const top = roundNumber(origin.y + boundsHeight / 2);
  const bottom = roundNumber(origin.y - boundsHeight / 2);
  const coordinate = (suffix, point) => {
    env.coordinates[`${name}-${suffix}`] = roundPoint(point);
  };

  coordinate("outer-north-west", { x: left, y: top });
  coordinate("outer-north-east", { x: right, y: top });
  coordinate("outer-south-west", { x: left, y: bottom });
  coordinate("outer-south-east", { x: right, y: bottom });

  columnWidths.forEach((width, index) => {
    const center = origin.x + columnLayout.offsets[index];
    const west = roundNumber(center - width / 2);
    const east = roundNumber(center + width / 2);
    coordinate(`column-${index + 1}-north-west`, { x: west, y: top });
    coordinate(`column-${index + 1}-north-east`, { x: east, y: top });
    coordinate(`column-${index + 1}-south-west`, { x: west, y: bottom });
    coordinate(`column-${index + 1}-south-east`, { x: east, y: bottom });
  });

  rowHeights.forEach((height, index) => {
    const center = origin.y + rowLayout.offsets[index];
    const north = roundNumber(center + height / 2);
    const south = roundNumber(center - height / 2);
    coordinate(`row-${index + 1}-north-west`, { x: left, y: north });
    coordinate(`row-${index + 1}-north-east`, { x: right, y: north });
    coordinate(`row-${index + 1}-south-west`, { x: left, y: south });
    coordinate(`row-${index + 1}-south-east`, { x: right, y: south });
  });
}

function addMatrixDelimiters(ir, options = {}, origin, width, height, matrixStyle = {}, env = {}) {
  addMatrixLibraryDelimiters(ir, options, origin, width, height, matrixStyle, env, parseFiniteDimension);
}

function matrixRowNodeOptions(matrixOptions = {}, rowNumber) {
  return matrixLibraryRowNodeOptions(matrixOptions, rowNumber);
}

function matrixInheritedNodeOptions(options = {}) {
  return matrixLibraryInheritedNodeOptions(options);
}

function parseMatrixScale(options = {}, env) {
  if (!tikzBoolean(options["transform shape"])) return 1;
  if (options.scale === undefined || options.scale === true || options.scale === "") return 1;
  const scale = evaluateMath(options.scale, env.variables);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function parseMatrixSeparation(raw, env, scale = 1) {
  const text = String(raw ?? "").replace(/^\{([\s\S]*)\}$/, "$1").trim();
  const parts = splitTopLevel(text, ",").map((part) => part.trim());
  const betweenOrigins = parts.some((part) => /^between origins$/i.test(part));
  const dimension = parts.find((part) => part && !/^between (?:origins|borders)$/i.test(part));
  return {
    betweenOrigins,
    value: parseFiniteDimension(dimension, env, 0) * scale
  };
}

function matrixAxisLayout(sizes = [], separation = {}, direction = 1) {
  if (!sizes.length) return { offsets: [], span: 0 };
  const centers = [0];
  for (let index = 1; index < sizes.length; index += 1) {
    const previous = Math.max(0.02, Number(sizes[index - 1]) || 0.02);
    const current = Math.max(0.02, Number(sizes[index]) || 0.02);
    const distance = separation.betweenOrigins
      ? Math.max(0.02, Number(separation.value) || 0)
      : Math.max(Math.max(0.02, Math.max(previous, current) * 0.25), previous / 2 + current / 2 + (Number(separation.value) || 0));
    centers.push(centers[index - 1] + direction * distance);
  }
  const min = Math.min(...centers.map((center, index) => center - Math.max(0.02, Number(sizes[index]) || 0.02) / 2));
  const max = Math.max(...centers.map((center, index) => center + Math.max(0.02, Number(sizes[index]) || 0.02) / 2));
  const middle = (min + max) / 2;
  return {
    offsets: centers.map((center) => roundNumber(center - middle)),
    span: roundNumber(max - min)
  };
}

function matrixPlacementSize(size = {}, options = {}, env = { variables: {} }, scale = 1) {
  const outerSep = nodeOuterSep(options, env);
  return {
    width: roundNumber(Math.max(0.02, Number(size.width) || 0) + outerSep.x * 2 * scale),
    height: roundNumber(Math.max(0.02, Number(size.height) || 0) + outerSep.y * 2 * scale)
  };
}

function findMatrixAnchorCell(rows, rawAnchor) {
  const anchor = String(rawAnchor ?? "").trim();
  if (!anchor) return null;
  const explicitName = anchor.replace(/\.(?:center|north|south|east|west|base|mid)$/i, "");
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < rows[rowIndex].length; columnIndex += 1) {
      if (String(rows[rowIndex][columnIndex].explicitName || "") === explicitName) {
        return { rowIndex, columnIndex };
      }
    }
  }
  return null;
}

function matrixInnerSepForAxis(options = {}, axis, env, scale, fallback) {
  const axisKey = axis === "x" ? "inner xsep" : "inner ysep";
  const raw = Object.hasOwn(options, axisKey) ? options[axisKey] : options["inner sep"];
  return parseFiniteDimension(raw, env, fallback) * scale;
}

function createPic(statement, env, ir, diagnostics = []) {
  const name = picName(statement, env);
  const origin = picOrigin(statement, env, diagnostics);
  if (createCustomPic(statement, env, ir, diagnostics, name, origin)) return;
  if (createTqftPic(statement, env, ir, diagnostics, name, origin)) return;
  if (createAnglePic(statement, env, ir)) return;
  const cube = statement.body.match(/cube\s*=\s*\{([^}]*)\}/);
  if (!cube) return;
  const [widthRaw = "1", heightRaw = "1", depthRaw = "0.5", lineWidthRaw = ""] = cube[1].split("/").map((part) => part.trim());
  const width = parseDimension(widthRaw, env.variables);
  const height = parseDimension(heightRaw, env.variables);
  const depth = parseDimension(depthRaw, env.variables);
  const cubeBasis = picCubeBasis(env);
  const point = (x, y, z = 0) => {
    const projected = projectBasisPoint(x, y, z, cubeBasis);
    return { x: origin.x + projected.x, y: origin.y + projected.y };
  };
  const points = {
    A: roundPoint(point(-width - depth * 0.5, 0, -depth * 0.5)),
    B: roundPoint(point(width - depth * 0.5, 0, -depth * 0.5)),
    V: roundPoint(point(width, height, 0)),
    W: roundPoint(point(width, -height, 0))
  };
  if (name) {
    for (const [suffix, point] of Object.entries(points)) {
      const coordinateName = `${name}-${suffix}`;
      env.coordinates[coordinateName] = point;
      env.nodes[coordinateName] = { point, width: 0.1, height: 0.1, shape: "rectangle" };
    }
    env.coordinates[name] = origin;
    env.nodes[name] = {
      point: origin,
      width: roundNumber(width * 2 + depth),
      height: roundNumber(height * 2 + depth),
      shape: "rectangle"
    };
  }

  const { style: rawStyle } = normalizeOptions("filldraw", statement.options || {}, env);
  const style = scaleCanvasStyle(rawStyle, env);
  const picLineWidth = parsePicCubeLineWidth(lineWidthRaw, env);
  if (Number.isFinite(picLineWidth)) style.lineWidth = roundNumber(picLineWidth * TIKZ_UNIT * env.canvasScale);
  if (isInvisiblePicCube(statement.options || {})) return;
  const leftTop = point(-width, height, 0);
  const rightTop = point(width, height, 0);
  const rightBottom = point(width, -height, 0);
  const leftBottom = point(-width, -height, 0);
  const backLeftBottom = point(-width - depth, -height, -depth);
  const backLeftTop = point(-width - depth, height, -depth);
  const backRightTop = point(width - depth, height, -depth);
  const commands = [
    { type: "moveTo", x: leftBottom.x, y: leftBottom.y },
    { type: "lineTo", x: rightBottom.x, y: rightBottom.y },
    { type: "lineTo", x: rightTop.x, y: rightTop.y },
    { type: "lineTo", x: leftTop.x, y: leftTop.y },
    { type: "closePath" }
  ];
  if (!env.toggles?.redraw) {
    commands.push(
      { type: "moveTo", x: leftBottom.x, y: leftBottom.y },
      { type: "lineTo", x: backLeftBottom.x, y: backLeftBottom.y },
      { type: "lineTo", x: backLeftTop.x, y: backLeftTop.y },
      { type: "lineTo", x: leftTop.x, y: leftTop.y },
      { type: "closePath" }
    );
  }
  if (!env.toggles?.redraw2) {
    commands.push(
      { type: "moveTo", x: leftTop.x, y: leftTop.y },
      { type: "lineTo", x: backLeftTop.x, y: backLeftTop.y },
      { type: "lineTo", x: backRightTop.x, y: backRightTop.y },
      { type: "lineTo", x: rightTop.x, y: rightTop.y },
      { type: "closePath" }
    );
  }
  ir.items.push({
    type: "path",
    shape: "pic-cube",
    style,
    commands: commands.map((command) => ("x" in command ? { ...command, x: roundNumber(command.x), y: roundNumber(command.y) } : command))
  });
}

function picName(statement, env) {
  return statement.name
    ? resolveDynamicName(statement.name, env)
    : statement.options?.name
      ? resolveDynamicName(statement.options.name, env)
      : null;
}

function picOrigin(options = {}, env, diagnostics = []) {
  const at = options.at ?? options.options?.at;
  if (at !== undefined && at !== null && at !== true && at !== "") {
    return resolveCoordinate(stripOuterBraces(String(at)), env, diagnostics);
  }
  return resolvePositioning(options.options || options || {}, env) || applyCoordinateTransform({ x: 0, y: 0 }, env);
}

function createCustomPic(statement, env, ir, diagnostics = [], name = null, origin = { x: 0, y: 0 }) {
  const picBody = env.pics?.[statement.body];
  if (!picBody) return false;
  if (name) {
    env.coordinates[name] = origin;
    env.nodes[name] = { point: origin, width: 0, height: 0, shape: "rectangle" };
  }
  const localStatements = parseStatements(picBody, diagnostics);
  const parentTransform = normalizeTransform(env.transform);
  const childEnv = {
    ...env,
    transform: { ...parentTransform, x: origin.x, y: origin.y },
    styles: {
      ...(env.styles || {}),
      "pic actions": statement.options || {}
    },
    picNamePrefix: name || env.picNamePrefix || null
  };
  for (const child of localStatements) interpretStatement(child, childEnv, ir, diagnostics);
  return true;
}

function createTqftPic(statement, env, ir, diagnostics, name, origin) {
  const spec = tqftPicSpec(statement, env);
  if (!spec) return false;
  const local = tqftLocalGeometry(spec);
  const anchor = tqftLocalAnchor(local, spec.anchor);
  const transform = (point) => tqftTransformPoint(point, origin, anchor, spec.rotate);
  const style = tqftPathStyle(spec, env);

  ir.items.push({
    type: "path",
    subtype: "tqft-cobordism",
    style,
    commands: tqftTransformCommands(tqftBodyPath(local, spec), transform)
  });

  for (const boundary of [...local.incoming, ...local.outgoing]) {
    ir.items.push({
      type: "path",
      subtype: `tqft-${boundary.kind}-boundary`,
      shape: "ellipse",
      style,
      commands: tqftTransformCommands(tqftBoundaryPath(boundary, spec), transform)
    });
  }

  if (name) registerTqftCoordinates(name, local, spec, transform, env);
  return true;
}

function tqftPicSpec(statement, env) {
  const options = tqftMergedOptions(statement.options || {}, env);
  const body = String(statement.body || "").trim();
  if (!tqftOptionPresent(options, body)) return null;

  let incoming = 5;
  let outgoing = 4;
  let offset = 0;
  if (options["tqft/cylinder to prior"] || options["cylinder to prior"]) {
    incoming = 1;
    outgoing = 1;
    offset = -0.5;
  } else if (options["tqft/cylinder to next"] || options["cylinder to next"]) {
    incoming = 1;
    outgoing = 1;
    offset = 0.5;
  } else if (options["tqft/cylinder"] || options.cylinder) {
    incoming = 1;
    outgoing = 1;
  } else if (options["tqft/cup"] || options.cup) {
    incoming = 1;
    outgoing = 0;
  } else if (options["tqft/cap"] || options.cap) {
    incoming = 0;
    outgoing = 1;
  } else if (options["tqft/pair of pants"] || options["pair of pants"]) {
    incoming = 1;
    outgoing = 2;
    offset = -0.5;
  } else if (options["tqft/reverse pair of pants"] || options["reverse pair of pants"]) {
    incoming = 2;
    outgoing = 1;
    offset = 0.5;
  }

  incoming = tqftIntegerOption(options, ["tqft/incoming boundary components", "incoming boundary components"], incoming, env);
  outgoing = tqftIntegerOption(options, ["tqft/outgoing boundary components", "outgoing boundary components"], outgoing, env);
  offset = tqftNumberOption(options, ["tqft/offset", "offset"], offset, env);
  return {
    incoming: Math.max(0, incoming),
    outgoing: Math.max(0, outgoing),
    offset,
    height: tqftDimensionOption(options, ["tqft/cobordism height", "cobordism height"], "2cm", env),
    separation: tqftDimensionOption(options, ["tqft/boundary separation", "boundary separation"], "2cm", env),
    rx: tqftDimensionOption(options, ["tqft/circle x radius", "circle x radius"], "10pt", env),
    ry: tqftDimensionOption(options, ["tqft/circle y radius", "circle y radius"], "5pt", env),
    rotate: tqftNumberOption(options, ["rotate"], 0, env),
    viewFrom: String(options["tqft/view from"] || options["view from"] || "outgoing").trim(),
    anchor: String(options.anchor || "none").trim(),
    options
  };
}

function tqftMergedOptions(options = {}, env = {}) {
  const everyTqftStyle = env.styles?.["every tqft"] || {};
  const everyTqft = parseOptions(env.pictureOptions?.["every tqft/.append style"] || env.pictureOptions?.["every tqft/.style"] || "");
  return {
    ...everyTqftStyle,
    ...everyTqft,
    ...resolveDynamicOptions(options || {}, env)
  };
}

function tqftOptionPresent(options = {}, body = "") {
  return body === "tqft" ||
    body === "cobordism" ||
    Object.keys(options).some((key) =>
      key === "tqft" ||
      key.startsWith("tqft/") ||
      key === "incoming boundary components" ||
      key === "outgoing boundary components" ||
      key === "cobordism edge/.style"
    );
}

function tqftIntegerOption(options, keys, fallback, env) {
  const value = tqftRawOption(options, keys);
  if (value === undefined) return fallback;
  const parsed = Math.round(evaluateMath(value, env.variables));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function tqftNumberOption(options, keys, fallback, env) {
  const value = tqftRawOption(options, keys);
  if (value === undefined || value === true || value === "") return fallback;
  const parsed = evaluateMath(value, env.variables);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function tqftDimensionOption(options, keys, fallback, env) {
  const value = tqftRawOption(options, keys) ?? fallback;
  const parsed = parseDimension(value, env.variables);
  return Number.isFinite(parsed) ? parsed : parseDimension(fallback, env.variables);
}

function tqftRawOption(options, keys) {
  for (const key of keys) {
    if (Object.hasOwn(options, key)) return options[key];
  }
  return undefined;
}

function tqftLocalGeometry(spec) {
  const incoming = Array.from({ length: spec.incoming }, (_item, index) => ({
    kind: "incoming",
    index: index + 1,
    x: index * spec.separation,
    y: 0
  }));
  const outgoing = Array.from({ length: spec.outgoing }, (_item, index) => ({
    kind: "outgoing",
    index: index + 1,
    x: (index + spec.offset) * spec.separation,
    y: -spec.height
  }));
  return {
    incoming,
    outgoing,
    height: spec.height,
    separation: spec.separation,
    offset: spec.offset,
    rx: spec.rx,
    ry: spec.ry
  };
}

function tqftBodyPath(local, spec) {
  const all = [...local.incoming, ...local.outgoing];
  if (!all.length) return [];
  if (!local.incoming.length || !local.outgoing.length) {
    const centers = local.incoming.length ? local.incoming : local.outgoing;
    const minX = Math.min(...centers.map((point) => point.x)) - spec.rx;
    const maxX = Math.max(...centers.map((point) => point.x)) + spec.rx;
    const y = centers[0].y;
    const bulge = spec.height * 0.42 * (local.incoming.length ? -1 : 1);
    return [
      { type: "moveTo", x: minX, y },
      { type: "curveTo", x1: minX, y1: y + bulge, x2: maxX, y2: y + bulge, x: maxX, y },
      { type: "curveTo", x1: maxX, y1: y - bulge * 0.35, x2: minX, y2: y - bulge * 0.35, x: minX, y },
      { type: "closePath" }
    ];
  }
  const minIn = Math.min(...local.incoming.map((point) => point.x)) - spec.rx;
  const maxIn = Math.max(...local.incoming.map((point) => point.x)) + spec.rx;
  const minOut = Math.min(...local.outgoing.map((point) => point.x)) - spec.rx;
  const maxOut = Math.max(...local.outgoing.map((point) => point.x)) + spec.rx;
  const topY = 0;
  const bottomY = -spec.height;
  const leftControl = Math.max(0.35, Math.abs(minOut - minIn) + 0.35) * spec.height / 2;
  const rightControl = Math.max(0.35, Math.abs(maxOut - maxIn) + 0.35) * spec.height / 2;
  return [
    { type: "moveTo", x: minIn, y: topY },
    { type: "curveTo", x1: minIn, y1: topY - leftControl, x2: minOut, y2: bottomY + leftControl, x: minOut, y: bottomY },
    { type: "moveTo", x: maxOut, y: bottomY },
    { type: "curveTo", x1: maxOut, y1: bottomY + rightControl, x2: maxIn, y2: topY - rightControl, x: maxIn, y: topY }
  ];
}

function tqftBoundaryPath(boundary, spec) {
  const side = spec.viewFrom === "incoming" ? "upper" : "lower";
  return halfEllipseToPath(boundary.x, boundary.y, spec.rx, spec.ry, side);
}

function halfEllipseToPath(cx, cy, rx, ry, side = "upper") {
  const k = 0.5522847498307936;
  if (side === "lower") {
    return [
      { type: "moveTo", x: cx - rx, y: cy },
      { type: "curveTo", x1: cx - rx, y1: cy - k * ry, x2: cx - k * rx, y2: cy - ry, x: cx, y: cy - ry },
      { type: "curveTo", x1: cx + k * rx, y1: cy - ry, x2: cx + rx, y2: cy - k * ry, x: cx + rx, y: cy }
    ];
  }
  return [
    { type: "moveTo", x: cx - rx, y: cy },
    { type: "curveTo", x1: cx - rx, y1: cy + k * ry, x2: cx - k * rx, y2: cy + ry, x: cx, y: cy + ry },
    { type: "curveTo", x1: cx + k * rx, y1: cy + ry, x2: cx + rx, y2: cy + k * ry, x: cx + rx, y: cy }
  ];
}

function tqftLocalAnchor(local, anchor) {
  const normalized = String(anchor || "none").trim();
  if (!normalized || normalized === "none") return { x: 0, y: 0 };
  const boundary = tqftBoundaryByName(local, normalized);
  if (boundary) return { x: boundary.x, y: boundary.y };
  const between = tqftBetweenAnchor(local, normalized);
  return between || { x: 0, y: 0 };
}

function tqftBoundaryByName(local, anchor) {
  const boundary = anchor.match(/^(incoming|outgoing) boundary(?:\s+(\d+))?$/);
  if (!boundary) return null;
  const list = boundary[1] === "incoming" ? local.incoming : local.outgoing;
  const index = boundary[2] ? Number(boundary[2]) : 1;
  return list[index - 1] || null;
}

function tqftBetweenAnchor(local, anchor) {
  const two = anchor.match(/^between\s+(incoming|outgoing)\s+(\d+)\s+and\s+(\d+)$/);
  if (two) {
    const list = two[1] === "incoming" ? local.incoming : local.outgoing;
    const first = list[Number(two[2]) - 1];
    const second = list[Number(two[3]) - 1];
    if (!first || !second) return null;
    return {
      x: (first.x + second.x) / 2,
      y: two[1] === "incoming" ? -local.height / 4 : -local.height * 3 / 4
    };
  }
  if (anchor === "between first incoming and first outgoing") return midpoint(local.incoming[0], local.outgoing[0]);
  if (anchor === "between last incoming and last outgoing") return midpoint(local.incoming.at(-1), local.outgoing.at(-1));
  if (anchor === "between first and last incoming" || anchor === "between first incoming and last incoming") {
    return midpoint(local.incoming[0], local.incoming.at(-1));
  }
  if (anchor === "between first and last outgoing" || anchor === "between first outgoing and last outgoing") {
    return midpoint(local.outgoing[0], local.outgoing.at(-1));
  }
  return null;
}

function midpoint(a, b) {
  if (!a || !b) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function tqftTransformPoint(point, origin, anchor, rotate) {
  const rotated = rotateVector(point.x - anchor.x, point.y - anchor.y, rotate);
  return roundPoint({ x: origin.x + rotated.x, y: origin.y + rotated.y });
}

function tqftTransformCommands(commands, transform) {
  return commands.map((command) => {
    if (command.type === "closePath") return command;
    if (command.type === "moveTo" || command.type === "lineTo") {
      const point = transform(command);
      return { ...command, x: point.x, y: point.y };
    }
    if (command.type === "curveTo") {
      const p1 = transform({ x: command.x1, y: command.y1 });
      const p2 = transform({ x: command.x2, y: command.y2 });
      const p = transform({ x: command.x, y: command.y });
      return { ...command, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, x: p.x, y: p.y };
    }
    return command;
  });
}

function tqftPathStyle(spec, env) {
  const { style: rawStyle } = normalizeOptions("path", { draw: true, ...spec.options }, env);
  const style = scaleCanvasStyle(rawStyle, env);
  return {
    ...style,
    stroke: style.stroke && style.stroke !== "none" ? style.stroke : "black",
    fill: "none"
  };
}

function registerTqftCoordinates(name, local, spec, transform, env) {
  for (const boundary of [...local.incoming, ...local.outgoing]) {
    const base = `${name}-${boundary.kind} boundary ${boundary.index}`;
    const center = transform(boundary);
    registerTqftNode(base, center, boundary, spec, transform, env);
    if (boundary.index === 1) registerTqftNode(`${name}-${boundary.kind} boundary`, center, boundary, spec, transform, env);
  }
  registerTqftCoordinate(`${name}-between first incoming and first outgoing`, tqftBetweenAnchor(local, "between first incoming and first outgoing"), transform, env);
  registerTqftCoordinate(`${name}-between last incoming and last outgoing`, tqftBetweenAnchor(local, "between last incoming and last outgoing"), transform, env);
  registerTqftCoordinate(`${name}-between first and last incoming`, tqftBetweenAnchor(local, "between first and last incoming"), transform, env);
  registerTqftCoordinate(`${name}-between first incoming and last incoming`, tqftBetweenAnchor(local, "between first incoming and last incoming"), transform, env);
  registerTqftCoordinate(`${name}-between first and last outgoing`, tqftBetweenAnchor(local, "between first and last outgoing"), transform, env);
  registerTqftCoordinate(`${name}-between first outgoing and last outgoing`, tqftBetweenAnchor(local, "between first outgoing and last outgoing"), transform, env);
  for (let index = 1; index < local.incoming.length; index += 1) {
    registerTqftCoordinate(`${name}-between incoming ${index} and ${index + 1}`, tqftBetweenAnchor(local, `between incoming ${index} and ${index + 1}`), transform, env);
  }
  for (let index = 1; index < local.outgoing.length; index += 1) {
    registerTqftCoordinate(`${name}-between outgoing ${index} and ${index + 1}`, tqftBetweenAnchor(local, `between outgoing ${index} and ${index + 1}`), transform, env);
  }
  if (local.incoming.length || local.outgoing.length) {
    const all = [...local.incoming, ...local.outgoing];
    const xs = all.map((point) => point.x);
    const ys = all.map((point) => point.y);
    const center = transform({ x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 });
    env.coordinates[name] = center;
    env.nodes[name] = { point: center, width: 0, height: 0, shape: "coordinate" };
  }
}

function registerTqftNode(name, center, boundary, spec, transform, env) {
  const east = transform({ x: boundary.x + spec.rx, y: boundary.y });
  const west = transform({ x: boundary.x - spec.rx, y: boundary.y });
  const north = transform({ x: boundary.x, y: boundary.y + spec.ry });
  const south = transform({ x: boundary.x, y: boundary.y - spec.ry });
  const width = Math.max(Math.abs(east.x - west.x), Math.abs(north.x - south.x), 0.01);
  const height = Math.max(Math.abs(east.y - west.y), Math.abs(north.y - south.y), 0.01);
  env.coordinates[name] = center;
  env.nodes[name] = {
    point: center,
    width: roundNumber(width),
    height: roundNumber(height),
    shape: "ellipse"
  };
}

function registerTqftCoordinate(name, point, transform, env) {
  if (!point) return;
  const global = transform(point);
  env.coordinates[name] = global;
  env.nodes[name] = { point: global, width: 0, height: 0, shape: "coordinate" };
}

function createAnglePic(statement, env, ir) {
  const body = String(statement.body || "").trim();
  const parts = parseAnglePicParts(body);
  if (!parts) return false;
  const from = resolveCoordinate(parts.from, env, []);
  const vertex = resolveCoordinate(parts.vertex, env, []);
  const to = resolveCoordinate(parts.to, env, []);
  const fromAngle = Math.atan2(from.y - vertex.y, from.x - vertex.x);
  const toAngle = Math.atan2(to.y - vertex.y, to.x - vertex.x);
  const { startAngle, delta } = anglePicSweep(fromAngle, toAngle);
  const radius = parseDimension(statement.options?.["angle radius"] ?? env.pictureOptions?.["angle radius"] ?? "5mm", env.variables);
  const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : 0.5;

  const { style: rawStyle } = normalizeOptions("path", statement.options || {}, env);
  const scaledStyle = scaleCanvasStyle(rawStyle, env);
  const hasFill = scaledStyle.fill && scaledStyle.fill !== "none";
  const style = { ...scaledStyle, fill: hasFill ? scaledStyle.fill : "none" };
  ir.items.push({
    type: "path",
    subtype: "angle-pic",
    shape: parts.kind === "right angle" ? "right-angle" : hasFill ? "sector" : "arc",
    style,
    commands: anglePicCommands(vertex, startAngle, delta, safeRadius, hasFill, parts.kind)
  });

  const quote = anglePicQuote(statement.options || {});
  if (quote) {
    const eccentricity = evaluateMath(statement.options?.["angle eccentricity"] ?? env.pictureOptions?.["angle eccentricity"] ?? "0.65", env.variables);
    const labelRadius = anglePicLabelRadius(safeRadius, eccentricity, parts.kind);
    const midAngle = startAngle + delta / 2;
    const textColor = normalizeColor(statement.options?.text ?? env.pictureOptions?.text ?? "black");
    ir.items.push({
      type: "textNode",
      text: quote,
      x: roundNumber(vertex.x + Math.cos(midAngle) * labelRadius),
      y: roundNumber(vertex.y + Math.sin(midAngle) * labelRadius),
      font: resolvedTextFontSpec(quote, statement.options || {}, env, env.canvasScale),
      style: {
        stroke: "none",
        fill: textColor,
        lineWidth: style.lineWidth,
        textFill: textColor,
        fontScale: roundNumber(env.canvasScale * fontScaleFromTikzFont(statement.options?.font ?? env.pictureOptions?.font)),
        fontSizeBaseScale: 1,
        fontFamily: resolveInheritedFontFamily(statement.options?.font, env.pictureOptions?.font),
        fontVariant: resolveInheritedFontVariant(statement.options?.font, env.pictureOptions?.font)
      }
    });
  }
  return true;
}

function anglePicQuote(options = {}) {
  for (const [key, value] of Object.entries(options)) {
    if (value !== true) continue;
    const text = String(key).trim();
    if (text.length >= 2 && text.startsWith("\"") && text.endsWith("\"")) return text.slice(1, -1);
  }
  return "";
}

function buildAnglePic(segment, pathOptions = {}, env = {}, diagnostics = []) {
  const parts = parseAnglePicParts(segment.body);
  if (!parts) return null;
  const from = resolveCoordinate(parts.from, env, diagnostics);
  const vertex = resolveCoordinate(parts.vertex, env, diagnostics);
  const to = resolveCoordinate(parts.to, env, diagnostics);
  const fromAngle = Math.atan2(from.y - vertex.y, from.x - vertex.x);
  const toAngle = Math.atan2(to.y - vertex.y, to.x - vertex.x);
  const { startAngle, delta } = anglePicSweep(fromAngle, toAngle);

  const radiusRaw = segment.options?.["angle radius"] ?? pathOptions["angle radius"] ?? env.pictureOptions?.["angle radius"] ?? "5mm";
  const radius = parseDimension(radiusRaw, env.variables);
  const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : parseDimension("5mm", env.variables);
  const { style: rawStyle } = normalizeOptions("path", segment.options || {}, env);
  const style = scaleCanvasStyle(rawStyle, env);
  const hasFill = style.fill && style.fill !== "none";
  const shapeStyle = {
    ...style,
    stroke: style.stroke && style.stroke !== "none" ? style.stroke : "black",
    fill: hasFill ? style.fill : "none"
  };
  const commands = anglePicCommands(vertex, startAngle, delta, safeRadius, hasFill, parts.kind);
  const quote = anglePicQuote(segment.options || {});
  return {
    shape: {
      type: "path",
      subtype: "angle-pic",
      shape: parts.kind === "right angle" ? "right-angle" : hasFill ? "sector" : "arc",
      style: shapeStyle,
      commands
    },
    label: quote ? anglePicLabelNode(quote, vertex, startAngle, delta, safeRadius, segment.options || {}, env, parts.kind) : null
  };
}

function parseAnglePicParts(body) {
  const angleMatch = String(body || "").trim().match(/^(right angle|angle)\s*=\s*([\s\S]+)$/);
  if (!angleMatch) return null;
  const parts = splitTopLevelAnglePath(angleMatch[2]);
  if (parts.length !== 3) return null;
  return {
    kind: angleMatch[1],
    from: parts[0],
    vertex: parts[1],
    to: parts[2]
  };
}

function splitTopLevelAnglePath(text) {
  const parts = [];
  let start = 0;
  let paren = 0;
  let brace = 0;
  let bracket = 0;
  for (let index = 0; index < text.length - 1; index += 1) {
    const char = text[index];
    if (char === "(") paren += 1;
    else if (char === ")") paren = Math.max(0, paren - 1);
    else if (char === "{") brace += 1;
    else if (char === "}") brace = Math.max(0, brace - 1);
    else if (char === "[") bracket += 1;
    else if (char === "]") bracket = Math.max(0, bracket - 1);
    if (paren || brace || bracket) continue;
    if (text.slice(index, index + 2) === "--") {
      parts.push(text.slice(start, index).trim());
      start = index + 2;
      index += 1;
    }
  }
  parts.push(text.slice(start).trim());
  return parts.filter(Boolean);
}

function anglePicSweep(fromAngle, toAngle) {
  // tikzlibraryangles compares the two raw atan2 results, moves a smaller
  // start angle back by 360 degrees, then uses an ordinary arc. This always
  // produces the library's counterclockwise sweep, including reflex angles.
  const startAngle = toAngle < fromAngle ? fromAngle - Math.PI * 2 : fromAngle;
  return { startAngle, delta: toAngle - startAngle };
}

function anglePicCommands(vertex, fromAngle, delta, radius, closed, kind = "angle") {
  if (kind === "right angle") {
    const start = anglePoint(vertex, fromAngle, radius);
    const end = anglePoint(vertex, fromAngle + delta, radius);
    const corner = roundPoint({
      x: start.x + end.x - vertex.x,
      y: start.y + end.y - vertex.y
    });
    const commands = closed
      ? [
          { type: "moveTo", x: vertex.x, y: vertex.y },
          { type: "lineTo", x: start.x, y: start.y },
          { type: "lineTo", x: corner.x, y: corner.y },
          { type: "lineTo", x: end.x, y: end.y },
          { type: "closePath" }
        ]
      : [
          { type: "moveTo", x: start.x, y: start.y },
          { type: "lineTo", x: corner.x, y: corner.y },
          { type: "lineTo", x: end.x, y: end.y }
        ];
    return commands;
  }
  const steps = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2)));
  const start = anglePoint(vertex, fromAngle, radius);
  const commands = closed
    ? [
        { type: "moveTo", x: vertex.x, y: vertex.y },
        { type: "lineTo", x: start.x, y: start.y }
      ]
    : [{ type: "moveTo", x: start.x, y: start.y }];
  for (let index = 1; index <= steps; index += 1) {
    const startAngle = fromAngle + (delta * (index - 1)) / steps;
    const endAngle = fromAngle + (delta * index) / steps;
    const k = (4 / 3) * Math.tan((endAngle - startAngle) / 4);
    const startPoint = anglePoint(vertex, startAngle, radius);
    const endPoint = anglePoint(vertex, endAngle, radius);
    const startDerivative = { x: -radius * Math.sin(startAngle), y: radius * Math.cos(startAngle) };
    const endDerivative = { x: -radius * Math.sin(endAngle), y: radius * Math.cos(endAngle) };
    commands.push(curveToCommand(
      roundPoint({ x: startPoint.x + k * startDerivative.x, y: startPoint.y + k * startDerivative.y }),
      roundPoint({ x: endPoint.x - k * endDerivative.x, y: endPoint.y - k * endDerivative.y }),
      endPoint
    ));
  }
  if (closed) commands.push({ type: "closePath" });
  return commands;
}

function anglePoint(vertex, angle, radius) {
  return roundPoint({
    x: vertex.x + Math.cos(angle) * radius,
    y: vertex.y + Math.sin(angle) * radius
  });
}

function anglePicLabelRadius(radius, eccentricity, kind = "angle") {
  const factor = Number.isFinite(eccentricity) && eccentricity > 0 ? eccentricity : 0.65;
  return radius * factor * (kind === "right angle" ? Math.SQRT2 : 1);
}

function anglePicLabelNode(text, vertex, fromAngle, delta, radius, options, env, kind = "angle") {
  const eccentricity = evaluateMath(options["angle eccentricity"] ?? env.pictureOptions?.["angle eccentricity"] ?? "0.65", env.variables);
  const labelRadius = anglePicLabelRadius(radius, eccentricity, kind);
  const point = anglePoint(vertex, fromAngle + delta / 2, labelRadius);
  return {
    at: point,
    displayPoint: point,
    text,
    options: {
      "inner sep": "1pt",
      anchor: "center",
      ...(options.text ?? env.pictureOptions?.text ? { text: options.text ?? env.pictureOptions?.text } : {})
    },
    canvasScale: env.canvasScale
  };
}

function picCubeBasis(env) {
  const basis = env.basis || parsePictureBasis();
  const z = basis.z || { x: 0, y: 0 };
  const hasZ = Math.abs(Number(z.x) || 0) > 1e-9 || Math.abs(Number(z.y) || 0) > 1e-9;
  return hasZ ? basis : { ...basis, z: PGF_DEFAULT_Z_VECTOR };
}

function parsePicCubeLineWidth(value, env) {
  const text = String(value || "").trim();
  if (!text) return NaN;
  const dimension = /[A-Za-z]/.test(text) ? text : `${text}mm`;
  const parsed = parseDimension(dimension, env.variables);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : NaN;
}

function isInvisiblePicCube(options = {}) {
  return isZeroPercentColor(options.draw) && isZeroPercentColor(options.fill);
}

function isZeroPercentColor(value) {
  const text = String(value ?? "").trim();
  const parts = text.split("!").map((part) => part.trim()).filter(Boolean);
  return parts.length === 2 && Number(parts[1]) === 0;
}

function createSpy(statement, env, ir, diagnostics) {
  const onPoint = resolveCoordinate(statement.on, env, diagnostics);
  const spyOptions = spyScopeOptions(statement, env);
  const magnification = spyMagnification(spyOptions, env);
  const targetSize = spyTargetSize(spyOptions, env);
  const sourceSize = {
    width: roundNumber(targetSize.width / magnification),
    height: roundNumber(targetSize.height / magnification)
  };
  const atPoint = statement.at ? resolveCoordinate(statement.at, env, diagnostics) : onPoint;
  const inCenter = spyInNodeCenter(atPoint, statement.inOptions || {}, targetSize, env);
  const shape = nodeShape(spyOptions);
  const radius = Math.max(targetSize.width, targetSize.height) / 2;
  const sourceRadius = Math.max(sourceSize.width, sourceSize.height) / 2;
  const existingItems = [...ir.items];
  ir.items.push(...spyMagnifiedPathItems(existingItems, onPoint, inCenter, magnification, radius, shape));

  const connectionStyle = spyPathStyle({ thin: true, draw: true, ...statement.options }, env);
  if (tikzBoolean(spyOptions["connect spies"])) {
    const clipped = clipNodeLineEndpoints(
      onPoint,
      { node: { point: onPoint, width: sourceSize.width, height: sourceSize.height, shape }, mode: "center" },
      inCenter,
      { node: { point: inCenter, width: targetSize.width, height: targetSize.height, shape }, mode: "center" },
      env
    );
    ir.items.push({
      type: "path",
      subtype: "spy-connection",
      style: connectionStyle,
      commands: [
        { type: "moveTo", x: clipped.from.x, y: clipped.from.y },
        { type: "lineTo", x: clipped.to.x, y: clipped.to.y }
      ]
    });
  }

  ir.items.push(
    spyOutlineItem("spy-on", onPoint, sourceSize, shape, spyPathStyle({ "very thin": true, draw: true, ...statement.options }, env), env),
    spyOutlineItem("spy-in", inCenter, targetSize, shape, spyPathStyle({ thick: true, draw: true, ...statement.options }, env), env)
  );
}

function spyScopeOptions(statement, env) {
  const pictureOptions = env.pictureOptions || {};
  const rawScope = pictureOptions["spy using outlines"] ?? pictureOptions["spy using overlays"] ?? "";
  const scope = rawScope && rawScope !== true ? parseOptions(rawScope) : {};
  if (scope.size && !scope["minimum size"]) scope["minimum size"] = scope.size;
  if (scope.width && !scope["minimum width"]) scope["minimum width"] = scope.width;
  if (scope.height && !scope["minimum height"]) scope["minimum height"] = scope.height;
  return normalizeOptions("node", { circle: true, ...scope, ...(statement.inOptions || {}) }, env).options;
}

function spyMagnification(options = {}, env) {
  const raw = options.magnification ?? "1";
  const parsed = evaluateMath(raw, env.variables);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function spyTargetSize(options = {}, env) {
  const size = parseFiniteDimension(options.size ?? options["minimum size"], env, 1);
  const width = parseFiniteDimension(options.width ?? options["minimum width"], env, size);
  const height = parseFiniteDimension(options.height ?? options["minimum height"], env, size);
  return {
    width: roundNumber(width * env.canvasScale),
    height: roundNumber(height * env.canvasScale)
  };
}

function spyInNodeCenter(atPoint, options = {}, size = {}, env) {
  const offset = { x: 0, y: 0 };
  const direction = spyPlacementDirection(options);
  const distance = spyPlacementDistance(options, env);
  if (direction.includes("left")) offset.x -= (Number(size.width) || 0) / 2 + distance.x;
  if (direction.includes("right")) offset.x += (Number(size.width) || 0) / 2 + distance.x;
  if (direction.includes("below")) offset.y -= (Number(size.height) || 0) / 2 + distance.y;
  if (direction.includes("above")) offset.y += (Number(size.height) || 0) / 2 + distance.y;
  return roundPoint({ x: atPoint.x + offset.x, y: atPoint.y + offset.y });
}

function spyPlacementDirection(options = {}) {
  return Object.keys(options)
    .filter((key) => options[key] === true || options[key] === "")
    .join(" ")
    .toLowerCase();
}

function spyPlacementDistance(options = {}, env) {
  let x = 0;
  let y = 0;
  for (const [key, value] of Object.entries(options || {})) {
    const lower = key.toLowerCase();
    if (!/(?:left|right|above|below)/.test(lower)) continue;
    if (value === true || value === "") continue;
    const parsed = parseDimension(value, env.variables);
    if (!Number.isFinite(parsed)) continue;
    if (lower.includes("left") || lower.includes("right")) x = parsed;
    if (lower.includes("above") || lower.includes("below")) y = parsed;
  }
  return { x, y };
}

function spyPathStyle(options = {}, env) {
  return scaleCanvasStyle(normalizeOptions("draw", options, env).style, env);
}

function spyOutlineItem(subtype, center, size, shape, style, env) {
  if (shape === "circle" || shape === "circleCrossSplit") {
    const r = roundNumber(Math.max(size.width, size.height) / 2);
    return {
      type: "path",
      subtype,
      shape: "circle",
      cx: center.x,
      cy: center.y,
      r,
      style,
      commands: circleCommands(center, r, env)
    };
  }
  const width = Number(size.width) || 0;
  const height = Number(size.height) || 0;
  return {
    type: "path",
    subtype,
    shape: "rectangle",
    x: roundNumber(center.x - width / 2),
    y: roundNumber(center.y - height / 2),
    width,
    height,
    style,
    commands: rectangleCommands(center, width, height)
  };
}

function rectangleCommands(center, width, height) {
  const left = center.x - width / 2;
  const right = center.x + width / 2;
  const bottom = center.y - height / 2;
  const top = center.y + height / 2;
  return [
    { type: "moveTo", x: roundNumber(left), y: roundNumber(bottom) },
    { type: "lineTo", x: roundNumber(right), y: roundNumber(bottom) },
    { type: "lineTo", x: roundNumber(right), y: roundNumber(top) },
    { type: "lineTo", x: roundNumber(left), y: roundNumber(top) },
    { type: "closePath" }
  ];
}

function spyMagnifiedPathItems(items, onPoint, inCenter, magnification, radius, shape) {
  const magnified = [];
  for (const item of items) {
    if (item.type !== "path" || !Array.isArray(item.commands) || item.subtype?.startsWith?.("spy-")) continue;
    const points = flattenPath(item.commands, 0.035);
    for (let index = 1; index < points.length; index += 1) {
      const from = spyTransformPoint(points[index - 1], onPoint, inCenter, magnification);
      const to = spyTransformPoint(points[index], onPoint, inCenter, magnification);
      const clipped = shape === "circle" || shape === "circleCrossSplit" ? clipSegmentToCircle(from, to, inCenter, radius) : { from, to };
      if (!clipped) continue;
      magnified.push({
        type: "path",
        subtype: "spy-magnified",
        style: spyMagnifiedStyle(item.style || {}, magnification),
        commands: [
          { type: "moveTo", x: clipped.from.x, y: clipped.from.y },
          { type: "lineTo", x: clipped.to.x, y: clipped.to.y }
        ]
      });
    }
  }
  return magnified;
}

function spyTransformPoint(point, onPoint, inCenter, magnification) {
  return roundPoint({
    x: inCenter.x + (point.x - onPoint.x) * magnification,
    y: inCenter.y + (point.y - onPoint.y) * magnification
  });
}

function spyMagnifiedStyle(style, magnification) {
  const scaled = { ...style };
  if (Number.isFinite(Number(scaled.lineWidth))) scaled.lineWidth = roundNumber(Number(scaled.lineWidth) * magnification);
  delete scaled.markerStart;
  delete scaled.markerEnd;
  return scaled;
}

function clipSegmentToCircle(from, to, center, radius) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const fx = from.x - center.x;
  const fy = from.y - center.y;
  const a = dx * dx + dy * dy;
  if (a < 1e-12) return pointInsideCircle(from, center, radius) ? { from: roundPoint(from), to: roundPoint(to) } : null;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  const discriminant = b * b - 4 * a * c;
  const values = [0, 1];
  if (discriminant >= -1e-12) {
    const root = Math.sqrt(Math.max(0, discriminant));
    values.push((-b - root) / (2 * a), (-b + root) / (2 * a));
  }
  const sorted = values
    .filter((value) => value >= -1e-9 && value <= 1 + 1e-9)
    .map((value) => Math.max(0, Math.min(1, value)))
    .sort((aValue, bValue) => aValue - bValue);
  for (let index = 1; index < sorted.length; index += 1) {
    const start = sorted[index - 1];
    const end = sorted[index];
    if (end - start < 1e-9) continue;
    const mid = (start + end) / 2;
    const midPoint = { x: from.x + dx * mid, y: from.y + dy * mid };
    if (!pointInsideCircle(midPoint, center, radius)) continue;
    return {
      from: roundPoint({ x: from.x + dx * start, y: from.y + dy * start }),
      to: roundPoint({ x: from.x + dx * end, y: from.y + dy * end })
    };
  }
  return null;
}

function pointInsideCircle(point, center, radius) {
  return Math.hypot(point.x - center.x, point.y - center.y) <= radius + 1e-9;
}

function applyNoopSideEffects(statement, env) {
  const raw = String(statement.raw || "").trim();
  const ctikz = raw.match(/^\\ctikzset\s*\{([\s\S]*)\}\s*$/);
  if (ctikz) {
    env.circuitikz = {
      ...(env.circuitikz || {}),
      ...normalizeCtikzSetOptions(parseOptions(ctikz[1]))
    };
    return;
  }
  const toggle = raw.match(/^\\toggle(true|false)\s*\{([^{}]+)\}/);
  if (!toggle) return;
  env.toggles ||= {};
  env.toggles[toggle[2].trim()] = toggle[1] === "true";
}

function pgfFormOnlyPatternDefinition(statement, env = {}) {
  const name = String(statement.name || "").trim();
  const lowerLeft = pgfPatternPoint(statement.lowerLeft, env);
  const upperRight = pgfPatternPoint(statement.upperRight, env);
  const tileSize = pgfPatternPoint(statement.tileSize, env);
  if (!name || !lowerLeft || !upperRight || !tileSize || tileSize.x <= 0 || tileSize.y <= 0) return null;
  const lineWidthMatch = String(statement.body || "").match(/\\pgfsetlinewidth\s*\{([^{}]+)\}/);
  const drawing = pgfPatternDrawing(statement.body, env);
  return {
    name,
    lowerLeft,
    upperRight,
    tileSize,
    lineWidth: lineWidthMatch ? parseDimension(lineWidthMatch[1], env.variables || {}) : lineWidthFromPt(0.4),
    commands: drawing.commands,
    operations: drawing.operations
  };
}

function pgfPatternDrawing(body, env = {}) {
  const source = String(body || "");
  const commands = [];
  const operations = [];
  let pending = [];
  const commandPattern = /\\(pgfpathmoveto|pgfpathlineto|pgfpathcircle|pgfpathrectangle|pgfpathclose|pgfusepath)\b/g;
  let match;
  while ((match = commandPattern.exec(source))) {
    const kind = match[1];
    let cursor = commandPattern.lastIndex;
    if (kind === "pgfpathclose") {
      pending.push({ kind: "close" });
      commands.push({ kind: "close" });
      continue;
    }
    const first = extractBalanced(source, cursor, "{", "}");
    if (!first) continue;
    cursor = first.end;
    if (kind === "pgfusepath") {
      const actions = String(first.content || "").toLowerCase();
      if (pending.length) {
        operations.push({
          kind: "path",
          commands: pending,
          stroke: /(?:^|,)\s*stroke\b/.test(actions),
          fill: /(?:^|,)\s*fill\b/.test(actions)
        });
      }
      pending = [];
      commandPattern.lastIndex = cursor;
      continue;
    }
    if (kind === "pgfpathcircle") {
      const radius = extractBalanced(source, cursor, "{", "}");
      const center = pgfPatternPoint(first.content, env);
      if (center && radius) {
        const parsedRadius = parseDimension(radius.content, env.variables || {});
        if (Number.isFinite(parsedRadius) && parsedRadius >= 0) pending.push({ kind: "circle", ...center, radius: parsedRadius });
        cursor = radius.end;
      }
      commandPattern.lastIndex = cursor;
      continue;
    }
    if (kind === "pgfpathrectangle") {
      const size = extractBalanced(source, cursor, "{", "}");
      const origin = pgfPatternPoint(first.content, env);
      const dimensions = size ? pgfPatternPoint(size.content, env) : null;
      if (origin && dimensions) pending.push({ kind: "rectangle", ...origin, width: dimensions.x, height: dimensions.y });
      commandPattern.lastIndex = size?.end || cursor;
      continue;
    }
    const point = pgfPatternPoint(first.content, env);
    if (point) {
      const command = { kind: kind === "pgfpathmoveto" ? "move" : "line", ...point };
      pending.push(command);
      commands.push(command);
    }
    commandPattern.lastIndex = cursor;
  }
  // PGF path declarations normally terminate in \pgfusepath. Keep a
  // conservative stroke fallback so partial declarations remain visible.
  if (pending.length) operations.push({ kind: "path", commands: pending, stroke: true, fill: false });
  return { commands, operations };
}

function pgfPatternPoint(value, env = {}) {
  const text = String(value || "").trim();
  if (text === "\\pgfpointorigin") return { x: 0, y: 0 };
  const match = text.match(/^\\pgf(?:q)?point\s*\{([^{}]+)\}\s*\{([^{}]+)\}$/);
  if (!match) return null;
  return {
    x: parseDimension(match[1], env.variables || {}),
    y: parseDimension(match[2], env.variables || {})
  };
}

function applyFontSwitch(font, env) {
  const next = String(font || "").trim();
  if (!next) return;
  const current = String(env.pictureOptions?.font || "").trim();
  env.pictureOptions = {
    ...(env.pictureOptions || {}),
    font: [current, next].filter(Boolean).join(" ")
  };
}

function applyColorDeclaration(color, env) {
  const next = String(color || "").trim();
  if (!next) return;
  env.pictureOptions = {
    ...(env.pictureOptions || {}),
    color: next
  };
}

function normalizeCtikzSetOptions(rawOptions = {}) {
  const normalized = {};
  let directory = "";
  for (const [key, value] of Object.entries(rawOptions || {})) {
    const originalKey = String(key).trim();
    const normalizedValue = value === true ? true : stripOuterBraces(String(value));
    if (/^(?:circuitikz\/)?[^/]+(?:\s+[^/]+)*\/\.cd$/i.test(originalKey)) {
      directory = originalKey.replace(/^(?:circuitikz\/)?/, "").replace(/\/\.cd$/i, "").trim();
      continue;
    }
    const normalizedKey = directory && !originalKey.includes("/") ? `${directory}/${originalKey}` : originalKey;
    const lowerKey = normalizedKey.toLowerCase();
    const lowerValue = String(normalizedValue).trim().toLowerCase();
    if (lowerKey === "quadpoles style" && lowerValue === "inline") {
      Object.assign(normalized, {
        "quadpoles/transformer/inner": "1",
        "quadpoles/transformer/width": "0.6",
        "quadpoles/transformer core/inner": "1",
        "quadpoles/transformer core/width": "0.6",
        "quadpoles/gyrator/inner": "1",
        "quadpoles/gyrator/width": "0.6"
      });
    }
    if (lowerKey === "cute inductors" || lowerKey === "cute") normalized["inductors/kind"] = "cute";
    if (lowerKey === "american inductors" || lowerKey === "american") normalized["inductors/kind"] = "american";
    if (lowerKey === "european inductors" || lowerKey === "european") normalized["inductors/kind"] = "european";
    if (lowerKey === "resistors/width") normalized["bipoles/resistor/width"] = normalizedValue;
    if (lowerKey === "diode straight whiskers") normalized["diodes/whiskers"] = "straight";
    if (lowerKey === "diode sloped whiskers") normalized["diodes/whiskers"] = "sloped";
    if (lowerKey === "led arrows from cathode") normalized["diodes/led-arrows"] = "cathode";
    if (lowerKey === "led arrows from anode") normalized["diodes/led-arrows"] = "anode";
    if (lowerKey === "pd arrows to cathode") normalized["diodes/pd-arrows"] = "cathode";
    if (lowerKey === "pd arrows to anode") normalized["diodes/pd-arrows"] = "anode";
    const styleMatch = normalizedKey.match(/^(?:circuitikz\/)?transformer\s+(L[12])\/\.style$/i);
    if (styleMatch) {
      const coil = styleMatch[1].toUpperCase();
      normalized[`transformer ${coil}`] = parseCtikzStyleValue(normalizedValue);
    }
    normalized[normalizedKey] = normalizedValue;
  }
  return normalized;
}

function picDefinitionsFromOptions(rawOptions = {}) {
  const pics = {};
  for (const [key, value] of Object.entries(rawOptions || {})) {
    const match = String(key).match(/^(.+?)\/\.pic$/);
    if (match) pics[match[1].trim()] = String(value === true ? "" : value).trim();
  }
  return pics;
}

// Claude: 读取节点自身的 rotate 选项（如 \node[rotate=90]{...}），转成角度。
// 用于把文字竖排/斜排，见 case 047 的 self-awareness / immunisation 标签。
function nodeRotation(options = {}, env) {
  const raw = options.rotate;
  const angle = raw === undefined || raw === true || raw === ""
    ? 0
    : evaluateMath(raw, env.variables);
  const localRotation = Number.isFinite(angle) ? angle : 0;
  if (!tikzBoolean(options["transform shape"])) return localRotation;
  const transform = normalizeTransform(env.transform);
  const externalRotation = (Math.atan2(transform.b, transform.a) * 180) / Math.PI;
  return roundNumber(localRotation + externalRotation);
}

function resolveFitNodeLayout(options = {}, env = {}, nodeEnv = env) {
  if (!options.fit) return null;
  const references = fitNodeReferences(options.fit);
  if (!references.length) return null;
  let bounds = null;
  for (const ref of references) {
    const itemBounds = fitReferenceBounds(ref, env);
    if (!itemBounds) continue;
    bounds = bounds
      ? {
          minX: Math.min(bounds.minX, itemBounds.minX),
          maxX: Math.max(bounds.maxX, itemBounds.maxX),
          minY: Math.min(bounds.minY, itemBounds.minY),
          maxY: Math.max(bounds.maxY, itemBounds.maxY)
        }
      : itemBounds;
  }
  if (!bounds) return null;
  const xSep = Math.max(
    0,
    parseNodeLengthDimension(options["inner xsep"] ?? options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, nodeEnv)
  );
  const ySep = Math.max(
    0,
    parseNodeLengthDimension(options["inner ysep"] ?? options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, nodeEnv)
  );
  const scale = canvasLengthScale(nodeEnv);
  let width = Math.max(0, bounds.maxX - bounds.minX + xSep * 2);
  let height = Math.max(0, bounds.maxY - bounds.minY + ySep * 2);
  // TikZ's fit library sets a node's text box from the collected bounds, but
  // the normal node sizing pass still honours explicit minimum dimensions.
  // This matters for empty fit overlays that deliberately preserve a matrix
  // cell-sized highlight region.
  const minimumWidth = parseNodeLengthDimension(options["minimum width"], nodeEnv);
  const minimumHeight = parseNodeLengthDimension(options["minimum height"], nodeEnv);
  const minimumSize = parseNodeLengthDimension(options["minimum size"], nodeEnv);
  if (Number.isFinite(minimumWidth)) width = Math.max(width, minimumWidth);
  if (Number.isFinite(minimumHeight)) height = Math.max(height, minimumHeight);
  if (Number.isFinite(minimumSize)) {
    width = Math.max(width, minimumSize);
    height = Math.max(height, minimumSize);
  }
  const shape = nodeShape(options);
  if (shape === "ellipse") {
    width *= Math.SQRT2;
    height *= Math.SQRT2;
  } else if (shape === "circle") {
    const diameter = 2 * Math.hypot(width / 2, height / 2);
    width = diameter;
    height = diameter;
  }
  return {
    point: roundPoint({
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2
    }),
    rawSize: {
      width: roundNumber(width / scale),
      height: roundNumber(height / scale)
    }
  };
}

function fitNodeReferences(value) {
  const refs = [];
  for (const match of String(value || "").matchAll(/\(([^()]+)\)/g)) {
    const ref = match[1].trim();
    if (ref) refs.push(ref);
  }
  return refs;
}

function fitReferenceBounds(ref, env = {}) {
  const clean = stripOuterBraces(String(ref || "").trim());
  const name = clean.replace(/\.[^.]+$/, "");
  const node = env.nodes?.[name];
  if (node?.point) {
    const width = Number(node.layoutWidth ?? node.width) || 0;
    const height = Number(node.layoutHeight ?? node.height) || 0;
    return {
      minX: node.point.x - width / 2,
      maxX: node.point.x + width / 2,
      minY: node.point.y - height / 2,
      maxY: node.point.y + height / 2
    };
  }
  const point = env.coordinates?.[name];
  if (point) {
    return { minX: point.x, maxX: point.x, minY: point.y, maxY: point.y };
  }
  return null;
}

function addNodeItems(node, ir, env) {
  const firstItemIndex = ir.items.length;
  const nodeEnv = Number.isFinite(Number(node.canvasScale)) && Number(node.canvasScale) > 0
    ? { ...env, canvasScale: Number(node.canvasScale) }
    : nodeCanvasEnv(env, node.options || {});
  const { style: rawStyle, semantic, options: normalizedNodeOptions } = normalizeOptions("node", node.options || {}, nodeEnv);
  const overlay = tikzBoolean(node.options?.overlay ?? semantic.overlay);
  const scaledStyle = scaleCanvasStyle(rawStyle, nodeEnv);
  const patternDefinition = scaledStyle.pattern ? nodeEnv.patterns?.[scaledStyle.pattern] : null;
  const style = patternDefinition ? { ...scaledStyle, patternDefinition } : scaledStyle;
  const rotation = node.rotation ?? nodeRotation(node.options || {}, nodeEnv);
  const point = node.displayPoint || resolveNodeAnchorPoint(node.at, node.options, node.text, nodeEnv, node.size);
  const shape = nodeShape(node.options || {});
  const shapeData = {
    ...nodeShapeData(node.options || {}, nodeEnv, node.text),
    rectangleSplit: node.rectangleSplit || null,
    circleSplit: node.circleSplit || null,
    ...(node.shapeData || {})
  };
  const size = node.size || scaleSize(estimateNodeLayoutSize(node.text, node.options, nodeEnv), nodeEnv.canvasScale);
  // shapes.misc foreground paths use inherited rectangle anchors, which include outer sep.
  const foregroundOuterSep = shape === "crossOut" || shape === "strikeOut"
    ? scaleNodeOuterSep(nodeOuterSep(node.options || {}, nodeEnv), nodeEnv)
    : undefined;
  const shadingStyle = pathShadingStyle(style, semantic, nodeEnv);
  const shadedFill = shadingStyle.fill || null;
  const textStyle = {
    ...style,
    fill: style.textFill || semantic.text || "black",
    fontScale: roundNumber(nodeEnv.canvasScale * (node.textFontScale || nodeFontScale(node.options || {}, nodeEnv))),
    fontSizeBaseScale: roundNumber(nodeEnv.canvasScale * nodeOptionScale(node.options || {}, nodeEnv)),
    exactMathFontScale: Boolean(semantic["axis legend"]),
    textWidthScale: numberOption(node.options?.["tikzkit text width scale"], 1),
    textWidthScaleExplicit: node.options?.["tikzkit text width scale"] !== undefined,
    fontFamily: resolveFontFamily(node.text) || resolveInheritedFontFamily(node.options?.font, nodeEnv.pictureOptions?.font),
    fontVariant: resolveInheritedFontVariant(node.options?.font, nodeEnv.pictureOptions?.font),
    fontWeight: resolveInheritedFontWeight(node.options?.font, nodeEnv.pictureOptions?.font)
  };
  let textFont = resolvedTextFontSpec(
    node.text,
    node.options || {},
    nodeEnv,
    nodeEnv.canvasScale * nodeOptionScale(node.options || {}, nodeEnv)
  );
  textStyle.fontFamily =
    computerModernOpticalTextFamily(node.text, textFont, textStyle.fontFamily) || textStyle.fontFamily;
  if (shape === "opAmp") {
    textStyle.fontScale = roundNumber((Number(textStyle.fontScale) || 1) * 0.75);
    textStyle.fontSizeBaseScale = roundNumber((Number(textStyle.fontSizeBaseScale) || 1) * 0.75);
    textFont = scaleResolvedFontSpec(textFont, 0.75);
  }
  const textPoint = shape === "opAmp"
    ? roundPoint({ x: point.x - size.width * 0.08, y: point.y - size.height * 0.02 })
    : shape === "circuitikzTransistor" || shape === "circuitikzMosfet"
      ? circuitikzTransistorTextPoint(point, size, shapeData)
      : point;
  if (node.options?.["tikzkit layout bbox"]) {
    ir.items.push(
      nodeLayoutBoundingBoxItem(
        point,
        size,
        rotation,
        Boolean(node.options?.overlay),
        nodeLayoutBoundingBoxPadding(node.options, nodeEnv)
      )
    );
  }
  if (shape === "ground") {
    ir.items.push(circuitikzGroundItem(point, style, nodeEnv));
    applyNodeOverlay(ir, firstItemIndex, overlay);
    applyCanvasTransformBounds(ir, firstItemIndex, nodeEnv.canvasTrackingDisabled);
    return;
  }
  if (shape === "opAmp") {
    ir.items.push({
      type: "nodeBox",
      id: node.name,
      subtype: "circuitikz-op-amp",
      shape,
      shapeData,
      x: point.x,
      y: point.y,
      width: size.width,
      height: size.height,
      style: circuitikzOpAmpNodeStyle(style, nodeEnv)
    });
  } else if (shape === "circuitikzMosfet") {
    ir.items.push({
      type: "nodeBox",
      id: node.name,
      subtype: "circuitikz-mosfet",
      shape,
      shapeData,
      x: point.x,
      y: point.y,
      width: size.width,
      height: size.height,
      style: circuitikzTransistorNodeStyle(style, nodeEnv)
    });
  } else if (shape === "circuitikzTransistor") {
    ir.items.push({
      type: "nodeBox",
      id: node.name,
      subtype: "circuitikz-transistor",
      shape,
      shapeData,
      x: point.x,
      y: point.y,
      width: size.width,
      height: size.height,
      style: circuitikzTransistorNodeStyle(style, nodeEnv)
    });
  } else if (shape === "circuitikzTriode") {
    ir.items.push({
      type: "nodeBox",
      id: node.name,
      subtype: "circuitikz-triode",
      shape,
      shapeData,
      x: point.x,
      y: point.y,
      width: size.width,
      height: size.height,
      style: circuitikzTransistorNodeStyle(style, nodeEnv)
    });
  } else if (shape === "circuitikzPentode" || shape === "circuitikzTetrode" || shape === "circuitikzDiodeTube") {
    const tubeKind = shapeData.tubeKind || (shape === "circuitikzPentode" ? "pentode" : shape === "circuitikzTetrode" ? "tetrode" : "diodetube");
    ir.items.push({
      type: "nodeBox",
      id: node.name,
      subtype: `circuitikz-${tubeKind}`,
      shape,
      shapeData: {
        ...shapeData,
        tubeKind,
        partialBorders: circuitikzTubePartialBorders(node.options || {}, nodeEnv)
      },
      x: point.x,
      y: point.y,
      width: size.width,
      height: size.height,
      style: circuitikzTubeNodeStyle(style, node.options || {}, nodeEnv)
    });
  } else if (shape === "circuitikzQuadpole") {
    const quadpoleKind = shapeData.quadpoleKind || "transformer";
    ir.items.push({
      type: "nodeBox",
      id: node.name,
      subtype: `circuitikz-quadpole-${quadpoleKind.replace(/\s+/g, "-")}`,
      shape,
      shapeData: {
        ...shapeData,
        quadpoleKind
      },
      x: point.x,
      y: point.y,
      width: size.width,
      height: size.height,
      style: circuitikzTransistorNodeStyle(
        circuitikzInlinePathNodeStyle(style, node.inlinePathStyle, node.options),
        nodeEnv
      )
    });
  } else if (style.fill !== "none" || style.stroke !== "none" || semantic.draw || shadedFill) {
    ir.items.push({
      type: "nodeBox",
      id: node.name,
      subtype: semanticSubtype({ ...node.options, ...semantic }),
      shape,
      shapeData,
      x: point.x,
      y: point.y,
      width: size.width,
      height: size.height,
      // Rectangle-like node renderers inset the geometry by half the stroke,
      // but SVG ellipses paint their stroke outside the supplied radii. Keep
      // that outer half-stroke in the scene bounds for circles and ellipses.
      strokeBoundsIncluded: shape !== "circle" && shape !== "ellipse",
      foregroundOuterSep,
      rx: nodeCornerRadius(shape, semantic, size, nodeEnv),
      pathPicture: semantic["path picture"],
      appendAfterCommand: semantic["append after command"],
      bpmnIcon: semantic["bpmn icon"],
      bpmnMarker: semantic["bpmn marker"],
      tikzquadsKind: semantic["tikzquads kind"],
      tikzquadsOptions: tikzquadsNodeOptions(semantic),
      doubleColor: semantic.double === undefined ? undefined : semantic.double || "white",
      shadows: nodeGeneralShadows({ ...node.options, ...semantic }, nodeEnv, style),
      parts: shape === "rectangleSplit" ? node.rectangleSplit?.count || rectangleSplitParts(semantic) : undefined,
      rectangleSplitHorizontal: shape === "rectangleSplit" ? node.rectangleSplit?.horizontal : undefined,
      rectangleSplitDrawSplits:
        shape === "rectangleSplit"
          ? semantic["rectangle split draw splits"] === undefined
            ? true
            : tikzBoolean(semantic["rectangle split draw splits"])
          : undefined,
      rectangleSplitUsesCustomFill:
        shape === "rectangleSplit"
          ? rectangleSplitUsesCustomFill(semantic)
          : undefined,
      partWidths: shape === "rectangleSplit" ? node.rectangleSplit?.partWidths : undefined,
      partHeights: shape === "rectangleSplit" ? node.rectangleSplit?.partHeights : undefined,
      separatorWidth: shape === "rectangleSplit" ? node.rectangleSplit?.separatorWidth : undefined,
      partFills:
        shape === "rectangleSplit" && rectangleSplitUsesCustomFill(semantic)
          ? rectangleSplitPartFills(semantic, node.rectangleSplit || rectangleSplitParts(semantic))
          : undefined,
      rotation: rotation || undefined,
      style: {
        stroke: semantic.draw || style.stroke !== "none" ? style.stroke || "black" : "none",
        fill: shadedFill || style.fill,
        lineWidth: style.lineWidth || 1,
        dashArray: style.dashArray,
        opacity: style.opacity,
        fillOpacity: style.fillOpacity,
        strokeOpacity: style.strokeOpacity,
        pattern: style.pattern,
        patternColor: style.patternColor,
        patternDefinition: style.patternDefinition,
        pathFading: style.pathFading,
        shading: shadingStyle.shading,
        ballColor: shadingStyle.ballColor,
        topColor: shadingStyle.topColor,
        middleColor: shadingStyle.middleColor,
        bottomColor: shadingStyle.bottomColor,
        shadingAngle: shadingStyle.shadingAngle,
        shadingName: shadingStyle.shadingName,
        radialStops: shadingStyle.radialStops
      }
    });
  }
  if (shape === "rectangleSplit" && node.rectangleSplit) {
    addRectangleSplitTextItems(node, textPoint, size, rotation, textStyle, nodeEnv, ir);
  } else if (shape === "circleSplit" && node.circleSplit) {
    addCircleSplitTextItems(node, textPoint, size, rotation, textStyle, nodeEnv, ir);
  } else {
    const svgTextAnchor = svgTextAnchorForNode(node.options || {}, semantic);
    const hasExplicitLayoutBounds = Boolean(node.options?.["tikzkit layout bbox"]);
    const skipsImplicitLayoutBounds = Boolean(node.options?.["tikzkit skip implicit node bbox"]);
    ir.items.push({
      type: "textNode",
      x: textPoint.x,
      y: textPoint.y,
      text: node.text,
      font: textFont,
      style: textStyle,
      rotation: rotation || undefined,
      textAlign: normalizedNodeTextAlign(normalizedNodeOptions.align, semantic),
      textWrapMode: nodeTextWrapMode(normalizedNodeOptions, semantic),
      textWrapHyphenation: isConceptNodeOptions(node.options || {}) ? false : undefined,
      svgTextAnchor,
      svgTextX: svgTextAnchor ? (node.at || textPoint).x : undefined,
      wrapWidth: node.options?.["text width"] ? parseDimension(node.options["text width"], nodeEnv.variables) : undefined,
      fitBox: node.fitTextToBox ? { width: size.width, height: size.height } : undefined,
      nodeLayoutWidth: hasExplicitLayoutBounds || skipsImplicitLayoutBounds ? undefined : size.width,
      nodeLayoutHeight: hasExplicitLayoutBounds || skipsImplicitLayoutBounds ? undefined : size.height
    });
  }
  for (const label of nodeLabels(node.options || {}, point, size, nodeEnv, textStyle)) {
    ir.items.push(label);
  }
  for (const pinItem of nodePins(node.options || {}, point, size, nodeEnv, textStyle)) {
    ir.items.push(pinItem);
  }
  addAutomataInitialArrow(node, point, semantic, style, textStyle, textFont, nodeEnv, ir);
  addAutomataAcceptingArrow(node, point, semantic, style, textStyle, textFont, nodeEnv, ir);
  applyNodeOverlay(ir, firstItemIndex, overlay);
  applyCanvasTransformBounds(ir, firstItemIndex, nodeEnv.canvasTrackingDisabled);
}

function addAutomataInitialArrow(node, point, semantic, nodeStyle, textStyle, textFont, env, ir) {
  if (!tikzBoolean(semantic["tikzkit automata initial"]) || !node.name) return;
  const stateNode = env.nodes?.[node.name];
  if (!stateNode) return;

  const rawAngle = Number(semantic["tikzkit automata initial angle"]);
  const angle = Number.isFinite(rawAngle) ? rawAngle : 180;
  const radians = (angle * Math.PI) / 180;
  const direction = { x: Math.cos(radians), y: Math.sin(radians) };
  const border = nodeBorderPoint(stateNode, point, {
    x: point.x + direction.x,
    y: point.y + direction.y
  }, env);
  const distance = parseFiniteDimension(
    semantic["initial distance"],
    env,
    parseDimension("3ex", env.variables || {})
  );
  const start = roundPoint({
    x: border.x + direction.x * distance,
    y: border.y + direction.y * distance
  });
  // PGF builds this post-node path as `[->,double=none,every initial by arrow]`.
  // It is deliberately independent from the state node's border style.
  const arrowOptions = {
    "->": true,
    double: "none",
    "every initial by arrow": true
  };
  if (env.pictureOptions?.[">"] !== undefined) arrowOptions[">"] = env.pictureOptions[">"];
  const { style: initialStyle } = normalizeOptions("draw", arrowOptions, env);
  const stroke = initialStyle.stroke || "black";
  const lineWidth = initialStyle.lineWidth || lineWidthFromPt(0.4);
  ir.items.push(createPathShape(
    [moveToCommand(start), lineToCommand(border)],
    {
      stroke,
      fill: "none",
      lineWidth,
      lineCap: initialStyle.lineCap,
      lineJoin: initialStyle.lineJoin,
      dashArray: initialStyle.dashArray,
      dashLineCap: initialStyle.dashLineCap,
      opacity: initialStyle.opacity,
      strokeOpacity: initialStyle.strokeOpacity,
      markerEnd: initialStyle.markerEnd || createArrowTip("to", { fill: stroke, stroke })
    },
    { subtype: "automata-initial" }
  ));
  addAutomataInitialText(start, angle, semantic, initialStyle, textStyle, textFont, env, ir);
}

function addAutomataInitialText(start, angle, semantic, initialStyle, textStyle, textFont, env, ir) {
  const rawText = semantic["initial text"] === undefined ? "start" : stripOuterBraces(String(semantic["initial text"]));
  const text = String(rawText || "").trim();
  if (!text) return;
  const normalizedAngle = ((angle % 360) + 360) % 360;
  const anchor = normalizedAngle === 0 ? "start" : normalizedAngle === 180 ? "end" : "middle";
  const side = normalizedAngle === 90 ? 1 : normalizedAngle === 270 ? -1 : 0;
  const fontSizePt = Number(textFont?.sizePt) || 10;
  const labelBox = measurePlainTextTeXBoxPt(text, {
    fontSizePt,
    fontFamily: textStyle.fontFamily
  });
  const verticalOffset = side * ((Number(labelBox?.height) || 0) + (Number(labelBox?.depth) || 0)) / (2 * TEX_PT_PER_CM);
  ir.items.push({
    type: "textNode",
    subtype: "automata-initial-text",
    x: start.x,
    y: roundNumber(start.y + verticalOffset),
    text,
    font: textFont,
    style: {
      ...textStyle,
      fill: initialStyle.textFill || textStyle.fill || "black"
    },
    svgTextAnchor: anchor,
    svgTextX: start.x,
    "tikzkit automata initial angle": normalizedAngle
  });
}

function addAutomataAcceptingArrow(node, point, semantic, nodeStyle, textStyle, textFont, env, ir) {
  if (!tikzBoolean(semantic["tikzkit automata accepting"]) || !node.name) return;
  const stateNode = env.nodes?.[node.name];
  if (!stateNode) return;

  const rawAngle = Number(semantic["tikzkit automata accepting angle"]);
  const angle = Number.isFinite(rawAngle) ? rawAngle : 0;
  const radians = (angle * Math.PI) / 180;
  const direction = { x: Math.cos(radians), y: Math.sin(radians) };
  const border = nodeBorderPoint(stateNode, point, {
    x: point.x + direction.x,
    y: point.y + direction.y
  }, env);
  const distance = parseFiniteDimension(
    semantic["accepting distance"],
    env,
    parseDimension("3ex", env.variables || {})
  );
  const end = roundPoint({
    x: border.x + direction.x * distance,
    y: border.y + direction.y * distance
  });
  // PGF uses the same path-local hook for an accepting arrow, after its
  // default arrow and double-line reset have been installed.
  const arrowOptions = {
    "->": true,
    double: "none",
    "every accepting by arrow": true
  };
  if (env.pictureOptions?.[">"] !== undefined) arrowOptions[">"] = env.pictureOptions[">"];
  const { style: acceptingStyle } = normalizeOptions("draw", arrowOptions, env);
  const stroke = acceptingStyle.stroke || "black";
  const lineWidth = acceptingStyle.lineWidth || lineWidthFromPt(0.4);
  ir.items.push(createPathShape(
    [moveToCommand(border), lineToCommand(end)],
    {
      stroke,
      fill: "none",
      lineWidth,
      lineCap: acceptingStyle.lineCap,
      lineJoin: acceptingStyle.lineJoin,
      dashArray: acceptingStyle.dashArray,
      dashLineCap: acceptingStyle.dashLineCap,
      opacity: acceptingStyle.opacity,
      strokeOpacity: acceptingStyle.strokeOpacity,
      markerEnd: acceptingStyle.markerEnd || createArrowTip("to", { fill: stroke, stroke })
    },
    { subtype: "automata-accepting", nodeId: node.name }
  ));
  addAutomataAcceptingText(end, angle, semantic, acceptingStyle, textStyle, textFont, env, ir);
}

function addAutomataAcceptingText(end, angle, semantic, acceptingStyle, textStyle, textFont, env, ir) {
  const rawText = semantic["accepting text"] === undefined ? "" : stripOuterBraces(String(semantic["accepting text"]));
  const text = String(rawText || "").trim();
  if (!text) return;
  const normalizedAngle = ((angle % 360) + 360) % 360;
  const anchor = normalizedAngle === 0 ? "start" : normalizedAngle === 180 ? "end" : "middle";
  const side = normalizedAngle === 90 ? 1 : normalizedAngle === 270 ? -1 : 0;
  const fontSizePt = Number(textFont?.sizePt) || 10;
  const labelBox = measurePlainTextTeXBoxPt(text, {
    fontSizePt,
    fontFamily: textStyle.fontFamily
  });
  const verticalOffset = side * ((Number(labelBox?.height) || 0) + (Number(labelBox?.depth) || 0)) / (2 * TEX_PT_PER_CM);
  ir.items.push({
    type: "textNode",
    subtype: "automata-accepting-text",
    x: end.x,
    y: roundNumber(end.y + verticalOffset),
    text,
    font: textFont,
    style: {
      ...textStyle,
      fill: acceptingStyle.textFill || textStyle.fill || "black"
    },
    svgTextAnchor: anchor,
    svgTextX: end.x,
    "tikzkit automata accepting angle": normalizedAngle
  });
}

function computerModernOpticalTextFamily(text, font = {}, currentFamily = "") {
  if (/\$/.test(String(text || ""))) return undefined;
  if (font.family !== "serif" || font.style !== "normal") return undefined;
  if (currentFamily && !/TikZKitCMUSerif|CMU Serif/.test(String(currentFamily))) return undefined;
  const sizePt = Number(font.sizePt);
  if (!Number.isFinite(sizePt) || sizePt <= 0) return undefined;
  if (Number(font.weight) === 700) {
    const designSize = computerModernBoldDesignSize(sizePt);
    return `TikZKitCMBX${designSize}, TikZKitCMUSerif, serif`;
  }
  if (Number(font.weight) !== 400) return undefined;
  const designSize = computerModernRomanDesignSize(sizePt);
  return `TikZKitCMR${designSize}, TikZKitCMUSerif, serif`;
}

function computerModernRomanDesignSize(sizePt) {
  if (sizePt < 5.5) return 5;
  if (sizePt < 6.5) return 6;
  if (sizePt < 7.5) return 7;
  if (sizePt < 8.5) return 8;
  if (sizePt < 9.5) return 9;
  if (sizePt < 11) return 10;
  if (sizePt < 14.5) return 12;
  return 17;
}

function computerModernBoldDesignSize(sizePt) {
  if (sizePt < 5.5) return 5;
  if (sizePt < 6.5) return 6;
  if (sizePt < 7.5) return 7;
  if (sizePt < 8.5) return 8;
  if (sizePt < 9.5) return 9;
  if (sizePt < 11) return 10;
  return 12;
}

function applyNodeOverlay(ir, firstItemIndex, overlay) {
  if (!overlay) return;
  for (let index = firstItemIndex; index < ir.items.length; index += 1) {
    ir.items[index].overlay = true;
  }
}

function applyCanvasTransformBounds(ir, firstItemIndex, disabled) {
  if (!disabled) return;
  for (let index = firstItemIndex; index < ir.items.length; index += 1) {
    ir.items[index].excludeFromBounds = true;
  }
}

function addRectangleSplitTextItems(node, point, size, rotation, textStyle, env, ir) {
  const xScale = size.width / Math.max(node.rectangleSplit.size.width, 1e-9);
  const yScale = size.height / Math.max(node.rectangleSplit.size.height, 1e-9);
  for (const part of node.rectangleSplit.parts || []) {
    if (!part.text) continue;
    const local = rotateVector(part.centerX * xScale, (part.centerY || 0) * yScale, rotation || 0);
    ir.items.push({
      type: "textNode",
      x: roundNumber(point.x + local.x),
      y: roundNumber(point.y + local.y),
      text: part.text,
      font: resolvedTextFontSpec(part.text, node.options || {}, env, env.canvasScale * nodeOptionScale(node.options || {}, env)),
      style: textStyle,
      rotation: rotation || undefined,
      textAlign: "center",
      texBoxVerticalAlign: true
    });
  }
}

function addCircleSplitTextItems(node, point, size, rotation, textStyle, env, ir) {
  const layout = node.circleSplit;
  const scale = size.width / Math.max(layout.size.width, 1e-9);
  for (const part of layout.parts || []) {
    if (!part.text) continue;
    const local = rotateVector(0, part.centerY * scale, rotation || 0);
    ir.items.push({
      type: "textNode",
      x: roundNumber(point.x + local.x),
      y: roundNumber(point.y + local.y),
      text: part.text,
      font: resolvedTextFontSpec(part.text, node.options || {}, env, env.canvasScale * nodeOptionScale(node.options || {}, env)),
      style: textStyle,
      rotation: rotation || undefined,
      textAlign: "center",
      texBoxVerticalAlign: true
    });
  }
}

function nodeLayoutBoundingBoxItem(point, size, rotation = 0, overlay = false, padding = {}) {
  const halfWidth = Math.max(0, Number(size?.width) || 0) / 2;
  const halfHeight = Math.max(0, Number(size?.height) || 0) / 2;
  const left = Math.max(0, Number(padding.left) || 0);
  const right = Math.max(0, Number(padding.right) || 0);
  const top = Math.max(0, Number(padding.top) || 0);
  const bottom = Math.max(0, Number(padding.bottom) || 0);
  const radians = ((Number(rotation) || 0) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const corners = [
    { x: -halfWidth - left, y: -halfHeight - bottom },
    { x: halfWidth + right, y: -halfHeight - bottom },
    { x: halfWidth + right, y: halfHeight + top },
    { x: -halfWidth - left, y: halfHeight + top }
  ].map((corner) => roundPoint({
    x: point.x + corner.x * cos - corner.y * sin,
    y: point.y + corner.x * sin + corner.y * cos
  }));
  return {
    type: "bbox",
    subtype: "node-layout",
    overlay,
    commands: [
      { type: "moveTo", ...corners[0] },
      { type: "lineTo", ...corners[1] },
      { type: "lineTo", ...corners[2] },
      { type: "lineTo", ...corners[3] },
      { type: "closePath" }
    ]
  };
}

function nodeLayoutBoundingBoxPadding(options = {}, env = {}) {
  const commonX = layoutBoundingPaddingDimension(options["tikzkit layout bbox x padding"], env);
  const commonY = layoutBoundingPaddingDimension(options["tikzkit layout bbox y padding"], env);
  return {
    left: layoutBoundingPaddingDimension(options["tikzkit layout bbox left padding"], env, commonX),
    right: layoutBoundingPaddingDimension(options["tikzkit layout bbox right padding"], env, commonX),
    top: layoutBoundingPaddingDimension(options["tikzkit layout bbox top padding"], env, commonY),
    bottom: layoutBoundingPaddingDimension(options["tikzkit layout bbox bottom padding"], env, commonY)
  };
}

function layoutBoundingPaddingDimension(raw, env, fallback = 0) {
  if (raw === undefined || raw === null || raw === true || raw === false || String(raw).trim() === "") return fallback;
  const value = parseNodeLengthDimension(raw, env) * canvasLengthScale(env);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizedNodeTextAlign(value, semantic = {}) {
  const align = String(value || "").trim().toLowerCase();
  if (["left", "flush left", "ragged right", "raggedright"].includes(align)) return "left";
  if (["right", "flush right", "ragged left", "raggedleft"].includes(align)) return "right";
  if (["center", "centering", "centered"].includes(align)) return "center";
  if (tikzBoolean(semantic["text centered"]) || tikzBoolean(semantic["text badly centered"])) return "center";
  if (tikzBoolean(semantic["text ragged right"]) || tikzBoolean(semantic["text badly ragged right"])) return "left";
  if (tikzBoolean(semantic["text ragged left"]) || tikzBoolean(semantic["text badly ragged left"])) return "right";
  return undefined;
}

function nodeTextWrapMode(options = {}, semantic = {}) {
  if (tikzBoolean(semantic["text badly centered"])) return "flush";
  if (options["tikzkit minipage text width"]) return "flush";
  return normalizedNodeTextAlign(options.align, semantic) === "center" ? "center" : undefined;
}

function svgTextAnchorForNode(options = {}, semantic = {}) {
  if (!semantic["axis legend"]) return undefined;
  const anchor = String(options.anchor || "").trim().toLowerCase().replace(/-/g, " ");
  if (anchor.includes("west")) return "start";
  if (anchor.includes("east")) return "end";
  return undefined;
}

function pathGeneralShadows(semantic = {}, env, mainStyle = {}) {
  const shadows = [];
  if (semantic["general shadow"] !== undefined) {
    shadows.push(...optionValueList(semantic["general shadow"]).map((value) => parseGeneralShadow(value, env)).filter(Boolean));
  }
  if (semantic["drop shadow"] !== undefined) {
    shadows.push(...optionValueList(semantic["drop shadow"]).map((value) => parseDropShadow(value, env)).filter(Boolean));
  }
  if (semantic["circular drop shadow"] !== undefined) {
    shadows.push(...optionValueList(semantic["circular drop shadow"]).map((value) => parseCircularDropShadow(value, env)).filter(Boolean));
  }
  if (semantic["circular glow"] !== undefined) {
    shadows.push(...optionValueList(semantic["circular glow"]).map((value) => parseCircularGlow(value, env)).filter(Boolean));
  }
  if (semantic["copy shadow"] !== undefined) {
    shadows.push(...optionValueList(semantic["copy shadow"]).map((value) => parseCopyShadow(value, env, mainStyle)).filter(Boolean));
  }
  if (semantic["double copy shadow"] !== undefined) {
    shadows.push(...optionValueList(semantic["double copy shadow"]).flatMap((value) => parseDoubleCopyShadow(value, env, mainStyle)).filter(Boolean));
  }
  if (semantic["blur shadow"] !== undefined) {
    shadows.push(...optionValueList(semantic["blur shadow"]).map((value) => parseBlurShadow(value, env)).filter(Boolean));
  }
  return shadows.length ? shadows : undefined;
}

const nodeGeneralShadows = pathGeneralShadows;

function parseGeneralShadow(value, env) {
  const shadowOptions = parseOptions(String(value === true ? "" : value));
  return parseShadowFromOptions(shadowOptions, env);
}

function parseDropShadow(value, env) {
  const shadowOptions = orderedShadowOptions({
    "shadow scale": 1,
    "shadow xshift": ".5ex",
    "shadow yshift": "-.5ex",
    opacity: 0.5,
    fill: "black!50",
    // PGF's `drop shadow` style runs this hook after its defaults, while
    // the caller's option list still has the final word.
    "every shadow": true
  }, parseOptions(String(value === true ? "" : value)));
  return parseShadowFromOptions(shadowOptions, env);
}

function parseCircularDropShadow(value, env) {
  // `shadows` paints this as a normal preaction, with a radial path fading
  // applied to the scaled and shifted copy of the original geometry.
  return parseCircularFadingShadow(orderedShadowOptions({
    "shadow scale": 1.1,
    "shadow xshift": ".3ex",
    "shadow yshift": "-.3ex",
    fill: "black!50",
    "path fading": "circle with fuzzy edge 15 percent",
    "every shadow": true
  }, parseOptions(String(value === true ? "" : value))), env);
}

function parseCircularGlow(value, env) {
  return parseCircularFadingShadow(orderedShadowOptions({
    "shadow scale": 1.25,
    "shadow xshift": "0pt",
    "shadow yshift": "0pt",
    fill: "black!50",
    "path fading": "circle with fuzzy edge 15 percent",
    "every shadow": true
  }, parseOptions(String(value === true ? "" : value))), env);
}

function parseCircularFadingShadow(shadowOptions, env) {
  const shadow = parseShadowFromOptions(shadowOptions, env);
  if (!shadow) return null;
  return {
    ...shadow,
    style: {
      ...shadow.style,
      pathFading: shadow.style.pathFading || "circle with fuzzy edge 15 percent"
    }
  };
}

function parseCopyShadow(value, env, mainStyle = {}) {
  const shadowOptions = copyShadowOptions(value, mainStyle, { everyShadow: true });
  return parseShadowFromOptions(shadowOptions, env);
}

function parseDoubleCopyShadow(value, env, mainStyle = {}) {
  // The local `double copy shadow` source has two general-shadow preactions:
  // the farther copy first, then the ordinary copy closest to the foreground.
  // Unlike `copy shadow`, its implementation does not insert `every shadow`.
  const shadowOptions = copyShadowOptions(value, mainStyle, { everyShadow: false });
  const nearShadow = parseShadowFromOptions(shadowOptions, env);
  if (!nearShadow) return [];
  return [{
    ...nearShadow,
    xshift: roundNumber(nearShadow.xshift * 2),
    yshift: roundNumber(nearShadow.yshift * 2)
  }, nearShadow];
}

function copyShadowOptions(value, mainStyle = {}, { everyShadow = false } = {}) {
  const defaults = {
    "shadow scale": 1,
    "shadow xshift": ".5ex",
    "shadow yshift": ".5ex",
    fill: mainStyle.fill || "none",
    draw: mainStyle.stroke || "none"
  };
  if (everyShadow) defaults["every shadow"] = true;
  return orderedShadowOptions(defaults, parseOptions(String(value === true ? "" : value)));
}

function orderedShadowOptions(defaults, overrides) {
  const options = { ...defaults };
  for (const [key, value] of Object.entries(overrides || {})) {
    // TikZ keys are ordered. Deleting first lets the caller's duplicate key
    // stay after `every shadow`, rather than retaining its default position.
    delete options[key];
    options[key] = value;
  }
  return options;
}

function parseBlurShadow(value, env) {
  const shadowOptions = orderedShadowOptions({
    "shadow scale": 1,
    "shadow xshift": ".5ex",
    "shadow yshift": "-.5ex",
    "shadow blur radius": ".4ex",
    "shadow opacity": 40,
    "every shadow": true
  }, parseOptions(String(value === true ? "" : value)));
  const shadow = parseShadowFromOptions(shadowOptions, env, { blur: true });
  if (!shadow) return null;
  const { options } = normalizeOptions("node", shadowOptions, env);
  const opacity = shadowOpacity(options["shadow opacity"], 0.4, env);
  const fill = normalizeColor(options["shadow color"] || "black", env);
  const blurRadius = parseDimension(options["shadow blur radius"] || ".4ex", env.variables) * env.canvasScale;
  return {
    ...shadow,
    blur: true,
    blurRadius: Number.isFinite(blurRadius) && blurRadius > 0 ? roundNumber(blurRadius) : 0.06,
    style: {
      ...shadow.style,
      stroke: "none",
      fill,
      opacity
    }
  };
}

function parseShadowFromOptions(shadowOptions, env) {
  const { style: rawStyle, semantic, options } = normalizeOptions("node", shadowOptions, env);
  const xshift = parseDimension(options["shadow xshift"] || "0", env.variables) * env.canvasScale;
  const yshift = parseDimension(options["shadow yshift"] || "0", env.variables) * env.canvasScale;
  const scale = evaluateMath(options["shadow scale"] || 1, env.variables);
  const style = scaleCanvasStyle(rawStyle, env);
  if (!Number.isFinite(xshift) || !Number.isFinite(yshift)) return null;
  return {
    xshift: roundNumber(xshift),
    yshift: roundNumber(yshift),
    scale: Number.isFinite(scale) && scale > 0 ? scale : 1,
    style: {
      stroke: semantic.draw || style.stroke !== "none" ? style.stroke || "black" : "none",
      fill: style.fill,
      lineWidth: style.lineWidth || 1,
      dashArray: style.dashArray,
      opacity: style.opacity,
      fillOpacity: style.fillOpacity,
      strokeOpacity: style.strokeOpacity
    }
  };
}

function shadowOpacity(value, fallback, env) {
  const opacity = evaluateMath(value ?? fallback, env.variables);
  if (!Number.isFinite(opacity)) return fallback;
  if (opacity > 1) return Math.max(0, Math.min(1, opacity / 100));
  return Math.max(0, Math.min(1, opacity));
}

function nodeLabels(options = {}, point, size, env, textStyle = {}) {
  if (options.label === undefined || options.label === true || options.label === "") return [];
  const labels = [];
  for (const value of optionValueList(options.label)) {
    const label = parseNodeLabel(value);
    if (!label.text) continue;
    const { options: normalizedLabelOptions } = resolveLabelOptions(label, env, options);
    const sep = parseDimension(
      normalizedLabelOptions["label distance"] ?? options["label distance"] ?? "0pt",
      env.variables
    );
    const labelSize = labelPlacementSize(label, env, options);
    const labelLayoutSize = estimateNodeLayoutSize(label.text, normalizedLabelOptions, env);
    const labelPoint = labelPointForDirection(label.direction, point, size, sep, labelSize);
    labels.push({
      type: "textNode",
      x: labelPoint.x,
      y: labelPoint.y,
      text: label.text,
      font: labelFontSpec(label, env, options),
      style: labelTextStyle(label, env, textStyle, options),
      // A TikZ label is a real, unpainted node. Its inner sep participates
      // in the picture bbox even when the label has no border or fill.
      nodeLayoutWidth: labelLayoutSize.width,
      nodeLayoutHeight: labelLayoutSize.height
    });
  }
  return labels;
}

function nodePins(options = {}, point, size, env, textStyle = {}) {
  if (options.pin === undefined || options.pin === true || options.pin === "") return [];
  const items = [];
  for (const value of optionValueList(options.pin)) {
    const pin = parseNodeLabel(value);
    if (!pin.text) continue;
    const { options: normalizedPinOptions } = resolveLabelOptions(pin, env, options, "pin");
    const pinDistance = parseDimension(pin.options?.["pin distance"] ?? options["pin distance"] ?? "3ex", env.variables);
    const pinScale = nodeOptionScale(normalizedPinOptions, env);
    const sep = Number.isFinite(pinDistance) ? pinDistance * pinScale : parseDimension("3ex", env.variables) * pinScale;
    const labelSize = labelPlacementSize(pin, env, options, "pin");
    const labelLayoutSize = estimateNodeLayoutSize(pin.text, normalizedPinOptions, env);
    const labelPoint = labelPointForDirection(pin.direction, point, size, sep, labelSize);
    const edge = pinEdgePoints(pin.direction, point, size, labelPoint, labelSize);
    items.push({
      type: "path",
      subtype: "pin-edge",
      style: nodePinEdgeStyle(pin, env, options),
      commands: [
        { type: "moveTo", x: edge.from.x, y: edge.from.y },
        { type: "lineTo", x: edge.to.x, y: edge.to.y }
      ]
    });
    items.push({
      type: "textNode",
      x: labelPoint.x,
      y: labelPoint.y,
      text: pin.text,
      font: labelFontSpec(pin, env, options, "pin"),
      style: labelTextStyle(pin, env, textStyle, options, "pin"),
      nodeLayoutWidth: labelLayoutSize.width,
      nodeLayoutHeight: labelLayoutSize.height
    });
  }
  return items;
}

function nodePinEdgeStyle(pin, env, parentOptions = {}) {
  const rawOptions = { "help lines": true };
  Object.assign(rawOptions, parsePinEdgeOptions(parentOptions["pin edge"]));
  Object.assign(rawOptions, parsePinEdgeOptions(pin.options?.["pin edge"]));
  const { style: rawStyle } = normalizeOptions("draw", rawOptions, env);
  return {
    ...scaleCanvasStyle(rawStyle, env),
    fill: "none"
  };
}

function parsePinEdgeOptions(value) {
  if (value === undefined || value === null || value === true || value === "") return {};
  return parseOptions(String(value));
}

function optionValueList(value) {
  return Array.isArray(value) ? value : [value];
}

function resolveLabelOptions(label, env, parentOptions = {}, kind = "label") {
  const inheritedPathText =
    parentOptions["tikzkit inherited path text"] || (kind === "pin" ? parentOptions.text || parentOptions.color : undefined);
  const labelOptions = label.options || {};
  const pathTextOptions = inheritedPathText && !hasExplicitTextColor(labelOptions)
    ? { text: inheritedPathText }
    : {};
  const localOptions = normalizeOptions("node", labelOptions, env).options;
  const resolved = normalizeOptions("node", {
    ...inheritedNodeOptions(env),
    [kind === "pin" ? "every pin" : "every label"]: true,
    ...pathTextOptions,
    ...labelOptions
  }, env);
  resolved.options[EXPLICIT_NODE_FONT] = Object.hasOwn(localOptions, "font") ? localOptions.font : null;
  return resolved;
}

function labelPlacementSize(label, env, parentOptions = {}, kind = "label") {
  const { options: normalizedOptions } = resolveLabelOptions(label, env, parentOptions, kind);
  return estimateNodeAnchorSize(label.text, normalizedOptions, env, estimateNodeSize(label.text, normalizedOptions, env));
}

function labelFontSpec(label, env, parentOptions = {}, kind = "label") {
  const { options } = resolveLabelOptions(label, env, parentOptions, kind);
  return resolvedTextFontSpec(label.text, options, env, env.canvasScale * nodeOptionScale(options, env));
}

function labelTextStyle(label, env, fallbackStyle = {}, parentOptions = {}, kind = "label") {
  const { style: rawStyle, semantic, options: normalizedLabelOptions } = resolveLabelOptions(label, env, parentOptions, kind);
  const style = scaleCanvasStyle(rawStyle, env);
  return {
    ...style,
    fill: style.textFill || semantic.text || "black",
    fontScale: roundNumber(env.canvasScale * nodeFontScale(normalizedLabelOptions, env)),
    fontSizeBaseScale: roundNumber(env.canvasScale * nodeOptionScale(normalizedLabelOptions, env)),
    fontFamily:
      resolveFontFamily(label.text) ||
      resolveInheritedFontFamily(normalizedLabelOptions.font, env.pictureOptions?.font) ||
      fallbackStyle.fontFamily,
    fontVariant: resolveInheritedFontVariant(normalizedLabelOptions.font, env.pictureOptions?.font) || fallbackStyle.fontVariant,
    fontWeight: resolveInheritedFontWeight(normalizedLabelOptions.font, env.pictureOptions?.font) || fallbackStyle.fontWeight
  };
}

function addCoordinateLabels(options = {}, point, env, ir) {
  if (options.label === undefined || options.label === true || options.label === "") return;
  const expandedOptions = normalizeOptions("node", {
    ...inheritedNodeOptions(env),
    ...resolveDynamicOptions(options, env)
  }, env).options;
  const { style: rawStyle, semantic } = normalizeOptions("node", expandedOptions, env);
  const style = scaleCanvasStyle(rawStyle, env);
  const textStyle = {
    ...style,
    fill: style.textFill || semantic.text || "black",
    fontScale: roundNumber(env.canvasScale * nodeFontScale(expandedOptions, env)),
    fontSizeBaseScale: roundNumber(env.canvasScale * nodeOptionScale(expandedOptions, env)),
    fontFamily:
      resolveFontFamily(String(expandedOptions.label || "")) ||
      resolveInheritedFontFamily(expandedOptions.font, env.pictureOptions?.font),
    fontVariant: resolveInheritedFontVariant(expandedOptions.font, env.pictureOptions?.font),
    fontWeight: resolveInheritedFontWeight(expandedOptions.font, env.pictureOptions?.font)
  };
  for (const label of nodeLabels(expandedOptions, point, { width: 0, height: 0 }, env, textStyle)) {
    ir.items.push(label);
  }
}

function parseNodeLabel(value) {
  let text = String(value || "").trim();
  text = text.replace(/^\{([\s\S]*)\}$/, "$1").trim();
  let options = {};
  if (text.startsWith("[")) {
    const parsedOptions = extractBalanced(text, 0, "[", "]");
    if (parsedOptions) {
      options = parseOptions(parsedOptions.content);
      text = text.slice(parsedOptions.end).trim();
    }
  }
  const colon = findLabelDirectionColon(text);
  if (colon === -1) return { direction: "above", text, options };
  return {
    direction: text.slice(0, colon).trim() || "above",
    text: text.slice(colon + 1).trim(),
    options
  };
}

function extractBalanced(text, start, open, close) {
  if (text[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (char === open) depth += 1;
    if (char === close) {
      depth -= 1;
      if (depth === 0) {
        return {
          content: text.slice(start + 1, index),
          end: index + 1
        };
      }
    }
  }
  return null;
}

function findLabelDirectionColon(text) {
  let brace = 0;
  let bracket = 0;
  let paren = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "{") brace += 1;
    if (char === "}") brace = Math.max(0, brace - 1);
    if (char === "[") bracket += 1;
    if (char === "]") bracket = Math.max(0, bracket - 1);
    if (char === "(") paren += 1;
    if (char === ")") paren = Math.max(0, paren - 1);
    if (char === ":" && brace === 0 && bracket === 0 && paren === 0) return index;
  }
  return -1;
}

function labelPointForDirection(direction, point, size, sep, labelSize = { width: 0, height: 0 }) {
  const rawDirection = String(direction || "above").trim().toLowerCase();
  const angle = /^[+\-*/().\d\s]+$/.test(rawDirection) ? evaluateMath(rawDirection, {}) : Number.NaN;
  if (Number.isFinite(angle)) {
    const radians = (angle * Math.PI) / 180;
    const radius = radialBoxExtent(size, radians) + radialBoxExtent(labelSize, radians) + sep;
    return roundPoint({
      x: point.x + Math.cos(radians) * radius,
      y: point.y + Math.sin(radians) * radius
    });
  }
  const normalized = rawDirection.replace(/-/g, " ");
  if (normalized === "center" || normalized === "centre") return roundPoint(point);
  let x = point.x;
  let y = point.y;
  const horizontalGap = (Number(size.width) || 0) / 2 + (Number(labelSize.width) || 0) / 2 + sep;
  const verticalGap = (Number(size.height) || 0) / 2 + (Number(labelSize.height) || 0) / 2 + sep;
  if (normalized.includes("right") || normalized.includes("east")) x += horizontalGap;
  if (normalized.includes("left") || normalized.includes("west")) x -= horizontalGap;
  if (normalized.includes("above") || normalized.includes("north")) y += verticalGap;
  if (normalized.includes("below") || normalized.includes("south")) y -= verticalGap;
  if (x === point.x && y === point.y) y += verticalGap;
  return roundPoint({ x, y });
}

function pinEdgePoints(direction, fromCenter, fromSize, toCenter, toSize) {
  const vector = pinDirectionVector(direction, fromCenter, toCenter);
  const length = Math.hypot(vector.x, vector.y);
  if (!Number.isFinite(length) || length <= 1e-9) {
    return { from: roundPoint(fromCenter), to: roundPoint(toCenter) };
  }
  const unit = { x: vector.x / length, y: vector.y / length };
  const radians = Math.atan2(unit.y, unit.x);
  const fromOffset = radialBoxExtent(fromSize, radians);
  const toOffset = radialBoxExtent(toSize, radians);
  return {
    from: roundPoint({
      x: fromCenter.x + unit.x * fromOffset,
      y: fromCenter.y + unit.y * fromOffset
    }),
    to: roundPoint({
      x: toCenter.x - unit.x * toOffset,
      y: toCenter.y - unit.y * toOffset
    })
  };
}

function pinDirectionVector(direction, fromCenter, toCenter) {
  const rawDirection = String(direction || "").trim().toLowerCase();
  const angle = /^[+\-*/().\d\s]+$/.test(rawDirection) ? evaluateMath(rawDirection, {}) : Number.NaN;
  if (Number.isFinite(angle)) {
    const radians = (angle * Math.PI) / 180;
    return { x: Math.cos(radians), y: Math.sin(radians) };
  }
  const normalized = rawDirection.replace(/-/g, " ");
  let x = 0;
  let y = 0;
  if (normalized.includes("right") || normalized.includes("east")) x += 1;
  if (normalized.includes("left") || normalized.includes("west")) x -= 1;
  if (normalized.includes("above") || normalized.includes("north")) y += 1;
  if (normalized.includes("below") || normalized.includes("south")) y -= 1;
  if (x || y) return { x, y };
  return {
    x: (Number(toCenter.x) || 0) - (Number(fromCenter.x) || 0),
    y: (Number(toCenter.y) || 0) - (Number(fromCenter.y) || 0)
  };
}

function radialBoxExtent(size = {}, radians = 0) {
  const halfWidth = (Number(size.width) || 0) / 2;
  const halfHeight = (Number(size.height) || 0) / 2;
  return Math.abs(Math.cos(radians)) * halfWidth + Math.abs(Math.sin(radians)) * halfHeight;
}

function resolveNodePoint(statement, env, diagnostics, selfSize) {
  if (statement.absolutePoint) return roundPoint(statement.absolutePoint);
  if (statement.at) {
    const point = resolveCoordinate(statement.at, env, diagnostics);
    const positioningOffset = resolveExplicitAtPositioningOffset(statement.options || {}, env, selfSize);
    if (!positioningOffset) return point;
    return roundPoint({
      x: point.x + positioningOffset.x,
      y: point.y + positioningOffset.y
    });
  }
  const chainPoint = resolveChainPosition(statement.options || {}, env, selfSize);
  if (chainPoint) return chainPoint;
  const positioning = resolvePositioning(statement.options || {}, env, selfSize);
  if (positioning) return positioning;
  return applyCoordinateTransform({ x: 0, y: 0 }, env);
}

function initialChains(pictureOptions = {}) {
  const chains = {};
  for (const spec of chainOptionValues(pictureOptions["start chain"])) {
    const parsed = parseStartChainSpec(spec);
    if (!parsed || chains[parsed.name]) continue;
    chains[parsed.name] = { placement: chainPlacementFromParsed(parsed), last: null, count: 0 };
  }
  return chains;
}

function initialActiveChain(pictureOptions = {}) {
  const specs = chainOptionValues(pictureOptions["start chain"]);
  const parsed = specs.length ? parseStartChainSpec(specs.at(-1)) : null;
  return parsed?.name || null;
}

function chainOptionValues(value) {
  return Array.isArray(value) ? value : value === undefined ? [] : [value];
}

function applyChainControlOptions(options = {}, env, diagnostics = []) {
  for (const spec of chainOptionValues(options["start chain"])) {
    const parsed = parseStartChainSpec(spec);
    if (!parsed) continue;
    if (env.chains?.[parsed.name]) {
      diagnostics.push({ level: "warning", message: `Chain ${parsed.name} is already active` });
      continue;
    }
    env.chains ||= {};
    env.chains[parsed.name] = { placement: chainPlacementFromParsed(parsed), last: null, count: 0 };
    env.activeChain = parsed.name;
  }
  for (const spec of chainOptionValues(options["continue chain"])) {
    const parsed = parseStartChainSpec(spec);
    const name = parsed?.name || env.activeChain;
    if (!name || !env.chains?.[name]) {
      diagnostics.push({ level: "warning", message: `Unknown chain ${name || ""}`.trim() });
      continue;
    }
    env.activeChain = name;
    if (parsed?.hasExplicitDirection) env.chains[name].placement = chainPlacementFromParsed(parsed);
  }
  for (const spec of chainOptionValues(options["start branch"])) {
    const parsed = parseStartChainSpec(spec);
    const parentName = env.activeChain;
    const parent = parentName ? env.chains?.[parentName] : null;
    if (!parentName || !parent?.last) {
      diagnostics.push({ level: "warning", message: "start branch requires an active chain with a last node" });
      continue;
    }
    if (!parsed?.name || parsed.name === "chain") {
      diagnostics.push({ level: "warning", message: "start branch requires a branch name" });
      continue;
    }
    const name = `${parentName}/${parsed.name}`;
    if (env.chains?.[name]) {
      diagnostics.push({ level: "warning", message: `Chain ${name} is already active` });
      continue;
    }
    seedBranchChain(name, parent, chainPlacementFromParsed(parsed), env);
    env.activeChain = name;
  }
  for (const spec of chainOptionValues(options["continue branch"])) {
    const parsed = parseStartChainSpec(spec);
    const parentName = env.activeChain;
    const name = parentName && parsed?.name ? `${parentName}/${parsed.name}` : null;
    if (!name || !env.chains?.[name]) {
      diagnostics.push({ level: "warning", message: `Unknown branch ${parsed?.name || ""}`.trim() });
      continue;
    }
    env.activeChain = name;
    if (parsed.hasExplicitDirection) env.chains[name].placement = chainPlacementFromParsed(parsed);
  }
}

function seedBranchChain(name, parent, placement, env) {
  const first = { ...parent.last };
  const record = parent.last.name ? env.nodes?.[parent.last.name] : null;
  if (record) {
    registerNodeRecord(`${name}-1`, record, env);
    registerNodeRecord(`${name}-begin`, record, env);
    registerNodeRecord(`${name}-end`, record, env);
  }
  env.chains ||= {};
  env.chains[name] = {
    placement,
    last: first,
    count: 1
  };
}

function parseStartChainSpec(value) {
  if (value === undefined || value === null || value === false) return null;
  const text = String(value === true ? "" : value).trim();
  if (!text) {
    return {
      name: "chain",
      placementKind: "going",
      placementValue: "right",
      hasExplicitDirection: false
    };
  }
  const match = text.match(/^(?:(.+?)\s+)?(going|placed)\s+(.+)$/i);
  if (match) {
    const placementKind = match[2].toLowerCase();
    return {
      name: normalizeChainName(match[1] || "chain"),
      placementKind,
      placementValue: placementKind === "going" ? normalizeChainDirection(match[3]) : match[3].trim(),
      hasExplicitDirection: true
    };
  }
  return {
    name: normalizeChainName(text),
    placementKind: "going",
    placementValue: "right",
    hasExplicitDirection: false
  };
}

function chainPlacementFromParsed(parsed = {}) {
  return {
    kind: parsed.placementKind === "placed" ? "placed" : "going",
    value: parsed.placementValue || "right"
  };
}

function chainSpecFromOptions(options = {}, env = {}) {
  if (!Object.hasOwn(options, "on chain")) return null;
  const value = options["on chain"];
  if (value === false || value === null) return null;
  if (value === true || value === "") {
    return {
      name: env.activeChain || "default",
      placementKind: "going",
      placementValue: "right",
      hasExplicitDirection: false
    };
  }
  return parseStartChainSpec(value);
}

function chainNameFromOptions(options = {}, env = {}) {
  return chainSpecFromOptions(options, env)?.name || null;
}

function normalizeChainName(value) {
  return String(value ?? "default").trim() || "default";
}

function normalizeChainDirection(value) {
  return String(value || "right").trim().toLowerCase().replace(/-/g, " ") || "right";
}

function ensureChain(name, env) {
  env.chains ||= {};
  if (!env.chains[name]) env.chains[name] = { placement: { kind: "going", value: "right" }, last: null, count: 0 };
  if (!Number.isFinite(Number(env.chains[name].count))) env.chains[name].count = 0;
  if (!env.chains[name].placement) env.chains[name].placement = { kind: "going", value: "right" };
  env.activeChain ||= name;
  return env.chains[name];
}

function resolveChainPosition(options = {}, env, selfSize = { width: 0, height: 0 }) {
  const spec = chainSpecFromOptions(options, env);
  if (!spec) return null;
  const chain = ensureChain(spec.name, env);
  const placement = spec.hasExplicitDirection ? chainPlacementFromParsed(spec) : chain.placement;
  if (placement?.kind === "placed") {
    return resolvePlacedChainPosition(placement.value, chain, env, selfSize);
  }
  if (!chain.last) return applyCoordinateTransform({ x: 0, y: 0 }, env);
  const distance = scalePositioningLibraryDistance(positioningLibraryDefaultDistance(env), env, positioningLibraryHelpers());
  const direction = placement?.value || "right";
  return roundPoint({
    x: chain.last.point.x + positioningLibraryDelta(direction, "x", distance, chain.last, selfSize),
    y: chain.last.point.y + positioningLibraryDelta(direction, "y", distance, chain.last, selfSize)
  });
}

function resolvePlacedChainPosition(value, chain, env, selfSize) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (!raw.includes("=")) {
    if (!chain.last?.name) return null;
    const direction = normalizeChainDirection(raw);
    return resolvePositioning({ [direction]: `of ${chain.last.name}` }, env, selfSize);
  }
  const expanded = raw.replace(/\\tikzchainprevious\b/g, chain.last?.name || "");
  const placementOptions = parseOptions(stripOuterBraces(expanded));
  if (placementOptions.at !== undefined) {
    return resolveCoordinate(placementOptions.at, env);
  }
  return resolvePositioning(placementOptions, env, selfSize);
}

function updateChainState(options = {}, env, point, size = { width: 0, height: 0 }, node = {}) {
  const name = chainNameFromOptions(options, env);
  if (!name) return null;
  const chain = ensureChain(name, env);
  const previous = chain.last ? { ...chain.last } : null;
  const count = (Number(chain.count) || 0) + 1;
  const alias = `${name}-${count}`;
  if (node.nodeRecord) {
    registerNodeRecord(alias, node.nodeRecord, env);
    if (count === 1) registerNodeRecord(`${name}-begin`, node.nodeRecord, env);
    registerNodeRecord(`${name}-end`, node.nodeRecord, env);
  }
  chain.count = count;
  chain.last = {
    point,
    width: Number(size?.width) || 0,
    height: Number(size?.height) || 0,
    name: alias,
    explicitName: node.name || null
  };
  return {
    chainName: name,
    previousName: previous?.name || previous?.explicitName || null,
    currentName: alias,
    previous,
    current: { ...chain.last }
  };
}

function chainInExistingNode(statement, env, ir, diagnostics) {
  // Native chains lowers \chainin to late options containing
  // `every chain in/.try` before the command's explicit options.
  const inheritedOptions = resolveDynamicOptions(env.styles?.["every chain in"] || {}, env);
  const explicitOptions = resolveDynamicOptions(statement.options || {}, env);
  const options = normalizeOptions("path", { ...inheritedOptions, ...explicitOptions }, env).options;
  const target = resolveDynamicName(statement.target, env);
  const record = env.nodes?.[target];
  const point = record?.point || env.coordinates?.[target];
  if (!point) {
    diagnostics.push({ level: "warning", message: `Unknown chain-in node ${target}` });
    return;
  }
  const chainUpdate = updateChainState(
    { ...options, "on chain": true },
    env,
    point,
    record?.size || { width: 0, height: 0 },
    { name: target, nodeRecord: record || null }
  );
  addChainJoinPath(chainUpdate, options, env, ir, diagnostics);
}

function addChainJoinPath(chainUpdate, options = {}, env, ir, diagnostics) {
  const join = parseChainJoinSpec(options.join);
  if (!join || !chainUpdate?.currentName) return;
  const fromName = join.from || chainUpdate.previousName;
  if (!fromName) return;
  const rawOptions = {
    "every join": true,
    ...parseOptions(join.style || "")
  };
  const normalized = normalizeOptions("draw", rawOptions, env);
  const style = scaleCanvasStyle(normalized.style, env);
  const { semantic, options: pathOptionsOnly } = normalized;
  const pathOptions = { ...pathOptionsOnly, ...semantic };
  const built = buildPath(
    [
      { kind: "coordinate", raw: fromName },
      { kind: "operator", value: "--", options: {} },
      { kind: "coordinate", raw: chainUpdate.currentName }
    ],
    env,
    diagnostics,
    pathOptions,
    style
  );
  const visible = isVisiblePath("draw", style, semantic, built.styleHints);
  if (!visible) return;
  for (const shape of built.shapes || []) {
    ir.items.push({ ...shape, style: { ...style, ...(shape.style || {}) } });
  }
  if (hasDrawableCommands(built.commands, built.shapes)) {
    const pathStyle = drawablePathStyle(style, built.styleHints);
    const item = {
      type: "path",
      subtype: semanticSubtype(pathOptions),
      overlay: tikzBoolean(pathOptions.overlay),
      style: pathStyle,
      commands: applyArrowEndpointShortening(built.commands, pathStyle, built.endpointRefs)
    };
    ir.items.push(item);
    addDecorationMarkers(item, pathOptionsOnly, ir);
  }
  for (const node of built.nodes || []) {
    addNodeItems(node, ir, env);
  }
}

function parseChainJoinSpec(value) {
  if (value === undefined || value === null || value === false) return null;
  const text = String(value === true ? "" : value).trim();
  if (!text) return { style: "" };
  const withMatch = text.match(/^with\s+(.+?)(?:\s+by\s+([\s\S]*))?$/);
  if (withMatch) {
    return {
      from: stripOuterBraces(withMatch[1].trim()),
      style: stripOuterBraces((withMatch[2] || "").trim())
    };
  }
  const byMatch = text.match(/^by(?:\s+([\s\S]*))?$/);
  if (byMatch) return { style: stripOuterBraces((byMatch[1] || "").trim()) };
  return { style: stripOuterBraces(text) };
}

function resolvePositioning(options, env, selfSize = { width: 0, height: 0 }) {
  return resolvePositioningPoint(options, env, selfSize, positioningLibraryHelpers());
}

function resolveExplicitAtPositioningOffset(options, env, selfSize = { width: 0, height: 0 }) {
  return resolveExplicitAtPositioningOffsetPoint(options, env, selfSize, positioningLibraryHelpers());
}

function positioningLibraryHelpers() {
  return {
    canvasLengthScale,
    resolveDynamicName,
    resolveAnchoredNodeCoordinate,
    resolveCoordinate
  };
}

function resolveNodeAnchorPoint(point, options = {}, text = "", env = { variables: {} }, sizeOverride = null) {
  const size = sizeOverride || estimateNodeLayoutSize(text, options, env);
  const sep = parseNodeLengthDimension(options["inner sep"] ?? options["outer sep"] ?? "0.08cm", env);
  const anchorSize = nodeAnchorTextWidthScaledSize(size, options, sep, env);
  const textAnchorOffsets = nodeTextAnchorOffsets(text, options, env, size);
  const rotation = nodeRotation(options, env);
  const splitTextAnchor = rectangleSplitTextAnchorShift(text, options, env, size, rotation);
  const shift = splitTextAnchor || nodeAnchorShift(options, anchorSize, sep, env, rotation, textAnchorOffsets);
  const explicitShift = nodeExplicitShift(options, env);
  return roundPoint({
    x: point.x + shift.x + explicitShift.x,
    y: point.y + shift.y + explicitShift.y
  });
}

function rectangleSplitTextAnchorShift(text, options = {}, env = {}, size = {}, rotation = 0) {
  if (nodeShape(options) !== "rectangleSplit" || String(options.anchor || "").trim().toLowerCase() !== "text") {
    return null;
  }
  const layout = rectangleSplitLayout(text, options, env);
  if (!layout?.parts?.length) return null;
  const xScale = (Number(size.width) || layout.size.width) / Math.max(layout.size.width, 1e-9);
  const yScale = (Number(size.height) || layout.size.height) / Math.max(layout.size.height, 1e-9);
  const firstPart = layout.parts[0];
  const local = rotateVector(
    (Number(firstPart.originX) || 0) * xScale,
    (Number(firstPart.originY) || 0) * yScale,
    rotation
  );
  return { x: -local.x, y: -local.y };
}

function nodeAnchorTextWidthScaledSize(size, options = {}, sep = 0, env = {}) {
  const scale = Number(options["tikzkit anchor text width scale"] ?? options["tikzkit text width scale"]);
  if (!Number.isFinite(scale) || scale <= 0 || Math.abs(scale - 1) < 1e-9) return size;
  const scaledSep = Math.max(0, Number(sep) || 0) * canvasLengthScale(env);
  const contentWidth = Math.max(0, (Number(size.width) || 0) - scaledSep * 2);
  return {
    ...size,
    width: roundNumber(contentWidth * scale + scaledSep * 2)
  };
}

function rotateVector(x, y, degrees) {
  if (!degrees) return { x, y };
  const r = (degrees * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

function nodeAnchorShift(options = {}, size, sep, env, rotation = 0, textAnchorOffsets = {}) {
  const direction = nodeDirection(options);
  const scaledSep = sep * canvasLengthScale(env);
  if (direction) {
    const distance =
      nodeDirectionDistance(options[direction], sep, env) *
      nodeDirectionSingleDistanceScale(direction, options[direction]) *
      canvasLengthScale(env);
    // Positioning gaps stay in page coordinates while the anchor-to-center
    // vector follows the node rotation.
    const gapX = direction.includes("right") ? distance : direction.includes("left") ? -distance : 0;
    const gapY = direction.includes("above") ? distance : direction.includes("below") ? -distance : 0;
    if (explicitAnchorOverridesDirection(options, direction)) {
      const explicit = explicitNodeAnchorShift(options, size, env, rotation, textAnchorOffsets);
      return { x: gapX + explicit.x, y: gapY + explicit.y };
    }
    const oppositeAnchor = [
      direction.includes("below") ? "north" : direction.includes("above") ? "south" : "",
      direction.includes("left") ? "east" : direction.includes("right") ? "west" : ""
    ].filter(Boolean).join(" ");
    const customAnchor = oppositeAnchor
      ? customNodeLocalAnchor(nodeShape(options), oppositeAnchor, { ...size, shapeData: nodeShapeData(options, env) })
      : null;
    const centerOffset = customAnchor
      ? { x: -customAnchor.x, y: -customAnchor.y }
      : {
          x: direction.includes("right") ? size.width / 2 : direction.includes("left") ? -size.width / 2 : 0,
          y: direction.includes("above") ? size.height / 2 : direction.includes("below") ? -size.height / 2 : 0
        };
    const rotated = rotateVector(centerOffset.x, centerOffset.y, rotation);
    return { x: gapX + rotated.x, y: gapY + rotated.y };
  }

  return explicitNodeAnchorShift(options, size, env, rotation, textAnchorOffsets);
}

function explicitAnchorOverridesDirection(options = {}, direction) {
  if (!options.anchor) return false;
  const keys = Object.keys(options);
  return keys.indexOf("anchor") > keys.indexOf(direction);
}

function explicitNodeAnchorShift(options = {}, size, env, rotation = 0, textAnchorOffsets = {}) {
  const anchor = String(options.anchor || "").trim();
  if (!anchor) return { x: 0, y: 0 };
  const nearTicklabelShift = nearTicklabelAnchorShift(anchor, size, rotation);
  if (nearTicklabelShift) return nearTicklabelShift;
  const textAnchor = textAnchorKind(anchor);
  if (textAnchor) {
    const outerSep = nodeOuterSep(options, env);
    const local = {
      x: anchor.includes("east") ? size.width / 2 + outerSep.x * canvasLengthScale(env) : anchor.includes("west") ? -(size.width / 2 + outerSep.x * canvasLengthScale(env)) : 0,
      y: Number(textAnchorOffsets[`${textAnchor}Offset`]) || 0
    };
    const rotated = rotateVector(local.x, local.y, rotation);
    return { x: -rotated.x, y: -rotated.y };
  }
  const customAnchor = customNodeLocalAnchor(nodeShape(options), anchor, { ...size, shapeData: nodeShapeData(options, env) });
  if (customAnchor) {
    const rotated = rotateVector(customAnchor.x, customAnchor.y, rotation);
    return { x: -rotated.x, y: -rotated.y };
  }
  const outerSep = nodeOuterSep(options, env);
  const scaledOuterX = outerSep.x * canvasLengthScale(env);
  const scaledOuterY = outerSep.y * canvasLengthScale(env);
  const local = {
    x: anchor.includes("east") ? size.width / 2 + scaledOuterX : anchor.includes("west") ? -(size.width / 2 + scaledOuterX) : 0,
    y: anchor.includes("north") ? size.height / 2 + scaledOuterY : anchor.includes("south") ? -(size.height / 2 + scaledOuterY) : 0
  };
  const rotated = rotateVector(local.x, local.y, rotation);
  return { x: -rotated.x, y: -rotated.y };
}

function textAnchorKind(anchorRaw) {
  const anchor = String(anchorRaw || "").trim().toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ");
  if (anchor === "base" || anchor === "base east" || anchor === "base west") return "base";
  if (anchor === "mid" || anchor === "mid east" || anchor === "mid west") return "mid";
  return null;
}

function nearTicklabelAnchorShift(anchorRaw, size = {}, rotation = 0) {
  const anchor = String(anchorRaw || "").trim().toLowerCase().replace(/\s+/g, " ");
  const match = anchor.match(/^near ([xy])ticklabel( opposite)?$/);
  if (!match) return null;
  const radians = (Number(rotation) || 0) * Math.PI / 180;
  const halfWidth = Math.max(0, Number(size.width) || 0) / 2;
  const halfHeight = Math.max(0, Number(size.height) || 0) / 2;
  const projectedHalfWidth = Math.abs(halfWidth * Math.cos(radians)) + Math.abs(halfHeight * Math.sin(radians));
  const projectedHalfHeight = Math.abs(halfWidth * Math.sin(radians)) + Math.abs(halfHeight * Math.cos(radians));
  const direction = match[2] ? 1 : -1;
  return match[1] === "x"
    ? { x: 0, y: direction * projectedHalfHeight }
    : { x: direction * projectedHalfWidth, y: 0 };
}

function nodeDirection(options = {}) {
  return nodeDirectionEntries(options).at(-1)?.[0];
}

function nodeDirectionEntries(options = {}) {
  const directions = new Set(["above right", "above left", "below right", "below left", "right", "left", "above", "below"]);
  return Object.entries(options).filter(([direction, value]) => (
    directions.has(direction) && (value === true || !String(value).includes("of"))
  ));
}

function nodeDirectionDistance(value, fallback, env) {
  if (value === true || value === undefined || value === null || value === "") return 0;
  const parsed = parseDimension(normalizeNodeDirectionDistance(value), env.variables);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nodeDirectionSingleDistanceScale(direction, value) {
  const diagonal =
    (String(direction).includes("right") || String(direction).includes("left")) &&
    (String(direction).includes("above") || String(direction).includes("below"));
  if (!diagonal) return 1;
  if (/\band\b/.test(String(value || ""))) return 1;
  return Math.SQRT1_2;
}

function normalizeNodeDirectionDistance(value) {
  const text = String(value).trim();
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return `${text}pt`;
  return text;
}

function nodeExplicitShift(options = {}, env) {
  let x = options.xshift ? parseShiftDimension(options.xshift, env.variables) : 0;
  let y = options.yshift ? parseShiftDimension(options.yshift, env.variables) : 0;
  if (options.shift) {
    const shifted = parseShift(options.shift, env);
    x += shifted.x;
    y += shifted.y;
  }
  return { x, y };
}

function resolveDynamicName(name, env) {
  return substitutePathLetNumbers(
    substituteTextVariables(String(name || "").trim(), env.variables),
    env
  ).trim();
}

function resolveDynamicOptions(options = {}, env) {
  const resolved = {};
  for (const [key, value] of Object.entries(options || {})) {
    const resolvedKey = substituteTextVariables(String(key), env.variables).trim();
    const resolvedValue = typeof value === "string" ? substituteTextVariables(value, env.variables) : value;
    resolved[resolvedKey] = resolvedValue;
  }
  return resolved;
}

function defaultPathNodeReference(raw, env) {
  let text = substituteTextVariables(String(raw || "").trim(), env.variables);
  text = substitutePathLetNumbers(text, env);
  text = text.replace(/^\{([\s\S]*)\}$/, "$1").trim();
  if (text.startsWith("(") && text.endsWith(")")) text = text.slice(1, -1).trim();
  const shifted = parseCoordinateOptionPrefix(text, env);
  if (shifted) text = shifted.coordinate;
  if (!text || text.startsWith("$")) return null;
  const explicitNode = text.match(/^node\s+cs\s*:\s*([\s\S]+)$/i);
  if (explicitNode) {
    const options = resolveDynamicOptions(parseOptions(explicitNode[1]), env);
    const name = resolveDynamicName(options.name, env);
    const node = env.nodes[name];
    if (!node) return null;
    if (Object.hasOwn(options, "anchor")) {
      return { name, node, mode: "anchor", anchor: String(options.anchor || "center").trim() };
    }
    if (Object.hasOwn(options, "angle")) {
      return { name, node, mode: "anchor", anchor: String(options.angle).trim() };
    }
    return { name, node, mode: "center" };
  }
  if (text.includes(",")) return null;
  const anchored = text.match(/^(.+)\.([^.]+)$/);
  if (anchored) {
    const name = resolveDynamicName(anchored[1], env);
    const node = env.nodes[name];
    return node ? { name, node, mode: "anchor", anchor: anchored[2].trim() } : null;
  }
  const name = resolveDynamicName(text, env);
  const node = env.nodes[name];
  return node ? { name, node, mode: "center" } : null;
}

function clipNodeLineEndpoints(from, fromRef, to, toRef, env) {
  return {
    from: fromRef ? clipNodeReferencePoint(fromRef, from, to, env) : roundPoint(from),
    to: toRef ? clipNodeReferencePoint(toRef, to, from, env) : roundPoint(to)
  };
}

function clipNodeReferencePoint(ref, point, toward, env) {
  if (ref.mode === "anchor") return roundPoint(point);
  return nodeBorderPoint(ref.node, point, toward, env);
}

// Claude: 曲线边的端点应落在"离开/进入"切线方向上的边框点，而不是两节点中心连线上的点。
// out = 从起点离开的角度；in = 进入终点的切线角度（指向控制点 c2 的方向），与控制点计算保持一致。
function clipNodeCurveEndpoints(from, fromRef, to, toRef, curve, env, terminalPadding = {}) {
  return {
    from: fromRef ? clipNodeReferenceAlongAngle(fromRef, from, curve.out, env, terminalPadding.start) : roundPoint(from),
    to: toRef ? clipNodeReferenceAlongAngle(toRef, to, curve.in, env, terminalPadding.end) : roundPoint(to)
  };
}

function clipNodeCubicEndpoints(from, fromRef, c1, c2, to, toRef, env) {
  return {
    from: fromRef ? clipNodeReferencePoint(fromRef, from, c1, env) : roundPoint(from),
    to: toRef ? clipNodeReferencePoint(toRef, to, c2, env) : roundPoint(to)
  };
}

function clipNodeReferenceAlongAngle(ref, center, angleDegrees, env, borderPadding = 0) {
  if (ref.mode === "anchor") return roundPoint(center);
  const radians = (angleDegrees * Math.PI) / 180;
  const toward = { x: center.x + Math.cos(radians), y: center.y + Math.sin(radians) };
  return nodeBorderPoint(ref.node, center, toward, env, borderPadding);
}

function curveArrowTerminalBorderPadding(style = {}) {
  const halfLineWidth = Math.max(0, Number(style.lineWidth) || 0) / TIKZ_UNIT / 2;
  return {
    start: style.markerStart ? halfLineWidth : 0,
    end: style.markerEnd ? halfLineWidth : 0
  };
}

function updateCurrentMoveTo(commands, point) {
  const command = commands.at(-1);
  if (command?.type === "moveTo") {
    command.x = point.x;
    command.y = point.y;
  }
}

function moveToNodeExit(commands, point) {
  const command = commands.at(-1);
  if (command?.type === "moveTo") {
    updateCurrentMoveTo(commands, point);
    return;
  }
  commands.push({ type: "moveTo", x: point.x, y: point.y });
}

function shouldBreakAtNodeExit(ref) {
  return Boolean(ref && ref.mode !== "anchor");
}

function edgePathOptions(options = {}) {
  const picked = {};
  if (Object.hasOwn(options, "decorate")) picked.decorate = options.decorate;
  if (Object.hasOwn(options, "decoration")) picked.decoration = options.decoration;
  return picked;
}

function pathOptionStyleHints(options = {}, inheritedPathStyle = {}, env = {}) {
  const normalized = normalizeOptions("path", options || {}, env);
  const style = scaleCanvasStyle(normalized.style, env);
  const hints = {};
  const drawAction = pathOptionsRequestDraw(options);
  const fillAction = pathOptionsRequestFill(options);
  if (drawAction || fillAction) hints.pathAction = true;
  if ((drawAction || inheritedPathStyle.stroke !== "none") && style.stroke && style.stroke !== "none") {
    hints.stroke = style.stroke;
  }
  if ((fillAction || inheritedPathStyle.fill !== "none") && style.fill && style.fill !== "none") {
    hints.fill = style.fill;
  }
  if (Number.isFinite(Number(style.lineWidth))) hints.lineWidth = style.lineWidth;
  if (Array.isArray(style.dashArray)) hints.dashArray = style.dashArray;
  if (style.markerStart) hints.markerStart = style.markerStart;
  if (style.markerEnd) hints.markerEnd = style.markerEnd;
  if (style.opacity !== undefined) hints.opacity = style.opacity;
  if (style.fillOpacity !== undefined) hints.fillOpacity = style.fillOpacity;
  if (style.strokeOpacity !== undefined) hints.strokeOpacity = style.strokeOpacity;
  return hints;
}

function pathOptionsRequestDraw(options = {}) {
  if (!Object.hasOwn(options, "draw")) return false;
  const value = options.draw;
  if (value === false) return false;
  return !/^(?:none|false|0|no|off|transparent)$/i.test(String(value).trim());
}

function pathOptionsRequestFill(options = {}) {
  if (!Object.hasOwn(options, "fill")) return false;
  const value = options.fill;
  if (value === false) return false;
  return !/^(?:none|false|0|no|off|transparent)$/i.test(String(value).trim());
}

function edgeExplicitlySuppressesDraw(options = {}) {
  const draw = options.draw;
  if (draw === false) return true;
  if (draw === undefined || draw === null) return false;
  return /^(?:none|false|0|no|off|transparent)$/i.test(String(draw).trim());
}

function edgeDrawableStyle(options = {}, inheritedPathStyle = {}, env = {}) {
  const normalized = normalizeOptions("draw", options || {}, env);
  const style = drawablePathStyle(scaleCanvasStyle(normalized.style, env), edgeStyleHintsFromOptions(options || {}, env));
  if (!edgeExplicitlySuppressesDraw(options) && (!style.stroke || style.stroke === "none")) {
    style.stroke = inheritedPathStyle.stroke && inheritedPathStyle.stroke !== "none" ? inheritedPathStyle.stroke : "black";
  }
  style.fill = "none";
  return style;
}

function loopDirectionFromOptions(options = {}) {
  for (const direction of ["above", "below", "left", "right"]) {
    if (Object.hasOwn(options, `loop ${direction}`)) return direction;
  }
  if (Object.hasOwn(options, "loop")) return "above";
  return null;
}

const PGF_LOOP_SPECS = {
  above: { out: 105, in: 75 },
  right: { out: 15, in: -15 },
  left: { out: 195, in: 165 },
  below: { out: 285, in: 255 }
};

function buildSelfLoop(point, nodeRef, direction, options, env) {
  const node = nodeRef?.node || null;
  const spec = PGF_LOOP_SPECS[direction] || PGF_LOOP_SPECS.above;
  const out = parseAngleOption(options.out, spec.out, env);
  const inAngle = parseAngleOption(options.in, spec.in, env);
  const start = node ? nodeAnchorCoordinate(node, out) : roundPoint(point);
  const end = node ? nodeAnchorCoordinate(node, inAngle) : roundPoint(point);
  const looseness = parseLoosenessOption(options.looseness, 8, env);
  const explicitDistance = explicitLoopDistance(options, env);
  const minDistance = explicitDistance ?? parseLoopMinDistance(options["min distance"], env);
  const chord = Math.hypot(end.x - start.x, end.y - start.y);
  const distance = explicitDistance ?? Math.max(chord * 0.3915 * looseness, minDistance);
  const c1 = polarOffset(start, out, distance);
  const c2 = polarOffset(end, inAngle, distance);
  return {
    start,
    end,
    labelPoint: cubicPointAt(start, c1, c2, end, 0.5),
    commands: [{ type: "curveTo", x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y, x: end.x, y: end.y }]
  };
}

function explicitLoopDistance(options, env) {
  const raw = options.distance ?? options["min distance"];
  if (raw === undefined || raw === null || raw === true || raw === "") return null;
  const distance = parseDimension(raw, env.variables) * canvasLengthScale(env);
  return Number.isFinite(distance) && distance >= 0 ? distance : null;
}

function parseLoopMinDistance(value, env) {
  const raw = value === undefined || value === null || value === true || value === "" ? "5mm" : value;
  const distance = parseDimension(raw, env.variables) * canvasLengthScale(env);
  return Number.isFinite(distance) && distance >= 0 ? distance : parseDimension("5mm", env.variables) * canvasLengthScale(env);
}

function edgeCurveSpec(options = {}, from, to, env, fromRef = null, toRef = null) {
  const looseness = parseLoosenessOption(options.looseness, 1, env);
  const outLooseness = parseLoosenessOption(options["out looseness"], looseness, env);
  const inLooseness = parseLoosenessOption(options["in looseness"], looseness, env);
  if (Object.hasOwn(options, "out") || Object.hasOwn(options, "in")) {
    const distance = curveControlDistanceOption(options.distance, env);
    return {
      out: parseAngleOption(options.out, 0, env),
      in: parseAngleOption(options.in, 180, env),
      outLooseness,
      inLooseness,
      outDistance: curveControlDistanceOption(options["out distance"], env) ?? distance,
      inDistance: curveControlDistanceOption(options["in distance"], env) ?? distance
    };
  }
  if (Object.hasOwn(options, "bend left")) return bendCurveSpec(options["bend left"], 1, from, to, env, { outLooseness, inLooseness });
  if (Object.hasOwn(options, "bend right")) return bendCurveSpec(options["bend right"], -1, from, to, env, { outLooseness, inLooseness });
  if (Object.hasOwn(options, "looseness")) return sameNodeAnchorLoosenessCurveSpec(fromRef, toRef, from, to, { outLooseness, inLooseness });
  return null;
}

function curveControlDistanceOption(value, env) {
  if (value === true || value === undefined || value === null || value === "") return null;
  const distance = parseDimension(value, env.variables || {}) * canvasLengthScale(env);
  return Number.isFinite(distance) && distance >= 0 ? distance : null;
}

function sameNodeAnchorLoosenessCurveSpec(fromRef, toRef, from, to, looseness = { outLooseness: 1, inLooseness: 1 }) {
  if (!fromRef || !toRef || fromRef.mode !== "anchor" || toRef.mode !== "anchor" || fromRef.name !== toRef.name) return null;
  // TikZ's plain `to[looseness=...]` curve keeps the default to-path
  // directions, even when both endpoints are explicit anchors on the same node.
  // Case 026 depends on this for the three flower-petal self loops.
  return {
    out: 45,
    in: 135,
    outLooseness: looseness.outLooseness,
    inLooseness: looseness.inLooseness
  };
}

function cubicLabelGeometry(from, c1, c2, to) {
  const point = cubicPointAt(from, c1, c2, to, 0.5);
  const tangent = cubicTangentAt(from, c1, c2, to, 0.5);
  return {
    point: roundPoint(point),
    segment: {
      from: roundPoint({ x: point.x - tangent.x / 2, y: point.y - tangent.y / 2 }),
      to: roundPoint({ x: point.x + tangent.x / 2, y: point.y + tangent.y / 2 })
    }
  };
}

function cubicPointAt(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  return {
    x: mt2 * mt * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t2 * t * p3.x,
    y: mt2 * mt * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t2 * t * p3.y
  };
}

function cubicTangentAt(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  const x = 3 * mt * mt * (p1.x - p0.x) + 6 * mt * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x);
  const y = 3 * mt * mt * (p1.y - p0.y) + 6 * mt * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y);
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

function bendCurveSpec(value, direction, from, to, env, looseness = { outLooseness: 1, inLooseness: 1 }) {
  const angle = parseAngleOption(value, 30, env);
  const base = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
  return {
    out: base + direction * angle,
    in: base + 180 - direction * angle,
    outLooseness: looseness.outLooseness,
    inLooseness: looseness.inLooseness
  };
}

function parseAngleOption(value, fallback, env) {
  if (value === true || value === undefined || value === null || value === "") return fallback;
  const angle = evaluateMath(value, env.variables);
  return Number.isFinite(angle) ? angle : fallback;
}

function parseLoosenessOption(value, fallback, env) {
  if (value === true || value === undefined || value === null || value === "") return fallback;
  const looseness = evaluateMath(value, env.variables);
  return Number.isFinite(looseness) && looseness > 0 ? looseness : fallback;
}

function tikzCurveControlDistance(from, to) {
  const chord = Math.hypot(to.x - from.x, to.y - from.y);
  return (chord || 1) * 0.3915;
}

function applyArrowEndpointShortening(commands, style = {}, endpointRefs = {}) {
  if (!commands.length || (!style.markerStart && !style.markerEnd)) return commands;
  if (!endpointRefs.start && !endpointRefs.end) return commands;
  return commands;
}

function pointsAlmostEqual(a, b, epsilon = 1e-9) {
  return Boolean(a && b && Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon);
}

function nodeBorderPoint(node, center, toward, env, borderPadding = 0) {
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1e-12) return roundPoint(center);
  const rotation = Number(node.rotation) || 0;
  const localDirection = rotateVector(dx, dy, -rotation);
  const localDx = localDirection.x;
  const localDy = localDirection.y;
  const localDistance = Math.hypot(localDx, localDy);
  const halfWidth = (Number(node.layoutWidth) || Number(node.width) || 0) / 2;
  const halfHeight = (Number(node.layoutHeight) || Number(node.height) || 0) / 2;
  if (halfWidth <= 0 || halfHeight <= 0) return roundPoint(center);
  const terminalPadding = Math.max(0, Number(borderPadding) || 0);
  let localPoint;
  if (node.shape === "circle" || node.shape === "circleSplit" || node.shape === "circleCrossSplit") {
    const radius = Math.max(halfWidth, halfHeight) + terminalPadding;
    localPoint = { x: (localDx / localDistance) * radius, y: (localDy / localDistance) * radius };
  } else if (node.shape === "ellipse" || node.shape === "cloud") {
    const paddedHalfWidth = halfWidth + terminalPadding;
    const paddedHalfHeight = halfHeight + terminalPadding;
    const factor = 1 / Math.sqrt((localDx * localDx) / (paddedHalfWidth * paddedHalfWidth) + (localDy * localDy) / (paddedHalfHeight * paddedHalfHeight));
    localPoint = { x: localDx * factor, y: localDy * factor };
  } else if (node.shape === "roundedRectangle") {
    localPoint = roundedRectangleBorderPoint(localDx, localDy, halfWidth, halfHeight, terminalPadding);
  } else if (node.shape === "cylinder") {
    localPoint = geometricCylinderBorderPoint(
      geometricCylinderGeometry({ width: halfWidth * 2, height: halfHeight * 2 }, node.shapeData || {}),
      { x: localDx, y: localDy },
      terminalPadding
    );
  } else if (node.shape === "signal") {
    const visibleWidth = Number(node.width) || halfWidth * 2;
    const visibleHeight = Number(node.height) || halfHeight * 2;
    const outerPadding = Math.max(
      0,
      ((Number(node.layoutWidth) || visibleWidth) - visibleWidth) / 2,
      ((Number(node.layoutHeight) || visibleHeight) - visibleHeight) / 2
    );
    localPoint = symbolSignalBorderPoint(
      symbolSignalGeometry({ width: visibleWidth, height: visibleHeight }, node.shapeData || {}),
      { x: localDx, y: localDy },
      outerPadding + terminalPadding
    );
  } else if (node.shape === "diamond") {
    const points = [
      { x: 0, y: halfHeight },
      { x: halfWidth, y: 0 },
      { x: 0, y: -halfHeight },
      { x: -halfWidth, y: 0 }
    ];
    localPoint = terminalPadding > 0
      ? polygonBorderPointWithPadding({ x: 0, y: 0 }, { x: localDx, y: localDy }, points, terminalPadding)
      : polygonBorderPoint({ x: 0, y: 0 }, { x: localDx, y: localDy }, points);
  } else if (node.shape === "regularPolygon") {
    const sides = Math.max(3, Math.round(Number(node.shapeData?.regularPolygonSides) || 5));
    const radius = Math.max(halfWidth, halfHeight) + regularPolygonOuterRadiusExtension(terminalPadding, sides);
    localPoint = polygonBorderPoint(
      { x: 0, y: 0 },
      { x: localDx, y: localDy },
      regularPolygonPoints(
        { x: 0, y: 0 },
        radius,
        radius,
        sides,
        regularPolygonStartAngle(sides, node.shapeData?.shapeBorderRotate)
      )
    );
  } else if (polygonNodeShape(node.shape)) {
    const points = nodePolygonPoints(node, { x: 0, y: 0 }, halfWidth, halfHeight);
    localPoint = terminalPadding > 0
      ? polygonBorderPointWithPadding({ x: 0, y: 0 }, { x: localDx, y: localDy }, points, terminalPadding)
      : polygonBorderPoint({ x: 0, y: 0 }, { x: localDx, y: localDy }, points);
  } else {
    if (terminalPadding > 0) {
      localPoint = polygonBorderPointWithPadding(
        { x: 0, y: 0 },
        { x: localDx, y: localDy },
        rectanglePoints({ x: 0, y: 0 }, halfWidth, halfHeight),
        terminalPadding
      );
    } else {
      const xScale = Math.abs(localDx) > 1e-12 ? halfWidth / Math.abs(localDx) : Number.POSITIVE_INFINITY;
      const yScale = Math.abs(localDy) > 1e-12 ? halfHeight / Math.abs(localDy) : Number.POSITIVE_INFINITY;
      const factor = Math.min(xScale, yScale);
      if (!Number.isFinite(factor)) return roundPoint(center);
      localPoint = { x: localDx * factor, y: localDy * factor };
    }
  }
  const rotated = rotateVector(localPoint.x, localPoint.y, rotation);
  return roundPoint({ x: center.x + rotated.x, y: center.y + rotated.y });
}

function roundedRectangleBorderPoint(dx, dy, halfWidth, halfHeight, padding = 0) {
  // The default PGF rounded rectangle has convex 180-degree end caps. Its
  // anchorborder first intersects the radial ray with the straight top/bottom
  // chord or vertical side, then with the matching circular corner/end cap.
  // This mirrors that shape rather than clipping paths to its outer rectangle.
  const horizontal = Math.max(0, halfWidth + padding);
  const vertical = Math.max(0, halfHeight + padding);
  const radius = Math.min(horizontal, vertical);
  if (radius <= 1e-12) return { x: 0, y: 0 };

  const chordX = Math.max(0, horizontal - radius);
  const chordY = Math.max(0, vertical - radius);
  const candidates = [];
  const epsilon = 1e-9;

  if (Math.abs(dx) > epsilon) {
    const t = horizontal / Math.abs(dx);
    const y = dy * t;
    if (Math.abs(y) <= chordY + epsilon) candidates.push({ t, x: dx * t, y });
  }
  if (Math.abs(dy) > epsilon) {
    const t = vertical / Math.abs(dy);
    const x = dx * t;
    if (Math.abs(x) <= chordX + epsilon) candidates.push({ t, x, y: dy * t });
  }

  const signX = dx >= 0 ? 1 : -1;
  const signY = dy >= 0 ? 1 : -1;
  const centerX = signX * chordX;
  const centerY = signY * chordY;
  const directionSquared = dx * dx + dy * dy;
  const directionCenterDot = dx * centerX + dy * centerY;
  const centerSquaredMinusRadiusSquared = centerX * centerX + centerY * centerY - radius * radius;
  const discriminant = directionCenterDot * directionCenterDot - directionSquared * centerSquaredMinusRadiusSquared;
  if (discriminant >= -epsilon) {
    const t = (directionCenterDot + Math.sqrt(Math.max(0, discriminant))) / directionSquared;
    if (t > epsilon) {
      const x = dx * t;
      const y = dy * t;
      if (signX * x >= chordX - epsilon && signY * y >= chordY - epsilon) candidates.push({ t, x, y });
    }
  }

  const point = candidates.filter((candidate) => Number.isFinite(candidate.t) && candidate.t > epsilon).sort((left, right) => left.t - right.t)[0];
  return point ? { x: point.x, y: point.y } : { x: (dx / Math.hypot(dx, dy)) * radius, y: (dy / Math.hypot(dx, dy)) * radius };
}

function nodeShape(options = {}) {
  const shape = normalizeShapeName(options.shape);
  const tubeKind = circuitikzTubeKind(options);
  const quadpoleKind = circuitikzQuadpoleKind(options);
  if (options["op amp"] || shape === "op amp" || shape === "opamp") return "opAmp";
  if (options.ground || shape === "ground") return "ground";
  if (circuitikzMosfetNodeKind(options)) return "circuitikzMosfet";
  if (circuitikzTransistorKind(options)) return "circuitikzTransistor";
  if (tubeKind) return circuitikzTubeShape(tubeKind);
  if (quadpoleKind) return "circuitikzQuadpole";
  if (shape === "tikzquads quad") return "tikzquadsQuad";
  if (shape === "tikzquads black box") return "tikzquadsBlackBox";
  if (shape === "tikzquads pg load line") return "tikzquadsPgLoadLine";
  const explicitShape = explicitNodeShape(shape);
  if (explicitShape) return explicitShape;
  if (options["rectangle split"]) return "rectangleSplit";
  if (options["circle split"]) return "circleSplit";
  if (options["single arrow"]) return "singleArrow";
  if (options["double arrow"]) return "doubleArrow";
  if (options["cross out"]) return "crossOut";
  if (options["strike out"]) return "strikeOut";
  if (options.circle || options["knot crossing"]) return "circle";
  if (options["circle cross split"]) return "circleCrossSplit";
  if (options.ellipse) return "ellipse";
  if (options.diamond) return "diamond";
  if (options["rounded rectangle"]) return "roundedRectangle";
  if (options.superellipse) return "superellipse";
  if (options["regular polygon"]) return "regularPolygon";
  if (options.star) return "star";
  if (options.trapezium) return "trapezium";
  if (options["isosceles triangle"]) return "isoscelesTriangle";
  if (options.cloud) return "cloud";
  if (options.cylinder) return "cylinder";
  if (options.signal) return "signal";
  return "rectangle";
}

function explicitNodeShape(shape) {
  const shapes = {
    rectangle: "rectangle",
    "rectangle split": "rectangleSplit",
    "circle split": "circleSplit",
    "single arrow": "singleArrow",
    "double arrow": "doubleArrow",
    "cross out": "crossOut",
    "strike out": "strikeOut",
    circle: "circle",
    "knot crossing": "circle",
    "circle cross split": "circleCrossSplit",
    ellipse: "ellipse",
    diamond: "diamond",
    "rounded rectangle": "roundedRectangle",
    "rectangle with rounded corners": "roundedRectangle",
    superellipse: "superellipse",
    "regular polygon": "regularPolygon",
    star: "star",
    trapezium: "trapezium",
    "isosceles triangle": "isoscelesTriangle",
    cloud: "cloud",
    cylinder: "cylinder",
    signal: "signal"
  };
  return shapes[shape] || null;
}

function diamondLayoutSize(contentWidth, contentHeight, options = {}, env = { variables: {} }) {
  const rawAspect = evaluateMath(options.aspect ?? options["shape aspect"] ?? "1", env.variables);
  const aspect = Number.isFinite(rawAspect) && rawAspect > 0 ? rawAspect : 1;
  const minimumSize = options["minimum size"] ? parseNodeLengthDimension(options["minimum size"], env) : 0;
  const minimumWidth = Math.max(
    minimumSize,
    options["minimum width"] ? parseNodeLengthDimension(options["minimum width"], env) : 0
  );
  const minimumHeight = Math.max(
    minimumSize,
    options["minimum height"] ? parseNodeLengthDimension(options["minimum height"], env) : 0
  );
  const halfContentWidth = Math.max(0, contentWidth) / 2;
  const halfContentHeight = Math.max(0, contentHeight) / 2;
  const halfWidth = Math.max(halfContentWidth + aspect * halfContentHeight, minimumWidth / 2);
  const halfHeight = Math.max(halfContentWidth / aspect + halfContentHeight, minimumHeight / 2);
  return {
    width: roundNumber(halfWidth * 2),
    height: roundNumber(halfHeight * 2)
  };
}

function trapeziumLayoutSize(contentWidth, contentHeight, options = {}, env = { variables: {} }) {
  const minimumSize = options["minimum size"] ? parseNodeLengthDimension(options["minimum size"], env) : 0;
  return geometricTrapeziumLayoutSize(contentWidth, contentHeight, {
    minimumWidth: Math.max(minimumSize, options["minimum width"] ? parseNodeLengthDimension(options["minimum width"], env) : 0),
    minimumHeight: Math.max(minimumSize, options["minimum height"] ? parseNodeLengthDimension(options["minimum height"], env) : 0),
    leftAngle: numberOption(options["trapezium left angle"] ?? options["trapezium angle"], 60),
    rightAngle: numberOption(options["trapezium right angle"] ?? options["trapezium angle"], 60)
  });
}

function starLayoutSize(contentWidth, contentHeight, options = {}, env = { variables: {} }) {
  const star = starShapeData(options, env);
  return geometricStarLayoutSize(contentWidth, contentHeight, {
    minimumWidth: options["minimum width"] ? parseNodeLengthDimension(options["minimum width"], env) : 0,
    minimumHeight: options["minimum height"] ? parseNodeLengthDimension(options["minimum height"], env) : 0,
    minimumSize: options["minimum size"] ? parseNodeLengthDimension(options["minimum size"], env) : 0,
    ...star
  });
}

function cylinderLayoutSize(contentWidth, contentHeight, options = {}, env = { variables: {} }) {
  const minimumSize = options["minimum size"] ? parseNodeLengthDimension(options["minimum size"], env) : 0;
  const { style } = normalizeOptions("node", options, env);
  return geometricCylinderLayoutSize(contentWidth, contentHeight, {
    aspect: numberOption(options["shape aspect"] ?? options.aspect, 1),
    shapeBorderRotate: numberOption(options["shape border rotate"], 0),
    innerXSep: parseNodeLengthDimension(options["inner xsep"] ?? options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env),
    innerYSep: parseNodeLengthDimension(options["inner ysep"] ?? options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env),
    lineWidth: (Number(style.lineWidth) || 0) / TIKZ_UNIT,
    minimumWidth: Math.max(minimumSize, options["minimum width"] ? parseNodeLengthDimension(options["minimum width"], env) : 0),
    minimumHeight: Math.max(minimumSize, options["minimum height"] ? parseNodeLengthDimension(options["minimum height"], env) : 0)
  });
}

function signalLayoutSize(contentWidth, contentHeight, options = {}, env = { variables: {} }) {
  const minimumSize = options["minimum size"] ? parseNodeLengthDimension(options["minimum size"], env) : 0;
  return symbolSignalLayoutSize(contentWidth, contentHeight, {
    signalFrom: options["signal from"] ?? "nowhere",
    signalTo: options["signal to"] ?? "east",
    pointerAngle: numberOption(options["signal pointer angle"], 90),
    minimumWidth: Math.max(minimumSize, options["minimum width"] ? parseNodeLengthDimension(options["minimum width"], env) : 0),
    minimumHeight: Math.max(minimumSize, options["minimum height"] ? parseNodeLengthDimension(options["minimum height"], env) : 0)
  });
}

function regularPolygonLayoutSize(contentWidth, contentHeight, options = {}, env = { variables: {} }) {
  const sides = regularPolygonSides(options, env);
  const apothem = Math.max(0, Number(contentWidth) || 0, Number(contentHeight) || 0) / 2;
  const contentRadius = Math.SQRT2 * apothem / Math.cos(Math.PI / sides);
  const minimumDiameter = Math.max(
    0,
    options["minimum size"] ? parseNodeLengthDimension(options["minimum size"], env) : 0,
    options["minimum width"] ? parseNodeLengthDimension(options["minimum width"], env) : 0,
    options["minimum height"] ? parseNodeLengthDimension(options["minimum height"], env) : 0
  );
  const diameter = roundNumber(Math.max(contentRadius * 2, minimumDiameter));
  return { width: diameter, height: diameter };
}

function nodeShapeData(options = {}, env = {}, text) {
  const regularSides = regularPolygonSides(options, env);
  const shapeBorderRotate = numberOption(options["shape border rotate"] ?? options["regular polygon rotate"] ?? options["star rotate"], 0);
  const star = starShapeData(options, env, shapeBorderRotate);
  const cylinderScale = nodeOptionScale(options, env) * canvasLengthScale(env);
  const { style: cylinderStyle } = normalizeOptions("node", options, env);
  return {
    knotCrossing: Boolean(options["knot crossing"] || normalizeShapeName(options.shape) === "knot crossing"),
    mosfetKind: circuitikzMosfetNodeKind(options),
    mosfetNode: Boolean(circuitikzMosfetNodeKind(options)),
    mosfetArrows: circuitikzMosfetNodeArrows(options, env),
    mosfetEmptyCircle: Boolean(options.emptycircle),
    mosfetNoCircle: Boolean(options.nocircle),
    transistorKind: circuitikzTransistorKind(options),
    tubeKind: circuitikzTubeKind(options),
    quadpoleKind: circuitikzQuadpoleKind(options),
    quadpoleSettings: circuitikzQuadpoleKind(options) ? circuitikzQuadpoleSettings(options, env) : null,
    transistorXScale: Math.sign(numberOption(options.xscale, 1)) || 1,
    transistorYScale: Math.sign(numberOption(options.yscale, 1)) || 1,
    opAmpNoInvInputUp: Boolean(options["noinv input up"]),
    regularPolygonSides: regularSides,
    regularPolygonStartAngle: regularPolygonStartAngle(regularSides, shapeBorderRotate),
    ...star,
    trapeziumLeftAngle: numberOption(options["trapezium left angle"] ?? options["trapezium angle"], 60),
    trapeziumRightAngle: numberOption(options["trapezium right angle"] ?? options["trapezium angle"], 60),
    isoscelesTriangleApexAngle: numberOption(options["isosceles triangle apex angle"], 45),
    cylinderAspect: Math.max(1e-9, numberOption(options["shape aspect"] ?? options.aspect, 1)),
    cylinderEndRadiusX: cylinderNaturalEndRadiusX(text, options, env),
    cylinderShapeBorderRotate: Math.round((((shapeBorderRotate % 360) + 360) % 360) / 90) * 90 % 360,
    cylinderInnerXSep: parseNodeLengthDimension(options["inner xsep"] ?? options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env) * cylinderScale,
    cylinderInnerYSep: parseNodeLengthDimension(options["inner ysep"] ?? options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env) * cylinderScale,
    cylinderLineWidth: ((Number(cylinderStyle.lineWidth) || 0) / TIKZ_UNIT) * canvasLengthScale(env),
    cylinderUsesCustomFill: tikzBoolean(options["cylinder uses custom fill"]),
    cylinderBodyFill: normalizeColor(String(options["cylinder body fill"] === true || options["cylinder body fill"] === undefined ? "white" : options["cylinder body fill"])),
    cylinderEndFill: normalizeColor(String(options["cylinder end fill"] === true || options["cylinder end fill"] === undefined ? "white" : options["cylinder end fill"])),
    signalDirections: parseSignalDirections(options["signal from"] ?? "nowhere", options["signal to"] ?? "east"),
    signalPointerAngle: numberOption(options["signal pointer angle"], 90),
    arrowTipAngle: numberOption(options["single arrow tip angle"] ?? options["double arrow tip angle"], 90),
    arrowHeadExtend: parseFiniteDimension(options["single arrow head extend"] ?? options["double arrow head extend"], env, 0.25),
    arrowHeadIndent: parseFiniteDimension(options["single arrow head indent"] ?? options["double arrow head indent"], env, 0),
    shapeBorderRotate
  };
}

function cylinderNaturalEndRadiusX(text, options = {}, env = {}) {
  if (text === undefined || nodeShape(options) !== "cylinder") return undefined;
  const contentOptions = { ...options };
  delete contentOptions.shape;
  delete contentOptions.cylinder;
  delete contentOptions["minimum width"];
  delete contentOptions["minimum height"];
  delete contentOptions["minimum size"];
  const normalized = normalizeTikzText(text, env);
  const contentSize = isEmptyNormalizedText(normalized)
    ? scaleSize(estimateEmptyTextNodeSize(contentOptions, env), nodeOptionScale(options, env))
    : estimateNodeSize(text, contentOptions, env);
  const rotate = Math.round(((((numberOption(options["shape border rotate"], 0) % 360) + 360) % 360) / 90)) * 90 % 360;
  const crossSize = rotate === 90 || rotate === 270 ? contentSize.width : contentSize.height;
  return roundNumber(
    Math.max(1e-9, numberOption(options["shape aspect"] ?? options.aspect, 1)) * crossSize / 2 * canvasLengthScale(env)
  );
}

function regularPolygonSides(options = {}) {
  return Math.max(3, Math.round(numberOption(options["regular polygon sides"], 5)));
}

function starShapeData(options = {}, env = {}, shapeBorderRotate = 0) {
  const hasPointHeight = optionHasValue(options["star point height"]);
  const hasPointRatio = optionHasValue(options["star point ratio"]);
  return {
    starPoints: Math.max(3, Math.round(numberOption(options["star points"], 5))),
    starPointRatio: Math.max(1e-9, numberOption(options["star point ratio"], 1.5)),
    starPointHeight: parseFiniteDimension(options["star point height"], env, 0.5),
    // PGF switches modes when either key is assigned. The usual option form
    // carries one of them; when both survive preprocessing, prefer the ratio
    // just like its default declaration does.
    starUsesPointRatio: hasPointRatio || !hasPointHeight,
    shapeBorderRotate
  };
}

function optionHasValue(value) {
  return value !== undefined && value !== null && value !== true && String(value).trim() !== "";
}

function regularPolygonStartAngle(sides, rotate = 0) {
  const count = Math.max(3, Math.round(Number(sides) || 5));
  const base = count % 2 ? 90 : 90 - 180 / count;
  return base + (Number(rotate) || 0);
}

function regularPolygonOuterRadiusExtension(separation, sides) {
  const distance = Math.max(0, Number(separation) || 0);
  const count = Math.max(3, Math.round(Number(sides) || 5));
  return distance / Math.cos(Math.PI / count);
}

function circuitikzTransistorKind(options = {}) {
  const shape = normalizeShapeName(options.shape);
  if (options.npn || shape === "npn") return "npn";
  if (options.pnp || shape === "pnp") return "pnp";
  return null;
}

function tikzquadsNodeOptions(semantic = {}) {
  const keys = [
    "Z11",
    "Z12",
    "Z21",
    "Z22",
    "Y11",
    "Y12",
    "Y21",
    "Y22",
    "G11",
    "G12",
    "G21",
    "G22",
    "H11",
    "H12",
    "H21",
    "H22",
    "I1",
    "I2",
    "V1",
    "V2",
    "In",
    "Yn",
    "Vth",
    "Zth",
    "x axis",
    "y axis",
    "x val",
    "y val",
    "label top left",
    "label top center",
    "label top right",
    "label inner top left",
    "label inner top center",
    "label inner top right",
    "label bottom left",
    "label bottom center",
    "label bottom right",
    "label inner bottom left",
    "label inner bottom center",
    "label inner bottom right"
  ];
  const result = {};
  for (const key of keys) {
    if (semantic[key] !== undefined) result[key] = semantic[key];
  }
  return result;
}

function normalizeShapeName(value) {
  return String(value || "").trim().toLowerCase().replace(/-/g, " ");
}

function numberOption(value, fallback) {
  if (value === undefined || value === null || value === true || value === "") return fallback;
  const parsed = evaluateMath(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nodeCornerRadius(shape, semantic, size, env = {}) {
  if (shape === "roundedRectangle") return roundNumber(Math.min(size.width, size.height) * 0.5);
  if (shape === "superellipse") return roundNumber(Math.min(size.width, size.height) * 0.28);
  if (semantic["rounded corners"]) {
    const parsed = parseDimension(String(semantic["rounded corners"]), env.variables || {});
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0.08;
  }
  return 0;
}

function resolveFontFamily(raw) {
  const text = String(raw || "").trim();
  if (!text) return undefined;
  const commands = [...text.matchAll(/\\(tikzkithelvetfamily|tt|ttfamily|texttt|sf|sffamily|textsf|rm|rmfamily|textrm)\b/g)];
  const family = commands.at(-1)?.[1];
  if (family === "tikzkithelvetfamily") return TIKZ_HELVETICA_FONT_FAMILY;
  if (family === "tt" || family === "ttfamily" || family === "texttt" || /monospace/i.test(text)) return TIKZ_MONOSPACE_FONT_FAMILY;
  if (family === "sf" || family === "sffamily" || family === "textsf" || /sans/i.test(text)) return TIKZ_SANS_SERIF_FONT_FAMILY;
  if (family === "rm" || family === "rmfamily" || family === "textrm" || /serif/i.test(text)) return TIKZ_FONT_FAMILY;
  return undefined;
}

function resolveInheritedFontFamily(localFont, inheritedFont) {
  return resolveFontFamily(localFont) || resolveFontFamily(inheritedFont);
}

function resolveFontVariant(raw) {
  return /\\scshape\b/.test(String(raw || "")) ? "small-caps" : undefined;
}

function resolveInheritedFontVariant(localFont, inheritedFont) {
  return resolveFontVariant(localFont) || resolveFontVariant(inheritedFont);
}

function resolveFontWeight(raw) {
  return /\\(?:bf|bfseries|textbf)\b/.test(String(raw || "")) ? 700 : undefined;
}

function resolveInheritedFontWeight(localFont, inheritedFont) {
  return resolveFontWeight(localFont) || resolveFontWeight(inheritedFont);
}

function rectangleSplitParts(semantic = {}) {
  const parts = Number(semantic["rectangle split parts"] || 1);
  return Number.isFinite(parts) && parts > 0 ? Math.round(parts) : 1;
}

function rectangleSplitPartAlignments(options = {}, count = 1, horizontal = false) {
  const raw = options["rectangle split part align"];
  const supported = horizontal ? new Set(["top", "bottom", "base"]) : new Set(["left", "right"]);
  const requested = splitTopLevel(String(raw === undefined ? "center" : raw))
    .map((entry) => stripOuterBraces(entry).trim().toLowerCase())
    .filter(Boolean)
    .map((entry) => (supported.has(entry) ? entry : "center"));
  const fallback = requested.at(-1) || "center";
  return Array.from({ length: count }, (_unused, index) => requested[index] || fallback);
}

const RECTANGLE_SPLIT_PART_NAMES = [
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"
];
const RECTANGLE_SPLIT_PART_ORDINALS = [
  "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth",
  "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth", "nineteenth", "twentieth"
];

function rectangleSplitLayout(text, options = {}, env = { variables: {} }) {
  if (!options["rectangle split"]) return null;
  const horizontal = tikzBoolean(options["rectangle split horizontal"]);
  const parsed = rectangleSplitTextParts(text);
  const declared = Number(options["rectangle split parts"]);
  const ignoreEmptyParts = tikzBoolean(options["rectangle split ignore empty parts"]);
  const defaultCount = ignoreEmptyParts ? parsed.highestPart : 4;
  const count = Math.max(1, Number.isFinite(declared) && declared > 0 ? Math.round(declared) : defaultCount || 1);
  const logicalParts = Array.from({ length: count }, (_unused, index) => ({
    name: RECTANGLE_SPLIT_PART_NAMES[index] || String(index + 1),
    text: String(parsed.parts[index] || "").trim(),
    logicalIndex: index
  }));
  // PGF retains the first text part even when it is empty, then removes
  // subsequent empty parts and aliases their bare anchors to the prior part.
  const visibleLogicalParts = ignoreEmptyParts
    ? logicalParts.filter((part, index) => index === 0 || Boolean(part.text))
    : logicalParts;
  let visibleIndex = 0;
  for (const part of logicalParts) {
    if (visibleLogicalParts.includes(part)) {
      part.visibleIndex = visibleIndex;
      visibleIndex += 1;
    } else {
      part.visibleIndex = Math.max(0, visibleIndex - 1);
    }
  }
  const innerXSep = parseNodeLengthDimension(options["inner xsep"] ?? options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env);
  const innerYSep = parseNodeLengthDimension(options["inner ysep"] ?? options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env);
  const emptyWidth =
    parseNodeLengthDimension("1ex", env) +
    (options["rectangle split empty part width"] === undefined
      ? 0
      : parseNodeLengthDimension(options["rectangle split empty part width"], env));
  // PGF appends a zero-width rule for each height/depth key. TeX combines
  // those rules in an hbox by taking the maximum height and depth, whereas
  // successive width rules remain adjacent and therefore accumulate above.
  const emptyHeight = Math.max(
    parseNodeLengthDimension("1ex", env),
    options["rectangle split empty part height"] === undefined
      ? 0
      : parseNodeLengthDimension(options["rectangle split empty part height"], env)
  );
  const emptyDepth = Math.max(
    0,
    options["rectangle split empty part depth"] === undefined
      ? 0
      : parseNodeLengthDimension(options["rectangle split empty part depth"], env)
  );
  const { style: splitStyle } = normalizeOptions("node", options, env);
  const separatorWidth = Math.max(0, (Number(splitStyle.lineWidth) || 0) / TIKZ_UNIT);
  const metricOptions = { ...options };
  delete metricOptions["rectangle split"];
  delete metricOptions["rectangle split horizontal"];
  delete metricOptions["rectangle split parts"];
  delete metricOptions.shape;
  delete metricOptions.draw;
  delete metricOptions.fill;
  const partSizes = visibleLogicalParts.map((part) => {
    if (!part.text) {
      return {
        width: roundNumber(Math.max(0.02, emptyWidth + innerXSep * 2)),
        height: roundNumber(Math.max(0.02, emptyHeight + emptyDepth + innerYSep * 2)),
        // PGF represents empty split parts with zero-width rules. Their
        // default dimensions are 1ex height and zero depth; custom rules can
        // raise either maximum independently.
        boxHeight: roundNumber(emptyHeight),
        boxDepth: roundNumber(emptyDepth)
      };
    }
    // The browser measurement backend sees KaTeX's typewriter face before
    // the renderer applies its cmtt10 advance-width correction.  A rectangle
    // split accumulates every part width, so that small per-glyph mismatch is
    // amplified in wide B-tree nodes.  For split layout, use the known TeX
    // typewriter metrics directly; SVG text still uses the normal renderer.
    const size = estimateCompactTextSize(
      part.text,
      nodeUsesTypewriterFont(part.text, options, env)
        ? { ...metricOptions, "tikzkit fixed typewriter metrics": true }
        : metricOptions,
      env
    );
    const normalized = normalizeTikzText(part.text, env);
    const plain = normalized.kind === "text" && normalized.lines?.length === 1
      ? measurePlainTextTeXBoxPt(normalized.lines[0], {
          fontSizePt: 10 * nodeFontScaleForText(normalized, metricOptions, env)
        })
      : null;
    const fallbackBoxHeight = Math.max(0.02, size.height - innerYSep * 2) * 0.75;
    const fallbackBoxDepth = Math.max(0, size.height - innerYSep * 2 - fallbackBoxHeight);
    return {
      ...size,
      boxHeight: roundNumber(plain ? plain.height / TEX_PT_PER_CM : fallbackBoxHeight),
      boxDepth: roundNumber(plain ? plain.depth / TEX_PT_PER_CM : fallbackBoxDepth)
    };
  });
  const visibleCount = visibleLogicalParts.length;
  const partWidths = partSizes.map((size) => size.width);
  const partHeights = partSizes.map((size) => size.height);
  let width = horizontal
    ? partWidths.reduce((sum, value) => sum + value, 0) + separatorWidth * Math.max(0, visibleCount - 1)
    : Math.max(...partWidths, 0.02);
  let height = horizontal
    ? Math.max(...partHeights, 0.02)
    : partHeights.reduce((sum, value) => sum + value, 0) + separatorWidth * Math.max(0, visibleCount - 1);
  const minimumWidth = options["minimum width"] ? parseNodeLengthDimension(options["minimum width"], env) : 0;
  const minimumHeight = options["minimum height"] ? parseNodeLengthDimension(options["minimum height"], env) : 0;
  const minimumSize = options["minimum size"] ? parseNodeLengthDimension(options["minimum size"], env) : 0;
  if (horizontal) {
    height = Math.max(height, minimumHeight, minimumSize);
    // PGF's horizontal rectangle split builds its width by accumulating the
    // individual part boxes.  `minimum width` (and the width component of
    // `minimum size`) is deliberately ignored; only the shared height is
    // enlarged.  See pgflibraryshapes.multipart.code.tex, where the computed
    // maximum width is only consumed by the vertical branch.
  } else {
    // PGF's vertical rectangle split honors a common minimum width but does
    // not stretch individual rows to a requested minimum height.
    width = Math.max(width, minimumWidth, minimumSize);
  }
  if (!horizontal) {
    const contentWidth = Math.max(...partSizes.map((size) => Math.max(0.02, size.width - innerXSep * 2)), 0.02);
    width = Math.max(width, contentWidth + innerXSep * 2);
    const partAlignments = rectangleSplitPartAlignments(options, visibleCount, false);
    let cursor = height / 2;
    const laidOutParts = visibleLogicalParts.map((part, index) => {
      const partHeight = partHeights[index];
      const partSize = partSizes[index];
      const boxWidth = Math.max(0.02, partSize.width - innerXSep * 2);
      const boxHeight = partSize.boxHeight || 0;
      const boxDepth = partSize.boxDepth || 0;
      const alignment = partAlignments[index];
      const centerY = cursor - partHeight / 2;
      const visualCenterX = alignment === "left"
        ? -width / 2 + innerXSep + boxWidth / 2
        : alignment === "right"
          ? width / 2 - innerXSep - boxWidth / 2
          : 0;
      const originX = visualCenterX - boxWidth / 2;
      const originY = centerY + (boxDepth - boxHeight) / 2;
      cursor -= partHeight + (index < visibleCount - 1 ? separatorWidth : 0);
      return {
        ...part,
        width: width,
        height: partHeight,
        centerX: roundNumber(visualCenterX),
        centerY: roundNumber(centerY),
        originX: roundNumber(originX),
        originY: roundNumber(originY),
        alignment
      };
    });
    return {
      horizontal: false,
      count: visibleCount,
      parts: laidOutParts,
      logicalParts,
      partWidths: Array.from({ length: visibleCount }, () => roundNumber(width)),
      partHeights,
      innerXSep: roundNumber(innerXSep),
      innerYSep: roundNumber(innerYSep),
      separatorWidth: roundNumber(separatorWidth),
      size: { width: roundNumber(width), height: roundNumber(height) }
    };
  }
  // PGF's horizontal rectangle split first measures the maximum TeX-box
  // height/depth, then places each part's baseline according to the per-part
  // alignment list. Keep the existing node extent calculation above (it is
  // already calibrated against native output), but use its inner content
  // height as PGF's max-total-height for the baseline placement.
  const contentHeight = Math.max(0.02, height - innerYSep * 2);
  const maxBoxHeight = Math.max(...partSizes.map((size) => size.boxHeight || 0), 0);
  const maxBoxDepth = Math.max(...partSizes.map((size) => size.boxDepth || 0), 0);
  const partAlignments = rectangleSplitPartAlignments(options, visibleCount, true);
  let cursor = -width / 2;
  const laidOutParts = visibleLogicalParts.map((part, index) => {
    const partWidth = partWidths[index];
    const centerX = cursor + partWidth / 2;
    const originX = cursor + innerXSep;
    const partSize = partSizes[index];
    const boxHeight = partSize.boxHeight || 0;
    const boxDepth = partSize.boxDepth || 0;
    const alignment = partAlignments[index];
    let originY = (boxDepth - boxHeight) / 2;
    if (alignment === "top") originY = contentHeight / 2 - boxHeight;
    if (alignment === "bottom") originY = -contentHeight / 2 + boxDepth;
    if (alignment === "base") originY = (maxBoxDepth - maxBoxHeight) / 2;
    const centerY = originY + (boxHeight - boxDepth) / 2;
    cursor += partWidth + (index < visibleCount - 1 ? separatorWidth : 0);
    return {
      ...part,
      width: partWidth,
      centerX: roundNumber(centerX),
      centerY: roundNumber(centerY),
      originX: roundNumber(originX),
      originY: roundNumber(originY),
      alignment
    };
  });
  return {
    horizontal: true,
    count: visibleCount,
    parts: laidOutParts,
    logicalParts,
    partWidths,
    partHeights,
    innerXSep: roundNumber(innerXSep),
    innerYSep: roundNumber(innerYSep),
    separatorWidth: roundNumber(separatorWidth),
    size: { width: roundNumber(width), height: roundNumber(height) }
  };
}

function circleSplitLayout(text, options = {}, env = { variables: {} }) {
  if (!options["circle split"] && normalizeShapeName(options.shape) !== "circle split") return null;
  const { upper, lower } = circleSplitTextParts(text);
  const metricOptions = {
    ...options,
    "inner sep": "0pt",
    "inner xsep": "0pt",
    "inner ysep": "0pt",
    "minimum width": undefined,
    "minimum height": undefined,
    "minimum size": undefined
  };
  // pgflibraryshapes.multipart.code.tex defines circle split from two TeX
  // boxes, not from two vertically centered labels. Keep their height/depth
  // split so `text`, `lower`, and the separator all share PGF's geometry.
  const upperBox = circleSplitPartMetric(upper, metricOptions, env);
  const lowerBox = circleSplitPartMetric(lower, metricOptions, env);
  const innerXSep = parseNodeLengthDimension(options["inner xsep"] ?? options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env);
  const innerYSep = parseNodeLengthDimension(options["inner ysep"] ?? options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env);
  const { style } = normalizeOptions("node", options, env);
  const lineWidth = Math.max(0, Number(style.lineWidth) || 0) / TIKZ_UNIT;
  const halfWidth = Math.max(upperBox.width, lowerBox.width) / 2 + innerXSep;
  const halfHeight = Math.max(upperBox.totalHeight, lowerBox.totalHeight) + innerYSep * 2 + lineWidth / 2;
  const minimumWidth = options["minimum width"] ? parseNodeLengthDimension(options["minimum width"], env) : 0;
  const minimumHeight = options["minimum height"] ? parseNodeLengthDimension(options["minimum height"], env) : 0;
  const minimumSize = options["minimum size"] ? parseNodeLengthDimension(options["minimum size"], env) : 0;
  const radius = Math.max(Math.hypot(halfWidth, halfHeight), minimumWidth / 2, minimumHeight / 2, minimumSize / 2);
  const size = { width: roundNumber(radius * 2), height: roundNumber(radius * 2) };
  return {
    size,
    parts: [
      {
        name: "text",
        text: upper,
        // The upper text box starts above the separator by its own visual
        // half-height. This follows the inherited circle centerpoint.
        centerY: roundNumber(innerYSep + lineWidth / 2 + upperBox.totalHeight / 2)
      },
      {
        name: "lower",
        text: lower,
        centerY: roundNumber(-(innerYSep + lineWidth / 2 + lowerBox.totalHeight / 2))
      }
    ],
    // The PGF `lower` anchor is the lower text box's origin. In particular,
    // it is left of the circle center by half the lower text width, rather
    // than at the geometric center of the lower semicircle.
    lowerAnchor: {
      x: roundNumber(-lowerBox.width / 2),
      y: roundNumber(-(innerYSep + lowerBox.height + lineWidth / 2))
    }
  };
}

function circleSplitPartMetric(text, options = {}, env = { variables: {} }) {
  const fallback = estimateCompactTextSize(text, options, env);
  const normalized = normalizeTikzText(text, env);
  const lines = normalized.lines?.length ? normalized.lines : String(normalized.text || "").split(/\\\\|\n/);
  const line = String(lines[0] || "").trim();
  const font = resolvedTextFontSpec(text, options, env);
  const fontSizePt = Number(font.sizePt) || 10;
  let width = Number(fallback.width) || 0.08;
  let height = Number.NaN;
  let depth = Number.NaN;

  if (line && lines.length === 1) {
    const math = parseMathText(line);
    if (math) {
      const formula = estimateFormulaBox(math.tex, {
        scale: fontSizePt / 10,
        minWidth: 0,
        widthPadding: 0,
        texTextMetrics: true
      });
      width = formula.width;
      height = formula.height;
      depth = formula.depth;
    } else if (!nodeUsesTypewriterFont(normalized, options, env)) {
      const measured = measurePlainTextTeXBoxPt(line, {
        fontSizePt,
        fontFamily: font.family
      });
      if (measured) {
        width = measured.width / TEX_PT_PER_CM;
        height = measured.height / TEX_PT_PER_CM;
        depth = measured.depth / TEX_PT_PER_CM;
      }
    }
  }

  if (options["text height"] !== undefined) height = parseNodeLengthDimension(options["text height"], env);
  if (options["text depth"] !== undefined) depth = parseNodeLengthDimension(options["text depth"], env);
  if (!Number.isFinite(height) || !Number.isFinite(depth)) {
    const fallbackHeight = Math.max(0.08, Number(fallback.height) || 0.08);
    height = Number.isFinite(height) ? height : fallbackHeight * 0.8;
    depth = Number.isFinite(depth) ? depth : fallbackHeight * 0.2;
  }
  return {
    width: roundNumber(Math.max(0.02, width)),
    height: roundNumber(Math.max(0, height)),
    depth: roundNumber(Math.max(0, depth)),
    totalHeight: roundNumber(Math.max(0.02, height + depth))
  };
}

function circleSplitTextParts(text) {
  const source = String(text || "");
  const match = /\\nodepart\s*\{lower\}/i.exec(source);
  if (!match) return { upper: source.trim(), lower: "" };
  return {
    upper: source.slice(0, match.index).trim(),
    lower: source.slice(match.index + match[0].length).trim()
  };
}

function rectangleSplitTextParts(text) {
  const source = String(text || "");
  const parts = [];
  let current = 0;
  let cursor = 0;
  let highestPart = 1;
  const pattern = /\\nodepart\s*\{([^{}]+)\}/g;
  for (const match of source.matchAll(pattern)) {
    parts[current] = `${parts[current] || ""}${source.slice(cursor, match.index)}`;
    const name = String(match[1] || "").trim().toLowerCase();
    const cardinalIndex = RECTANGLE_SPLIT_PART_NAMES.indexOf(name);
    const ordinalIndex = RECTANGLE_SPLIT_PART_ORDINALS.indexOf(name);
    const namedIndex = cardinalIndex >= 0 ? cardinalIndex : ordinalIndex;
    const numericIndex = Number(name) - 1;
    current = namedIndex >= 0 ? namedIndex : Number.isFinite(numericIndex) && numericIndex >= 0 ? numericIndex : current;
    highestPart = Math.max(highestPart, current + 1);
    cursor = match.index + match[0].length;
  }
  parts[current] = `${parts[current] || ""}${source.slice(cursor)}`;
  highestPart = Math.max(highestPart, parts.length);
  return { parts, highestPart };
}

function rectangleSplitPartFills(semantic = {}, layoutOrPartCount = 0) {
  if (!semantic["rectangle split part fill"]) return [];
  const fills = splitTopLevel(String(semantic["rectangle split part fill"])).map((color) => normalizeColor(color));
  const layout = layoutOrPartCount && typeof layoutOrPartCount === "object" ? layoutOrPartCount : null;
  const count = layout?.logicalParts?.length || layout?.count || Math.max(0, Math.round(Number(layoutOrPartCount) || 0));
  const last = fills.at(-1);
  while (last && fills.length < count) fills.push(last);
  return layout?.parts ? layout.parts.map((part) => fills[part.logicalIndex] || last) : fills;
}

function rectangleSplitUsesCustomFill(semantic = {}) {
  // PGF's `rectangle split part fill` key enables custom fills as it is
  // encountered.  The documented boolean key may then turn them back off,
  // so preserve the option ordering rather than treating any fill list as an
  // unconditional request to paint the individual parts.
  let enabled = false;
  for (const [key, value] of Object.entries(semantic || {})) {
    if (key === "rectangle split part fill") enabled = true;
    if (key === "rectangle split uses custom fill") {
      enabled = tikzBoolean(value);
    }
  }
  return enabled;
}

function rectangleSplitHorizontalMinPartWidth(env = { variables: {} }) {
  return parseDimension("1.14em", env.variables);
}

function roundedRectangleTextExtraXSep(textBox, outerHeight) {
  const contentHeight = Math.max(0, Number(textBox?.height) || 0);
  const halfTextHeight = contentHeight / 2;
  const halfHeight = Math.max(0, Number(outerHeight) || 0) / 2;
  if (!halfTextHeight || !halfHeight) return 0;

  // `rounded rectangle` defaults to two convex 180-degree arcs. PGF derives
  // their horizontal allowance from the chord that encloses the text box;
  // fixed em padding makes short text nodes noticeably too wide.
  const radius = halfHeight;
  const ratio = Math.min(1, halfTextHeight / radius);
  return radius * (1 - Math.sqrt(Math.max(0, 1 - ratio * ratio)));
}

function splitMatrixRows(body) {
  const rows = [];
  let current = "";
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (char === "(") paren += 1;
    if (char === ")") paren = Math.max(0, paren - 1);
    if (char === "[") bracket += 1;
    if (char === "]") bracket = Math.max(0, bracket - 1);
    if (char === "{") brace += 1;
    if (char === "}") brace = Math.max(0, brace - 1);
    if (char === "\\" && body[index + 1] === "\\" && paren === 0 && bracket === 0 && brace === 0) {
      if (current.trim()) rows.push(current.trim());
      current = "";
      index += 1;
      continue;
    }
    current += char;
  }
  if (current.trim()) rows.push(current.trim());
  return rows;
}

function splitMatrixCells(row) {
  const cells = [];
  let current = "";
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  for (let index = 0; index < row.length; index += 1) {
    const char = row[index];
    if (char === "(") paren += 1;
    if (char === ")") paren = Math.max(0, paren - 1);
    if (char === "[") bracket += 1;
    if (char === "]") bracket = Math.max(0, bracket - 1);
    if (char === "{") brace += 1;
    if (char === "}") brace = Math.max(0, brace - 1);

    if (char === "\\" && row[index + 1] === "&" && paren === 0 && bracket === 0 && brace === 0) {
      cells.push(current.trim());
      current = "";
      index += 1;
      continue;
    }

    if (char === "&" && paren === 0 && bracket === 0 && brace === 0) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function parseMatrixCell(raw) {
  let text = String(raw).trim();
  let options = {};
  let explicitName = null;
  const nameMatch = text.match(/^\|\s*\(([^)]*)\)\s*\|\s*([\s\S]*)$/);
  if (nameMatch) {
    explicitName = nameMatch[1].trim() || null;
    text = nameMatch[2].trim();
  }
  const optionMatch = text.match(/^\|\s*\[([\s\S]*?)\]\s*\|\s*([\s\S]*)$/);
  if (optionMatch) {
    options = parseOptions(optionMatch[1]);
    text = optionMatch[2].trim();
  }
  const nodeMatch = text.match(/^\\node\s*(?:\[([^\]]*)\])?\s*(?:\(([^)]*)\)\s*)?\{([\s\S]*)\}\s*;?$/);
  if (nodeMatch) {
    return {
      text: stripOuterBraces(nodeMatch[3]),
      options: { ...options, ...(nodeMatch[1] ? parseOptions(nodeMatch[1]) : {}) },
      explicitName: nodeMatch[2]?.trim() || explicitName
    };
  }
  const calendar = parseCalendarSpec(text);
  if (calendar) return { text: "", options, explicitName, calendar };
  return { text: stripOuterBraces(text), options, explicitName };
}

function parseFiniteDimension(value, env, fallback) {
  if (value === undefined || value === null || value === true || value === "") return fallback;
  const parsed = parseDimension(value, env.variables);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseFinitePgfLength(value, env, fallback) {
  if (value === undefined || value === null || value === true || value === "") return fallback;
  const substituted = substituteVariables(value, env.variables).replace(/\{\}/g, "").trim();
  const text = stripOuterBraces(substituted);
  const hasExplicitUnit = /(?:cm|mm|pt|em|ex|in)\s*$/.test(text);
  const length = !hasExplicitUnit && /^[+\-*/().\d\s]+$/.test(text) ? `${text}pt` : value;
  const parsed = parseDimension(length, env.variables);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function scaleSize(size, scale = 1) {
  const factor = Number.isFinite(scale) && scale > 0 ? scale : 1;
  if (Math.abs(factor - 1) < 1e-9) return size;
  const scaled = {
    width: roundNumber((Number(size?.width) || 0) * factor),
    height: roundNumber((Number(size?.height) || 0) * factor)
  };
  for (const key of ["minX", "minY", "maxX", "maxY"]) {
    if (Number.isFinite(Number(size?.[key]))) scaled[key] = roundNumber(Number(size[key]) * factor);
  }
  return scaled;
}

function canvasLengthScale(env = {}) {
  const scale = Number(env.canvasScale);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function nodeCanvasEnv(env = {}, options = {}) {
  const scale = nodeCanvasScale(options, env);
  if (Math.abs(scale - canvasLengthScale(env)) < 1e-9) return env;
  return { ...env, canvasScale: scale };
}

function nodeCanvasScale(options = {}, env = {}) {
  const base = canvasLengthScale(env);
  if (!tikzBoolean(options["transform shape"])) return base;
  const transformScale = Number(env.transform?.scale);
  return base * (Number.isFinite(transformScale) && transformScale > 0 ? transformScale : 1);
}

function scaleCanvasStyle(style = {}, env = {}) {
  const scale = canvasLengthScale(env) * (Number(env.styleScale) || 1);
  if (Math.abs(scale - 1) < 1e-9) return style;
  const scaled = { ...style };
  if (Number.isFinite(Number(scaled.lineWidth))) scaled.lineWidth = Number(scaled.lineWidth) * scale;
  if (Number.isFinite(Number(scaled.shortenStart))) scaled.shortenStart = Number(scaled.shortenStart) * scale;
  if (Number.isFinite(Number(scaled.shortenEnd))) scaled.shortenEnd = Number(scaled.shortenEnd) * scale;
  if (Array.isArray(scaled.dashArray)) scaled.dashArray = scaled.dashArray.map((value) => value * scale);
  if (scaled.markerStart) scaled.markerStart = scaleArrowTipMetrics(scaled.markerStart, scale);
  if (scaled.markerEnd) scaled.markerEnd = scaleArrowTipMetrics(scaled.markerEnd, scale);
  return scaled;
}

function tikzkitStyleScale(options = {}, env = {}) {
  const value = evaluateMath(options["tikzkit pgfplots style scale"] ?? 1, env.variables || {});
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function pathStyleScaleEnv(env = {}, options = {}) {
  const scale = tikzkitStyleScale(options, env);
  if (Math.abs(scale - 1) < 1e-9) return env;
  return { ...env, styleScale: (Number(env.styleScale) || 1) * scale };
}

function scaleArrowTipMetrics(tip, scale) {
  return {
    ...tip,
    length: Number.isFinite(Number(tip.length)) ? Number(tip.length) * scale : tip.length,
    width: Number.isFinite(Number(tip.width)) ? Number(tip.width) * scale : tip.width
  };
}

function nodeFontScale(options = {}, env = {}) {
  return fontScaleFromTikzFont(options.font ?? env.pictureOptions?.font) * nodeOptionScale(options, env);
}

function resolvedTextFontSpec(text, options = {}, env = {}, geometricScale = 1) {
  const scopeFont = env.pictureOptions?.font;
  const nodeFont = Object.hasOwn(options, EXPLICIT_NODE_FONT) ? options[EXPLICIT_NODE_FONT] : options.font;
  const resolved = resolveFontSpec({
    document: createFontSpec(),
    scope: parseTikzFontPatch(scopeFont, { source: "scope" }),
    nodeOption: nodeFont === undefined || nodeFont === null
      ? null
      : parseTikzFontPatch(nodeFont, { source: "node-option" }),
    contentCommand: leadingContentFontPatch(text)
  });
  return scaleResolvedFontSpec(resolved, geometricScale);
}

function leadingContentFontPatch(text) {
  let source = stripOuterBraces(String(text ?? "").trim());
  const phantom = source.match(/^\\(?:phantom|hphantom|vphantom)\s*/);
  if (phantom) {
    const group = readBalancedPrefix(source.slice(phantom[0].length), "{", "}");
    if (group && !source.slice(phantom[0].length + group.end).trim()) source = group.content.trim();
  }
  if (source.startsWith("$$")) source = source.slice(2).trimStart();
  else if (source.startsWith("$")) source = source.slice(1).trimStart();
  else if (source.startsWith("\\[")) source = source.slice(2).trimStart();
  let prefix = "";
  while (source) {
    const declaration = source.match(
      /^(?:\\(?:Huge|huge|LARGE|Large|large|normalsize|small|footnotesize|scriptsize|tiny|tikzkithelvetfamily|rmfamily|sffamily|ttfamily|normalfont|rm|sf|tt|mdseries|bfseries|bf|boldmath|unboldmath|sansmath|unsansmath|upshape|itshape|slshape|scshape)\b|\\fontsize\s*\{[^{}]+\}\s*\{[^{}]+\}\s*\\selectfont\b)\s*/
    );
    if (!declaration) break;
    prefix += declaration[0];
    source = source.slice(declaration[0].length);
  }
  return parseTikzFontPatch(prefix, { source: "content-command" });
}

function scaleResolvedFontSpec(font, scale = 1) {
  const factor = Number(scale);
  if (!Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 1e-9) return font;
  return mergeFontSpec(font, {
    sizePt: font.sizePt * factor,
    baselineSkipPt: font.baselineSkipPt * factor,
    source: font.source
  });
}

function nodeFontScaleForText(normalized, options = {}, env = {}) {
  return normalized?.explicitFontSize ? nodeOptionScale(options, env) : nodeFontScale(options, env);
}

function nodeTextMetricScaleForText(normalized, scale = 1) {
  const factor = Number.isFinite(Number(scale)) && Number(scale) > 0 ? Number(scale) : 1;
  if (normalized?.kind !== "text") return factor;
  const lines = normalized.lines?.length ? normalized.lines : String(normalized.text || "").split(/\\\\|\n/);
  const nonEmptyLines = lines.map((line) => String(line || "").trim()).filter(Boolean);
  if (nonEmptyLines.length !== 1) return factor;
  const math = parseMathText(nonEmptyLines[0]);
  return math ? effectiveMathFontScale(math.tex, factor) : factor;
}

function nodeOptionScale(options = {}, env = { variables: {} }) {
  if (options.scale === undefined || options.scale === null || options.scale === true || options.scale === "") return 1;
  const scale = evaluateMath(options.scale, env.variables);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function inheritedNodeOptions(env = {}) {
  const options = { ...(env.pictureOptions || {}) };
  const nodesOptions = parseInheritedNodesOption(options.nodes);
  delete options.nodes;
  delete options.scale;
  delete options.rotate;
  delete options.xshift;
  delete options.yshift;
  delete options.shift;
  if (env.styles?.["every path"]) options["every path"] = true;
  if (env.styles?.["every node"]) options["every node"] = true;
  return resolveDynamicOptions({ ...options, ...nodesOptions }, env);
}

function resolvedNodeLayerFont(localOptions = {}, env = {}) {
  if (Object.hasOwn(localOptions, "font")) return localOptions.font;
  return inheritedNodeStyleFont(env);
}

function inheritedNodeStyleFont(env = {}) {
  const pictureOptions = env.pictureOptions || {};
  const hasNodeStyleLayer = Boolean(env.styles?.["every node"]) || Object.hasOwn(pictureOptions, "nodes");
  if (!hasNodeStyleLayer) return null;

  // `font` on the picture is already the scope layer in resolvedTextFontSpec.
  // `every node` and `nodes={...}` are installed for each node afterwards, so
  // their resolved font needs to be carried as a node layer rather than only
  // contributing the legacy layout scale.
  const nodeStyleOptions = {
    ...(env.styles?.["every node"] ? { "every node": true } : {}),
    ...parseInheritedNodesOption(pictureOptions.nodes)
  };
  const inherited = normalizeOptions("node", nodeStyleOptions, env).options;
  return inherited.font ?? null;
}

function parseInheritedNodesOption(rawNodes) {
  const parsed = {};
  if (rawNodes === undefined || rawNodes === null || rawNodes === true) return parsed;
  const values = Array.isArray(rawNodes) ? rawNodes : [rawNodes];
  for (const value of values) {
    Object.assign(parsed, parseOptions(String(value)));
  }
  return parsed;
}

function scaleTextMetricBox(box, scale = 1) {
  const factor = Number.isFinite(scale) && scale > 0 ? scale : 1;
  if (Math.abs(factor - 1) < 1e-9) return box;
  return {
    ...box,
    width: box.width * factor,
    height: box.height * factor
  };
}

function textEngineMetricOptions(env = {}, text = null, options = {}, normalized = null) {
  const normalizedOptions = normalizeOptions("node", options, env);
  const { semantic } = normalizedOptions;
  const metricOptions = {
    textEngine: options["tikzkit fixed typewriter metrics"] ? null : env.textEngine || null,
    textEngineUnit: Number(env.textEngineUnit) || TIKZ_UNIT,
    lineBreakMode: nodeTextWrapMode(normalizedOptions.options, semantic)
  };
  if (text === null || text === undefined) return metricOptions;
  const normalizedText = normalized || normalizeTikzText(text, env);
  metricOptions.font = resolvedTextFontSpec(
    text,
    options,
    env,
    env.canvasScale * nodeOptionScale(options, env)
  );
  metricOptions.fontMetricNormalization = nodeFontScaleForText(normalizedText, options, env) * env.canvasScale;
  return metricOptions;
}

function estimateMatrixCellSize(text, options = {}, env = { variables: {} }) {
  if (options.circle || options.shape === "circle") return estimateNodeSize(text, options, env);

  const normalized = normalizeTikzText(text, env);
  if (normalized.kind === "image") return estimateNodeSize(text, options, env);

  const textBox = scaleTextMetricBox(estimateTextMetricBox(normalized, {
    ...textEngineMetricOptions(env, text, options, normalized),
    widthFactor: 0.12,
    lineHeight: 0.24,
    minHeight: 0.24,
    formulaMinWidth: 0.08,
    formulaWidthPadding: 0
  }), nodeFontScaleForText(normalized, options, env));
  const innerSep = parseNodeLengthDimension(options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env);
  const textWidth = options["text width"] ? parseDimension(options["text width"], env.variables) : null;
  const textHeight = options["text height"] ? parseDimension(options["text height"], env.variables) : null;
  const textDepth = options["text depth"] ? parseDimension(options["text depth"], env.variables) : 0;
  const isEmptyText = normalized.kind === "text" && String(normalized.text || "").trim().length === 0;
  if (isEmptyText) {
    let width = Number.isFinite(textWidth) ? textWidth + innerSep * 2 : innerSep * 2;
    let height = Number.isFinite(textHeight) ? textHeight + textDepth + innerSep * 2 : innerSep * 2;
    width = Math.max(0.02, width);
    height = Math.max(0.02, height);
    if (options["minimum width"]) width = Math.max(width, parseNodeLengthDimension(options["minimum width"], env));
    if (options["minimum height"]) height = Math.max(height, parseNodeLengthDimension(options["minimum height"], env));
    if (options["minimum size"]) {
      const size = parseNodeLengthDimension(options["minimum size"], env);
      width = Math.max(width, size);
      height = Math.max(height, size);
    }
    return { width: roundNumber(width), height: roundNumber(height) };
  }
  let width = Math.max(0.22, textBox.width + 0.06 + innerSep * 2);
  let height = Math.max(0.24, textBox.height + innerSep * 2);

  if (Number.isFinite(textWidth)) width = Math.max(0.22, textWidth + innerSep * 2);
  if (Number.isFinite(textHeight)) height = Math.max(0.22, textHeight + textDepth + innerSep * 2);
  if (options["minimum width"]) width = Math.max(width, parseNodeLengthDimension(options["minimum width"], env));
  if (options["minimum height"]) height = Math.max(height, parseNodeLengthDimension(options["minimum height"], env));
  if (options["minimum size"]) {
    const size = parseNodeLengthDimension(options["minimum size"], env);
    width = Math.max(width, size);
    height = Math.max(height, size);
  }

  return { width: roundNumber(width), height: roundNumber(height) };
}

function estimateMatrixCellLayoutSize(text, options = {}, env = { variables: {} }) {
  const shape = nodeShape(options);
  if (
    shape !== "rectangle" ||
    options["text width"] ||
    options["text height"] ||
    options["minimum width"] ||
    options["minimum height"] ||
    options["minimum size"]
  ) {
    return estimateNodeSize(text, options, env);
  }
  return estimateMatrixCellSize(text, options, env);
}

function estimateNodeLayoutSize(text, options = {}, env = { variables: {} }) {
  if (options["op amp"]) return circuitikzOpAmpSize(env);
  if (options.ground) return circuitikzGroundSize(env);
  if (circuitikzMosfetNodeKind(options)) return circuitikzMosfetNodeSize(env);
  if (circuitikzTransistorKind(options)) return circuitikzTransistorSize(env);
  if (circuitikzTubeKind(options)) return circuitikzTubeSize(env, options);
  if (circuitikzQuadpoleKind(options)) return circuitikzQuadpoleSize(env, options);
  if (options["tikzkit tkz axis tick label"]) return estimateTkzAxisTickLabelSize(text, options, env);
  if (nodeUsesBoxSizing(options, env)) return estimateNodeSize(text, options, env);
  return estimateCompactTextSize(text, options, env);
}

function estimateTkzAxisTickLabelSize(text, options = {}, env = { variables: {} }) {
  const compact = estimateCompactTextSize(text, options, env);
  const match = String(text || "").trim().match(/^\$\s*(\d+)\s*\$$/);
  if (!match) return compact;

  // tkz-base applies \scriptsize to the common Cartesian frame. For simple
  // integer graduations, use the local CMR optical-size digit advance instead
  // of the generic filled-node minimum. The two-sided padding is still driven
  // by TikZ's explicit 1pt inner sep option.
  const font = resolvedTextFontSpec(text, options, env, env.canvasScale * nodeOptionScale(options, env));
  const fontSizePt = Number(font.sizePt) || 10;
  const designSize = computerModernRomanDesignSize(fontSizePt);
  const digitScale = {
    5: 1.361132,
    6: 1.2,
    7: 1.138895,
    8: 1.062515,
    9: 1.027771,
    10: 1
  }[designSize] || 1;
  const innerXSep = parseNodeLengthDimension(options["inner xsep"] ?? options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env);
  const digitAdvance = (5 * (fontSizePt / 10) * digitScale) / TEX_PT_PER_CM;
  const width = Math.max(0.08, match[1].length * digitAdvance + innerXSep * 2);

  return { ...compact, width: roundNumber(width) };
}

function estimateNodeAnchorSize(text, options = {}, env = { variables: {} }, visibleSize = null) {
  const size = visibleSize || estimateNodeLayoutSize(text, options, env);
  const outerSep = nodeOuterSep(options, env);
  if (nodeShape(options) === "signal") {
    const geometry = symbolSignalGeometry(size, nodeShapeData(options, env, text));
    const minX = roundNumber(geometry.anchors.west.x - outerSep.x);
    const minY = roundNumber(geometry.anchors.south.y - outerSep.y);
    const maxX = roundNumber(geometry.anchors.east.x + outerSep.x);
    const maxY = roundNumber(geometry.anchors.north.y + outerSep.y);
    return {
      width: roundNumber(geometry.bounds.maxX - geometry.bounds.minX + outerSep.x * 2),
      height: roundNumber(geometry.bounds.maxY - geometry.bounds.minY + outerSep.y * 2),
      minX,
      minY,
      maxX,
      maxY
    };
  }
  if (nodeShape(options) === "regularPolygon") {
    const sides = regularPolygonSides(options, env);
    // PGF grows a regular polygon's anchor border by the mitre distance of
    // the side, rather than by a rectangular x/y outer separation.
    const outerRadius =
      Math.max(Number(size.width) || 0, Number(size.height) || 0) / 2 +
      regularPolygonOuterRadiusExtension(Math.max(outerSep.x, outerSep.y), sides);
    const diameter = roundNumber(Math.max(0, outerRadius * 2));
    return { width: diameter, height: diameter };
  }
  return {
    width: roundNumber((Number(size.width) || 0) + outerSep.x * 2),
    height: roundNumber((Number(size.height) || 0) + outerSep.y * 2)
  };
}

function nodeTextAnchorOffsets(text, options = {}, env = {}, visibleSize = {}) {
  const shape = nodeShape(options);
  const canvasScale = canvasLengthScale(env);
  const font = resolvedTextFontSpec(text, options, env, canvasScale);
  const midOffset = (0.5 * 4.30554 * (Number(font.sizePt) || 10) / 10) / TEX_PT_PER_CM;
  if (shape !== "rectangle" && shape !== "roundedRectangle") {
    return { baseOffset: 0, midOffset: roundNumber(midOffset) };
  }

  const normalized = normalizeTikzText(text, env);
  const lines = normalized.lines?.length ? normalized.lines : String(normalized.text || "").split(/\\\\|\n/);
  const line = String(lines[0] || "").trim();
  let height = Number.NaN;
  let depth = Number.NaN;
  const math = parseMathText(line);
  if (math && lines.length === 1) {
    const formula = estimateFormulaBox(math.tex, {
      scale: (Number(font.sizePt) || 10) / 10,
      minWidth: 0,
      widthPadding: 0,
      texTextMetrics: true
    });
    height = formula.height;
    depth = formula.depth;
  } else if (line && lines.length === 1) {
    const measured = measurePlainTextTeXBoxPt(line, {
      fontSizePt: Number(font.sizePt) || 10,
      fontFamily: font.family
    });
    if (measured) {
      height = measured.height / TEX_PT_PER_CM;
      depth = measured.depth / TEX_PT_PER_CM;
    }
  }

  if (options["text height"] !== undefined) height = parseNodeLengthDimension(options["text height"], env) * canvasScale;
  if (options["text depth"] !== undefined) depth = parseNodeLengthDimension(options["text depth"], env) * canvasScale;
  if (!Number.isFinite(height) || !Number.isFinite(depth)) {
    const innerYSep = parseNodeLengthDimension(options["inner ysep"] ?? options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env) * canvasScale;
    const contentHeight = Math.max(0, (Number(visibleSize.height) || 0) - innerYSep * 2);
    height = Number.isFinite(height) ? height : contentHeight * 0.8;
    depth = Number.isFinite(depth) ? depth : contentHeight * 0.2;
  }
  const baseOffset = (depth - height) / 2;
  return {
    baseOffset: roundNumber(baseOffset),
    midOffset: roundNumber(baseOffset + midOffset)
  };
}

function nodeOuterSep(options = {}, env = { variables: {} }) {
  if (!nodeUsesBoxSizing(options, env)) return { x: 0, y: 0 };
  const { style } = normalizeOptions("node", options, env);
  const defaultSep = Math.max(0, (Number(style.lineWidth) || 0) / TIKZ_UNIT / 2);
  return {
    x: parseOuterSepDimension(options["outer xsep"] ?? options["outer sep"], defaultSep, env),
    y: parseOuterSepDimension(options["outer ysep"] ?? options["outer sep"], defaultSep, env)
  };
}

function scaleNodeOuterSep(separation = {}, env = {}) {
  const scale = canvasLengthScale(env);
  return {
    x: roundNumber(Math.max(0, Number(separation.x) || 0) * scale),
    y: roundNumber(Math.max(0, Number(separation.y) || 0) * scale)
  };
}

function parseOuterSepDimension(value, fallback, env) {
  if (value === undefined || value === null || value === true || value === "" || String(value).trim() === "auto") {
    return fallback;
  }
  const parsed = parseNodeLengthDimension(value, env);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseNodeLengthDimension(value, env = { variables: {} }) {
  const substituted = substituteVariables(value ?? "", env.variables || {}).trim();
  if (/^\{?\s*[-+]?(?:\d+\.?\d*|\.\d+)\s*\}?$/.test(substituted)) {
    return parseDimension(`${substituted.replace(/[{}]/g, "").trim()}pt`, env.variables);
  }
  return parseDimension(value, env.variables);
}

function nodeUsesBoxSizing(options = {}, env = { variables: {} }) {
  const { style, semantic } = normalizeOptions("node", options, env);
  return Boolean(
    style.stroke !== "none" ||
      style.fill !== "none" ||
      semantic.draw ||
      semantic.shading ||
      options.circle ||
      options["knot crossing"] ||
      options.ellipse ||
      options["op amp"] ||
      options.ground ||
      options.shape ||
      options.signal ||
      options["minimum width"] ||
      options["minimum height"] ||
      options["minimum size"] ||
      options["text width"]
  );
}

function shouldFitTextToNodeBox(options = {}) {
  return Boolean(nodeShape(options) === "circle" && options["minimum size"]);
}

function estimateCompactTextSize(text, options = {}, env = { variables: {} }) {
  const normalized = normalizeTikzText(text, env);
  if (normalized.kind === "image") return estimateNodeSize(text, options, env);
  if (isEmptyNormalizedText(normalized)) return estimateEmptyTextNodeSize(options, env);
  const typewriter = nodeUsesTypewriterFont(normalized, options, env);

  const textBox = scaleTextMetricBox(estimateTextMetricBox(normalized, {
    ...textEngineMetricOptions(env, text, options, normalized),
    // cmtt10.tfm advances every glyph by 0.524996em (5.24996pt at 10pt).
    widthFactor: typewriter ? 0.184516 : 0.13,
    fixedCharWidth: typewriter ? 0.184516 : undefined,
    texTextMetrics: Boolean(options["axis tick label"]),
    formulaTexTextMetrics: Boolean(options["axis tick label"] || options["axis label"]),
    // cmtt10's visual glyph box is about 6.38pt at \normalsize.  Keep its
    // width fixed separately above while matching PGF's native split height.
    lineHeight: typewriter ? 0.2244 : 0.18,
    lineGap: typewriter ? 0.184516 : undefined,
    minHeight: 0.18,
    formulaMinWidth: 0.08,
    formulaWidthPadding: 0.08
  }), nodeTextMetricScaleForText(normalized, nodeFontScaleForText(normalized, options, env)));
  const innerSep = parseNodeLengthDimension(compactTextInnerSepOption(normalized, options), env);
  const width = Math.max(0.08, textBox.width + innerSep * 2);
  const height = Math.max(0.08, textBox.height + innerSep * 2);

  return { width: roundNumber(width), height: roundNumber(height) };
}

function compactTextInnerSepOption(normalized, options = {}) {
  if (options["inner sep"] !== undefined) return options["inner sep"];
  return TIKZ_DEFAULT_INNER_SEP;
}

function nodeUsesMonospaceFont(text, options = {}, env = {}) {
  return Boolean(resolveFontFamily(options.font || env.pictureOptions?.font) || resolveFontFamily(text));
}

function nodeUsesTypewriterFont(normalizedOrText, options = {}, env = {}) {
  const textFont =
    typeof normalizedOrText === "object" && normalizedOrText
      ? normalizedOrText.fontFamily || resolveFontFamily(normalizedOrText.raw || normalizedOrText.text)
      : resolveFontFamily(normalizedOrText);
  const optionFont = resolveFontFamily(options.font || env.pictureOptions?.font);
  return fontFamilyUsesTypewriter(`${textFont || ""} ${optionFont || ""}`);
}

function fontFamilyUsesTypewriter(fontFamily) {
  return /(?:Typewriter|mono|Menlo|Monaco|Consolas|Courier)/i.test(String(fontFamily || ""));
}

function estimatePositioningSelfSize(text, options = {}, env = { variables: {} }, fallback = null) {
  if (!hasPositioningOfOption(options) || nodeUsesBoxSizing(options, env)) return fallback || estimateNodeAnchorSize(text, options, env);
  const normalized = normalizeTikzText(text, env);
  if (normalized.kind !== "text") {
    return fallback || estimateNodeAnchorSize(text, options, env);
  }
  const positioningMath = parseMathText(String(normalized.text || "").trim());
  if (positioningMath) {
    const useTexFormulaWidth = positioningFormulaNeedsTexMetrics(positioningMath.tex);
    if (!useTexFormulaWidth) return fallback || estimateNodeAnchorSize(text, options, env);
    const textBox = scaleTextMetricBox(estimateTextMetricBox(normalized, {
      ...textEngineMetricOptions(env, text, options, normalized),
      widthFactor: 0.187,
      lineHeight: 0.18,
      minHeight: 0.18,
      formulaMinWidth: 0.08,
      formulaWidthPadding: positioningFormulaWidthPadding(positioningMath.tex),
      formulaTexTextMetrics: true
    }), nodeFontScaleForText(normalized, options, env));
    const innerSep = parseNodeLengthDimension(options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env);
    return {
      width: roundNumber(Math.max(fallback?.width || 0.08, textBox.width + innerSep * 2)),
      height: roundNumber(Math.max(fallback?.height || 0.08, textBox.height + innerSep * 2))
    };
  }
  if (isEmptyNormalizedText(normalized)) return estimateEmptyTextNodeSize(options, env);
  const textBox = scaleTextMetricBox(estimateTextMetricBox(normalized, {
    ...textEngineMetricOptions(env, text, options, normalized),
    widthFactor: 0.187,
    lineHeight: 0.18,
    minHeight: 0.18,
    formulaMinWidth: 0.08,
    formulaWidthPadding: 0
  }), nodeFontScaleForText(normalized, options, env));
  const innerSep = parseNodeLengthDimension(options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env);
  return {
    width: roundNumber(Math.max(fallback?.width || 0.08, textBox.width + innerSep * 2)),
    height: roundNumber(Math.max(fallback?.height || 0.08, textBox.height + innerSep * 2))
  };
}

function positioningFormulaNeedsTexMetrics(tex) {
  const fallback = mathFallbackText(tex);
  return /\\(?:vec|overrightarrow)(?![A-Za-z])/.test(String(tex || "")) || /[(),;]/.test(fallback) || mathTextMetricUnits(fallback) >= 4.5;
}

function positioningFormulaWidthPadding(tex) {
  return /\\(?:vec|overrightarrow)(?![A-Za-z])/.test(String(tex || "")) ? 0.4 : 0.16;
}

function isEmptyNormalizedText(normalized) {
  return normalized?.kind === "text" && String(normalized.text || "").trim().length === 0;
}

function estimateEmptyTextNodeSize(options = {}, env = { variables: {} }) {
  const innerXSep = parseNodeLengthDimension(options["inner xsep"] ?? options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env);
  const innerYSep = parseNodeLengthDimension(options["inner ysep"] ?? options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env);
  const textWidth = options["text width"] ? parseDimension(options["text width"], env.variables) : NaN;
  const textHeight = options["text height"] ? parseDimension(options["text height"], env.variables) : NaN;
  const textDepth = options["text depth"] ? parseDimension(options["text depth"], env.variables) : 0;
  return {
    width: roundNumber(Math.max(0.02, (Number.isFinite(textWidth) ? textWidth : 0) + innerXSep * 2)),
    height: roundNumber(Math.max(0.02, (Number.isFinite(textHeight) ? textHeight + textDepth : 0) + innerYSep * 2))
  };
}

function hasPositioningOfOption(options = {}) {
  for (const direction of ["right", "left", "above", "below", "above right", "above left", "below right", "below left"]) {
    const value = options[direction];
    if (value !== undefined && value !== true && /\bof\b/.test(String(value))) return true;
  }
  return false;
}

function estimateNodeSize(text, options = {}, env = { variables: {} }) {
  if (options["tikzcd label"]) return estimateTikzCdLabelSize(text, options, env);
  const normalized = normalizeTikzText(text, env);
  const shapeScale = nodeOptionScale(options, env);
  const unscaledTextMetricScale = nodeTextMetricScaleForText(
    normalized,
    nodeFontScaleForText(normalized, options, env) / shapeScale
  );
  if (normalized.kind === "image") {
    const contentScale = nodeFontScale(options, env) / shapeScale;
    const innerSep = parseNodeLengthDimension(options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env);
    let width = normalized.width * contentScale + innerSep * 2;
    let height = normalized.height * contentScale + innerSep * 2;
    if (options["minimum width"]) width = Math.max(width, parseNodeLengthDimension(options["minimum width"], env));
    if (options["minimum height"]) height = Math.max(height, parseNodeLengthDimension(options["minimum height"], env));
    if (options["minimum size"]) {
      const size = parseNodeLengthDimension(options["minimum size"], env);
      width = Math.max(width, size);
      height = Math.max(height, size);
    }
    return scaleSize({
      width: roundNumber(width),
      height: roundNumber(height)
    }, shapeScale);
  }
  const shape = nodeShape(options);
  const isCircleShape = shape === "circle" || shape === "circleCrossSplit";
  const typewriter = nodeUsesTypewriterFont(normalized, options, env);
  const inlineMathLabelMetrics = Boolean(options["tikzkit inline math label metrics"]);
  const datavisLegendMathMetrics = Boolean(options["tikzkit datavis legend math metrics"]);
  const multilineFormulaCircle = isCircleShape && nodeHasMultipleMathLines(normalized);
  const formulaNeedsTexMetrics = normalizedFormulaNeedsTexMetrics(normalized);
  const textWidth = options["text width"] ? parseDimension(options["text width"], env.variables) : null;
  const normalizedOptions = normalizeOptions("node", options, env);
  const wholeMathLines =
    normalized.lines?.length &&
    normalized.lines.every((line) => Boolean(parseMathText(String(line || "").trim())));
  // Mindmap concepts are circles whose `text width` is a real paragraph
  // constraint. Ordinary circles retain their compact label sizing.
  const conceptCircleTextWidth = isCircleShape && isConceptNodeOptions(options);
  const usesParagraphTextWidth =
    Number.isFinite(textWidth) && textWidth > 0 && (!isCircleShape || conceptCircleTextWidth) && !wholeMathLines;
  const hasScopedLineFontScale = normalized.lineStyles?.some(
    (style) => Math.abs((Number(style?.scale) || 1) - 1) > 1e-6
  );
  const prewrapTextWidth =
    usesParagraphTextWidth && (conceptCircleTextWidth || hasScopedLineFontScale);
  // TeX applies a scoped font declaration before it packs a text-width
  // paragraph. Reuse the renderer's per-line wrapping input here so a line
  // such as `{\small ...}` cannot reserve a normal-size phantom line in the
  // node's PGF bounding box.
  const metricNormalized =
    prewrapTextWidth
      ? wrappedTextMetricNormalized(
          normalized,
          textWidth,
          nodeTextWrapMode(normalizedOptions.options, normalizedOptions.semantic),
          { hyphenate: !conceptCircleTextWidth }
        )
      : normalized;
  // The text engine can measure an unwrapped paragraph at `text width`, but
  // metricNormalized already contains those wrapped lines. Passing the width
  // again would make every physical line reserve a full paragraph height.
  const textWidthForTextEngine =
    usesParagraphTextWidth && !prewrapTextWidth ? textWidth : null;
  const lines = textMetricLines(metricNormalized);
  const paragraphFont = usesParagraphTextWidth
    ? resolvedTextFontSpec(text, options, env)
    : null;
  const textBox = scaleTextMetricBox(estimateTextMetricBox(
    metricNormalized,
    isCircleShape
      ? {
          ...textEngineMetricOptions(env, text, options, metricNormalized),
          textWidth: textWidthForTextEngine,
          texTextMetrics: !typewriter,
          fixedCharWidth: typewriter ? 0.187 : undefined,
          widthFactor: 0.09,
          formulaWidthFactor: datavisLegendMathMetrics ? 0.08 : 0.09,
          formulaMinWidth: datavisLegendMathMetrics ? 0.18 : 0.32,
          lineHeight: typewriter ? 0.236 : 0.32,
          minHeight: typewriter ? 0.236 : 0.28,
          widthPadding: 0,
          // The SVG math engine measures the renderer's line box, which is
          // intentionally wider than TeX's packed inline math box. Native
          // datavisualization legends and circle nodes with multiple math
          // rows size themselves from the latter.
          disableMathTextEngine: datavisLegendMathMetrics || multilineFormulaCircle,
          formulaTexTextMetrics: datavisLegendMathMetrics ? false : true,
          // PGF's circle shape takes the Euclidean norm of the actual TeX
          // text-box half-width and half-height. Multi-line math needs no
          // circle-only horizontal reserve: its widest measured row already
          // defines the TeX box used by that construction.
          formulaWidthPadding: datavisLegendMathMetrics ? 0.02 : multilineFormulaCircle ? 0 : 0.08,
          compactVectorFormulaWidthPadding: 0,
          longSubscriptVectorFormulaWidthPadding: 0.08,
          shortFormulaWidthPadding: 0.02,
          shortFormulaMaxUnits: 1.6
        }
      : {
          ...textEngineMetricOptions(env, text, options, metricNormalized),
          textWidth: textWidthForTextEngine,
          texTextMetrics: !typewriter,
          fixedCharWidth: typewriter ? 0.187 : undefined,
          widthFactor: datavisLegendMathMetrics ? 0.08 : 0.16,
          formulaWidthFactor: datavisLegendMathMetrics ? 0.08 : 0.17,
          formulaMinWidth: 0.08,
          // PGF's diamond shape uses the actual TeX height plus depth before
          // adding its inner separation. The generic node floor is useful for
          // labels, but makes short formulas such as $q_0$ grow the diamond.
          formulaMinHeight: shape === "diamond" ? 0 : 0.36,
          lineHeight: typewriter ? 0.236 : 0.32,
          minHeight: typewriter ? 0.236 : 0.28,
          widthPadding: 0,
          // A formula selected for TeX metrics must also bypass browser text
          // measurement; otherwise its node box and its SVG fallback use
          // unrelated advances (notably for AMS relation symbols).
          disableMathTextEngine: datavisLegendMathMetrics || formulaNeedsTexMetrics,
          formulaTexTextMetrics: datavisLegendMathMetrics
            ? false
            : shortVectorExpressionNeedsCompactMetrics(normalized)
              ? false
              : shape === "roundedRectangle" || inlineMathLabelMetrics || formulaNeedsTexMetrics,
          formulaWidthPadding: datavisLegendMathMetrics ? 0.02 : inlineMathLabelMetrics ? 0.35 : shape === "roundedRectangle" || formulaNeedsTexMetrics ? 0 : 0.14,
          shortFormulaWidthPadding: datavisLegendMathMetrics ? 0.02 : 0.08,
          shortFormulaMaxUnits: 3
        }
  ), unscaledTextMetricScale);
  textBox.width += explicitHspaceWidth(text, env);
  const innerXSep = parseNodeLengthDimension(options["inner xsep"] ?? options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env);
  const innerYSep = parseNodeLengthDimension(options["inner ysep"] ?? options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env);
  const isEmptyText = lines.every((line) => !line.trim());
  const isEmptyCircle = isCircleShape && isEmptyText;
  const fixedCircleSize = isCircleShape ? fixedCircularMinimumSize(options, env) : null;
  if (usesParagraphTextWidth) {
    const paragraphNormalized = prewrapTextWidth
      ? metricNormalized
      : wrappedTextMetricNormalized(
          normalized,
          textWidth,
          nodeTextWrapMode(normalizedOptions.options, normalizedOptions.semantic),
          { hyphenate: !conceptCircleTextWidth }
        );
    // TikZ uses a minipage for `text width`: the first line's TeX height,
    // the paragraph baseline grid, and the last line's depth form its box.
    // Summing visible glyph boxes makes wrapped mixed-size text too short.
    const paragraphHeight = wrappedStyledParagraphHeightCm(
      paragraphNormalized,
      paragraphFont,
      unscaledTextMetricScale
    );
    // An outer `minipage` is already a fixed TeX vbox. Its renderer cache
    // describes painted glyph extents, which can be taller than the vbox and
    // previously made the surrounding TikZ node about 3pt too high. Preserve
    // the cache safeguard for ordinary `text width` nodes, but use the vbox
    // metric exactly for the minipage wrapper.
    textBox.height = options["tikzkit minipage text width"]
      ? paragraphHeight
      : Math.max(textBox.height, paragraphHeight);
    textBox.width = Math.min(textBox.width, textWidth);
  }
  // Claude: 空圆里带 cross（⊗ 乘法器/混频符号，如 case 037）若按 inner sep 撑，会小到几乎看不见。
  // 给它一个合理的默认直径，让 ⊗ 有正常大小；普通空圆（如 dropout 节点）仍保持小。
  const pgfCircleDiameter = 2 * Math.hypot(textBox.width / 2 + innerXSep, textBox.height / 2 + innerYSep);
  const emptyCircleDiameter = Math.max(parseDimension("1pt", env.variables), 2 * Math.hypot(innerXSep, innerYSep));
  const emptyCircleSize = options.cross ? Math.max(0.42, emptyCircleDiameter) : emptyCircleDiameter;
  const textHeight = options["text height"] ? parseDimension(options["text height"], env.variables) : NaN;
  const textDepth = options["text depth"] ? parseDimension(options["text depth"], env.variables) : 0;
  const emptyNodeShape = nodeShape(options);
  if (isEmptyText && emptyNodeShape === "regularPolygon") {
    const emptyWidth = Number.isFinite(textWidth) && textWidth > 0 ? textWidth + innerXSep * 2 : innerXSep * 2;
    const emptyHeight = Number.isFinite(textHeight) ? textHeight + textDepth + innerYSep * 2 : innerYSep * 2;
    return scaleSize(regularPolygonLayoutSize(emptyWidth, emptyHeight, options, env), shapeScale);
  }
  if (isEmptyText && emptyNodeShape === "star") {
    const emptyWidth = Number.isFinite(textWidth) && textWidth > 0 ? textWidth + innerXSep * 2 : innerXSep * 2;
    const emptyHeight = Number.isFinite(textHeight) ? textHeight + textDepth + innerYSep * 2 : innerYSep * 2;
    return scaleSize(starLayoutSize(emptyWidth, emptyHeight, options, env), shapeScale);
  }
  if (isEmptyText && emptyNodeShape === "cylinder") {
    const emptyWidth = Number.isFinite(textWidth) && textWidth > 0 ? textWidth + innerXSep * 2 : innerXSep * 2;
    const emptyHeight = Number.isFinite(textHeight) ? textHeight + textDepth + innerYSep * 2 : innerYSep * 2;
    return scaleSize(cylinderLayoutSize(emptyWidth, emptyHeight, options, env), shapeScale);
  }
  if (isEmptyText && emptyNodeShape === "signal") {
    const emptyWidth = Number.isFinite(textWidth) && textWidth > 0 ? textWidth + innerXSep * 2 : innerXSep * 2;
    const emptyHeight = Number.isFinite(textHeight) ? textHeight + textDepth + innerYSep * 2 : innerYSep * 2;
    return scaleSize(signalLayoutSize(emptyWidth, emptyHeight, options, env), shapeScale);
  }
  // shapes.misc cross out and strike out inherit rectangle anchors.  Their
  // foreground is drawn from southwest to northeast, so an empty node must
  // use only its configured inner/minimum dimensions rather than the normal
  // text line-height floor.
  if (isEmptyText && ["crossOut", "strikeOut"].includes(emptyNodeShape)) {
    let emptyWidth = Number.isFinite(textWidth) && textWidth > 0 ? textWidth + innerXSep * 2 : innerXSep * 2;
    let emptyHeight = Number.isFinite(textHeight) ? textHeight + textDepth + innerYSep * 2 : innerYSep * 2;
    if (options["minimum width"]) emptyWidth = Math.max(emptyWidth, parseNodeLengthDimension(options["minimum width"], env));
    if (options["minimum height"]) emptyHeight = Math.max(emptyHeight, parseNodeLengthDimension(options["minimum height"], env));
    if (options["minimum size"]) {
      const size = parseNodeLengthDimension(options["minimum size"], env);
      emptyWidth = Math.max(emptyWidth, size);
      emptyHeight = Math.max(emptyHeight, size);
    }
    return scaleSize({
      width: roundNumber(Math.max(0.02, emptyWidth)),
      height: roundNumber(Math.max(0.02, emptyHeight))
    }, shapeScale);
  }
  if (
    isEmptyText &&
    !isCircleShape &&
    !["roundedRectangle", "rectangleSplit", "diamond"].includes(emptyNodeShape) &&
    (options["minimum width"] || options["minimum height"] || options["minimum size"] || options["text width"] || options["text height"])
  ) {
    let emptyWidth = Number.isFinite(textWidth) && textWidth > 0 ? textWidth + innerXSep * 2 : innerXSep * 2;
    let emptyHeight = Number.isFinite(textHeight) ? textHeight + textDepth + innerYSep * 2 : innerYSep * 2;
    if (arrowNodeShape(emptyNodeShape)) return scaleSize(arrowNodeLayoutSize(emptyWidth, emptyHeight, options, env), shapeScale);
    if (emptyNodeShape === "trapezium") return scaleSize(trapeziumLayoutSize(emptyWidth, emptyHeight, options, env), shapeScale);
    if (options["minimum width"]) emptyWidth = Math.max(emptyWidth, parseNodeLengthDimension(options["minimum width"], env));
    if (options["minimum height"]) emptyHeight = Math.max(emptyHeight, parseNodeLengthDimension(options["minimum height"], env));
    if (options["minimum size"]) {
      const size = parseNodeLengthDimension(options["minimum size"], env);
      emptyWidth = Math.max(emptyWidth, size);
      emptyHeight = Math.max(emptyHeight, size);
    }
    if (emptyNodeShape === "isoscelesTriangle") {
      return scaleSize(isoscelesTriangleLayoutSize(emptyWidth, emptyHeight, options, env), shapeScale);
    }
    return scaleSize({
      width: roundNumber(Math.max(0.02, emptyWidth)),
      height: roundNumber(Math.max(0.02, emptyHeight))
    }, shapeScale);
  }
  let width = fixedCircleSize ?? (isEmptyCircle
    ? emptyCircleSize
    : textWidth
      ? textWidth + innerXSep * 2
      : Math.max(0.22, textBox.width + innerXSep * 2));
  let height = fixedCircleSize ?? (isEmptyCircle ? width : Math.max(0.35, textBox.height + innerYSep * 2));
  if (arrowNodeShape(shape)) return scaleSize(arrowNodeLayoutSize(width, height, options, env), shapeScale);
  if (shape === "trapezium") {
    return scaleSize(trapeziumLayoutSize(width, height, options, env), shapeScale);
  }
  if (shape === "star") {
    return scaleSize(starLayoutSize(width, height, options, env), shapeScale);
  }
  if (shape === "cylinder") {
    return scaleSize(cylinderLayoutSize(width, height, options, env), shapeScale);
  }
  if (shape === "signal") {
    return scaleSize(signalLayoutSize(width, height, options, env), shapeScale);
  }
  if (shape === "diamond" && !options["bpmn gateway"]) {
    ({ width, height } = diamondLayoutSize(width, height, options, env));
  } else if (shape === "ellipse") {
    const minWidth = options["minimum width"] ? parseNodeLengthDimension(options["minimum width"], env) : NaN;
    const minHeight = options["minimum height"] ? parseNodeLengthDimension(options["minimum height"], env) : NaN;
    const minSize = options["minimum size"] ? parseNodeLengthDimension(options["minimum size"], env) : NaN;
    const hasExplicitWidth = Number.isFinite(minWidth) || Number.isFinite(minSize);
    const hasExplicitHeight = Number.isFinite(minHeight) || Number.isFinite(minSize);
    width = hasExplicitWidth ? width : width * Math.SQRT2;
    height = hasExplicitHeight ? height : height * Math.SQRT2;
    if (Number.isFinite(minWidth)) width = Math.max(width, minWidth);
    if (Number.isFinite(minHeight)) height = Math.max(height, minHeight);
    if (Number.isFinite(minSize)) {
      width = Math.max(width, minSize);
      height = Math.max(height, minSize);
    }
  } else {
    if (options["minimum width"]) width = Math.max(width, parseNodeLengthDimension(options["minimum width"], env));
    if (options["minimum height"]) height = Math.max(height, parseNodeLengthDimension(options["minimum height"], env));
    if (options["minimum size"]) {
      const size = parseNodeLengthDimension(options["minimum size"], env);
      width = Math.max(width, size);
      height = Math.max(height, size);
    }
  }
  if (options["rectangle split"] && options["rectangle split horizontal"]) {
    const parts = Number(options["rectangle split parts"] || 1);
    const count = Number.isFinite(parts) && parts > 0 ? Math.round(parts) : 1;
    width = Math.max(width, rectangleSplitHorizontalMinPartWidth(env) * count);
  }
  if (isCircleShape) {
    const shouldCircumscribe = circleNeedsDiagonalFit(normalized, textBox, isEmptyCircle, null);
    const circumscribed = shouldCircumscribe ? pgfCircleDiameter : 0;
    const diameter = Math.max(width, height, circumscribed, compactMathCircleMinimumDiameter(normalized));
    width = diameter;
    height = diameter;
  }
  if (shape === "diamond" && options["bpmn gateway"]) {
    const diameter = Math.max(width, height);
    width = diameter;
    height = diameter;
  }
  if (shape === "roundedRectangle") {
    if (isEmptyText && options["minimum width"]) {
      width = Math.max(parseDimension("1pt", env.variables), parseNodeLengthDimension(options["minimum width"], env) - innerXSep * 2);
    } else if (!isEmptyText) {
      width += roundedRectangleTextExtraXSep(textBox, height) * 2;
    }
  }
  if (shape === "regularPolygon") {
    const polygonContentWidth = textWidth ? textWidth + innerXSep * 2 : Math.max(0, textBox.width + innerXSep * 2);
    const polygonContentHeight = Math.max(0, textBox.height + innerYSep * 2);
    ({ width, height } = regularPolygonLayoutSize(polygonContentWidth, polygonContentHeight, options, env));
  }
  if (shape === "isoscelesTriangle") {
    ({ width, height } = isoscelesTriangleLayoutSize(width, height, options, env));
  }
  if (shape === "cloud") {
    width *= 1.28;
    height *= 1.18;
  }
  if (shape === "tikzquadsQuad") {
    width = Math.max(width, parseFiniteDimension(options["base width"], env, 6.6));
    height = Math.max(height, parseFiniteDimension(options["base height"], env, 2.8));
  }
  if (shape === "tikzquadsBlackBox") {
    width = Math.max(width, parseFiniteDimension(options["base width"], env, 3.8));
    height = Math.max(height, parseFiniteDimension(options["base height"], env, 2.8));
  }
  if (shape === "tikzquadsPgLoadLine") {
    width = Math.max(width, parseFiniteDimension(options["base width"], env, 1.8));
    height = Math.max(height, parseFiniteDimension(options["base height"], env, 1.8));
  }
  return scaleSize({ width: roundNumber(width), height: roundNumber(height) }, shapeScale);
}

function isoscelesTriangleLayoutSize(baseWidth, apexToBase, options = {}, env = {}) {
  const apexAngle = Math.max(1, Math.min(170, nodeShapeData(options, env).isoscelesTriangleApexAngle || 45));
  const halfApex = (apexAngle * Math.PI) / 360;
  // PGF defines the minimum height along the apex-to-base axis. The
  // perpendicular base width follows from the apex angle, not vice versa.
  const axis = Math.max(0.02, Number(apexToBase) || 0);
  const halfBase = Math.max((Number(baseWidth) || 0) / 2, axis * Math.tan(halfApex));
  return {
    width: roundNumber(axis),
    height: roundNumber(Math.max(0.02, halfBase * 2))
  };
}

function normalizedFormulaNeedsTexMetrics(normalized) {
  if (normalized?.kind !== "text") return false;
  const lines = normalized.lines?.length ? normalized.lines : String(normalized.text || "").split(/\\\\|\n/);
  return lines.some((line) => {
    const math = parseMathText(String(line || "").trim());
    return Boolean(
      math && (
        /[_^=+<>]|\\(?:frac|sqrt|sum|prod|int|leq|le|geq|ge|neq|approx|sim)(?![A-Za-z])/.test(math.tex) ||
        containsMathFallbackSpacedOperator(mathFallbackText(math.tex))
      )
    );
  });
}

function shortVectorExpressionNeedsCompactMetrics(normalized) {
  if (normalized?.kind !== "text") return false;
  const lines = normalized.lines?.length ? normalized.lines : String(normalized.text || "").split(/\\\\|\n/);
  return lines.some((line) => {
    const math = parseMathText(String(line || "").trim());
    if (!math || !/\\(?:vec|overrightarrow)(?![A-Za-z])/.test(math.tex)) return false;
    return mathTextMetricUnits(mathFallbackText(math.tex)) <= 3.2;
  });
}

function nodeHasMultipleMathLines(normalized) {
  const rawLines = normalized?.lines?.length ? normalized.lines : String(normalized?.text || "").split(/\\\\|\n/);
  const nonEmptyLines = rawLines.filter((line) => String(line || "").trim().length);
  if (nonEmptyLines.length <= 1) return false;
  return nonEmptyLines.some((line) => Boolean(parseMathText(String(line || "").trim())));
}

function circleNeedsDiagonalFit(normalized, textBox, isEmptyCircle, fixedCircleSize) {
  if (isEmptyCircle || fixedCircleSize !== null) return false;
  if (normalized?.kind === "text" && !parseMathText(String(normalized.text || "").trim())) return true;
  const lines = normalized?.lines?.length ? normalized.lines : String(normalized?.text || "").split(/\\\\|\n/);
  const nonEmptyLines = lines.filter((line) => String(line || "").trim().length);
  if (nonEmptyLines.length > 1) return true;
  const math = parseMathText(String(nonEmptyLines[0] || "").trim());
  if (math && isCompactAccentFormula(math.tex)) return false;
  const raw = String(normalized?.raw || normalized?.text || "");
  if (/\\(?:vec|overrightarrow|hat|bar|overline)\b|[_^]/.test(raw)) return true;
  const width = Number(textBox?.width) || 0;
  const height = Number(textBox?.height) || 0;
  return height > 0.34 && width > 0 && height / width > 0.72;
}

function isCompactAccentFormula(tex) {
  const text = String(tex || "").trim();
  return /^\\(?:vec|hat|bar|overline)\s*\{\s*[A-Za-z]\s*\}$/.test(text);
}

function compactMathCircleMinimumDiameter(normalized) {
  const lines = normalized?.lines?.length ? normalized.lines : String(normalized?.text || "").split(/\\\\|\n/);
  const nonEmptyLines = lines.filter((line) => String(line || "").trim().length);
  if (nonEmptyLines.length !== 1) return 0;
  const math = parseMathText(String(nonEmptyLines[0] || "").trim());
  if (!math || /[_^]/.test(math.tex)) return 0;
  return 0.64 * (math.scale || 1);
}

function arrowNodeShape(shape) {
  return shape === "singleArrow" || shape === "doubleArrow";
}

function arrowNodeLayoutSize(contentWidth, contentHeight, options = {}, env = { variables: {} }) {
  return arrowNodeShapeLayout(contentWidth, contentHeight, options, env).size;
}

function arrowNodeShapeGeometry(text, options = {}, env = { variables: {} }) {
  const shape = nodeShape(options);
  if (!arrowNodeShape(shape)) return null;
  const contentSize = arrowNodeContentSize(text, options, env);
  return arrowNodeShapeLayout(contentSize.width, contentSize.height, options, env).geometry;
}

function arrowNodeContentSize(text, options = {}, env = { variables: {} }) {
  const contentOptions = { ...options };
  delete contentOptions.shape;
  delete contentOptions["single arrow"];
  delete contentOptions["double arrow"];
  delete contentOptions["minimum width"];
  delete contentOptions["minimum height"];
  delete contentOptions["minimum size"];
  return estimateNodeSize(text, contentOptions, env);
}

function arrowNodeShapeLayout(contentWidth, contentHeight, options = {}, env = { variables: {} }) {
  const shape = nodeShape(options);
  const data = nodeShapeData(options, env);
  const tipAngle = Math.max(5, Math.min(175, Number(data.arrowTipAngle) || 90));
  const halfTip = (tipAngle * Math.PI) / 360;
  const cotHalfTip = Math.cos(halfTip) / Math.max(1e-6, Math.sin(halfTip));
  const { style } = normalizeOptions("node", options, env);
  const halfStroke = Math.max(0, Number(style.lineWidth) || 0) / (2 * TIKZ_UNIT);
  const contentHalfX = Math.max(0, Number(contentWidth) || 0) / 2 + halfStroke;
  let bodyHalf = Math.max(0.01, Number(contentHeight) || 0) / 2 + halfStroke;
  let headHeight = Math.max(0, Number(data.arrowHeadExtend) || 0);
  let tipExtension = bodyHalf * cotHalfTip;
  const minimumSize = options["minimum size"] ? parseNodeLengthDimension(options["minimum size"], env) : 0;
  const minimumWidth = Math.max(
    minimumSize,
    options["minimum width"] ? parseNodeLengthDimension(options["minimum width"], env) : 0
  );
  const minimumHeight = Math.max(
    minimumSize,
    options["minimum height"] ? parseNodeLengthDimension(options["minimum height"], env) : 0
  );

  // pgflibraryshapes.arrows first grows the transverse text/head box for
  // minimum width, then derives the longitudinal tip geometry from that box.
  const transverseHalf = bodyHalf + headHeight;
  if (transverseHalf > 0 && transverseHalf < minimumWidth / 2) {
    const scale = (minimumWidth / 2) / transverseHalf;
    bodyHalf *= scale;
    headHeight *= scale;
    tipExtension *= scale;
  }

  const headLength = headHeight * cotHalfTip;
  const headIndent = Math.max(0, Number(data.arrowHeadIndent) || 0);
  const naturalLength = shape === "doubleArrow"
    ? 2 * (contentHalfX + tipExtension)
    : 2 * contentHalfX + tipExtension;
  const totalLength = Math.max(minimumHeight, naturalLength, 0.02);
  const tailHalf = shape === "doubleArrow"
    ? totalLength / 2 - tipExtension
    : (totalLength - tipExtension) / 2;
  const tipX = tailHalf + tipExtension;
  const beforeTipX = tailHalf - headLength;
  const beforeHeadX = beforeTipX + headIndent;
  const fullHalfHeight = bodyHalf + headHeight;
  const points = shape === "doubleArrow"
    ? [
        { name: "tip 1", x: tipX, y: 0 },
        { name: "before tip 1", x: beforeTipX, y: fullHalfHeight },
        { name: "before head 1", x: beforeHeadX, y: bodyHalf },
        { name: "after head 2", x: -beforeHeadX, y: bodyHalf },
        { name: "after tip 2", x: -beforeTipX, y: fullHalfHeight },
        { name: "tip 2", x: -tipX, y: 0 },
        { name: "before tip 2", x: -beforeTipX, y: -fullHalfHeight },
        { name: "before head 2", x: -beforeHeadX, y: -bodyHalf },
        { name: "after head 1", x: beforeHeadX, y: -bodyHalf },
        { name: "after tip 1", x: beforeTipX, y: -fullHalfHeight }
      ]
    : [
        { name: "tip", x: tipX, y: 0 },
        { name: "before tip", x: beforeTipX, y: fullHalfHeight },
        { name: "before head", x: beforeHeadX, y: bodyHalf },
        { name: "after tail", x: -tailHalf, y: bodyHalf },
        { name: "tail", x: -tailHalf, y: 0 },
        { name: "before tail", x: -tailHalf, y: -bodyHalf },
        { name: "after head", x: beforeHeadX, y: -bodyHalf },
        { name: "after tip", x: beforeTipX, y: -fullHalfHeight }
      ];
  return {
    size: {
      width: roundNumber(totalLength),
      height: roundNumber(fullHalfHeight * 2)
    },
    geometry: {
      points: points.map((point) => ({ ...point, x: roundNumber(point.x), y: roundNumber(point.y) }))
    }
  };
}

function scaleArrowNodeGeometry(geometry, scale = 1) {
  if (!geometry?.points?.length) return null;
  const factor = Number.isFinite(Number(scale)) && Number(scale) > 0 ? Number(scale) : 1;
  return {
    ...geometry,
    points: geometry.points.map((point) => ({
      ...point,
      x: roundNumber((Number(point.x) || 0) * factor),
      y: roundNumber((Number(point.y) || 0) * factor)
    }))
  };
}

function estimateTikzCdLabelSize(text, options = {}, env = { variables: {} }) {
  const normalized = normalizeTikzText(text, env);
  const textBox = scaleTextMetricBox(estimateTextMetricBox(normalized, {
    ...textEngineMetricOptions(env, text, options, normalized),
    widthFactor: 0.1,
    lineHeight: 0.16,
    minHeight: 0.13,
    formulaMinWidth: 0.04,
    formulaWidthPadding: 0
  }), nodeFontScaleForText(normalized, options, env));
  const innerXSep = parseNodeLengthDimension(options["inner xsep"] ?? options["inner sep"] ?? "0.015", env);
  const innerYSep = parseNodeLengthDimension(options["inner ysep"] ?? options["inner sep"] ?? "0.015", env);
  const width = Math.max(0.08, textBox.width + innerXSep * 2);
  const height = Math.max(0.08, textBox.height + innerYSep * 2);
  return { width: roundNumber(width), height: roundNumber(height) };
}

function explicitHspaceWidth(text, env = { variables: {} }) {
  let width = 0;
  const pattern = /\\hspace\s*\{([^{}]+)\}/g;
  let match;
  while ((match = pattern.exec(String(text || "")))) {
    width += parseDimension(match[1], env.variables);
  }
  return Number.isFinite(width) ? width : 0;
}

function fixedCircularMinimumSize(options = {}, env = { variables: {} }) {
  if (!(options.circle || options.shape === "circle") || !options["minimum size"]) return null;
  const size = parseNodeLengthDimension(options["minimum size"], env);
  return Number.isFinite(size) && size > 0 ? size : null;
}

function estimateTextMetricBox(normalized, options = {}) {
  const rawLines = normalized.lines.length ? normalized.lines : String(normalized.text || "").split(/\\\\|\n/);
  const scale = normalized.scale || 1;
  const widthFactor = options.widthFactor ?? 0.16;
  const lineHeight = options.lineHeight ?? 0.35;
  const lineGap = normalized.displayMathSequence ? Math.max(options.lineGap ?? 0.1, 0.32) : options.lineGap ?? 0.1;
  const minHeight = options.minHeight ?? lineHeight;
  const widthPadding = options.widthPadding ?? 0;
  const lineStyles = Array.isArray(normalized.lineStyles) ? normalized.lineStyles : [];
  const boxes = rawLines.map((line, index) => {
    const text = String(line).trim();
    const lineScale = scale * (Number(lineStyles[index]?.scale) || 1);
    const math = parseMathText(text);
    if (math) {
      const measured = measureMathWithTextEngine(text, math, lineScale, options);
      if (measured) return measured;
      const formulaScale = lineScale * (math.scale || 1);
      const formula = estimateFormulaBox(math.tex, {
        displayMode: math.displayMode,
        scale: formulaScale,
        minWidth: options.formulaMinWidth,
        widthFactor: options.formulaWidthFactor ?? widthFactor,
        widthPadding: formulaWidthPaddingFor(math.tex, options, widthPadding),
        texTextMetrics: Boolean(options.formulaTexTextMetrics)
      });
      const formulaMinHeight = compactMathSymbolUsesNativeHeight(math.tex) ? 0 : (options.formulaMinHeight ?? minHeight);
      return {
        width: formula.width,
        height: Math.max(formulaMinHeight * formulaScale, formulaTotalHeight(formula))
      };
    }
    const measured = measurePlainTextWithTextEngine(text, lineScale, options);
    if (measured) return measured;
    const fallback = text.replace(/\$([^$]+)\$/g, (_match, tex) => mathFallbackText(tex));
    const fixedCharWidth = Number(options.fixedCharWidth);
    const textWidth =
      Number.isFinite(fixedCharWidth) && fixedCharWidth > 0
        ? [...fallback].length * fixedCharWidth * lineScale
        : options.texTextMetrics
          ? texTextWidthCm(fallback, lineScale)
          : mathTextMetricUnits(fallback) * widthFactor * lineScale;
    return {
      width: textWidth + widthPadding,
      height: Math.max(minHeight * lineScale, lineHeight * lineScale)
    };
  });
  const maxLineScale = Math.max(scale, ...lineStyles.map((style) => scale * (Number(style?.scale) || 1)));
  return {
    width: Math.max(...boxes.map((box) => box.width), Number(normalized.boxWidth) || 0, 0),
    height: boxes.reduce((sum, box) => sum + box.height, 0) + Math.max(0, boxes.length - 1) * lineGap * maxLineScale
  };
}

function measureMathWithTextEngine(text, math, lineScale, options = {}) {
  if (options.disableMathTextEngine) return null;
  const textEngine = options.textEngine;
  if (!textEngine || typeof textEngine.measure !== "function") return null;
  let metrics = null;
  try {
    metrics = textEngine.measure({
      mode: "math",
      text,
      displayMode: Boolean(math.displayMode),
      font: options.font,
      fontSizePt: 10 * lineScale,
      fontFamily: options.fontFamily || TIKZ_FONT_FAMILY,
      fontStyle: "normal",
      fontWeight: "normal",
      textWidthPt: null,
      alignment: "center"
    });
  } catch {
    return null;
  }
  const unit = Number(options.textEngineUnit) || TIKZ_UNIT;
  const normalization = finitePositiveScale(options.fontMetricNormalization);
  const width = Number(metrics?.width) / unit / normalization;
  const height = Number(metrics?.height) / unit / normalization;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const formulaScale = lineScale * (math.scale || 1);
  const formulaMinHeight = compactMathSymbolUsesNativeHeight(math.tex) ? 0 : (options.formulaMinHeight ?? options.minHeight ?? 0);
  return {
    width,
    height: Math.max(formulaMinHeight * formulaScale, height)
  };
}

function measurePlainTextWithTextEngine(text, lineScale, options = {}) {
  const textEngine = options.textEngine;
  if (!textEngine || typeof textEngine.measure !== "function") return null;
  const textWidth = Number(options.textWidth);
  const textWidthPt = Number.isFinite(textWidth) && textWidth > 0 ? textWidth * TEX_PT_PER_CM : null;
  let metrics = null;
  try {
    metrics = textEngine.measure({
      mode: "text",
      text,
      displayMode: false,
      font: options.font,
      fontSizePt: 10 * lineScale,
      // Preserve the resolved TeX family for measurement.  In particular,
      // `font=\\tt` changes node dimensions as well as the eventual SVG
      // glyphs; falling back to the serif default here made multipart nodes
      // narrower than their PGF boxes.
      fontFamily: options.fontFamily || options.font?.family || TIKZ_FONT_FAMILY,
      fontStyle: "normal",
      fontWeight: "normal",
      textWidthPt,
      alignment: "center",
      lineBreakMode: options.lineBreakMode
    });
  } catch {
    return null;
  }
  const unit = Number(options.textEngineUnit) || TIKZ_UNIT;
  const normalization = finitePositiveScale(options.fontMetricNormalization);
  const width = Number(metrics?.width) / unit / normalization;
  const height = Number(metrics?.height) / unit / normalization;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return {
    width,
    height: metrics?.measurementKind === "tex-box" ? height : Math.max((options.minHeight ?? 0) * lineScale, height)
  };
}

function finitePositiveScale(value) {
  const scale = Number(value);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function compactMathSymbolUsesNativeHeight(tex) {
  return /^\\(?:clubsuit|diamondsuit|heartsuit|spadesuit)(?![A-Za-z])$/.test(String(tex || "").trim());
}

function formulaWidthPaddingFor(tex, options, fallback) {
  if (Number.isFinite(options.compactVectorFormulaWidthPadding) && isCompactVectorFormula(tex)) {
    if (Number.isFinite(options.longSubscriptVectorFormulaWidthPadding) && compactVectorFormulaHasLongTextSubscript(tex)) {
      return options.longSubscriptVectorFormulaWidthPadding;
    }
    return options.compactVectorFormulaWidthPadding;
  }
  const regular = options.formulaWidthPadding ?? fallback;
  const short = options.shortFormulaWidthPadding;
  if (!Number.isFinite(short)) return regular;
  const units = mathTextMetricUnits(mathFallbackText(tex));
  const maxUnits = Number.isFinite(options.shortFormulaMaxUnits) ? options.shortFormulaMaxUnits : 3;
  return units <= maxUnits ? short : regular;
}

function isCompactVectorFormula(tex) {
  return /^\\(?:vec|overrightarrow)\s*\{[^{}]+\}(?:\s*[_^][\s\S]+)?$/.test(String(tex || "").trim());
}

function compactVectorFormulaHasLongTextSubscript(tex) {
  return /_\s*(?:\{\s*)?[A-Za-z]{4,}/.test(String(tex || ""));
}

function textMetricLines(normalized) {
  const rawLines = normalized.lines.length ? normalized.lines : String(normalized.text || "").split(/\\\\|\n/);
  return rawLines.map((line) => {
    const text = String(line).trim();
    const math = parseMathText(text);
    if (math) return mathFallbackText(math.tex);
    return text.replace(/\$([^$]+)\$/g, (_match, tex) => mathFallbackText(tex));
  });
}

function wrappedStyledParagraphHeightCm(normalized, baseFont = null, scale = 1) {
  const lines = normalized?.lines?.length
    ? normalized.lines
    : String(normalized?.text || "").split(/\\\\|\n/);
  if (!Array.isArray(lines) || !lines.length) return 0;
  const styles = Array.isArray(normalized?.lineStyles) ? normalized.lineStyles : [];
  const baseFontSizePt = Number(baseFont?.sizePt) || 10 * scale;
  const baselineSkipPt = Number(baseFont?.baselineSkipPt) || baseFontSizePt * 1.2;
  const firstScale = Number(styles[0]?.scale) || 1;
  const lastScale = Number(styles.at(-1)?.scale) || 1;
  const first = measurePlainTextTeXBoxPt(lines[0], { fontSizePt: baseFontSizePt * firstScale });
  const last = measurePlainTextTeXBoxPt(lines.at(-1), { fontSizePt: baseFontSizePt * lastScale });
  if (!first || !last) {
    return (baseFontSizePt * 0.7 + Math.max(0, lines.length - 1) * baselineSkipPt + baseFontSizePt * 0.2) / TEX_PT_PER_CM;
  }
  return (
    first.height + Math.max(0, lines.length - 1) * baselineSkipPt + Math.max(0, last.depth)
  ) / TEX_PT_PER_CM;
}

function maxTextMetricUnits(lines) {
  return Math.max(...lines.map((line) => textMetricUnits(line)), 0);
}

function textMetricUnits(line) {
  return mathTextMetricUnits(line);
}

function buildGrid(from, to, pathOptions, env = {}, localCoordinates = false) {
  const scale = localCoordinates ? 1 : gridStepScale(env);
  const fallbackStep = parseDimension(pathOptions.step || 1) * scale;
  const xstep = parseDimension(pathOptions.xstep || pathOptions["x step"] || pathOptions.step || 1) * scale;
  const ystep = parseDimension(pathOptions.ystep || pathOptions["y step"] || pathOptions.step || 1) * scale;
  if (!Number.isFinite(fallbackStep) || fallbackStep <= 0 || !Number.isFinite(xstep) || xstep <= 0 || !Number.isFinite(ystep) || ystep <= 0) return [];
  const lines = [];
  const subtype = semanticSubtype(pathOptions) || "grid-line";
  const minX = Math.min(from.x, to.x);
  const maxX = Math.max(from.x, to.x);
  const minY = Math.min(from.y, to.y);
  const maxY = Math.max(from.y, to.y);
  const xTolerance = Math.max(1e-9, xstep * 0.05);
  const yTolerance = Math.max(1e-9, ystep * 0.05);
  const gridPoint = (point) => localCoordinates ? applyCoordinateTransform(point, env) : roundPoint(point);
  const addHorizontal = (y) => {
    const start = gridPoint({ x: minX, y: roundNumber(y) });
    const end = gridPoint({ x: maxX, y: roundNumber(y) });
    lines.push({
      type: "path",
      subtype,
      commands: [
        { type: "moveTo", x: start.x, y: start.y },
        { type: "lineTo", x: end.x, y: end.y }
      ]
    });
  };
  for (let x = Math.ceil((minX - xTolerance) / xstep) * xstep; x <= maxX + xTolerance; x += xstep) {
    const start = gridPoint({ x: roundNumber(x), y: minY });
    const end = gridPoint({ x: roundNumber(x), y: maxY });
    lines.push({
      type: "path",
      subtype,
      commands: [
        { type: "moveTo", x: start.x, y: start.y },
        { type: "lineTo", x: end.x, y: end.y }
      ]
    });
  }
  let horizontalCount = 0;
  for (let y = Math.ceil((minY - yTolerance) / ystep) * ystep; y <= maxY + yTolerance; y += ystep) {
    addHorizontal(y);
    horizontalCount += 1;
  }
  const transformedCap = localCoordinates ? null : transformedGridUpperCap(minY, maxY, ystep, yTolerance, env);
  if (horizontalCount === 0 && transformedCap !== null) {
    addHorizontal(transformedCap);
  }
  return lines;
}

function gridStepScale(env = {}) {
  const scale = normalizeTransform(env.transform).scale;
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function transformedGridUpperCap(minY, maxY, step, tolerance, env = {}) {
  if (!usesCustomBasis(env.basis) || maxY <= 0 || minY < 0) return null;
  const upper = Math.ceil((maxY - tolerance) / step) * step;
  if (upper <= maxY + tolerance) return null;
  if (upper > maxY + step + tolerance) return null;
  return roundNumber(upper);
}

function buildArc(current, options, env) {
  const start = Object.hasOwn(options, "start angle")
    ? evaluateMath(options["start angle"], env.variables)
    : 0;
  // TikZ accepts either an absolute `end angle` or a relative `delta angle`.
  // Do not use `||` here: an explicit `end angle=0` is meaningful, and a
  // missing end angle with a delta otherwise used to accidentally draw 360°.
  const end = Object.hasOwn(options, "end angle")
    ? evaluateMath(options["end angle"], env.variables)
    : Object.hasOwn(options, "delta angle")
      ? start + evaluateMath(options["delta angle"], env.variables)
      : 360;
  const { rx, ry } = parseArcRadii(options, env);
  const startRad = (start * Math.PI) / 180;
  const projected = usesProjectedLocalGeometry(env);
  const radialPoint = (angle) => {
    const x = rx * Math.cos(angle);
    const y = ry * Math.sin(angle);
    return projected ? projectLocalOffset(x, y, env) : { x, y };
  };
  const radialDerivative = (angle) => {
    const x = -rx * Math.sin(angle);
    const y = ry * Math.cos(angle);
    return projected ? projectLocalOffset(x, y, env) : { x, y };
  };
  const startOffset = radialPoint(startRad);
  const center = {
    x: current.x - startOffset.x,
    y: current.y - startOffset.y
  };
  const endRad = (end * Math.PI) / 180;
  const segments = Math.max(1, Math.ceil(Math.abs(end - start) / 90));
  const commands = [{ type: "moveTo", x: current.x, y: current.y }];
  if (Math.abs(rx) < 1e-12 || Math.abs(ry) < 1e-12) {
    const offset = radialPoint(endRad);
    commands.push({
      type: "lineTo",
      x: roundNumber(center.x + offset.x),
      y: roundNumber(center.y + offset.y)
    });
  } else {
    for (let i = 0; i < segments; i += 1) {
      const a0 = startRad + ((endRad - startRad) * i) / segments;
      const a1 = startRad + ((endRad - startRad) * (i + 1)) / segments;
      const k = (4 / 3) * Math.tan((a1 - a0) / 4);
      const p0 = radialPoint(a0);
      const p1 = radialPoint(a1);
      const d0 = radialDerivative(a0);
      const d1 = radialDerivative(a1);
      commands.push(
        curveToCommand(
          roundPoint({ x: center.x + p0.x + k * d0.x, y: center.y + p0.y + k * d0.y }),
          roundPoint({ x: center.x + p1.x - k * d1.x, y: center.y + p1.y - k * d1.y }),
          roundPoint({ x: center.x + p1.x, y: center.y + p1.y })
        )
      );
    }
  }
  return {
    type: "path",
    shape: "arc",
    commands,
    endPoint: { x: commands.at(-1).x, y: commands.at(-1).y }
  };
}

function parseArcRadii(options = {}, env = {}) {
  const variables = env.variables || {};
  const rawRadius = stripOuterBraces(String(options.radius ?? "1")).trim();
  const elliptical = rawRadius.match(/^([\s\S]+?)\s+and\s+([\s\S]+)$/);
  const defaultX = elliptical ? elliptical[1].trim() : rawRadius;
  const defaultY = elliptical ? elliptical[2].trim() : defaultX;
  const rx = parseDimension(options["x radius"] ?? defaultX, variables);
  const ry = parseDimension(options["y radius"] ?? defaultY, variables);
  return { rx, ry };
}

function applyPathMorphing(commands, pathOptions, env, pathStyle = {}) {
  const legacySnake = legacySnakeSpec(pathOptions, env);
  if (legacySnake) return applyLegacySnakePath(commands, legacySnake);
  const decoration = parseOptions(String(pathOptions.decoration || ""));
  if (pathOptions.decorate && decoration.brace) return applyBraceDecoration(commands, decoration, env);
  if (pathOptions.decorate && decoration.border) return applyBorderDecoration(commands, decoration, env);
  if (pathOptions.decorate && decoration.ticks) return applyTicksDecoration(commands, decoration, env);
  if (pathOptions.decorate && (decoration.waves || decoration["expanding waves"])) return applyWavesDecoration(commands, decoration, env);
  if (pathOptions.decorate && decoration["Koch snowflake"]) return applyKochSnowflakeDecoration(commands);
  const mode = decoration.snake ? "snake" : decoration.zigzag ? "zigzag" : null;
  if (!pathOptions.decorate || !mode) return commands;
  const defaultAmplitude = parseDimension("2.5pt", env.variables);
  const defaultSegmentLength = parseDimension("10pt", env.variables);
  const minimumSegmentLength = parseDimension("1pt", env.variables);
  const amplitude = Math.max(0, parseFinitePgfLength(decoration.amplitude ?? "2.5pt", env, defaultAmplitude));
  const segmentLength = Math.max(
    minimumSegmentLength,
    parseFinitePgfLength(decoration["segment length"] ?? "10pt", env, defaultSegmentLength)
  );
  // TikZ decorates the path before the arrow-tip shortening pass.  In
  // particular, adding an arrow must not alter the snake's phase or the
  // caller-provided pre/post lengths; the SVG renderer shortens only the
  // final painted line when it places the tip.
  const preLength = Math.max(0, parseFinitePgfLength(decoration["pre length"] ?? "0", env, 0));
  const postLength = Math.max(0, parseFinitePgfLength(decoration["post length"] ?? "0", env, 0));
  // PGF runs path-morphing decorations over the complete input subpath. In
  // particular, their state machines do not restart at each `--` corner and
  // pre/post lengths only apply at the subpath endpoints.
  if (mode === "snake" || mode === "zigzag") {
    return applyPathMorphingToSubpaths(commands, amplitude, segmentLength, mode, preLength, postLength);
  }
  const morphed = [];
  let current = null;
  let start = null;
  for (const command of commands) {
    if (command.type === "moveTo") {
      current = { x: command.x, y: command.y };
      start = current;
      morphed.push(command);
      continue;
    }
    if (command.type === "lineTo" && current) {
      appendMorphedLine(morphed, current, { x: command.x, y: command.y }, amplitude, segmentLength, mode, preLength, postLength);
      current = { x: command.x, y: command.y };
      continue;
    }
    if (command.type === "curveTo" && current) {
      appendMorphedCurve(morphed, current, command, amplitude, segmentLength, mode, preLength, postLength);
      current = { x: command.x, y: command.y };
      continue;
    }
    if (command.type === "closePath" && current && start) {
      appendMorphedLine(morphed, current, start, amplitude, segmentLength, mode, preLength, postLength);
      morphed.push(command);
      current = start;
      continue;
    }
    morphed.push(command);
    if ("x" in command) current = { x: command.x, y: command.y };
  }
  return morphed;
}

function legacySnakeSpec(pathOptions, env) {
  if (pathOptions.snake === undefined || pathOptions.snake === false) return null;
  const requested = String(pathOptions.snake === true ? "" : pathOptions.snake).trim().toLowerCase();
  if (requested === "none") return null;
  const mode = requested === "" || requested === "zigzag" ? "zigzag" : requested === "snake" ? "snake" : null;
  if (!mode) return null;

  const defaultAmplitude = parseDimension("2.5pt", env.variables);
  const defaultSegmentLength = parseDimension("10pt", env.variables);
  const minimumSegmentLength = parseDimension("1pt", env.variables);
  const around = legacySnakeEndpointOptions(pathOptions, "around", env);
  const before = around || legacySnakeEndpointOptions(pathOptions, "before", env);
  const after = around || legacySnakeEndpointOptions(pathOptions, "after", env);

  return {
    mode,
    amplitude: Math.max(0, parseFinitePgfLength(pathOptions["segment amplitude"] ?? "2.5pt", env, defaultAmplitude)),
    segmentLength: Math.max(
      minimumSegmentLength,
      parseFinitePgfLength(pathOptions["segment length"] ?? "10pt", env, defaultSegmentLength)
    ),
    before,
    after,
    mirrored: tikzBoolean(pathOptions["mirror snake"]),
    raise: parseFinitePgfLength(pathOptions["raise snake"] ?? "0", env, 0)
  };
}

function legacySnakeEndpointOptions(pathOptions, position, env) {
  const lineKey = `line ${position} snake`;
  const gapKey = `gap ${position} snake`;
  if (pathOptions[lineKey] !== undefined) {
    return { type: "line", length: Math.max(0, parseFinitePgfLength(pathOptions[lineKey], env, 0)) };
  }
  if (pathOptions[gapKey] !== undefined) {
    return { type: "gap", length: Math.max(0, parseFinitePgfLength(pathOptions[gapKey], env, 0)) };
  }
  return null;
}

function applyLegacySnakePath(commands, spec) {
  const morphed = [];
  let current = null;
  let start = null;

  for (const command of commands) {
    if (command.type === "moveTo") {
      morphed.push(command);
      current = { x: command.x, y: command.y };
      start = current;
      continue;
    }
    if (command.type === "lineTo" && current) {
      appendLegacySnakeLine(morphed, current, { x: command.x, y: command.y }, spec);
      current = { x: command.x, y: command.y };
      continue;
    }
    if (command.type === "closePath" && current && start) {
      appendLegacySnakeLine(morphed, current, start, spec);
      morphed.push(command);
      current = start;
      continue;
    }
    morphed.push(command);
    if ("x" in command) current = { x: command.x, y: command.y };
  }

  return morphed;
}

function appendLegacySnakeLine(commands, from, to, spec) {
  const points = [from, to];
  const length = polylineLength(points);
  if (length < 1e-12 || spec.amplitude <= 0) {
    commands.push({ type: "lineTo", x: to.x, y: to.y });
    return;
  }

  const beforeLength = Math.min(length, spec.before?.length ?? 0);
  const afterLength = Math.min(
    Math.max(0, length - beforeLength),
    spec.after?.length ?? 0
  );
  const activeLength = length - beforeLength - afterLength;
  const normalSign = spec.mirrored ? -1 : 1;
  const shiftedPoint = (distance) => {
    const sample = pointOnPolyline(points, distance);
    return {
      x: roundNumber(sample.x + sample.normal.x * spec.raise),
      y: roundNumber(sample.y + sample.normal.y * spec.raise)
    };
  };

  if (beforeLength > 1e-12) {
    const beforeEnd = pointOnPolyline(points, beforeLength);
    if (spec.before?.type === "gap") commands.push({ type: "moveTo", x: beforeEnd.x, y: beforeEnd.y });
    else commands.push({ type: "lineTo", x: beforeEnd.x, y: beforeEnd.y });
  }
  const entry = shiftedPoint(beforeLength);
  const previous = commands.at(-1);
  if (!previous || Math.hypot((previous.x ?? entry.x) - entry.x, (previous.y ?? entry.y) - entry.y) > 1e-9) {
    commands.push({ type: spec.before?.type === "gap" ? "moveTo" : "lineTo", x: entry.x, y: entry.y });
  }

  if (activeLength > 1e-12) {
    if (spec.mode === "snake") {
      appendNativeSnakePolyline(commands, points, spec.amplitude, spec.segmentLength, beforeLength, activeLength, normalSign, spec.raise);
    } else {
      appendNativeZigzagPolyline(commands, points, spec.amplitude, spec.segmentLength, beforeLength, activeLength, normalSign, spec.raise);
    }
  }

  if (afterLength > 1e-12) {
    if (spec.after?.type === "gap") commands.push({ type: "moveTo", x: to.x, y: to.y });
    else commands.push({ type: "lineTo", x: to.x, y: to.y });
  } else if (activeLength < 1e-12) {
    commands.push({ type: "lineTo", x: to.x, y: to.y });
  }
}

function postactionDecorationPathItems(built, pathOptions, env) {
  const items = [];
  for (const parsedPostaction of resolvedPostactionOptionsList(pathOptions, env)) {
    // A postaction usually only says `decorate`; PGF resolves the named
    // decoration through the enclosing path/picture options.
    const rawOptions = {
      ...(pathOptions.decoration === undefined ? {} : { decoration: pathOptions.decoration }),
      ...parsedPostaction
    };
    if (!tikzBoolean(rawOptions.decorate) || !supportedPathDecoration(rawOptions)) continue;
    const normalized = normalizeOptions("draw", rawOptions, env);
    const postactionOptions = { ...normalized.options, ...normalized.semantic };
    const sourceCommands = built.decorationInputCommands || built.boundsCommands || built.commands;
    const commands = applyPathMorphing(sourceCommands, postactionOptions, env, normalized.style);
    if (!commands.length) continue;
    const style = drawablePathStyle(scaleCanvasStyle(normalized.style, pathStyleScaleEnv(env, rawOptions)));
    items.push(createPathShape(commands, style, {
      subtype: "postaction-decoration",
      includeStrokeBounds: true,
      includeArrowNormalBounds: true,
      includeArrowBounds: true,
      tightBezierBounds: tikzBoolean(postactionOptions["bezier bounding box"])
    }));
  }
  return items;
}

function addPostactionShowPathConstructionItems(built, pathOptions, env, ir, diagnostics) {
  for (const options of resolvedPostactionOptionsList(pathOptions, env)) {
    if (!tikzBoolean(options.decorate)) continue;
    const decoration = parseOptions(String(options.decoration || ""));
    if (!tikzBoolean(decoration["show path construction"])) continue;
    addShowPathConstructionItems(built, options, env, ir, diagnostics, pathOptions);
  }
}

function resolvedPostactionOptionsList(pathOptions = {}, env = {}) {
  return optionList(pathOptions.postaction)
    .map((rawPostaction) => String(rawPostaction || "").trim())
    .filter(Boolean)
    .map((rawPostaction) => {
      const normalized = normalizeOptions("draw", parseOptions(rawPostaction), env);
      return { ...normalized.options, ...normalized.semantic };
    });
}

function addShowPathConstructionItems(built, pathOptions, env, ir, diagnostics, inheritedPathOptions = pathOptions) {
  if (!tikzBoolean(pathOptions.decorate)) return;
  const decoration = parseOptions(String(pathOptions.decoration || ""));
  if (!tikzBoolean(decoration["show path construction"])) return;

  const callbackFor = {
    moveTo: decoration["moveto code"],
    lineTo: decoration["lineto code"],
    curveTo: decoration["curveto code"],
    closePath: decoration["closepath code"]
  };
  if (!Object.values(callbackFor).some((code) => typeof code === "string" && code.trim())) return;

  // PGF calls these callbacks with its decoration automaton transform disabled.
  // The input commands are already in the outer path's canvas coordinates, so
  // parse the callback in an identity coordinate frame to avoid transforming
  // the injected points a second time.
  const callbackEnv = showPathConstructionCallbackEnvironment(env, inheritedPathOptions);
  let current = null;
  let start = null;

  for (const command of built.decorationInputCommands || []) {
    let segment = null;
    if (command.type === "moveTo") {
      current = { x: command.x, y: command.y };
      start = { ...current };
      segment = { first: current, last: current };
    } else if (command.type === "lineTo" && current) {
      const last = { x: command.x, y: command.y };
      segment = { first: current, last };
      current = last;
    } else if (command.type === "curveTo" && current) {
      const last = { x: command.x, y: command.y };
      segment = {
        first: current,
        last,
        supportA: { x: command.x1, y: command.y1 },
        supportB: { x: command.x2, y: command.y2 }
      };
      current = last;
    } else if (command.type === "closePath" && current && start) {
      segment = { first: current, last: start };
      current = { ...start };
    }
    if (!segment) continue;

    const callback = callbackFor[command.type];
    if (typeof callback !== "string" || !callback.trim()) continue;
    const source = expandShowPathConstructionCallback(callback, segment);
    for (const callbackStatement of parseStatements(source, diagnostics)) {
      interpretStatement(callbackStatement, callbackEnv, ir, diagnostics);
    }
  }
}

function showPathConstructionCallbackEnvironment(env, inheritedPathOptions = {}) {
  const pictureOptions = {
    ...(env.pictureOptions || {}),
    ...showPathConstructionInheritedOptions(inheritedPathOptions)
  };
  for (const key of [
    "scale", "xscale", "yscale", "rotate", "rotate around", "scale around",
    "cm", "xshift", "yshift", "shift", "xslant", "yslant", "mirror",
    "mirror x", "mirror y", "reset cm", "transform canvas", "x", "y", "z"
  ]) {
    delete pictureOptions[key];
  }
  return {
    ...env,
    pictureOptions,
    pathLet: { points: {}, numbers: {} },
    transform: identityTransform(),
    canvasTransform: identityTransform(),
    canvasTrackingDisabled: false,
    basis: parsePictureBasis({}, env.variables || {})
  };
}

function showPathConstructionInheritedOptions(options = {}) {
  const inherited = { ...(options || {}) };
  // Keep the outer paint state, but not decoration or registration behavior.
  for (const key of [
    "decorate", "decoration", "postaction", "preaction",
    "name path", "name path global", "name intersections",
    "use as bounding box", "bezier bounding box", "overlay",
    "tikzkit clip rect", "tikzkit clip circle"
  ]) {
    delete inherited[key];
  }
  return inherited;
}

function expandShowPathConstructionCallback(callback, segment) {
  const points = {
    tikzinputsegmentfirst: segment.first,
    tikzinputsegmentlast: segment.last,
    tikzinputsegmentsupporta: segment.supportA || segment.first,
    tikzinputsegmentsupportb: segment.supportB || segment.last
  };
  const source = String(callback).replace(
    /\\(tikzinputsegmentfirst|tikzinputsegmentlast|tikzinputsegmentsupporta|tikzinputsegmentsupportb)\b/g,
    (_match, name) => showPathConstructionPointText(points[name])
  ).trim();
  return /;\s*$/.test(source) ? source : `${source};`;
}

function showPathConstructionPointText(point) {
  return `${roundNumber(point.x, 9)},${roundNumber(point.y, 9)}`;
}

function supportedPathDecoration(options = {}) {
  const decoration = parseOptions(String(options.decoration || ""));
  return tikzBoolean(decoration.brace)
    || tikzBoolean(decoration.border)
    || tikzBoolean(decoration.ticks)
    || tikzBoolean(decoration.waves)
    || tikzBoolean(decoration["expanding waves"])
    || tikzBoolean(decoration["Koch snowflake"])
    || tikzBoolean(decoration.snake)
    || tikzBoolean(decoration.zigzag);
}

function applyPathMorphingToSubpaths(commands, amplitude, segmentLength, mode, preLength, postLength) {
  const morphed = [];
  let subpath = [];

  const flushSubpath = () => {
    if (!subpath.length) return;
    const startsWithMove = subpath[0]?.type === "moveTo";
    const hasDrawableSegment = subpath.some((command) => ["lineTo", "quadTo", "curveTo", "closePath"].includes(command.type));
    if (!startsWithMove || !hasDrawableSegment) {
      morphed.push(...subpath);
      subpath = [];
      return;
    }

    const points = flattenPath(subpath, 0.04);
    if (points.length < 2) {
      morphed.push(...subpath);
      subpath = [];
      return;
    }

    const start = points[0];
    morphed.push({ type: "moveTo", x: start.x, y: start.y });
    appendMorphedPolyline(morphed, points, amplitude, segmentLength, mode, preLength, postLength);
    if (subpath.at(-1)?.type === "closePath") morphed.push({ type: "closePath" });
    subpath = [];
  };

  for (const command of commands) {
    if (command.type === "moveTo") {
      flushSubpath();
      subpath.push(command);
      continue;
    }
    if (subpath.length && ["lineTo", "quadTo", "curveTo", "closePath"].includes(command.type)) {
      subpath.push(command);
      if (command.type === "closePath") flushSubpath();
      continue;
    }
    flushSubpath();
    morphed.push(command);
  }
  flushSubpath();
  return morphed;
}

function decoratedSnakeOmitsArrowPaintBounds(pathOptions = {}) {
  if (!tikzBoolean(pathOptions.decorate)) return false;
  const decoration = parseOptions(String(pathOptions.decoration || ""));
  // PGF computes a snake's bounding box from its decorated path. Arrow tips
  // are installed afterwards, so their wing span does not enlarge the canvas.
  return tikzBoolean(decoration.snake);
}

function applyKochSnowflakeDecoration(commands) {
  const decorated = [];
  let current = null;
  let start = null;
  for (const command of commands) {
    if (command.type === "moveTo") {
      current = { x: command.x, y: command.y };
      start = current;
      decorated.push(command);
      continue;
    }
    if (command.type === "lineTo" && current) {
      appendKochSnowflakeLine(decorated, current, { x: command.x, y: command.y });
      current = { x: command.x, y: command.y };
      continue;
    }
    if (command.type === "closePath" && current && start) {
      appendKochSnowflakeLine(decorated, current, start);
      decorated.push(command);
      current = start;
      continue;
    }
    decorated.push(command);
    if ("x" in command && "y" in command) current = { x: command.x, y: command.y };
  }
  return decorated;
}

function appendKochSnowflakeLine(commands, from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const normalScale = Math.sqrt(3) / 6;
  commands.push(
    lineToCommand({ x: from.x + dx / 3, y: from.y + dy / 3 }),
    lineToCommand({
      x: from.x + dx / 2 - dy * normalScale,
      y: from.y + dy / 2 + dx * normalScale
    }),
    lineToCommand({ x: from.x + (2 * dx) / 3, y: from.y + (2 * dy) / 3 }),
    lineToCommand(to)
  );
}

function pathCommandEndpoints(commands = []) {
  let start = null;
  let current = null;
  for (const command of commands) {
    if (command.type === "moveTo") {
      current = { x: command.x, y: command.y };
      if (!start) start = current;
      continue;
    }
    if (command.type === "closePath") {
      current = start;
      continue;
    }
    if ("x" in command && "y" in command) current = { x: command.x, y: command.y };
  }
  return { start, end: current };
}

function decorationArrowEndpointShortening(style = {}) {
  return {
    start: arrowTipShortenCoordinateLength(style.markerStart, style),
    end: arrowTipShortenCoordinateLength(style.markerEnd, style)
  };
}

function arrowTipShortenCoordinateLength(tip, style = {}) {
  if (!tip) return 0;
  const source = typeof tip === "string" ? {} : tip || {};
  const raw = typeof tip === "string" ? createArrowTip(tip === "arrow" ? "to" : tip) : createArrowTip(tip?.kind, source);
  const lineWidth = Math.max(0.01, style.lineWidth ?? 1);
  const lineWidthPt = lineWidth / lineWidthFromPt(1);
  const customLength = usesCustomArrowDimension(source, raw, "length");
  const customWidth = usesCustomArrowDimension(source, raw, "width");
  const arrowMetaScale = (key) => {
    if (!raw.meta) return 1;
    const scale = Number(raw[key]);
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
  };
  const lengthScale = arrowMetaScale("scale") * arrowMetaScale("lengthScale");
  const widthScale = arrowMetaScale("scale") * arrowMetaScale("widthScale");
  let shorten;
  if (raw.kind === "stealth") {
    shorten = raw.meta
      ? stealthMetaArrowGeometryFromLineWidth(lineWidth, {
        lengthScale,
        widthScale,
        harpoon: raw.harpoon,
        reversed: raw.reversed,
        swap: raw.swap,
        ...(customLength ? { lengthPt: raw.length / lineWidthFromPt(1) } : {}),
        ...(customWidth ? { widthPt: raw.width / lineWidthFromPt(1) } : {})
      }).shorten
      : stealthArrowShortenFromLength((customLength ? raw.length : stealthArrowLengthFromLineWidth(lineWidth)) * lengthScale);
  } else if (raw.kind === "stealth-prime") {
    shorten = stealthPrimeArrowDimensions(lineWidth).rightExtent;
  } else if (raw.kind === "latex") {
    if (raw.legacy) {
      const length = customLength ? raw.length : lineWidthFromPt(3.2 + 2.4 * lineWidthPt);
      shorten = length * 0.9;
    } else {
      shorten = latexArrowGeometryFromLineWidth(lineWidth, {
        lengthScale,
        widthScale,
        ...(customLength ? { lengthPt: raw.length / lineWidthFromPt(1) } : {}),
        ...(customWidth ? { widthPt: raw.width / lineWidthFromPt(1) } : {})
      }).shorten;
    }
  } else if (raw.kind === "two-heads") {
    shorten = lineWidth;
  } else if (raw.kind === "hook") {
    shorten = 0;
  } else if (raw.kind === "open-circle") {
    shorten = raw.width / 2;
  } else if (raw.kind === "open-triangle") {
    shorten = raw.length;
  } else if (raw.kind === "dimline" || raw.kind === "dimline reverse") {
    shorten = lineWidth * 0.2;
  } else {
    shorten = lineWidth;
    if (customLength || customWidth) shorten = lineWidth;
  }
  return Number.isFinite(shorten) ? shorten / TIKZ_UNIT : 0;
}

function usesCustomArrowDimension(source = {}, raw = {}, key) {
  if (source[`custom${key[0].toUpperCase()}${key.slice(1)}`] || source[`${key}Explicit`]) return true;
  if (source.meta && !source[`custom${key[0].toUpperCase()}${key.slice(1)}`]) return false;
  if (!Number.isFinite(source[key])) return false;
  const defaultTip = createArrowTip(raw.kind || source.kind || "to");
  return Math.abs(source[key] - defaultTip[key]) > 1e-6;
}

function applyBraceDecoration(commands, decoration, env) {
  const replaced = [];
  let subpath = [];

  const flushSubpath = () => {
    if (!subpath.length) return;
    const startsWithMove = subpath[0]?.type === "moveTo";
    const hasDrawableSegment = subpath.some((command) => ["lineTo", "quadTo", "curveTo", "closePath"].includes(command.type));
    if (!startsWithMove || !hasDrawableSegment) {
      replaced.push(...subpath);
      subpath = [];
      return;
    }

    // PGF's brace state consumes the whole remaining decorated subpath. Its
    // coordinate frame stays aligned to the initial tangent, even for a
    // polyline, so the replacement endpoint is the total traversal length
    // along that initial direction rather than the source subpath endpoint.
    const points = flattenPath(subpath, 0.04);
    const start = points[0];
    const tangentPoint = points.find((point, index) => index > 0 && Math.hypot(point.x - start.x, point.y - start.y) > 1e-12);
    const length = pathLength(points);
    if (!start || !tangentPoint || length <= 1e-12) {
      replaced.push(...subpath);
      subpath = [];
      return;
    }
    const tangentLength = Math.hypot(tangentPoint.x - start.x, tangentPoint.y - start.y);
    appendBraceLine(replaced, start, {
      x: start.x + ((tangentPoint.x - start.x) / tangentLength) * length,
      y: start.y + ((tangentPoint.y - start.y) / tangentLength) * length
    }, decoration, env);
    subpath = [];
  };

  for (const command of commands) {
    if (command.type === "moveTo") {
      flushSubpath();
      subpath.push(command);
      continue;
    }
    if (subpath.length && ["lineTo", "quadTo", "curveTo", "closePath"].includes(command.type)) {
      subpath.push(command);
      if (command.type === "closePath") flushSubpath();
      continue;
    }
    flushSubpath();
    replaced.push(command);
  }
  flushSubpath();
  return replaced.length ? replaced : commands;
}

function applyTicksDecoration(commands, decoration, env) {
  const replaced = [];
  let subpath = [];

  const flushSubpath = () => {
    if (!subpath.length) return;
    const startsWithMove = subpath[0]?.type === "moveTo";
    const hasDrawableSegment = subpath.some((command) => ["lineTo", "quadTo", "curveTo", "closePath"].includes(command.type));
    if (!startsWithMove || !hasDrawableSegment) {
      replaced.push(...subpath);
      subpath = [];
      return;
    }

    // `ticks` is a path-replacing decoration. The PGF state machine advances
    // through the complete decorated subpath, so a tick after a corner uses
    // the following segment's local tangent rather than restarting there.
    const points = flattenPath(subpath, 0.02);
    const length = pathLength(points);
    if (points.length < 2 || length <= 1e-12) {
      replaced.push(...subpath);
      subpath = [];
      return;
    }
    appendTicksOnPolyline(replaced, points, length, decoration, env);
    subpath = [];
  };

  for (const command of commands) {
    if (command.type === "moveTo") {
      flushSubpath();
      subpath.push(command);
      continue;
    }
    if (subpath.length && ["lineTo", "quadTo", "curveTo", "closePath"].includes(command.type)) {
      subpath.push(command);
      if (command.type === "closePath") flushSubpath();
      continue;
    }
    flushSubpath();
    replaced.push(command);
  }
  flushSubpath();
  return replaced.length ? replaced : commands;
}

function applyBorderDecoration(commands, decoration, env) {
  const replaced = [];
  let subpath = [];

  const flushSubpath = () => {
    if (!subpath.length) return;
    const startsWithMove = subpath[0]?.type === "moveTo";
    const hasDrawableSegment = subpath.some((command) => ["lineTo", "quadTo", "curveTo", "closePath"].includes(command.type));
    if (!startsWithMove || !hasDrawableSegment) {
      replaced.push(...subpath);
      subpath = [];
      return;
    }
    const points = flattenPath(subpath, 0.02);
    const length = pathLength(points);
    if (points.length < 2 || length <= 1e-12) {
      replaced.push(...subpath);
      subpath = [];
      return;
    }
    appendBorderOnPolyline(replaced, points, length, decoration, env);
    subpath = [];
  };

  for (const command of commands) {
    if (command.type === "moveTo") {
      flushSubpath();
      subpath.push(command);
      continue;
    }
    if (subpath.length && ["lineTo", "quadTo", "curveTo", "closePath"].includes(command.type)) {
      subpath.push(command);
      if (command.type === "closePath") flushSubpath();
      continue;
    }
    flushSubpath();
    replaced.push(command);
  }
  flushSubpath();
  return replaced.length ? replaced : commands;
}

function applyWavesDecoration(commands, decoration, env) {
  const replaced = [];
  let subpath = [];

  const flushSubpath = () => {
    if (!subpath.length) return;
    const startsWithMove = subpath[0]?.type === "moveTo";
    const hasDrawableSegment = subpath.some((command) => ["lineTo", "quadTo", "curveTo", "closePath"].includes(command.type));
    if (!startsWithMove || !hasDrawableSegment) {
      replaced.push(...subpath);
      subpath = [];
      return;
    }
    const points = flattenPath(subpath, 0.02);
    const length = pathLength(points);
    if (points.length < 2 || length <= 1e-12) {
      replaced.push(...subpath);
      subpath = [];
      return;
    }
    appendPathReplacingWaves(replaced, points, length, decoration, env);
    subpath = [];
  };

  for (const command of commands) {
    if (command.type === "moveTo") {
      flushSubpath();
      subpath.push(command);
      continue;
    }
    if (subpath.length && ["lineTo", "quadTo", "curveTo", "closePath"].includes(command.type)) {
      subpath.push(command);
      if (command.type === "closePath") flushSubpath();
      continue;
    }
    flushSubpath();
    replaced.push(command);
  }
  flushSubpath();
  return replaced.length ? replaced : commands;
}

function appendBorderOnPolyline(commands, points, length, decoration, env) {
  const defaultSegmentLength = parseDimension("10pt", env.variables);
  const defaultAmplitude = parseDimension("2.5pt", env.variables);
  const segmentLength = Math.max(
    1e-9,
    parseFinitePgfLength(decoration["segment length"] ?? "10pt", env, defaultSegmentLength)
  );
  const amplitude = Math.max(
    0,
    parseFinitePgfLength(decoration.amplitude ?? "2.5pt", env, defaultAmplitude)
  );
  const rawAngle = evaluateMath(String(decoration.angle ?? "45"), env.variables || {});
  const angle = Number.isFinite(rawAngle) ? (rawAngle * Math.PI) / 180 : Math.PI / 4;
  for (let distance = 0; distance < length - 1e-9; distance += segmentLength) {
    const point = pointOnPolyline(points, distance);
    const tangent = { x: point.normal.y, y: -point.normal.x };
    commands.push(
      moveToCommand({ x: roundNumber(point.x), y: roundNumber(point.y) }),
      lineToCommand({
        x: roundNumber(point.x + amplitude * (tangent.x * Math.cos(angle) + point.normal.x * Math.sin(angle))),
        y: roundNumber(point.y + amplitude * (tangent.y * Math.cos(angle) + point.normal.y * Math.sin(angle)))
      })
    );
  }
}

function appendTicksOnPolyline(commands, points, length, decoration, env) {
  const defaultSegmentLength = parseDimension("10pt", env.variables);
  const defaultAmplitude = parseDimension("2.5pt", env.variables);
  const segmentLength = Math.max(
    1e-9,
    parseFinitePgfLength(decoration["segment length"] ?? "10pt", env, defaultSegmentLength)
  );
  const amplitude = Math.max(
    0,
    parseFinitePgfLength(decoration.amplitude ?? "2.5pt", env, defaultAmplitude)
  );
  const offsets = [];
  for (let distance = 0; distance < length - 1e-9; distance += segmentLength) offsets.push(distance);
  // PGF's `final` state runs at the current decoration-state origin. It does
  // not relocate the tick to the raw path endpoint when a partial segment is
  // left over, so only fully reached segment origins receive tick marks.

  for (const distance of offsets) {
    const point = pointOnPolyline(points, distance);
    const positive = {
      x: roundNumber(point.x + point.normal.x * amplitude),
      y: roundNumber(point.y + point.normal.y * amplitude)
    };
    const negative = {
      x: roundNumber(point.x - point.normal.x * amplitude),
      y: roundNumber(point.y - point.normal.y * amplitude)
    };
    commands.push(moveToCommand(positive), lineToCommand(negative));
  }
}

function appendPathReplacingWaves(commands, points, length, decoration, env) {
  const defaultSegmentLength = parseDimension("10pt", env.variables);
  const defaultRadius = parseDimension("2.5pt", env.variables);
  const segmentLength = Math.max(
    1e-9,
    parseFinitePgfLength(decoration["segment length"] ?? "10pt", env, defaultSegmentLength)
  );
  const angleDegrees = evaluateMath(String(decoration.angle ?? "45"), env.variables || {});
  const angle = Number.isFinite(angleDegrees) ? (angleDegrees * Math.PI) / 180 : Math.PI / 4;
  const expanding = tikzBoolean(decoration["expanding waves"]);
  const radius = Math.max(
    0,
    parseFinitePgfLength(decoration.radius ?? decoration["start radius"] ?? "2.5pt", env, defaultRadius)
  );

  // `waves` starts immediately: every full state has a fixed circle radius.
  // `expanding waves` consumes its initial empty state first, then uses the
  // completed decoration distance as both its radius and local x offset. The
  // latter is the native `-\pgfdecoratedcompleteddistance` transform.
  const firstDistance = expanding ? segmentLength : 0;
  // The fixed wave state has positive width, so it only runs while a full
  // segment remains. `expanding waves` instead switches its final partial
  // state to `last` with width zero; this includes the exact endpoint when
  // the input length is a whole number of segments.
  const terminalLimit = expanding ? length + 1e-9 : length - 1e-9;
  for (let distance = firstDistance; distance <= terminalLimit; distance += segmentLength) {
    const state = pointOnPolyline(points, distance);
    const tangent = { x: state.normal.y, y: -state.normal.x };
    const waveRadius = expanding ? distance : radius;
    if (!(waveRadius > 1e-12)) continue;
    const centerOffset = expanding ? -distance : segmentLength - waveRadius;
    const center = {
      x: state.x + tangent.x * centerOffset,
      y: state.y + tangent.y * centerOffset
    };
    appendOrientedCircularArc(commands, center, tangent, state.normal, waveRadius, angle, -angle);
  }

  // The PGF `final` state is a move-to at the original decorated endpoint.
  // Retaining it keeps terminal arrow placement tied to the source path
  // without painting an accidental closing line.
  const end = points.at(-1);
  if (end) commands.push(moveToCommand(roundPoint(end)));
}

function appendOrientedCircularArc(commands, center, tangent, normal, radius, startAngle, endAngle) {
  const steps = Math.max(1, Math.ceil(Math.abs(endAngle - startAngle) / (Math.PI / 2)));
  const pointAt = (angle) => ({
    x: center.x + radius * (tangent.x * Math.cos(angle) + normal.x * Math.sin(angle)),
    y: center.y + radius * (tangent.y * Math.cos(angle) + normal.y * Math.sin(angle))
  });
  const derivativeAt = (angle) => ({
    x: radius * (-tangent.x * Math.sin(angle) + normal.x * Math.cos(angle)),
    y: radius * (-tangent.y * Math.sin(angle) + normal.y * Math.cos(angle))
  });
  commands.push(moveToCommand(roundPoint(pointAt(startAngle))));
  for (let index = 1; index <= steps; index += 1) {
    const fromAngle = startAngle + ((endAngle - startAngle) * (index - 1)) / steps;
    const toAngle = startAngle + ((endAngle - startAngle) * index) / steps;
    const k = (4 / 3) * Math.tan((toAngle - fromAngle) / 4);
    const from = pointAt(fromAngle);
    const to = pointAt(toAngle);
    const fromDerivative = derivativeAt(fromAngle);
    const toDerivative = derivativeAt(toAngle);
    commands.push(curveToCommand(
      roundPoint({ x: from.x + k * fromDerivative.x, y: from.y + k * fromDerivative.y }),
      roundPoint({ x: to.x - k * toDerivative.x, y: to.y - k * toDerivative.y }),
      roundPoint(to)
    ));
  }
}

function appendBraceLine(commands, from, to, decoration, env) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-12) {
    commands.push({ type: "moveTo", x: from.x, y: from.y });
    return;
  }
  const raise = parseFinitePgfLength(decoration.raise || "0", env, 0);
  const mirrored = decoration.mirror === true || String(decoration.mirror).trim() === "true";
  const side = mirrored ? -1 : 1;
  const ux = dx / length;
  const uy = dy / length;
  const nx = -uy * side;
  const ny = ux * side;
  const amplitude = Math.max(
    0,
    parseFinitePgfLength(decoration.amplitude ?? "2.5pt", env, parseDimension("2.5pt", env.variables))
  );
  if (amplitude <= 1e-12) {
    const p0 = bracePoint(from, ux, uy, nx, ny, 0, raise);
    const p1 = bracePoint(from, ux, uy, nx, ny, length, raise);
    commands.push({ type: "moveTo", x: p0.x, y: p0.y });
    commands.push({ type: "lineTo", x: p1.x, y: p1.y });
    return;
  }

  const aspectRaw = evaluateMath(decoration.aspect ?? "0.5", env.variables);
  const aspect = Number.isFinite(aspectRaw) ? Math.min(0.95, Math.max(0.05, aspectRaw)) : 0.5;
  const apexDistance = length * aspect;
  const beforeCurl = Math.min(amplitude, Math.max(0, apexDistance / 2));
  const afterCurl = Math.min(amplitude, Math.max(0, (length - apexDistance) / 2));
  const point = (distance, normalOffset) => bracePoint(from, ux, uy, nx, ny, distance, raise + normalOffset);
  const pushLineTo = (distance, normalOffset) => {
    const previous = commands.at(-1);
    const p = point(distance, normalOffset);
    if (previous && Math.hypot((previous.x ?? 0) - p.x, (previous.y ?? 0) - p.y) < 1e-9) return;
    commands.push({ type: "lineTo", x: p.x, y: p.y });
  };
  const pushCurveTo = (c1Distance, c1Normal, c2Distance, c2Normal, endDistance, endNormal) => {
    const c1 = point(c1Distance, c1Normal);
    const c2 = point(c2Distance, c2Normal);
    const end = point(endDistance, endNormal);
    commands.push({
      type: "curveTo",
      x1: c1.x,
      y1: c1.y,
      x2: c2.x,
      y2: c2.y,
      x: end.x,
      y: end.y
    });
  };

  const start = point(0, 0);
  commands.push({ type: "moveTo", x: start.x, y: start.y });
  pushCurveTo(
    beforeCurl * 0.15,
    amplitude * 0.3,
    beforeCurl * 0.5,
    amplitude * 0.5,
    beforeCurl,
    amplitude * 0.5
  );
  pushLineTo(apexDistance - beforeCurl, amplitude * 0.5);
  pushCurveTo(
    apexDistance - beforeCurl * 0.5,
    amplitude * 0.5,
    apexDistance - beforeCurl * 0.15,
    amplitude * 0.7,
    apexDistance,
    amplitude
  );
  pushCurveTo(
    apexDistance + afterCurl * 0.15,
    amplitude * 0.7,
    apexDistance + afterCurl * 0.5,
    amplitude * 0.5,
    apexDistance + afterCurl,
    amplitude * 0.5
  );
  pushLineTo(length - afterCurl, amplitude * 0.5);
  pushCurveTo(
    length - afterCurl * 0.5,
    amplitude * 0.5,
    length - afterCurl * 0.15,
    amplitude * 0.3,
    length,
    0
  );
}

function bracePoint(origin, ux, uy, nx, ny, distance, normalDistance) {
  return roundPoint({
    x: origin.x + ux * distance + nx * normalDistance,
    y: origin.y + uy * distance + ny * normalDistance
  });
}

function addDecorationTextItems(built, pathOptions, style, ir, env) {
  const decorations = textAlongPathDecorationsFromOptions(pathOptions);
  if (!decorations.length) return;
  const targets = [];
  if (hasDrawableCommands(built.commands || [], built.shapes || [])) {
    targets.push({ commands: built.commands, style });
  }
  for (const shape of built.shapes || []) {
    if (shape.commands?.length) targets.push({ commands: shape.commands, style: { ...style, ...(shape.style || {}) } });
  }
  for (const decoration of decorations) {
    for (const target of targets) addDecorationTextItem(target, decoration, pathOptions, ir, env);
  }
}

function textAlongPathDecorationsFromOptions(options = {}) {
  const decorations = [];
  if (tikzBoolean(options.decorate)) {
    const rawDecoration = String(options.decoration || "");
    const decoration = parseOptions(rawDecoration);
    if (isTextAlongPathDecoration(decoration)) decorations.push(decorationTextDecorationOptions(decoration, rawDecoration));
  }
  for (const rawPostaction of optionList(options.postaction)) {
    const postaction = String(rawPostaction || "");
    if (!postaction.includes("decorate")) continue;
    const postOptions = parseOptions(postaction);
    if (!tikzBoolean(postOptions.decorate)) continue;
    // TikZ permits `decoration=...` on the outer path and a bare
    // `postaction={decorate}`. The postaction then consumes that same
    // decoration rather than requiring it to be repeated inside the braces.
    const rawDecoration = String(postOptions.decoration ?? options.decoration ?? "");
    const decoration = parseOptions(rawDecoration);
    if (isTextAlongPathDecoration(decoration)) decorations.push(decorationTextDecorationOptions(decoration, rawDecoration));
  }
  return decorations;
}

function isTextAlongPathDecoration(decoration = {}) {
  return tikzBoolean(decoration["text along path"]) || tikzBoolean(decoration["text effects along path"]);
}

function decorationTextDecorationOptions(decoration, rawDecoration) {
  return { ...decoration, "tikzkit decoration raw": rawDecoration };
}

function addDecorationTextItem(item, decoration, pathOptions, ir, env) {
  const flat = flattenPath(item.commands || [], 0.02);
  if (flat.length < 2) return;
  const payload = decorationTextPayload(decoration.text, pathOptions, env, decoration["tikzkit decoration raw"]);
  if (!payload.text) return;
  const layout = decorationTextLayout(decoration, env);
  const textEffects = decorationTextEffects(decoration, pathOptions);
  const characterReplacements = decorationTextCharacterReplacements(decoration, pathOptions, env);
  const repeatText = decorationTextRepeatCount(decoration, textEffects.options);
  const point = pointAtLength(flat, 0.5);
  const angle = Number(point.angle) || 0;
  const raise = parseFiniteDimension(decoration.raise || "0", env, 0);
  const radians = (angle * Math.PI) / 180;
  const nx = -Math.sin(radians);
  const ny = Math.cos(radians);
  const textFont = resolvedTextFontSpec(
    payload.text,
    { ...pathOptions, font: `${pathOptions.font || ""} ${payload.fontSource || ""}`.trim() },
    env,
    env.canvasScale
  );
  const inheritedFontFamily = payload.style.fontFamily || resolveInheritedFontFamily(pathOptions.font, env.pictureOptions?.font);
  // Decoration text is still ordinary TeX text inside a positioned node. Keep
  // its rendered face in sync with the CMR metrics used for its path advances.
  const fontFamily = computerModernOpticalTextFamily(payload.text, textFont, inheritedFontFamily) || inheritedFontFamily;
  ir.items.push({
    type: "textNode",
    subtype: "decoration-text",
    text: payload.text,
    pathCommands: item.commands.map((command) => ({ ...command })),
    pathRaise: roundNumber(raise),
    pathTextAlign: layout.align,
    pathLeftIndent: roundNumber(layout.leftIndent),
    pathRightIndent: roundNumber(layout.rightIndent),
    pathTextFitToPath: layout.fitToPath,
    pathTextFitToPathStretchingSpaces: layout.fitToPathStretchingSpaces,
    pathTextEffects: textEffects.transforms,
    pathTextEffectsFitToPath: textEffects.fitTextToPath,
    pathTextEffectsScaleToPath: textEffects.scaleTextToPath,
    pathTextReverse: textEffects.reverseText,
    pathTextReversePath: tikzBoolean(decoration["reverse path"]),
    pathTextGroupLetters: textEffects.groupLetters,
    pathTextWordSeparator: textEffects.wordSeparator,
    pathTextRepeat: repeatText,
    pathTextCharacterReplacements: characterReplacements,
    x: roundNumber(point.x + nx * raise),
    y: roundNumber(point.y + ny * raise),
    rotation: roundNumber(angle),
    font: textFont,
    style: {
      ...item.style,
      ...payload.style,
      fill: visibleTextFill(normalizeColor(decoration["text color"] || ""), payload.style.fill, item.style?.textFill, item.style?.stroke, item.style?.fill),
      fontFamily,
      fontVariant: payload.style.fontVariant || resolveInheritedFontVariant(pathOptions.font, env.pictureOptions?.font),
      fontScale: roundNumber(env.canvasScale * (payload.fontScale || fontScaleFromTikzFont(pathOptions.font || env.pictureOptions?.font)))
    }
  });
}

function decorationTextEffects(decoration = {}, pathOptions = {}) {
  const transforms = [];
  let wordSeparator = " ";
  let fitTextToPath = false;
  let scaleTextToPath = false;
  const options = parseOptions(stripOuterBraces(String(pathOptions["text effects"] ?? "")));
  const rawDecoration = String(decoration["tikzkit decoration raw"] ?? "");
  const sources = [
    rawDecoration,
    String(pathOptions["text effects"] ?? "")
  ];
  if (!rawDecoration) sources.push(String(decoration["text effects"] ?? ""));

  const read = (source, depth = 0) => {
    if (depth > 4) return;
    for (const part of splitTopLevel(stripOuterBraces(String(source ?? "")), ",")) {
      const sourcePart = String(part ?? "").trim();
      if (!sourcePart || sourcePart === "text effects/.cd") continue;
      const equals = findTopLevel(sourcePart, "=");
      const key = (equals === -1 ? sourcePart : sourcePart.slice(0, equals)).trim().toLowerCase();
      const value = equals === -1 ? "" : sourcePart.slice(equals + 1).trim();
      if (key === "text effects") {
        read(value, depth + 1);
      } else if (key === "reverse text") {
        transforms.push("reverse");
      } else if (key === "group letters" || key === "group letters into words") {
        transforms.push("group");
      } else if (key === "fit text to path") {
        fitTextToPath = tikzBoolean(value);
      } else if (key === "scale text to path") {
        scaleTextToPath = tikzBoolean(value);
      } else if (key === "word separator") {
        const separator = stripOuterBraces(value).trim();
        wordSeparator = separator.toLowerCase() === "space" || !separator ? " " : Array.from(separator)[0] || " ";
      }
    }
  };

  for (const source of sources) read(source);
  if (!transforms.includes("reverse") && tikzBoolean(options["reverse text"])) transforms.push("reverse");
  if (!transforms.includes("group") && (tikzBoolean(options["group letters"]) || tikzBoolean(options["group letters into words"]))) {
    transforms.push("group");
  }
  if (options["word separator"] !== undefined && wordSeparator === " ") {
    const separator = stripOuterBraces(String(options["word separator"])).trim();
    wordSeparator = separator.toLowerCase() === "space" || !separator ? " " : Array.from(separator)[0] || " ";
  }

  return {
    options,
    transforms,
    fitTextToPath,
    scaleTextToPath,
    reverseText: transforms.includes("reverse"),
    groupLetters: transforms.includes("group"),
    wordSeparator
  };
}

function decorationTextRepeatCount(decoration = {}, textEffects = {}) {
  const value = decoration["repeat text"] ?? textEffects["repeat text"];
  if (value === undefined || value === false || value === "0") return 0;
  // PGF treats a missing value as -1, then decrements it on every pass. Any
  // negative value therefore repeats until the remaining path is exhausted.
  if (value === true || String(value).trim() === "") return -1;
  const numeric = Number(String(value).trim());
  if (!Number.isFinite(numeric)) return 0;
  return Math.trunc(numeric);
}

function decorationTextCharacterReplacements(decoration = {}, pathOptions = {}, env = {}) {
  const sources = [
    String(decoration["tikzkit decoration raw"] ?? ""),
    String(pathOptions["text effects"] ?? "")
  ];
  const replacements = {};
  for (const source of sources) {
    for (const part of splitTopLevel(source, ",")) {
      const match = part.match(/^replace\s+characters\s*=\s*([\s\S]*?)\s+with\s+([\s\S]+)$/i);
      if (!match) continue;
      const replacement = parseDecorationTextCharacterReplacement(match[2], env);
      if (!replacement) continue;
      for (const character of Array.from(stripOuterBraces(match[1]).trim())) {
        replacements[character] = replacement;
      }
    }
  }
  return replacements;
}

function parseDecorationTextCharacterReplacement(raw, env) {
  const source = stripOuterBraces(String(raw ?? "")).trim();
  const match = source.match(/^\\(fill|draw|path)\s*(?:\[([^\]]*)\])?\s*circle\s*(?:\[([^\]]*)\]|\(([^()]*)\))\s*;?\s*$/i);
  if (!match) return null;
  const command = match[1].toLowerCase();
  const { style } = normalizeOptions(command, parseOptions(match[2] || ""), env);
  const radiusOptions = parseOptions(match[3] || "");
  const radius = parseFiniteDimension(radiusOptions.radius ?? match[4], env, 0);
  if (!(radius > 0)) return null;
  return {
    type: "circle",
    radius: roundNumber(radius),
    fill: style.fill || "none",
    stroke: style.stroke || "none",
    lineWidth: roundNumber(style.lineWidth || 0),
    opacity: Number.isFinite(style.opacity) ? style.opacity : undefined,
    fillOpacity: Number.isFinite(style.fillOpacity) ? style.fillOpacity : undefined,
    strokeOpacity: Number.isFinite(style.strokeOpacity) ? style.strokeOpacity : undefined
  };
}

function decorationTextLayout(decoration = {}, env = {}) {
  const raw = stripOuterBraces(String(decoration["text align"] ?? "left")).trim();
  const options = parseOptions(raw);
  const namedAlign = String(options.align ?? "").trim().toLowerCase();
  const styleAlign = ["left", "right", "center"].find((name) => tikzBoolean(options[name]));
  const align = ["left", "right", "center"].includes(namedAlign)
    ? namedAlign
    : styleAlign || "left";
  const fitToPathStretchingSpaces = tikzBoolean(options["fit to path stretching spaces"]);

  return {
    align,
    leftIndent: parseFiniteDimension(options["left indent"] ?? "0", env, 0),
    rightIndent: parseFiniteDimension(options["right indent"] ?? "0", env, 0),
    fitToPath: tikzBoolean(options["fit to path"]) || fitToPathStretchingSpaces,
    fitToPathStretchingSpaces
  };
}

function decorationTextPayload(raw, pathOptions = {}, env = {}, rawDecoration = "") {
  const rawText = decorationTextValueFromRaw(rawDecoration) ?? String(raw ?? "");
  let text = substituteTextVariables(stripDecorationTextOuterBraces(rawText), env.variables || {});
  let styleRaw = "";
  if (text.startsWith("|")) {
    const end = text.indexOf("|", 1);
    if (end !== -1) {
      styleRaw = text.slice(1, end).trim();
      text = text.slice(end + 1);
    }
  }
  const style = {};
  const color = decorationTextColor(styleRaw);
  if (color) style.fill = normalizeColor(color);
  const fontFamily = resolveFontFamily(`${styleRaw} ${pathOptions.font || ""}`);
  if (fontFamily) style.fontFamily = fontFamily;
  const fontPrefix = decorationTextFontPrefix(styleRaw);
  return {
    text: `${fontPrefix}${text}`,
    style,
    fontScale: fontScaleFromTikzFont(styleRaw),
    fontSource: styleRaw
  };
}

function decorationTextValueFromRaw(rawDecoration = "") {
  for (const part of splitTopLevel(String(rawDecoration ?? ""), ",")) {
    const equals = findTopLevel(part, "=");
    if (equals === -1 || part.slice(0, equals).trim() !== "text") continue;
    return part.slice(equals + 1).trim();
  }
  return null;
}

function stripDecorationTextOuterBraces(value = "") {
  const text = String(value ?? "").trim();
  if (!text.startsWith("{") || !text.endsWith("}")) return text;
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "{") depth += 1;
    if (text[index] === "}") {
      depth -= 1;
      if (depth === 0 && index < text.length - 1) return text;
    }
    if (depth < 0) return text;
  }
  return depth === 0 ? text.slice(1, -1) : text;
}

function decorationTextColor(styleRaw) {
  const match = String(styleRaw || "").match(/\\color\s*\{([^{}]+)\}/);
  return match?.[1]?.trim() || null;
}

function decorationTextFontPrefix(styleRaw) {
  const commands = [];
  const raw = String(styleRaw || "");
  for (const match of raw.matchAll(/\\(Huge|huge|LARGE|Large|large|normalsize|small|footnotesize|scriptsize|tiny|bf|bfseries|itshape|slshape|sffamily|rmfamily|ttfamily)\b/g)) {
    commands.push(`\\${match[1]}`);
  }
  return commands.length ? `${commands.join("")} ` : "";
}

function visibleTextFill(...candidates) {
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null || candidate === false) continue;
    const text = String(candidate).trim();
    if (!text || text === "none") continue;
    return candidate;
  }
  return "black";
}

function appendMorphedLine(commands, from, to, amplitude, segmentLength, mode, preLength = 0, postLength = 0) {
  appendMorphedPolyline(commands, [from, to], amplitude, segmentLength, mode, preLength, postLength);
}

function appendMorphedCurve(commands, from, curve, amplitude, segmentLength, mode, preLength = 0, postLength = 0) {
  const flat = flattenPath([{ type: "moveTo", x: from.x, y: from.y }, curve], 0.04);
  appendMorphedPolyline(commands, flat, amplitude, segmentLength, mode, preLength, postLength);
}

function appendMorphedPolyline(commands, points, amplitude, segmentLength, mode, preLength = 0, postLength = 0) {
  const length = polylineLength(points);
  const to = points.at(-1);
  if (!to) return;
  if (length < 1e-12 || amplitude <= 0) {
    commands.push({ type: "lineTo", x: to.x, y: to.y });
    return;
  }
  const activeStart = Math.min(Math.max(0, preLength), length);
  const activeEnd = Math.max(activeStart, length - Math.min(Math.max(0, postLength), Math.max(0, length - activeStart)));
  const activeLength = activeEnd - activeStart;
  if (activeStart > 1e-12) {
    const startPoint = pointOnPolyline(points, activeStart);
    commands.push({ type: "lineTo", x: roundNumber(startPoint.x), y: roundNumber(startPoint.y) });
  }
  if (activeLength < 1e-12) {
    commands.push({ type: "lineTo", x: to.x, y: to.y });
    return;
  }
  if (mode === "zigzag") {
    appendNativeZigzagPolyline(commands, points, amplitude, segmentLength, activeStart, activeLength);
    if (postLength > 1e-12) commands.push({ type: "lineTo", x: to.x, y: to.y });
    return;
  }
  if (mode === "snake") {
    appendNativeSnakePolyline(commands, points, amplitude, segmentLength, activeStart, activeLength);
    if (postLength > 1e-12) commands.push({ type: "lineTo", x: to.x, y: to.y });
    return;
  }
}

function appendNativeSnakePolyline(commands, points, amplitude, segmentLength, activeStart, activeLength, normalSign = 1, normalRaise = 0) {
  // The native snake decoration does not enable `auto corner on length`.
  // A state that crosses a polyline corner is therefore painted entirely in
  // the tangent frame at that state's origin. Sampling every control point
  // against the input polyline rotates a single Bezier segment midway through
  // a corner, which visibly kinks the snake. Keep the legacy snakes path
  // below: its extra mirror/raise semantics deliberately use the older
  // per-sample behavior.
  if (normalSign === 1 && normalRaise === 0) {
    appendNativeSnakePolylineInStateFrames(commands, points, amplitude, segmentLength, activeStart, activeLength);
    return;
  }

  const point = (distance, normalOffset = 0) => {
    const sample = pointOnPolyline(points, activeStart + distance);
    return {
      x: roundNumber(sample.x + sample.normal.x * (normalRaise + normalSign * normalOffset)),
      y: roundNumber(sample.y + sample.normal.y * (normalRaise + normalSign * normalOffset))
    };
  };
  const pushCurve = (control1, control2, end) => {
    commands.push({ type: "curveTo", x1: control1.x, y1: control1.y, x2: control2.x, y2: control2.y, x: end.x, y: end.y });
  };
  const finishAt = point(activeLength);
  if (activeLength < 0.625 * segmentLength) {
    commands.push({ type: "lineTo", x: finishAt.x, y: finishAt.y });
    return;
  }

  // pgflibrarydecorations.pathmorphing: initial state of the native snake.
  pushCurve(
    point(0.125 * segmentLength, 0),
    point(0.1875 * segmentLength, amplitude),
    point(0.3125 * segmentLength, amplitude)
  );

  let distance = 0.3125 * segmentLength;
  let phase = 1;
  while (activeLength - distance >= 0.8125 * segmentLength) {
    const quarter = 0.25 * segmentLength;
    // These are the native PGF \pgfpathcosine / \pgfpathsine coefficients.
    pushCurve(
      point(distance + 0.362 * quarter, phase * amplitude),
      point(distance + 0.674 * quarter, phase * amplitude * 0.512),
      point(distance + quarter, 0)
    );
    pushCurve(
      point(distance + quarter + 0.326 * quarter, -phase * amplitude * 0.512),
      point(distance + quarter + 0.638 * quarter, -phase * amplitude),
      point(distance + 2 * quarter, -phase * amplitude)
    );
    distance += 2 * quarter;
    phase *= -1;
  }

  // pgflibrarydecorations.pathmorphing: end down/end up followed by final.
  pushCurve(
    point(distance + 0.125 * segmentLength, phase * amplitude),
    point(distance + 0.1875 * segmentLength, 0),
    point(distance + 0.3125 * segmentLength, 0)
  );
  distance += 0.3125 * segmentLength;
  if (activeLength - distance > 1e-9) commands.push({ type: "lineTo", x: finishAt.x, y: finishAt.y });
}

function appendNativeSnakePolylineInStateFrames(commands, points, amplitude, segmentLength, activeStart, activeLength) {
  const inputPoint = (distance) => pointOnPolyline(points, activeStart + distance);
  const finishAt = inputPoint(activeLength);
  const pushCurve = (control1, control2, end) => {
    commands.push({ type: "curveTo", x1: control1.x, y1: control1.y, x2: control2.x, y2: control2.y, x: end.x, y: end.y });
  };
  const statePoint = (stateOrigin, stateStart, xOffset, yOffset) => {
    const sample = inputPoint(stateOrigin);
    const tangent = { x: sample.normal.y, y: -sample.normal.x };
    return {
      x: roundNumber(stateStart.x + tangent.x * xOffset + sample.normal.x * yOffset),
      y: roundNumber(stateStart.y + tangent.y * xOffset + sample.normal.y * yOffset)
    };
  };
  const currentPoint = () => {
    const current = commands.at(-1);
    return { x: Number(current?.x) || 0, y: Number(current?.y) || 0 };
  };

  if (activeLength < 0.625 * segmentLength) {
    commands.push({ type: "lineTo", x: roundNumber(finishAt.x), y: roundNumber(finishAt.y) });
    return;
  }

  let stateOrigin = 0;
  let stateStart = currentPoint();
  const initialPoint = (xOffset, yOffset) => statePoint(stateOrigin, stateStart, xOffset, yOffset);
  pushCurve(
    initialPoint(0.125 * segmentLength, 0),
    initialPoint(0.1875 * segmentLength, amplitude),
    initialPoint(0.3125 * segmentLength, amplitude)
  );

  stateOrigin = 0.3125 * segmentLength;
  let phase = 1;
  while (activeLength - stateOrigin >= 0.8125 * segmentLength) {
    stateStart = currentPoint();
    const quarter = 0.25 * segmentLength;
    const point = (xOffset, yOffset) => statePoint(stateOrigin, stateStart, xOffset, yOffset);
    // `down` and `up` use two relative cosine/sine halves in this state
    // frame. The y offsets below are relative to the state entry point.
    pushCurve(
      point(0.362 * quarter, 0),
      point(0.674 * quarter, -phase * amplitude * 0.488),
      point(quarter, -phase * amplitude)
    );
    pushCurve(
      point(quarter + 0.326 * quarter, -phase * amplitude * 1.512),
      point(quarter + 0.638 * quarter, -phase * amplitude * 2),
      point(2 * quarter, -phase * amplitude * 2)
    );
    stateOrigin += 2 * quarter;
    phase *= -1;
  }

  stateStart = currentPoint();
  const finalPoint = (xOffset, yOffset) => statePoint(stateOrigin, stateStart, xOffset, yOffset);
  pushCurve(
    finalPoint(0.125 * segmentLength, 0),
    finalPoint(0.1875 * segmentLength, -phase * amplitude),
    finalPoint(0.3125 * segmentLength, -phase * amplitude)
  );
  stateOrigin += 0.3125 * segmentLength;
  if (activeLength - stateOrigin > 1e-9) {
    commands.push({ type: "lineTo", x: roundNumber(finishAt.x), y: roundNumber(finishAt.y) });
  }
}

function appendNativeZigzagPolyline(commands, points, amplitude, segmentLength, activeStart, activeLength, normalSign = 1, normalRaise = 0) {
  const point = (distance, normalOffset = 0) => {
    const sample = pointOnPolyline(points, activeStart + Math.max(0, Math.min(activeLength, distance)));
    return {
      x: roundNumber(sample.x + sample.normal.x * (normalRaise + normalSign * normalOffset)),
      y: roundNumber(sample.y + sample.normal.y * (normalRaise + normalSign * normalOffset))
    };
  };
  const pushLineTo = (next) => {
    const previous = commands.at(-1);
    if (previous && Math.hypot((previous.x ?? 0) - next.x, (previous.y ?? 0) - next.y) < 1e-9) return;
    commands.push({ type: "lineTo", x: next.x, y: next.y });
  };
  const finishAt = point(activeLength);
  const halfSegment = segmentLength / 2;
  if (activeLength < halfSegment - 1e-9) {
    pushLineTo(finishAt);
    return;
  }

  // pgflibrarydecorations.pathmorphing.code.tex declares `zigzag` as an
  // `up from center` state followed by alternating `big down` / `big up`
  // states. Each state has width segmentLength / 2 and places its apex at
  // its local quarter point. If less than a half state remains, PGF emits
  // `center finish` at the state origin, then joins the actual endpoint.
  pushLineTo(point(segmentLength / 4, amplitude));
  let stateOrigin = halfSegment;
  let phase = -1;
  while (activeLength - stateOrigin >= halfSegment - 1e-9) {
    pushLineTo(point(stateOrigin + segmentLength / 4, phase * amplitude));
    stateOrigin += halfSegment;
    phase *= -1;
  }
  pushLineTo(point(stateOrigin));
  pushLineTo(finishAt);
}

function appendSmoothCurveThroughPoints(commands, points) {
  if (points.length < 2) return;
  for (let index = 1; index < points.length; index += 1) {
    const p0 = points[index - 2] || points[index - 1];
    const p1 = points[index - 1];
    const p2 = points[index];
    const p3 = points[index + 1] || p2;
    commands.push({
      type: "curveTo",
      x1: roundNumber(p1.x + (p2.x - p0.x) / 6),
      y1: roundNumber(p1.y + (p2.y - p0.y) / 6),
      x2: roundNumber(p2.x - (p3.x - p1.x) / 6),
      y2: roundNumber(p2.y - (p3.y - p1.y) / 6),
      x: p2.x,
      y: p2.y
    });
  }
}

function polylineLength(points) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }
  return total;
}

function pointOnPolyline(points, distance) {
  let walked = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const dx = current.x - previous.x;
    const dy = current.y - previous.y;
    const segmentLength = Math.hypot(dx, dy);
    if (segmentLength < 1e-12) continue;
    if (walked + segmentLength >= distance - 1e-12) {
      const local = Math.max(0, Math.min(1, (distance - walked) / segmentLength));
      return {
        x: previous.x + dx * local,
        y: previous.y + dy * local,
        walked: walked + segmentLength * local,
        normal: { x: -dy / segmentLength, y: dx / segmentLength }
      };
    }
    walked += segmentLength;
  }
  const last = points.at(-1) || { x: 0, y: 0 };
  const previous = points.at(-2) || last;
  const dx = last.x - previous.x;
  const dy = last.y - previous.y;
  const segmentLength = Math.hypot(dx, dy) || 1;
  return {
    x: last.x,
    y: last.y,
    walked,
    normal: { x: -dy / segmentLength, y: dx / segmentLength }
  };
}

function buildPlot(coordinate, env, pathOptions) {
  const domain = String(pathOptions.domain || "-1:1").split(":");
  const start = evaluateMath(domain[0], env.variables);
  const end = evaluateMath(domain[1], env.variables);
  const samples = Math.max(2, Math.min(200, Math.round(evaluateMath(pathOptions.samples || 25, env.variables))));
  const variable = String(pathOptions.variable || "\\x").replace(/^\\/, "");
  const commands = [];
  for (let i = 0; i < samples; i += 1) {
    const t = samples === 1 ? 0 : i / (samples - 1);
    const value = start + (end - start) * t;
    const point = resolveCoordinate(coordinate, { ...env, variables: { ...env.variables, [variable]: value }, transform: identityTransform() }, []);
    commands.push({ type: i === 0 ? "moveTo" : "lineTo", x: point.x, y: point.y });
  }
  return commands;
}

function buildPlotFunction(expression, env, pathOptions = {}) {
  const domain = parsePlotFunctionDomain(pathOptions.domain, env);
  const samples = Math.max(2, Math.min(500, Math.round(evaluateMath(pathOptions.samples || 25, env.variables))));
  const variable = String(pathOptions.variable || "x").trim().replace(/^\\/, "") || "x";
  const points = [];
  for (let i = 0; i < samples; i += 1) {
    const t = samples === 1 ? 0 : i / (samples - 1);
    const value = domain.start + (domain.end - domain.start) * t;
    const y = evaluatePlotFunctionExpression(expression, value, variable, env.variables);
    if (!Number.isFinite(y)) continue;
    const local = roundPoint(projectBasisPoint(value, y, 0, env.basis));
    points.push({ ...applyCoordinateTransform(local, env), sourceX: value, sourceY: y });
  }
  if (!points.length) return { commands: [], points };
  if (tikzBoolean(pathOptions.ycomb) || tikzBoolean(pathOptions.xcomb)) {
    const isXComb = tikzBoolean(pathOptions.xcomb);
    const commands = [];
    for (const point of points) {
      const baselineLocal = isXComb
        ? roundPoint(projectBasisPoint(0, point.sourceY, 0, env.basis))
        : roundPoint(projectBasisPoint(point.sourceX, 0, 0, env.basis));
      const baseline = applyCoordinateTransform(baselineLocal, env);
      commands.push({ type: "moveTo", x: baseline.x, y: baseline.y });
      commands.push({ type: "lineTo", x: point.x, y: point.y });
    }
    return { commands, points };
  }
  if (tikzBoolean(pathOptions.smooth) && points.length >= 3) {
    return { commands: smoothPlotCoordinateCommands(points, pathOptions, env), points };
  }
  return {
    commands: points.map((point, index) => ({
      type: index === 0 ? "moveTo" : "lineTo",
      x: point.x,
      y: point.y
    })),
    points
  };
}

function parsePlotFunctionDomain(raw, env) {
  const text = stripOuterBraces(String(raw || "-1:1").trim());
  const split = splitTopLevelDomain(text);
  const start = evaluateMath(split.start, env.variables);
  const end = evaluateMath(split.end, env.variables);
  return {
    start: Number.isFinite(start) ? start : -1,
    end: Number.isFinite(end) ? end : 1
  };
}

function splitTopLevelDomain(text) {
  let brace = 0;
  let bracket = 0;
  let paren = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "{") brace += 1;
    else if (char === "}") brace = Math.max(0, brace - 1);
    else if (char === "[") bracket += 1;
    else if (char === "]") bracket = Math.max(0, bracket - 1);
    else if (char === "(") paren += 1;
    else if (char === ")") paren = Math.max(0, paren - 1);
    else if (char === ":" && brace === 0 && bracket === 0 && paren === 0) {
      return { start: text.slice(0, index).trim(), end: text.slice(index + 1).trim() };
    }
  }
  return { start: "-1", end: "1" };
}

function evaluatePlotFunctionExpression(expression, xValue, variable, variables = {}) {
  const substituted = substitutePlotFunctionVariable(expression, variable, xValue);
  return evaluateMath(substituted, { ...variables, x: xValue, [variable]: xValue });
}

function substitutePlotFunctionVariable(expression, variable, value) {
  const name = String(variable || "x").replace(/^\\/, "") || "x";
  const escaped = escapeRegExp(name);
  const replacement = `(${value})`;
  return String(expression || "")
    .replace(new RegExp(`\\\\${escaped}\\b`, "g"), replacement)
    .replace(new RegExp(`\\b${escaped}\\b`, "g"), replacement);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildPlotCoordinates(coordinates, env, diagnostics, pathOptions = {}) {
  const points = [];
  for (const coordinate of coordinates) {
    const point = resolveCoordinate(coordinate, env, diagnostics);
    if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) points.push(point);
  }
  if (!points.length) return { commands: [], points };
  if (tikzBoolean(pathOptions.smooth) && points.length >= 3) {
    return { commands: smoothPlotCoordinateCommands(points, pathOptions, env), points };
  }
  return {
    commands: points.map((point, index) => ({
      type: index === 0 ? "moveTo" : "lineTo",
      x: point.x,
      y: point.y
    })),
    points
  };
}

function smoothPlotCoordinateCommands(points, pathOptions, env) {
  const rawTension = evaluateMath(pathOptions.tension ?? 0.5, env.variables);
  const tension = Number.isFinite(rawTension) && rawTension > 0 ? Math.min(rawTension, 3) : 1;
  const factor = tension * 0.2775;
  const commands = [{ type: "moveTo", x: points[0].x, y: points[0].y }];

  let first = points[0];
  let second = points[1];
  let firstSupport = { ...first };
  for (let index = 2; index < points.length; index += 1) {
    const current = points[index];
    const support = {
      x: (current.x - first.x) * factor,
      y: (current.y - first.y) * factor
    };
    const secondSupport = {
      x: second.x - support.x,
      y: second.y - support.y
    };
    commands.push({
      type: "curveTo",
      x1: roundNumber(firstSupport.x),
      y1: roundNumber(firstSupport.y),
      x2: roundNumber(secondSupport.x),
      y2: roundNumber(secondSupport.y),
      x: roundNumber(second.x),
      y: roundNumber(second.y)
    });
    firstSupport = {
      x: second.x + support.x,
      y: second.y + support.y
    };
    first = second;
    second = current;
  }
  commands.push({
    type: "curveTo",
    x1: roundNumber(firstSupport.x),
    y1: roundNumber(firstSupport.y),
    x2: roundNumber(second.x),
    y2: roundNumber(second.y),
    x: roundNumber(second.x),
    y: roundNumber(second.y)
  });
  return commands;
}

function sineCosineCurveCommand(from, to, op) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const controls =
    op === "sin"
      ? [
          { x: 0.326, y: 0.512 },
          { x: 0.638, y: 1 }
        ]
      : [
          { x: 0.362, y: 0 },
          { x: 0.674, y: 0.488 }
        ];
  return {
    type: "curveTo",
    x1: roundNumber(from.x + dx * controls[0].x),
    y1: roundNumber(from.y + dy * controls[0].y),
    x2: roundNumber(from.x + dx * controls[1].x),
    y2: roundNumber(from.y + dy * controls[1].y),
    x: roundNumber(to.x),
    y: roundNumber(to.y)
  };
}

function plotMarkItems(point, mark, pathStyle = {}, markOptions = {}, env = {}) {
  const markShape = buildPlotMark(point, mark, pathStyle, markOptions, env);
  return Array.isArray(markShape) ? markShape : [markShape];
}

function buildPlotMark(point, mark, pathStyle = {}, markOptions = {}, env = {}) {
  const kind = stripOuterBraces(String(mark || "*")).trim();
  const size = plotMarkSize(markOptions, env);
  const markColor = markOptions["mark color"] && markOptions["mark color"] !== true
    ? normalizeColor(String(markOptions["mark color"]))
    : pathStyle.stroke || "black";
  const lineStyle = {
    stroke: markColor,
    fill: "none",
    lineWidth: pathStyle.lineWidth || 1
  };
  const filledStyle = {
    ...lineStyle,
    fill: markColor
  };
  const finalize = (item) => rotatePlotMark(item, point, markOptions, env);
  const finalizeItems = (items) => items.map(finalize);

  if (kind === "halfcircle" || kind === "halfcircle*") {
    const stroke = pathStyle.stroke || "black";
    const lowerFill = plotHalfCircleMarkColor(markOptions);
    const outline = {
      type: "path",
      shape: "plot-mark",
      mark: kind,
      commands: kind === "halfcircle"
        ? [
            { type: "moveTo", x: roundNumber(point.x - size), y: roundNumber(point.y) },
            { type: "lineTo", x: roundNumber(point.x + size), y: roundNumber(point.y) },
            ...circleToPath(point.x, point.y, size)
          ]
        : circleToPath(point.x, point.y, size),
      style: { stroke, fill: "none", lineWidth: pathStyle.lineWidth || 1 }
    };
    const items = [];
    if (kind === "halfcircle*") {
      items.push({
        type: "path",
        shape: "plot-mark-fill",
        mark: kind,
        commands: plotHalfCirclePath(point, size, "upper"),
        style: { stroke: "none", fill: pathStyle.fill && pathStyle.fill !== "none" ? pathStyle.fill : stroke, lineWidth: 0 }
      });
    }
    if (lowerFill) {
      items.push({
        type: "path",
        shape: "plot-mark-fill",
        mark: kind,
        commands: plotHalfCirclePath(point, size, "lower"),
        style: { stroke: "none", fill: lowerFill, lineWidth: 0 }
      });
    }
    return finalizeItems([...items, outline]);
  }

  if (kind === "*" || kind === "." || kind === "o") {
    return {
      type: "path",
      shape: "plot-mark",
      mark: kind,
      commands: circleToPath(point.x, point.y, size),
      style: kind === "o" ? lineStyle : filledStyle
    };
  }
  const basicGeometry = basicPlotMarkGeometry(kind, size);
  if (basicGeometry) {
    return finalize({
      type: "path",
      shape: "plot-mark",
      mark: kind,
      commands: plotMarkGeometryCommands(basicGeometry, point),
      style: basicGeometry.filled ? filledStyle : lineStyle
    });
  }
  if (kind === "+" || kind === "|" || kind === "||" || kind === "|||") {
    const lineWidth = (Number(pathStyle.lineWidth) || lineWidthFromPt(0.4)) / TIKZ_UNIT;
    const offsets = kind === "||"
      ? [-2 * lineWidth, 2 * lineWidth]
      : kind === "|||"
        ? [-3 * lineWidth, 0, 3 * lineWidth]
        : [0];
    const commands = offsets.flatMap((offset) => [
      { type: "moveTo", x: roundNumber(point.x + offset), y: roundNumber(point.y - size) },
      { type: "lineTo", x: roundNumber(point.x + offset), y: roundNumber(point.y + size) }
    ]);
    if (kind === "+") {
      commands.push(
        { type: "moveTo", x: roundNumber(point.x - size), y: roundNumber(point.y) },
        { type: "lineTo", x: roundNumber(point.x + size), y: roundNumber(point.y) }
      );
    }
    return finalize({
      type: "path",
      shape: "plot-mark",
      mark: kind,
      commands,
      style: lineStyle
    });
  }
  if (kind === "x") {
    const diagonal = size / Math.SQRT2;
    return {
      type: "path",
      shape: "plot-mark",
      mark: kind,
      commands: [
        { type: "moveTo", x: roundNumber(point.x - diagonal), y: roundNumber(point.y - diagonal) },
        { type: "lineTo", x: roundNumber(point.x + diagonal), y: roundNumber(point.y + diagonal) },
        { type: "moveTo", x: roundNumber(point.x - diagonal), y: roundNumber(point.y + diagonal) },
        { type: "lineTo", x: roundNumber(point.x + diagonal), y: roundNumber(point.y - diagonal) }
      ],
      style: lineStyle
    };
  }
  if (kind === "s|" || kind === "s||" || kind === "s|||") {
    const offsets = kind === "s|"
      ? [-Math.SQRT1_2]
      : kind === "s||"
        ? [-0.75, 0]
        : [-0.75, 0, 0.75];
    const commands = offsets.flatMap((offset) => {
      if (kind === "s|") {
        return [
          { type: "moveTo", x: roundNumber(point.x - Math.SQRT1_2 * size), y: roundNumber(point.y - Math.SQRT1_2 * size) },
          { type: "lineTo", x: roundNumber(point.x + Math.SQRT1_2 * size), y: roundNumber(point.y + Math.SQRT1_2 * size) }
        ];
      }
      return [
        { type: "moveTo", x: roundNumber(point.x + offset * size), y: roundNumber(point.y - size) },
        { type: "lineTo", x: roundNumber(point.x + (offset + 1) * size), y: roundNumber(point.y + size) }
      ];
    });
    return finalize({
      type: "path",
      shape: "plot-mark",
      mark: kind,
      commands,
      style: lineStyle
    });
  }
  if (kind === "z") {
    return finalize({
      type: "path",
      shape: "plot-mark",
      mark: kind,
      commands: [
        { type: "moveTo", x: roundNumber(point.x + 0.75 * size), y: roundNumber(point.y - size) },
        { type: "lineTo", x: roundNumber(point.x - 0.75 * size), y: roundNumber(point.y - size) },
        { type: "lineTo", x: roundNumber(point.x + 0.75 * size), y: roundNumber(point.y + size) },
        { type: "lineTo", x: roundNumber(point.x - 0.75 * size), y: roundNumber(point.y + size) }
      ],
      style: lineStyle
    });
  }
  if (kind === "s" || kind === "oo") {
    const cubic = (x1, y1, x2, y2, x, y) => ({
      type: "curveTo",
      x1: roundNumber(point.x + x1 * size),
      y1: roundNumber(point.y + y1 * size),
      x2: roundNumber(point.x + x2 * size),
      y2: roundNumber(point.y + y2 * size),
      x: roundNumber(point.x + x * size),
      y: roundNumber(point.y + y * size)
    });
    const moveToCenter = () => ({ type: "moveTo", x: roundNumber(point.x), y: roundNumber(point.y) });
    const commands = kind === "s"
      ? [
          moveToCenter(), cubic(0, 0, -1, 1, 1, 1),
          moveToCenter(), cubic(0, 0, 1, -1, -1, -1)
        ]
      : [
          moveToCenter(), cubic(0, 0, 0.5, 1, 1, 0),
          moveToCenter(), cubic(0, 0, -0.5, 1, -1, 0),
          moveToCenter(), cubic(0, 0, 0.5, -1, 1, 0),
          moveToCenter(), cubic(0, 0, -0.5, -1, -1, 0)
        ];
    return finalize({
      type: "path",
      shape: "plot-mark",
      mark: kind,
      commands,
      style: lineStyle
    });
  }
  return {
    type: "path",
    shape: "plot-mark",
    mark: kind,
    commands: [
      { type: "moveTo", x: roundNumber(point.x - size), y: roundNumber(point.y - size) },
      { type: "lineTo", x: roundNumber(point.x + size), y: roundNumber(point.y + size) },
      { type: "moveTo", x: roundNumber(point.x - size), y: roundNumber(point.y + size) },
      { type: "lineTo", x: roundNumber(point.x + size), y: roundNumber(point.y - size) }
    ],
    style: lineStyle
  };
}

function plotHalfCircleMarkColor(markOptions = {}) {
  const raw = markOptions["mark color"];
  if (raw !== undefined && raw !== null && raw !== true) {
    const color = normalizeColor(String(raw));
    return color === "none" ? null : color;
  }
  // PGF's /pgf/mark color default is white for half-filled plot marks.
  return "white";
}

function plotHalfCirclePath(point, size, half) {
  const k = 0.5522847498307936;
  const cubic = (x1, y1, x2, y2, x, y) => ({
    type: "curveTo",
    x1: roundNumber(x1),
    y1: roundNumber(y1),
    x2: roundNumber(x2),
    y2: roundNumber(y2),
    x: roundNumber(x),
    y: roundNumber(y)
  });
  if (half === "upper") {
    return [
      { type: "moveTo", x: roundNumber(point.x + size), y: roundNumber(point.y) },
      cubic(point.x + size, point.y - k * size, point.x + k * size, point.y - size, point.x, point.y - size),
      cubic(point.x - k * size, point.y - size, point.x - size, point.y - k * size, point.x - size, point.y),
      { type: "closePath" }
    ];
  }
  return [
    { type: "moveTo", x: roundNumber(point.x - size), y: roundNumber(point.y) },
    cubic(point.x - size, point.y + k * size, point.x - k * size, point.y + size, point.x, point.y + size),
    cubic(point.x + k * size, point.y + size, point.x + size, point.y + k * size, point.x + size, point.y),
    { type: "closePath" }
  ];
}

function rotatePlotMark(item, point, markOptions = {}, env = {}) {
  const options = markOptions["mark options"] && markOptions["mark options"] !== true
    ? parseOptions(stripOuterBraces(String(markOptions["mark options"])))
    : {};
  const degrees = evaluateMath(options.rotate, env.variables || {});
  if (!Number.isFinite(degrees) || Math.abs(degrees) < 1e-12) return item;

  const radians = (degrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const rotate = (x, y) => ({
    x: roundNumber(point.x + (x - point.x) * cosine - (y - point.y) * sine),
    y: roundNumber(point.y + (x - point.x) * sine + (y - point.y) * cosine)
  });
  const commands = item.commands.map((command) => {
    const rotated = { ...command };
    for (const [xKey, yKey] of [["x", "y"], ["x1", "y1"], ["x2", "y2"]]) {
      if (!Number.isFinite(command[xKey]) || !Number.isFinite(command[yKey])) continue;
      const control = rotate(command[xKey], command[yKey]);
      rotated[xKey] = control.x;
      rotated[yKey] = control.y;
    }
    return rotated;
  });
  return { ...item, commands };
}

function plotMarkSize(markOptions = {}, env = {}) {
  const parsed = parseDimension(markOptions["mark size"] || "2pt", env.variables || {});
  return Number.isFinite(parsed) && parsed > 0 ? parsed : parseDimension("2pt", env.variables || {});
}

function resolveControlPoint(raw, current, env, diagnostics) {
  const text = String(raw).trim();
  const relative = text.match(/^\+{1,2}\((.+)\)$/);
  if (!relative) return resolveCoordinate(stripCurveCoordinateParens(text), env, diagnostics);
  const local = resolveCoordinate(relative[1], localCoordinateEnvironment(env), diagnostics);
  const offset = applyCoordinateTransformVector(local, env);
  return roundPoint({ x: current.x + offset.x, y: current.y + offset.y });
}

function resolveCurveEndpoint(raw, start, env, diagnostics) {
  const text = String(raw || "").trim();
  const relative = text.match(/^\+{1,2}\((.+)\)$/);
  if (!relative) return resolveCoordinate(stripCurveCoordinateParens(text), env, diagnostics);
  const local = resolveCoordinate(relative[1], localCoordinateEnvironment(env), diagnostics);
  const offset = applyCoordinateTransformVector(local, env);
  return roundPoint({ x: start.x + offset.x, y: start.y + offset.y });
}

function stripCurveCoordinateParens(value) {
  const text = String(value || "").trim();
  return text.startsWith("(") && text.endsWith(")") ? text.slice(1, -1).trim() : text;
}

function resolveRelativeCoordinate(raw, current, env, diagnostics) {
  const base = current || applyCoordinateTransform({ x: 0, y: 0 }, env);
  const local = resolveCoordinate(raw, localCoordinateEnvironment(env), diagnostics);
  const offset = applyCoordinateTransformVector(local, env);
  return roundPoint({
    x: base.x + offset.x,
    y: base.y + offset.y
  });
}

function resolveTurnCoordinate(raw, current, lastSegment, env, diagnostics) {
  const prefixed = parseCoordinateOptionPrefix(String(raw || "").trim(), env);
  if (!prefixed || !tikzBoolean(prefixed.options.turn)) return null;
  const tangent = pathIncomingTangent(lastSegment);
  const tangentLength = Math.hypot(tangent.x, tangent.y);
  if (tangentLength <= 1e-12) return null;

  const local = resolveCoordinate(prefixed.coordinate, {
    ...env,
    transform: scaleOnlyTransform(env.transform)
  }, diagnostics);
  const angle = Math.atan2(tangent.y, tangent.x);
  return roundPoint({
    x: current.x + local.x * Math.cos(angle) - local.y * Math.sin(angle),
    y: current.y + local.x * Math.sin(angle) + local.y * Math.cos(angle)
  });
}

function pathIncomingTangent(segment = {}) {
  if (segment.tangent && Number.isFinite(segment.tangent.x) && Number.isFinite(segment.tangent.y)) {
    return segment.tangent;
  }
  return {
    x: (segment.to?.x || 0) - (segment.from?.x || 0),
    y: (segment.to?.y || 0) - (segment.from?.y || 0)
  };
}

function incomingTangentFromCommands(commands = [], from, to) {
  const last = commands.at(-1);
  if (last?.type === "curveTo") return { x: to.x - last.x2, y: to.y - last.y2 };
  const previous = commands.length > 1 ? commands.at(-2) : null;
  if (previous && Number.isFinite(previous.x) && Number.isFinite(previous.y)) {
    return { x: to.x - previous.x, y: to.y - previous.y };
  }
  return { x: to.x - from.x, y: to.y - from.y };
}

function semanticSubtype(options = {}) {
  if (options["tikzquads parallel path"]) return "tikzquads-parallel-connect";
  if (options["tikzquads kind"]) return `tikzquads-${String(options["tikzquads kind"]).trim().replace(/\s+/g, "-")}`;
  if (options["axis mark"]) return "axis-mark";
  if (options["axis bar"]) return "axis-bar";
  if (options["axis rectangle"]) return "axis-rectangle";
  if (options["axis candlestick wick"]) return "axis-candlestick-wick";
  if (options["axis candlestick body"]) return "axis-candlestick-body";
  if (options["axis comb"]) return "axis-comb";
  if (options["axis closed cycle"]) return "axis-closed-cycle";
  if (options["axis surface"] || options["axis surface fill"] || options["axis surface mesh"]) return "axis-surface";
  if (options["axis minor tick"]) return "axis-minor-tick";
  if (options["axis tick"]) return "axis-tick";
  if (options["axis bounds"]) return "axis-frame";
  if (options["axis frame"]) return "axis-frame";
  if (options["axis minor grid"]) return "axis-minor-grid-line";
  if (options["axis grid"]) return "axis-grid-line";
  if (options["axis clean line"]) return "axis-clean-line";
  if (options["axis clean boundary"]) return "axis-clean-boundary";
  if (options["axis line"]) return "axis-line";
  if (options["axis plot"]) return "axis-plot";
  if (options["axis pin edge"]) return "axis-pin-edge";
  if (options["axis legend background"]) return "axis-legend-background";
  if (options["axis legend example"]) return "axis-legend-example";
  if (options["axis legend"]) return "axis-legend";
  if (options["ternary patch"]) return "ternary-patch";
  if (options["ternary grid"]) return "ternary-grid";
  if (options["ternary frame"]) return "ternary-frame";
  if (options["ternary colorbar"]) return "ternary-colorbar";
  if (options["ternary colorbar frame"]) return "ternary-colorbar-frame";
  if (options["stanli support hatch"]) return "stanli-support-hatch";
  if (options["stanli dspring"]) return "stanli-dspring";
  if (options["stanli lineload arrow"]) return "stanli-lineload-arrow";
  if (options["stanli lineload outline"]) return "stanli-lineload-outline";
  if (options["stanli lineload endpoint"]) return "stanli-lineload-endpoint";
  if (options["bagua line"]) return "bagua-line";
  if (options["bagua taiji fill"]) return "bagua-taiji-fill";
  if (options["bagua taiji outline"]) return "bagua-taiji-outline";
  if (options["bagua taiji eye"]) return "bagua-taiji-eye";
  if (options["decofonts pixl"]) return "decofonts-pixl";
  if (options["decofonts surround"]) return "decofonts-surround";
  if (options["decofonts underline"]) return "decofonts-underline";
  if (options["decofonts fit arrow"]) return "decofonts-fit-arrow";
  if (options["decofonts brush"]) return "decofonts-brush";
  if (options["decofonts ink"]) return "decofonts-ink";
  if (options["dimline line"]) return "dimline-line";
  if (options["dimline extension"]) return "dimline-extension";
  if (options["dimline tick"]) return "dimline-tick";
  if (options["tikz-cnn-edge"]) return "tikz-cnn-edge";
  if (options["tikz-cnn-face"]) return "tikz-cnn-face";
  if (options["tikz-cnn-connection"]) return "tikz-cnn-connection";
  if (options["feynhand particle"]) return "feynhand-particle";
  if (options["feynhand dot"]) return "feynhand-dot";
  if (options["feynhand blob"]) return "feynhand-blob";
  if (options["feynhand fermion"]) return "feynhand-fermion";
  if (options["feynhand gluon"]) return "feynhand-gluon";
  if (options["feynhand boson"]) return "feynhand-boson";
  if (options["feynhand scalar"]) return "feynhand-scalar";
  if (options["feynhand ghost"]) return "feynhand-ghost";
  if (options["feynhand majorana"]) return "feynhand-majorana";
  if (options["feynman particle"]) return "feynman-particle";
  if (options["feynman dot"]) return "feynman-dot";
  if (options["feynman blob"]) return "feynman-blob";
  if (options["feynman plain"]) return "feynman-plain";
  if (options["feynman fermion"]) return "feynman-fermion";
  if (options["feynman gluon"]) return "feynman-gluon";
  if (options["feynman boson"]) return "feynman-boson";
  if (options["feynman scalar"]) return "feynman-scalar";
  if (options["feynman ghost"]) return "feynman-ghost";
  if (options["feynman majorana"]) return "feynman-majorana";
  if (options["forest node"] || options["tikzkit forest node"]) return "forest-node";
  if (options["forest edge"] || options["tikzkit forest edge"]) return "forest-edge";
  for (const key of Object.keys(options)) {
    if (key.startsWith("palattice ")) return `palattice-${key.slice("palattice ".length).trim().replace(/\s+/g, "-")}`;
  }
  if (options["qtree roof"]) return "qtree-roof";
  if (options["qtree edge"]) return "qtree-edge";
  return undefined;
}

function tikzBoolean(value) {
  if (value === undefined || value === null || value === false) return false;
  if (value === true || value === "") return true;
  return !/^(?:false|0|no|off)$/i.test(String(value).trim());
}

function hasDrawableCommands(commands, shapes) {
  if (commands.length === 0) return false;
  if (commands.every((command) => command.type === "moveTo") && shapes.length > 0) return false;
  if (commands.length === 1 && commands[0].type === "moveTo" && shapes.length > 0) return false;
  return true;
}

function compoundFillRuleShape(shapes = [], pathOptions = {}, subtype, { allowShadows = false } = {}) {
  if (shapes.length < 2) return null;
  if (!shapes[0]?.style?.fillRule && !allowShadows) return null;
  if (!shapes.every((shape) => shape?.type === "path" && shape.commands?.length && isClosedPath(shape.commands))) return null;
  if (!shapes.every((shape) => compatibleCompoundShapeStyle(shapes[0].style || {}, shape.style || {}))) return null;
  return {
    type: "path",
    subtype: shapes[0].subtype || subtype,
    tightBezierBounds: tikzBoolean(pathOptions["bezier bounding box"]),
    style: { ...(shapes[0].style || {}) },
    commands: shapes.flatMap((shape) => shape.commands || [])
  };
}

function isClosedPath(commands = []) {
  return commands.some((command) => command.type === "closePath");
}

function compatibleCompoundShapeStyle(base = {}, candidate = {}) {
  const keys = ["fill", "stroke", "lineWidth", "fillRule", "fillOpacity", "strokeOpacity", "opacity", "dashArray"];
  return keys.every((key) => JSON.stringify(base[key] ?? null) === JSON.stringify(candidate[key] ?? null));
}

function polarOffset(point, angle, distance) {
  const radians = (angle * Math.PI) / 180;
  return roundPoint({
    x: point.x + Math.cos(radians) * distance,
    y: point.y + Math.sin(radians) * distance
  });
}

function composeTransform(parent, options = {}, env) {
  let current = normalizeTransform(parent);
  for (const [key, value] of Object.entries(options || {})) {
    if (key === "reset cm" && tikzBoolean(value)) {
      current = identityTransform();
      continue;
    }
    if (key === "transform canvas") {
      // `transform canvas` changes PGF's backend matrix, not TikZ's
      // coordinate matrix. It is applied after normal coordinate resolution.
      continue;
    }
    const operation = coordinateTransformOperation(key, value, env);
    if (operation) current = multiplyTransforms(current, operation);
  }
  return current;
}

function transformCanvasOptions(options = {}) {
  const raw = options["transform canvas"];
  if (raw === undefined || raw === null || raw === true || raw === "") return {};
  return parseOptions(String(raw));
}

function hasTransformCanvas(options = {}) {
  const raw = options["transform canvas"];
  return raw !== undefined && raw !== null && raw !== false && raw !== true && String(raw).trim() !== "";
}

function transformCanvasTransform(options = {}, env = {}) {
  return composeTransform(identityTransform(), transformCanvasOptions(options), env);
}

function coordinateTransformForEnvironment(env = {}) {
  return multiplyTransforms(env.canvasTransform || identityTransform(), env.transform || identityTransform());
}

function applyCoordinateTransform(point, env = {}) {
  return applyTransform(point, coordinateTransformForEnvironment(env));
}

function applyCoordinateTransformVector(point, env = {}) {
  return applyTransformVector(point, coordinateTransformForEnvironment(env));
}

function localCoordinateEnvironment(env = {}) {
  return {
    ...env,
    transform: identityTransform(),
    canvasTransform: identityTransform()
  };
}

function coordinateLocalTransform(options = {}, env) {
  return composeTransform(identityTransform(), options, env);
}

function coordinateTransformOperation(key, value, env) {
  if (key === "scale" || key === "xscale" || key === "yscale") {
    const parsed = evaluateMath(value ?? 1, env.variables);
    const scale = Number.isFinite(parsed) ? parsed : 1;
    if (key === "xscale") return affineTransform(scale, 0, 0, 1);
    if (key === "yscale") return affineTransform(1, 0, 0, scale);
    return affineTransform(scale, 0, 0, scale);
  }
  if (key === "rotate") {
    const parsed = evaluateMath(value ?? 0, env.variables);
    const radians = ((Number.isFinite(parsed) ? parsed : 0) * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return affineTransform(cos, sin, -sin, cos);
  }
  if (key === "rotate around") {
    return aroundTransform(value, env, (raw) => {
      const parsed = evaluateMath(raw ?? 0, env.variables);
      const radians = ((Number.isFinite(parsed) ? parsed : 0) * Math.PI) / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      return affineTransform(cos, sin, -sin, cos);
    });
  }
  if (key === "scale around") {
    return aroundTransform(value, env, (raw) => {
      const parsed = evaluateMath(raw ?? 1, env.variables);
      const scale = Number.isFinite(parsed) ? parsed : 1;
      return affineTransform(scale, 0, 0, scale);
    });
  }
  if (key === "cm") return parseCmTransform(value, env);
  if (key === "xshift") return translationTransform(parseShiftDimension(value, env.variables), 0);
  if (key === "yshift") return translationTransform(0, parseShiftDimension(value, env.variables));
  if (key === "shift") {
    const shift = parseTransformCoordinateShift(value, env);
    return translationTransform(shift.x, shift.y);
  }
  if (key === "xslant") {
    const parsed = evaluateMath(value ?? 0, env.variables);
    return affineTransform(1, 0, Number.isFinite(parsed) ? parsed : 0, 1);
  }
  if (key === "yslant") {
    const parsed = evaluateMath(value ?? 0, env.variables);
    return affineTransform(1, Number.isFinite(parsed) ? parsed : 0, 0, 1);
  }
  if (/^ext\/(?:xmirror|xMirror|mirror x|Mirror x|ymirror|yMirror|mirror y|Mirror y|mirror|Mirror)$/.test(key)) {
    return tikzExtMirrorTransform({ [key]: value }, env);
  }
  return null;
}

function aroundTransform(value, env, createLinearTransform) {
  const text = stripOuterBraces(String(value ?? "").trim());
  const parts = splitTopLevel(text, ":");
  if (parts.length < 2) return null;
  const centerText = parts.slice(1).join(":").trim();
  const center = resolveCoordinate(centerText, localCoordinateEnvironment(env), []);
  const linear = createLinearTransform(parts[0].trim());
  return transformAroundPoint(linear, center);
}

function parseCmTransform(value, env) {
  const parts = splitTopLevel(stripOuterBraces(String(value ?? "").trim()), ",");
  if (parts.length < 4) return null;
  const coefficients = parts.slice(0, 4).map((part, index) => {
    const parsed = evaluateMath(part, env.variables);
    return Number.isFinite(parsed) ? parsed : index % 3 === 0 ? 1 : 0;
  });
  const shift = parts.length > 4
    ? resolveCoordinate(parts.slice(4).join(","), localCoordinateEnvironment(env), [])
    : { x: 0, y: 0 };
  return affineTransform(coefficients[0], coefficients[1], coefficients[2], coefficients[3], shift.x, shift.y);
}

function transformAroundPoint(transform, point = { x: 0, y: 0 }) {
  return multiplyTransforms(
    translationTransform(point.x, point.y),
    multiplyTransforms(transform, translationTransform(-point.x, -point.y))
  );
}

function affineTransform(a, b, c, d, x = 0, y = 0) {
  return {
    a,
    b,
    c,
    d,
    x,
    y,
    scale: Math.sqrt(Math.abs(a * d - b * c)) || 1
  };
}

function translationTransform(x, y) {
  return affineTransform(1, 0, 0, 1, Number(x) || 0, Number(y) || 0);
}

function transformCanvasScale(options = {}, env) {
  const parsed = transformCanvasOptions(options);
  const value = parsed.scale ?? parsed["scale around"] ?? 1;
  const scale = evaluateMath(value, env.variables);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function parseTransformShift(options = {}, env) {
  let x = options.xshift ? parseShiftDimension(options.xshift, env.variables) : 0;
  let y = options.yshift ? parseShiftDimension(options.yshift, env.variables) : 0;
  if (options.shift) {
    const shifted = parseTransformCoordinateShift(options.shift, env);
    x += shifted.x;
    y += shifted.y;
  }
  return { x, y };
}

function parseTransformCoordinateShift(value, env) {
  if (!value) return { x: 0, y: 0 };
  const text = stripOuterBraces(String(value).trim());
  if (!text.startsWith("(")) return parseShift(text, env);

  const canvasPoint = resolveCoordinate(text, env, []);
  const transform = normalizeTransform(env.transform);
  const det = transform.a * transform.d - transform.b * transform.c;
  if (Math.abs(det) < 1e-12) return { x: 0, y: 0 };

  // Named coordinates are already in the parent canvas; recover the local vector.
  const x = canvasPoint.x - transform.x;
  const y = canvasPoint.y - transform.y;
  return roundPoint({
    x: (transform.d * x - transform.c * y) / det,
    y: (-transform.b * x + transform.a * y) / det
  });
}

// Claude: TikZ 的 xshift/yshift 是「维度」，无单位的裸数字默认是 pt（例如 yshift=-120 即 -120pt，
// 约 -4.22cm），而项目的 parseDimension 对裸数字默认按 cm。这会让 yshift=-120 被当成 -120cm、
// 把内容抛到极远处。这里：裸数字补上 pt 再解析；带单位(cm/mm/pt..)或含表达式的保持原样。
function parseShiftDimension(value, variables) {
  const text = String(value).trim();
  if (/^[-+]?[\d.]+$/.test(text)) return parseDimension(`${text}pt`, variables);
  return parseDimension(value, variables);
}

function tikzExtMirrorTransform(options = {}, env) {
  const xMirror = options["ext/xmirror"] ?? options["ext/xMirror"] ?? options["ext/mirror x"] ?? options["ext/Mirror x"];
  const yMirror = options["ext/ymirror"] ?? options["ext/yMirror"] ?? options["ext/mirror y"] ?? options["ext/Mirror y"];
  const lineMirror = options["ext/mirror"] ?? options["ext/Mirror"];
  if (lineMirror !== undefined && lineMirror !== true && lineMirror !== "") {
    const parsed = parseMirrorLine(lineMirror, env);
    if (parsed) return mirrorLineTransform(parsed.a, parsed.b);
  }
  if (xMirror !== undefined) {
    const point = mirrorReferencePoint(xMirror, env);
    return { a: -1, b: 0, c: 0, d: 1, x: 2 * point.x, y: 0, scale: 1 };
  }
  if (yMirror !== undefined) {
    const point = mirrorReferencePoint(yMirror, env);
    return { a: 1, b: 0, c: 0, d: -1, x: 0, y: 2 * point.y, scale: 1 };
  }
  return identityTransform();
}

function mirrorReferencePoint(value, env) {
  if (value === true || value === "") return { x: 0, y: 0 };
  const text = String(value).trim();
  if (text.startsWith("(")) return resolveCoordinate(text, localCoordinateEnvironment(env), []);
  const scalar = parseDimension(text, env.variables);
  return Number.isFinite(scalar) ? { x: scalar, y: scalar } : { x: 0, y: 0 };
}

function parseMirrorLine(value, env) {
  const text = stripOuterBraces(String(value || "").trim());
  const parts = text.split(/\s*--\s*/);
  const a = mirrorReferencePoint(parts[0] || "(0,0)", env);
  const b = parts[1] ? mirrorReferencePoint(parts[1], env) : { x: 0, y: 0 };
  if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-9) return null;
  return { a, b };
}

function mirrorLineTransform(a, b) {
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const cos = Math.cos(2 * angle);
  const sin = Math.sin(2 * angle);
  return multiplyTransforms(
    { a: 1, b: 0, c: 0, d: 1, x: a.x, y: a.y, scale: 1 },
    multiplyTransforms(
      { a: cos, b: sin, c: sin, d: -cos, x: 0, y: 0, scale: 1 },
      { a: 1, b: 0, c: 0, d: 1, x: -a.x, y: -a.y, scale: 1 }
    )
  );
}

function composePgfTransform(parent, statement, env) {
  return multiplyTransforms(parent, {
    a: evaluateMath(statement.a, env.variables),
    b: evaluateMath(statement.b, env.variables),
    c: evaluateMath(statement.c, env.variables),
    d: evaluateMath(statement.d, env.variables),
    x: parseDimension(statement.x, env.variables),
    y: parseDimension(statement.y, env.variables),
    scale: 1
  });
}

function identityTransform() {
  return { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0, scale: 1 };
}

function normalizeTransform(transform = identityTransform()) {
  if (Number.isFinite(transform.a)) return transform;
  const scale = Number.isFinite(transform.scale) ? transform.scale : 1;
  return {
    a: scale,
    b: 0,
    c: 0,
    d: scale,
    x: transform.x || 0,
    y: transform.y || 0,
    scale
  };
}

function scaleOnlyTransform(transform = identityTransform()) {
  const normalized = normalizeTransform(transform);
  const scale = Number.isFinite(normalized.scale) ? normalized.scale : Math.sqrt(Math.abs(normalized.a * normalized.d - normalized.b * normalized.c)) || 1;
  return { a: normalized.a, b: normalized.b, c: normalized.c, d: normalized.d, x: 0, y: 0, scale };
}

function multiplyTransforms(parent, child) {
  const first = normalizeTransform(parent);
  const second = normalizeTransform(child);
  const a = first.a * second.a + first.c * second.b;
  const b = first.b * second.a + first.d * second.b;
  const c = first.a * second.c + first.c * second.d;
  const d = first.b * second.c + first.d * second.d;
  return {
    a,
    b,
    c,
    d,
    x: first.a * second.x + first.c * second.y + first.x,
    y: first.b * second.x + first.d * second.y + first.y,
    scale: Math.sqrt(Math.abs(a * d - b * c)) || 1
  };
}

function parsePictureBasis(options = {}, variables = {}) {
  const basis = {
    x: { x: 1, y: 0 },
    y: { x: 0, y: 1 },
    z: { ...PGF_DEFAULT_Z_VECTOR }
  };
  for (const key of ["x", "y", "z"]) {
    if (options[key]) basis[key] = parseBasisVector(options[key], variables, key) || basis[key];
  }
  return basis;
}

function composeBasis(parent, options = {}, env) {
  const next = {
    x: { ...parent.x },
    y: { ...parent.y },
    z: { ...parent.z }
  };
  for (const key of ["x", "y", "z"]) {
    if (options[key]) next[key] = parseBasisVector(options[key], env.variables, key) || next[key];
  }
  return next;
}

function canvasPlaneEnvironment(parentEnv, options = {}, transform = parentEnv.transform) {
  const spec = canvasPlaneSpec(options);
  if (!spec) return null;

  // Resolve the three defining points through the parent 3D basis, but before
  // the new scope/path affine transform. Their differences are the local
  // canvas x/y vectors; the origin is composed into the canvas transform.
  const coordinateEnv = localCoordinateEnvironment(parentEnv);
  const origin = resolveCoordinate(spec.origin, coordinateEnv, []);
  const xPoint = resolveCoordinate(spec.x, coordinateEnv, []);
  const yPoint = resolveCoordinate(spec.y, coordinateEnv, []);
  if (![origin, xPoint, yPoint].every(isFinitePoint)) return null;

  return {
    transform: multiplyTransforms(transform, translationTransform(origin.x, origin.y)),
    basis: {
      ...parentEnv.basis,
      x: roundPoint({ x: xPoint.x - origin.x, y: xPoint.y - origin.y }),
      y: roundPoint({ x: yPoint.x - origin.x, y: yPoint.y - origin.y })
    }
  };
}

function isFinitePoint(point) {
  return Number.isFinite(point?.x) && Number.isFinite(point?.y);
}

function parseBasisVector(value, variables = {}, axis = "x") {
  let text = String(value).trim();
  text = text.replace(/^\{([\s\S]*)\}$/, "$1").trim();
  if (text.startsWith("(") && text.endsWith(")")) text = text.slice(1, -1).trim();
  const polar = text.match(/^(.+):(.+)$/);
  if (polar) {
    const angle = (evaluateMath(polar[1], variables) * Math.PI) / 180;
    const radius = parseDimension(polar[2], variables);
    return roundPoint({
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    }, 6);
  }
  const parts = splitTopLevel(text, ",");
  if (parts.length < 2) {
    const scalar = parseDimension(text, variables);
    if (!Number.isFinite(scalar)) return null;
    if (axis === "y") return { x: 0, y: scalar };
    if (axis === "z") return { x: scalar, y: scalar };
    return { x: scalar, y: 0 };
  }
  return roundPoint({
    x: parseDimension(parts[0], variables),
    y: parseDimension(parts[1], variables)
  });
}

function parseShift(value, env) {
  if (!value) return { x: 0, y: 0 };
  if (typeof value === "string" && value.startsWith("(")) {
    const point = resolveCoordinate(value, localCoordinateEnvironment(env), []);
    return point;
  }
  return { x: parseDimension(value, env.variables), y: parseDimension(value, env.variables) };
}

function applyTransform(point, transform = identityTransform()) {
  const normalized = normalizeTransform(transform);
  return roundPoint({
    x: point.x * normalized.a + point.y * normalized.c + normalized.x,
    y: point.x * normalized.b + point.y * normalized.d + normalized.y
  });
}

function applyTransformVector(point, transform = identityTransform()) {
  const normalized = normalizeTransform(transform);
  return roundPoint({
    x: point.x * normalized.a + point.y * normalized.c,
    y: point.x * normalized.b + point.y * normalized.d
  });
}

export function resolveCoordinate(raw, env, diagnostics = []) {
  let text = substituteTextVariables(String(raw).trim(), env.variables);
  text = substitutePathLetNumbers(text, env);
  text = stripOuterBraces(text);
  if (/^\+\(.+\)$/.test(text)) text = text.slice(1);
  if (text.startsWith("(") && text.endsWith(")")) text = text.slice(1, -1).trim();
  text = stripOuterBraces(text);

  const letCoordinate = resolvePathLetCoordinate(text, env);
  if (letCoordinate) return roundPoint(letCoordinate);

  const shifted = parseCoordinateOptionPrefix(text, env);
  if (shifted) {
    const point = resolveCoordinate(shifted.coordinate, env, diagnostics);
    return applyCoordinateOptionTransform(point, shifted.options, env);
  }

  if (text.startsWith("$") && text.endsWith("$")) {
    return resolveCalc(text.slice(1, -1).trim(), env, diagnostics);
  }
  const projection = splitCoordinateProjection(text);
  if (projection) {
    const left = resolveCoordinate(projection.left, env, diagnostics);
    const right = resolveCoordinate(projection.right, env, diagnostics);
    const projected = projection.operator === "|-" ? { x: left.x, y: right.y } : { x: right.x, y: left.y };
    return roundPoint(projected);
  }
  const intersectionCoordinate = resolveIntersectionCoordinateSystem(text, env, diagnostics);
  if (intersectionCoordinate) {
    return roundPoint(intersectionCoordinate);
  }
  if (Object.hasOwn(env.coordinates, text)) {
    return roundPoint(env.coordinates[text]);
  }
  const currentBoundingBoxPoint = resolveCurrentBoundingBoxCoordinate(text, env);
  if (currentBoundingBoxPoint) {
    return roundPoint(currentBoundingBoxPoint);
  }
  if (Object.hasOwn(env.nodes, text)) {
    return roundPoint(env.nodes[text].point);
  }
  const anchored = resolveAnchoredNodeCoordinate(text, env);
  if (anchored) {
    return roundPoint(anchored);
  }
  const declaredCoordinate = resolveDeclaredCoordinateSystem(text, env);
  if (declaredCoordinate) {
    return applyCoordinateTransform(declaredCoordinate, env);
  }
  const explicitCoordinate = resolveExplicitCoordinateSystem(text, env, diagnostics);
  if (explicitCoordinate) {
    return explicitCoordinate.absolute
      ? roundPoint(explicitCoordinate.point)
      : applyCoordinateTransform(explicitCoordinate.point, env);
  }
  const polar = text.match(/^(.+):(.+)$/);
  if (polar) {
    const angle = (coordinateAngleDegrees(polar[1], env.variables) * Math.PI) / 180;
    const radiusText = polar[2].trim();
    const [xRadiusText, yRadiusText] = splitImplicitPolarRadii(radiusText);
    const canvasPolar = coordinateComponentHasDimension(xRadiusText, env.variables) ||
      coordinateComponentHasDimension(yRadiusText, env.variables);
    const point = canvasPolar
      ? {
          x: Math.cos(angle) * parseImplicitCanvasPolarRadius(xRadiusText, env.variables),
          y: Math.sin(angle) * parseImplicitCanvasPolarRadius(yRadiusText, env.variables)
        }
      : projectBasisPoint(
          Math.cos(angle) * parseCoordinateFactor(xRadiusText, env.variables),
          Math.sin(angle) * parseCoordinateFactor(yRadiusText, env.variables),
          0,
          env.basis
        );
    return applyCoordinateTransform(roundPoint(point), env);
  }
  const comma = splitTopLevel(text, ",");
  if (comma.length >= 2) {
    if (comma.length >= 3) {
      const projected = projectBasisPoint(
        parseCoordinateFactor(comma[0], env.variables),
        parseCoordinateFactor(comma[1], env.variables),
        parseCoordinateFactor(comma[2], env.variables),
        env.basis
      );
      return applyCoordinateTransform(projected, env);
    }
    return applyCoordinateTransform(resolveImplicitTwoPartCoordinate(comma[0], comma[1], env), env);
  }
  diagnostics.push({ severity: "warning", message: `Unknown coordinate ${raw}` });
  return { x: 0, y: 0 };
}

function applyPathLetBindings(bindings = [], env = {}, diagnostics = []) {
  env.pathLet ||= { points: {}, numbers: {} };
  env.pathLet.points ||= {};
  env.pathLet.numbers ||= {};
  for (const binding of bindings) {
    const name = String(binding.name || "").trim();
    if (!name) continue;
    if (binding.kind === "point") {
      env.pathLet.points[name] = roundPoint(resolveCoordinate(binding.value, env, diagnostics));
    } else if (binding.kind === "number") {
      env.pathLet.numbers[name] = evaluateMath(binding.value, env.variables || {});
    }
  }
}

function substitutePathLetNumbers(input, env = {}) {
  const numbers = env.pathLet?.numbers || {};
  return String(input || "").replace(/\\n(?:\{([^{}]+)\}|([A-Za-z0-9@:_-]+))/g, (match, braced, plain) => {
    const name = String(braced ?? plain ?? "").trim();
    return Object.hasOwn(numbers, name) ? String(numbers[name]) : match;
  });
}

function resolvePathLetCoordinate(text, env = {}) {
  const points = env.pathLet?.points || {};
  const pointName = pathLetMacroName(text, "p");
  if (pointName !== null && Object.hasOwn(points, pointName)) return points[pointName];

  const parts = splitTopLevel(String(text || ""), ",");
  if (parts.length < 2) return null;
  const x = pathLetScalar(parts[0], env);
  const y = pathLetScalar(parts[1], env);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function pathLetScalar(value, env = {}) {
  const text = stripOuterBraces(String(value || "").trim());
  for (const axis of ["x", "y"]) {
    const name = pathLetMacroName(text, axis);
    if (name !== null && Object.hasOwn(env.pathLet?.points || {}, name)) {
      return Number(env.pathLet.points[name][axis]);
    }
  }
  const numberName = pathLetMacroName(text, "n");
  if (numberName !== null && Object.hasOwn(env.pathLet?.numbers || {}, numberName)) {
    return Number(env.pathLet.numbers[numberName]);
  }
  return Number.NaN;
}

function pathLetMacroName(text, macro) {
  const match = String(text || "").match(/^\\([pxyn])(?:\{([^{}]+)\}|([A-Za-z0-9@:_-]+))$/);
  if (!match || match[1] !== macro) return null;
  return String(match[2] ?? match[3] ?? "").trim();
}

function splitImplicitPolarRadii(value) {
  const match = String(value || "").trim().match(/^([\s\S]+?)\s+and\s+([\s\S]+)$/);
  if (!match) return [String(value || "").trim(), String(value || "").trim()];
  return [match[1].trim(), match[2].trim()];
}

function parseImplicitCanvasPolarRadius(value, variables = {}) {
  if (coordinateComponentHasDimension(value, variables)) {
    return parseCoordinateCanvasDimension(value, variables);
  }
  const text = stripOuterBraces(String(value || "").trim());
  return parseCoordinateCanvasDimension(`${text}pt`, variables);
}

function resolveImplicitTwoPartCoordinate(xRaw, yRaw, env) {
  const xIsDimension = coordinateComponentHasDimension(xRaw, env.variables);
  const yIsDimension = coordinateComponentHasDimension(yRaw, env.variables);
  const xPoint = xIsDimension
    ? { x: parseCoordinateCanvasDimension(xRaw, env.variables), y: 0 }
    : projectBasisPoint(parseCoordinateFactor(xRaw, env.variables), 0, 0, env.basis);
  const yPoint = yIsDimension
    ? { x: 0, y: parseCoordinateCanvasDimension(yRaw, env.variables) }
    : projectBasisPoint(0, parseCoordinateFactor(yRaw, env.variables), 0, env.basis);
  return roundPoint({
    x: xPoint.x + yPoint.x,
    y: xPoint.y + yPoint.y
  });
}

function resolveExplicitCoordinateSystem(text, env, diagnostics) {
  const match = String(text || "").match(/^([A-Za-z][A-Za-z0-9 _-]*?)\s+cs\s*:\s*([\s\S]+)$/);
  if (!match) return null;
  const system = match[1].trim().replace(/\s+/g, " ");
  const options = parseOptions(match[2]);
  if (system === "canvas") {
    return localCoordinateSystemPoint({
      x: parseCoordinateCanvasDimension(options.x ?? "0pt", env.variables),
      y: parseCoordinateCanvasDimension(options.y ?? "0pt", env.variables)
    });
  }
  if (system === "xyz") {
    return localCoordinateSystemPoint(projectBasisPoint(
      parseCoordinateFactor(options.x ?? 0, env.variables),
      parseCoordinateFactor(options.y ?? 0, env.variables),
      parseCoordinateFactor(options.z ?? 0, env.variables),
      env.basis
    ));
  }
  if (system === "canvas polar") {
    const angle = (coordinateAngleDegrees(options.angle ?? 0, env.variables) * Math.PI) / 180;
    const radius = options.radius ?? null;
    const xRadius = parseCoordinateCanvasDimension(options["x radius"] ?? radius ?? "0pt", env.variables);
    const yRadius = parseCoordinateCanvasDimension(options["y radius"] ?? radius ?? "0pt", env.variables);
    return localCoordinateSystemPoint({
      x: Math.cos(angle) * xRadius,
      y: Math.sin(angle) * yRadius
    });
  }
  if (system === "xyz polar" || system === "xy polar") {
    const angle = (coordinateAngleDegrees(options.angle ?? 0, env.variables) * Math.PI) / 180;
    const radius = options.radius ?? 0;
    const xRadius = parseCoordinateFactor(options["x radius"] ?? radius, env.variables);
    const yRadius = parseCoordinateFactor(options["y radius"] ?? radius, env.variables);
    return localCoordinateSystemPoint(projectBasisPoint(Math.cos(angle) * xRadius, Math.sin(angle) * yRadius, 0, env.basis));
  }
  if (system === "node") {
    const name = String(options.name || "").trim();
    if (!name) return null;
    if (options.anchor) return absoluteCoordinateSystemPoint(resolveCoordinate(`${name}.${options.anchor}`, env, diagnostics));
    if (options.angle) return absoluteCoordinateSystemPoint(resolveCoordinate(`${name}.${options.angle}`, env, diagnostics));
    if (Object.hasOwn(env.nodes, name)) return absoluteCoordinateSystemPoint(env.nodes[name].point);
    if (Object.hasOwn(env.coordinates, name)) return absoluteCoordinateSystemPoint(env.coordinates[name]);
  }
  if (system === "perpendicular") {
    const horizontalRaw = options["horizontal line through"];
    const verticalRaw = options["vertical line through"];
    if (horizontalRaw === undefined || verticalRaw === undefined) return null;
    const horizontal = resolveCoordinate(stripOuterBraces(String(horizontalRaw)), env, diagnostics);
    const vertical = resolveCoordinate(stripOuterBraces(String(verticalRaw)), env, diagnostics);
    return absoluteCoordinateSystemPoint({ x: vertical.x, y: horizontal.y });
  }
  if (system === "tangent") return resolveTangentCoordinateSystem(options, env, diagnostics);
  if (system === "barycentric") return resolveBarycentricCoordinateSystem(options, env);
  return null;
}

function localCoordinateSystemPoint(point) {
  return { point: roundPoint(point), absolute: false };
}

function absoluteCoordinateSystemPoint(point) {
  return { point: roundPoint(point), absolute: true };
}

function resolveBarycentricCoordinateSystem(weights = {}, env = {}) {
  let totalWeight = 0;
  let x = 0;
  let y = 0;
  for (const [name, rawWeight] of Object.entries(weights)) {
    const point = env.nodes?.[name]?.point || env.coordinates?.[name];
    const weight = evaluateMath(rawWeight, env.variables);
    if (!point || !Number.isFinite(weight)) continue;
    totalWeight += weight;
    x += point.x * weight;
    y += point.y * weight;
  }
  if (Math.abs(totalWeight) < 1e-12) return null;
  return absoluteCoordinateSystemPoint({ x: x / totalWeight, y: y / totalWeight });
}

function resolveTangentCoordinateSystem(options = {}, env = {}, diagnostics = []) {
  const name = resolveDynamicName(options.node, env);
  if (!name) return null;
  const node = env.nodes?.[name];
  const center = node?.point || env.coordinates?.[name];
  if (!center) return null;
  if (!node) return absoluteCoordinateSystemPoint(center);
  if (node.shape !== "circle" && node.shape !== "circleCrossSplit") {
    diagnostics.push({ severity: "warning", message: `Unsupported tangent node shape ${node.shape || "unknown"}` });
    return absoluteCoordinateSystemPoint(center);
  }
  const pointRaw = stripOuterBraces(String(options.point || "").trim());
  if (!pointRaw) return null;
  const external = resolveCoordinate(pointRaw, env, diagnostics);
  const dx = external.x - center.x;
  const dy = external.y - center.y;
  const distance = Math.hypot(dx, dy);
  const radius = Math.max(
    (Number(node.layoutWidth) || Number(node.width) || 0) / 2,
    (Number(node.layoutHeight) || Number(node.height) || 0) / 2
  );
  if (!Number.isFinite(radius) || radius <= 0 || distance <= radius) {
    diagnostics.push({ severity: "warning", message: `No tangent from ${pointRaw} to node ${name}` });
    return absoluteCoordinateSystemPoint(center);
  }
  const solution = evaluateMath(options.solution ?? 1, env.variables);
  const tangentOffset = Math.acos(Math.max(-1, Math.min(1, radius / distance)));
  const angle = Math.atan2(dy, dx) + (Number.isFinite(solution) && solution > 1 ? -tangentOffset : tangentOffset);
  return absoluteCoordinateSystemPoint({
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius
  });
}

function coordinateComponentHasDimension(value, variables = {}) {
  const raw = stripOuterBraces(String(value ?? "").trim());
  if (/\\(?:textwidth|textheight|linewidth|paperwidth|paperheight)\b/.test(raw)) return true;
  const text = substituteVariables(raw, variables).replace(/\{\}/g, "");
  return /(?:^|[^\p{L}])(?:cm|mm|pt|em|ex|in)\b/u.test(text);
}

function parseCoordinateFactor(value, variables = {}) {
  const evaluated = evaluateMath(value, variables);
  return Number.isFinite(evaluated) ? evaluated : 0;
}

function parseCoordinateCanvasDimension(value, variables = {}) {
  const text = stripOuterBraces(substituteVariables(value, variables).replace(/\{\}/g, "").trim());
  const additive = parseAdditiveCoordinateDimension(text);
  if (Number.isFinite(additive)) return additive;
  const parsed = parseDimension(text, variables);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseAdditiveCoordinateDimension(text) {
  const compact = String(text || "").replace(/\s+/g, "");
  if (!compact) return NaN;
  const tokenPattern = /[+-]?(?:\d+\.?\d*|\.\d+)(?:cm|mm|pt|em|ex|in)?/g;
  let index = 0;
  let total = 0;
  let matched = false;
  for (const match of compact.matchAll(tokenPattern)) {
    if (match.index !== index) return NaN;
    matched = true;
    const token = match[0];
    const parsed = token.match(/^([+-]?(?:\d+\.?\d*|\.\d+))(cm|mm|pt|em|ex|in)?$/);
    if (!parsed) return NaN;
    total += parseDimension(`${parsed[1]}${parsed[2] || "pt"}`, {});
    index = match.index + token.length;
  }
  return matched && index === compact.length ? total : NaN;
}

function coordinateAngleDegrees(value, variables = {}) {
  const text = String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const namedAngles = {
    right: 0,
    east: 0,
    up: 90,
    north: 90,
    left: 180,
    west: 180,
    down: -90,
    south: -90,
    "north east": 45,
    "north west": 135,
    "south east": -45,
    "south west": -135
  };
  if (Object.hasOwn(namedAngles, text)) return namedAngles[text];
  return evaluateMath(value, variables);
}

function resolveIntersectionCoordinateSystem(text, env, diagnostics) {
  const match = String(text || "").match(/^intersection\s+cs\s*:\s*([\s\S]+)$/);
  if (!match) return null;
  const options = parseOptions(match[1]);
  const first = intersectionLineEndpoints(options["first line"], env, diagnostics);
  const second = intersectionLineEndpoints(options["second line"], env, diagnostics);
  if (!first || !second) return null;
  const point = lineLineIntersection(first[0], first[1], second[0], second[1]);
  if (!point) {
    diagnostics.push({ severity: "warning", message: `No line intersection for ${text}` });
    return null;
  }
  return roundPoint(point);
}

function intersectionLineEndpoints(value, env, diagnostics) {
  if (value === undefined || value === null || value === true) return null;
  const parts = splitTopLevelOperator(String(value), "--");
  if (parts.length !== 2) {
    diagnostics.push({ severity: "warning", message: `Unsupported intersection line ${value}` });
    return null;
  }
  return parts.map((part) => resolveCoordinate(stripCoordinateEndpoint(part), env, diagnostics));
}

function stripCoordinateEndpoint(value) {
  let text = stripOuterBraces(String(value || "").trim());
  if (text.startsWith("(") && text.endsWith(")")) text = text.slice(1, -1).trim();
  return text;
}

function splitTopLevelOperator(text, operator) {
  const parts = [];
  let start = 0;
  let paren = 0;
  let brace = 0;
  let bracket = 0;
  for (let index = 0; index <= text.length - operator.length; index += 1) {
    const char = text[index];
    if (char === "(") paren += 1;
    else if (char === ")") paren = Math.max(0, paren - 1);
    else if (char === "{") brace += 1;
    else if (char === "}") brace = Math.max(0, brace - 1);
    else if (char === "[") bracket += 1;
    else if (char === "]") bracket = Math.max(0, bracket - 1);
    if (paren || brace || bracket) continue;
    if (text.slice(index, index + operator.length) === operator) {
      parts.push(text.slice(start, index).trim());
      start = index + operator.length;
      index += operator.length - 1;
    }
  }
  parts.push(text.slice(start).trim());
  return parts.filter(Boolean);
}

function lineLineIntersection(a, b, c, d) {
  const denominator = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
  if (Math.abs(denominator) < 1e-12) return null;
  const detA = a.x * b.y - a.y * b.x;
  const detB = c.x * d.y - c.y * d.x;
  return {
    x: (detA * (c.x - d.x) - (a.x - b.x) * detB) / denominator,
    y: (detA * (c.y - d.y) - (a.y - b.y) * detB) / denominator
  };
}

function resolveDeclaredCoordinateSystem(text, env) {
  const match = String(text || "").match(/^(.+?)\s+cs\s*:\s*([\s\S]+)$/);
  if (!match) return null;
  const name = match[1].trim();
  const definition = env.coordinateSystems?.[name];
  if (!definition?.point) return null;
  const argument = stripOuterBraces(match[2].trim());
  const variables = { ...(env.variables || {}) };
  for (const macro of definition.macros || []) {
    variables[macro.name] = evaluateMath(substituteCoordinateSystemArgument(macro.expression, argument), variables);
  }
  const xRaw = substituteCoordinateSystemArgument(definition.point.x, argument);
  const yRaw = substituteCoordinateSystemArgument(definition.point.y, argument);
  const usesBasisFactors = definition.point.kind === "xy";
  const x = usesBasisFactors ? evaluateMath(xRaw, variables) : parseCoordinateCanvasDimension(xRaw, variables);
  const y = usesBasisFactors ? evaluateMath(yRaw, variables) : parseCoordinateCanvasDimension(yRaw, variables);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return roundPoint(usesBasisFactors ? projectBasisPoint(x, y, 0, env.basis) : { x, y });
}

function substituteCoordinateSystemArgument(text, argument) {
  return String(text || "").replace(/#1/g, `(${argument})`);
}

function splitCoordinateProjection(text) {
  let paren = 0;
  let brace = 0;
  let bracket = 0;
  for (let index = 0; index < text.length - 1; index += 1) {
    const char = text[index];
    if (char === "(") paren += 1;
    if (char === ")") paren = Math.max(0, paren - 1);
    if (char === "{") brace += 1;
    if (char === "}") brace = Math.max(0, brace - 1);
    if (char === "[") bracket += 1;
    if (char === "]") bracket = Math.max(0, bracket - 1);
    if (paren || brace || bracket) continue;
    const operator = text.slice(index, index + 2);
    if (operator === "|-" || operator === "-|") {
      return {
        operator,
        left: text.slice(0, index).trim(),
        right: text.slice(index + 2).trim()
      };
    }
  }
  return null;
}

function parseCoordinateOptionPrefix(text, env) {
  if (!text.startsWith("[")) return null;
  const options = readBalancedPrefix(text, "[", "]");
  if (!options) return null;
  const coordinate = text.slice(options.end).trim();
  if (!coordinate) return null;
  const parsed = parseOptions(options.content);
  const expanded = normalizeOptions("path", parsed, env).options;
  return { coordinate, options: expanded };
}

function applyCoordinateOptionTransform(point, options, env) {
  const parent = normalizeTransform(env.transform);
  const inverseParent = inverseAffineTransform(parent);
  if (!inverseParent) return roundPoint(point);
  const local = coordinateLocalTransform(options, env);
  const canvasTransform = multiplyTransforms(parent, multiplyTransforms(local, inverseParent));
  return applyTransform(point, canvasTransform);
}

function inverseAffineTransform(transform) {
  const normalized = normalizeTransform(transform);
  const determinant = normalized.a * normalized.d - normalized.b * normalized.c;
  if (Math.abs(determinant) < 1e-12) return null;
  const a = normalized.d / determinant;
  const b = -normalized.b / determinant;
  const c = -normalized.c / determinant;
  const d = normalized.a / determinant;
  return affineTransform(
    a,
    b,
    c,
    d,
    -(a * normalized.x + c * normalized.y),
    -(b * normalized.x + d * normalized.y)
  );
}

function readBalancedPrefix(text, open, close) {
  if (text[0] !== open) return null;
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === open) depth += 1;
    if (text[index] === close) depth -= 1;
    if (depth === 0) {
      return { content: text.slice(1, index), end: index + 1 };
    }
  }
  return null;
}

function resolveAnchoredNodeCoordinate(text, env) {
  if (looksLikeExplicitCoordinate(text)) return null;
  const dot = text.lastIndexOf(".");
  if (dot <= 0 || dot === text.length - 1) return null;
  const name = text.slice(0, dot).trim();
  const anchor = text.slice(dot + 1).trim();
  const node = env.nodes[name];
  if (node) return nodeAnchorCoordinate(node, anchor);
  if (Object.hasOwn(env.coordinates, name)) return env.coordinates[name];
  return null;
}

function looksLikeExplicitCoordinate(text) {
  const value = String(text || "").trim();
  return value.includes(",") || /^[-+]?(?:\d+\.?\d*|\.\d+)\s*:/.test(value);
}

function nodeAnchorCoordinate(node, anchorRaw) {
  const rawAnchor = String(anchorRaw ?? "center").trim().toLowerCase();
  const visibleWidth = Number(node.width) || 0;
  const visibleHeight = Number(node.height) || 0;
  const width = Number(node.layoutWidth) || visibleWidth;
  const height = Number(node.layoutHeight) || visibleHeight;
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const angle = Number(rawAnchor);
  if (Number.isFinite(angle)) {
    return angleAnchor(node, angle, halfWidth, halfHeight);
  }
  const anchor = rawAnchor.replace(/-/g, " ");
  if (!anchor || anchor === "center") return roundPoint(node.point);
  const customAnchor = customNodeLocalAnchor(node.shape, rawAnchor, {
    width,
    height,
    visibleWidth,
    visibleHeight,
    shapeData: node.shapeData
  });
  if (customAnchor) {
    const rotated = rotateVector(customAnchor.x, customAnchor.y, Number(node.rotation) || 0);
    return roundPoint({ x: node.point.x + rotated.x, y: node.point.y + rotated.y });
  }
  if (anchor === "text") return roundPoint({ x: node.point.x - visibleWidth * 0.18, y: node.point.y - visibleHeight * 0.04 });
  const textAnchor = textAnchorKind(anchor);
  if (textAnchor) {
    const local = {
      x: anchor.includes("east") ? halfWidth : anchor.includes("west") ? -halfWidth : 0,
      y: Number(node[`${textAnchor}Offset`]) || (textAnchor === "base" ? -visibleHeight * 0.08 : 0)
    };
    const rotated = rotateVector(local.x, local.y, Number(node.rotation) || 0);
    return roundPoint({ x: node.point.x + rotated.x, y: node.point.y + rotated.y });
  }
  if (node.shape === "diamond") {
    return diamondAnchorCoordinate(node, anchor, halfWidth, halfHeight);
  }
  const local = {
    x: anchor.includes("east") ? halfWidth : anchor.includes("west") ? -halfWidth : 0,
    y: anchor.includes("north") ? halfHeight : anchor.includes("south") ? -halfHeight : 0
  };
  const rotated = rotateVector(local.x, local.y, Number(node.rotation) || 0);
  return roundPoint({ x: node.point.x + rotated.x, y: node.point.y + rotated.y });
}

function customNodeLocalAnchor(shape, anchorRaw, size) {
  const rawAnchor = String(anchorRaw || "").trim().toLowerCase();
  const anchor = rawAnchor.replace(/-/g, " ");
  const halfWidth = (Number(size.width) || 0) / 2;
  const halfHeight = (Number(size.height) || 0) / 2;
  if (shape === "circuitikzInductor") {
    const inductorAnchor = circuitikzInductorLocalAnchor(anchor, size);
    if (inductorAnchor) return inductorAnchor;
  }
  if (shape === "circuitikzVariableCapacitor") {
    const tunableHalf = Number(size.shapeData?.tunableHalf) || halfWidth;
    const halfHeightFromShape = Number(size.shapeData?.halfHeight) || halfHeight;
    const fixed = size.shapeData?.fixedDirection !== false;
    const anchors = {
      wiper: { x: -tunableHalf, y: fixed ? -halfHeightFromShape : halfHeightFromShape },
      w: { x: -tunableHalf, y: fixed ? -halfHeightFromShape : halfHeightFromShape },
      W: { x: -tunableHalf, y: fixed ? -halfHeightFromShape : halfHeightFromShape },
      tip: { x: tunableHalf, y: fixed ? halfHeightFromShape : -halfHeightFromShape }
    };
    return anchors[rawAnchor] || anchors[anchor] || null;
  }
  const scaledKnotAnchor = size.shapeData?.knotCrossing
    ? anchor.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s+(.+)$/)
    : null;
  if (scaledKnotAnchor) {
    const base = shapeCompassLocalAnchor(shape, scaledKnotAnchor[2], halfWidth, halfHeight);
    if (base) {
      const scale = Number(scaledKnotAnchor[1]);
      return { x: base.x * scale, y: base.y * scale };
    }
  }
  if (shape === "cylinder") {
    const geometry = geometricCylinderGeometry({
      width: Number(size.visibleWidth) || Number(size.width) || 0,
      height: Number(size.visibleHeight) || Number(size.height) || 0
    }, size.shapeData || {});
    const named = geometry.anchors?.[anchor] || geometry.anchors?.[rawAnchor];
    if (named) return named;
    const directions = {
      north: { x: 0, y: 1 },
      south: { x: 0, y: -1 },
      east: { x: 1, y: 0 },
      west: { x: -1, y: 0 },
      "north east": { x: 1, y: 1 },
      "north west": { x: -1, y: 1 },
      "south east": { x: 1, y: -1 },
      "south west": { x: -1, y: -1 }
    };
    if (directions[anchor]) return geometricCylinderBorderPoint(geometry, directions[anchor]);
  }
  if (shape === "signal") {
    const geometry = symbolSignalGeometry({
      width: Number(size.visibleWidth) || Number(size.width) || 0,
      height: Number(size.visibleHeight) || Number(size.height) || 0
    }, size.shapeData || {});
    const named = geometry.anchors?.[anchor] || geometry.anchors?.[rawAnchor];
    if (named) return named;
  }
  const shapeAnchor = shapeCompassLocalAnchor(shape, anchor, halfWidth, halfHeight);
  if (shapeAnchor) return shapeAnchor;
  if (shape === "rectangleSplit") {
    const splitAnchor = rectangleSplitLocalAnchor(anchor, size);
    if (splitAnchor) return splitAnchor;
  }
  if (shape === "circleSplit") {
    const splitAnchor = circleSplitLocalAnchor(anchor, size);
    if (splitAnchor) return splitAnchor;
  }
  if (shape === "isoscelesTriangle") {
    const anchors = {
      apex: { x: halfWidth, y: 0 },
      "left corner": { x: -halfWidth, y: halfHeight },
      "right corner": { x: -halfWidth, y: -halfHeight },
      "lower side": { x: -halfWidth, y: 0 },
      "left side": { x: 0, y: halfHeight / 2 },
      "right side": { x: 0, y: -halfHeight / 2 }
    };
    return anchors[anchor] || anchors[rawAnchor] || null;
  }
  if (arrowNodeShape(shape)) {
    return arrowNodeLocalAnchor(shape, anchor, { ...size, width: halfWidth * 2, height: halfHeight * 2 });
  }
  if (shape === "opAmp") {
    const inputY = halfHeight * 0.5;
    const noInvUp = size.shapeData?.opAmpNoInvInputUp !== false;
    const plusY = noInvUp ? inputY : -inputY;
    const minusY = -plusY;
    const anchors = {
      "+": { x: -halfWidth, y: plusY },
      plus: { x: -halfWidth, y: plusY },
      "-": { x: -halfWidth, y: minusY },
      minus: { x: -halfWidth, y: minusY },
      out: { x: halfWidth, y: 0 },
      output: { x: halfWidth, y: 0 },
      up: { x: 0, y: halfHeight },
      down: { x: 0, y: -halfHeight }
    };
    return anchors[rawAnchor] || anchors[anchor] || null;
  }
  if (shape === "circuitikzTransistor") {
    return circuitikzTransistorLocalAnchor(rawAnchor, size);
  }
  if (shape === "circuitikzMosfet") {
    return circuitikzMosfetLocalAnchor(rawAnchor, size);
  }
  if (shape === "circuitikzTriode") {
    return circuitikzTriodeLocalAnchor(rawAnchor, size);
  }
  if (shape === "circuitikzPentode" || shape === "circuitikzTetrode" || shape === "circuitikzDiodeTube") {
    return circuitikzTubeLocalAnchor(rawAnchor, size);
  }
  if (shape === "circuitikzQuadpole") {
    return circuitikzQuadpoleLocalAnchor(rawAnchor, size);
  }
  if (shape === "tikzquadsQuad") {
    const portY = tikzquadsPortY(halfHeight);
    const innerX = halfWidth - tikzquadsOuterExt(halfWidth, "quad") - tikzquadsInnerExt(halfWidth);
    const textY = halfHeight - tikzquadsInnerExt(halfHeight);
    const anchors = {
      "1+": { x: -halfWidth, y: portY },
      "1-": { x: -halfWidth, y: -portY },
      "2+": { x: halfWidth, y: portY },
      "2-": { x: halfWidth, y: -portY },
      "inner 1+": { x: -innerX, y: portY },
      "inner 1-": { x: -innerX, y: -portY },
      "inner 2+": { x: innerX, y: portY },
      "inner 2-": { x: innerX, y: -portY },
      "top left": { x: -innerX, y: textY },
      "top center": { x: 0, y: textY },
      "top right": { x: innerX, y: textY },
      "bottom left": { x: -innerX, y: -textY },
      "bottom center": { x: 0, y: -textY },
      "bottom right": { x: innerX, y: -textY },
      "inner top left": { x: -innerX, y: portY + halfHeight * 0.12 },
      "inner top center": { x: 0, y: portY + halfHeight * 0.12 },
      "inner top right": { x: innerX, y: portY + halfHeight * 0.12 },
      "inner bottom left": { x: -innerX, y: -portY - halfHeight * 0.12 },
      "inner bottom center": { x: 0, y: -portY - halfHeight * 0.12 },
      "inner bottom right": { x: innerX, y: -portY - halfHeight * 0.12 }
    };
    return anchors[rawAnchor] || anchors[anchor] || null;
  }
  if (shape === "tikzquadsBlackBox") {
    const portY = tikzquadsPortY(halfHeight);
    const innerX = halfWidth - tikzquadsOuterExt(halfWidth, "black box") - tikzquadsInnerExt(halfWidth);
    const textY = halfHeight - tikzquadsInnerExt(halfHeight);
    const anchors = {
      "1+": { x: -halfWidth, y: portY },
      "1-": { x: -halfWidth, y: -portY },
      "inner 1+": { x: -innerX, y: portY },
      "inner 1-": { x: -innerX, y: -portY },
      "top left": { x: -innerX, y: textY },
      "top center": { x: 0, y: textY },
      "top right": { x: innerX, y: textY },
      "bottom left": { x: -innerX, y: -textY },
      "bottom center": { x: 0, y: -textY },
      "bottom right": { x: innerX, y: -textY },
      "inner top left": { x: -innerX, y: portY + halfHeight * 0.12 },
      "inner top center": { x: 0, y: portY + halfHeight * 0.12 },
      "inner top right": { x: innerX, y: portY + halfHeight * 0.12 },
      "inner bottom left": { x: -innerX, y: -portY - halfHeight * 0.12 },
      "inner bottom center": { x: 0, y: -portY - halfHeight * 0.12 },
      "inner bottom right": { x: innerX, y: -portY - halfHeight * 0.12 }
    };
    return anchors[rawAnchor] || anchors[anchor] || null;
  }
  return null;
}

function circuitikzInductorLocalAnchor(anchor, size = {}) {
  const halfWidth = (Number(size.width) || 0) / 2;
  const upperAmplitude = Math.max(0, Number(size.shapeData?.upperAmplitude) || (Number(size.height) || 0) / 2);
  const lowerAmplitude = Math.max(0, Number(size.shapeData?.lowerAmplitude) || upperAmplitude);
  const coreDistance = Math.max(0, Number(size.shapeData?.coreDistance) || 0);
  if (anchor === "core east") return { x: halfWidth, y: upperAmplitude + coreDistance };
  if (anchor === "core west") return { x: -halfWidth, y: upperAmplitude + coreDistance };
  if (anchor !== "midtap") return null;
  const kind = String(size.shapeData?.inductorKind || "cute").toLowerCase();
  const coils = Math.max(0, Math.round(Number(size.shapeData?.coils) || 0));
  if (kind === "european") return { x: 0, y: 0 };
  if (kind === "american") return { x: 0, y: coils % 2 === 1 ? upperAmplitude : 0 };
  return { x: 0, y: coils % 2 === 1 ? upperAmplitude : -lowerAmplitude };
}

function rectangleSplitLocalAnchor(anchor, size = {}) {
  const layout = size.shapeData?.rectangleSplit;
  if (!layout?.parts?.length) return null;
  if (String(anchor || "").trim().toLowerCase() === "text") {
    return rectangleSplitLocalAnchor("one", size);
  }
  const match = String(anchor || "").match(/^([a-z]+|\d+)(?:\s+(north|south|east|west|split))?$/);
  if (!match) return null;
  const namedIndex = RECTANGLE_SPLIT_PART_NAMES.indexOf(match[1]);
  const numericIndex = Number(match[1]) - 1;
  const index = namedIndex >= 0 ? namedIndex : Number.isFinite(numericIndex) ? numericIndex : -1;
  const logicalPart = layout.logicalParts?.[index];
  const part = logicalPart ? layout.parts[logicalPart.visibleIndex] : layout.parts[index];
  if (!part) return null;
  if (!layout.horizontal) {
    const xScale = (Number(size.width) || layout.size.width) / Math.max(layout.size.width, 1e-9);
    const yScale = (Number(size.height) || layout.size.height) / Math.max(layout.size.height, 1e-9);
    const centerX = part.centerX * xScale;
    const centerY = part.centerY * yScale;
    const halfWidth = (Number(size.width) || layout.size.width) / 2;
    const halfPartHeight = (part.height * yScale) / 2;
    const originX = (Number(part.originX) || 0) * xScale;
    const originY = (Number(part.originY) || 0) * yScale;
    if (match[2] === "north") return { x: centerX, y: centerY + halfPartHeight };
    if (match[2] === "south") return { x: centerX, y: centerY - halfPartHeight };
    if (match[2] === "east") return { x: halfWidth, y: centerY };
    if (match[2] === "west") return { x: -halfWidth, y: centerY };
    if (match[2] === "split") return { x: 0, y: centerY - halfPartHeight };
    return { x: originX, y: originY };
  }
  const scale = (Number(size.width) || layout.size.width) / Math.max(layout.size.width, 1e-9);
  const centerX = part.centerX * scale;
  const halfPartWidth = (part.width * scale) / 2;
  const originX = (part.originX ?? (part.centerX - part.width / 2 + (layout.innerXSep || 0))) * scale;
  const yScale = (Number(size.height) || layout.size.height) / Math.max(layout.size.height, 1e-9);
  const originY = (Number(part.originY) || 0) * yScale;
  const halfHeight = (Number(size.height) || layout.size.height) / 2;
  if (match[2] === "north") return { x: centerX, y: halfHeight };
  if (match[2] === "south") return { x: centerX, y: -halfHeight };
  if (match[2] === "east") return { x: centerX + halfPartWidth, y: 0 };
  if (match[2] === "west") return { x: centerX - halfPartWidth, y: 0 };
  if (match[2] === "split") return { x: centerX + halfPartWidth, y: 0 };
  // PGF's bare part anchors are the origins of the part text boxes, not
  // the geometric centers of the split cells.
  return { x: originX, y: originY };
}

function circleSplitLocalAnchor(anchor, size = {}) {
  if (String(anchor || "").trim().toLowerCase() !== "lower") return null;
  const layout = size.shapeData?.circleSplit;
  if (!layout?.size || !layout.lowerAnchor) return null;
  // Shape-specific anchors do not inherit PGF's outer separation. Use the
  // painted circle size (which includes canvas/node scaling) rather than the
  // enlarged border-routing size.
  const scale = (Number(size.visibleWidth) || Number(size.width) || 0) / Math.max(Number(layout.size.width) || 0, 1e-9);
  return {
    x: (Number(layout.lowerAnchor.x) || 0) * scale,
    y: (Number(layout.lowerAnchor.y) || 0) * scale
  };
}

function tikzquadsPortY(halfHeight) {
  return halfHeight * (5 / 7);
}

function tikzquadsOuterExt(halfWidth, kind) {
  return kind === "black box" ? halfWidth * (5 / 19) : halfWidth * (5 / 33);
}

function tikzquadsInnerExt(halfSize) {
  return halfSize / 7;
}

function shapeCompassLocalAnchor(shape, anchor, halfWidth, halfHeight) {
  if (shape !== "circle" && shape !== "circleSplit" && shape !== "circleCrossSplit" && shape !== "ellipse") return null;
  if (halfWidth <= 0 || halfHeight <= 0) return null;
  const dx = anchor.includes("east") ? 1 : anchor.includes("west") ? -1 : 0;
  const dy = anchor.includes("north") ? 1 : anchor.includes("south") ? -1 : 0;
  if (!dx && !dy) return null;
  if (shape === "circle" || shape === "circleSplit" || shape === "circleCrossSplit") {
    const radius = Math.max(halfWidth, halfHeight);
    const length = Math.hypot(dx, dy) || 1;
    return { x: (dx / length) * radius, y: (dy / length) * radius };
  }
  const scale = 1 / Math.sqrt((dx * dx) / (halfWidth * halfWidth) + (dy * dy) / (halfHeight * halfHeight));
  return { x: dx * scale, y: dy * scale };
}

function arrowNodeLocalAnchor(shape, anchor, size) {
  const points = arrowNodeLocalPoints(shape, size);
  const byName = Object.fromEntries(points.map((point) => [point.name, { x: point.x, y: point.y }]));
  const aliases = {
    tip: "tip",
    "tip 1": "tip 1",
    "tip 2": "tip 2",
    tail: "tail",
    "before tail": "before tail",
    "after tail": "after tail",
    "before head": "before head",
    "after head": "after head",
    "before head 1": "before head 1",
    "after head 1": "after head 1",
    "before head 2": "before head 2",
    "after head 2": "after head 2",
    "before tip": "before tip",
    "after tip": "after tip",
    "before tip 1": "before tip 1",
    "after tip 1": "after tip 1",
    "before tip 2": "before tip 2",
    "after tip 2": "after tip 2"
  };
  const named = byName[aliases[anchor] || anchor];
  if (named) return named;
  if (anchor === "east") return byName.tip || byName["tip 1"] || null;
  if (anchor === "west") return byName.tail || byName["tip 2"] || null;
  if (anchor === "north") return topmostPoint(points);
  if (anchor === "south") return bottommostPoint(points);
  if (anchor === "north east") return cornerPoint(points, 1, 1);
  if (anchor === "south east") return cornerPoint(points, 1, -1);
  if (anchor === "north west") return cornerPoint(points, -1, 1);
  if (anchor === "south west") return cornerPoint(points, -1, -1);
  return null;
}

function arrowNodeLocalPoints(shape, size = {}) {
  const halfWidth = (Number(size.width) || 0) / 2;
  const halfHeight = (Number(size.height) || 0) / 2;
  const data = size.shapeData || {};
  const sourcePoints = Array.isArray(data.arrowGeometry?.points) && data.arrowGeometry.points.length
    ? data.arrowGeometry.points.map((point) => ({ ...point }))
    : null;
  if (sourcePoints) {
    const rotate = Number(data.shapeBorderRotate) || 0;
    return rotate ? sourcePoints.map((point) => ({ ...point, ...rotateVector(point.x, point.y, rotate) })) : sourcePoints;
  }
  const headExtend = Math.max(0, Number(data.arrowHeadExtend) || 0.25);
  const headIndent = Math.max(0, Number(data.arrowHeadIndent) || 0);
  const headLength = Math.min(halfWidth * 0.82, Math.max(halfHeight * 0.82, headExtend * 1.15, 0.12));
  const bodyHalf = Math.max(0.02, Math.min(halfHeight * 0.72, halfHeight - Math.min(headExtend, halfHeight * 0.48)));
  const indent = Math.min(Math.max(0, headIndent), headLength * 0.7);
  const rotate = Number(data.shapeBorderRotate) || 0;
  const rightBase = halfWidth - headLength;
  const rightNeck = rightBase + indent;
  let points;
  if (shape === "doubleArrow") {
    const leftBase = -rightBase;
    const leftNeck = -rightNeck;
    points = [
      { name: "tip 1", x: halfWidth, y: 0 },
      { name: "before tip 1", x: rightBase, y: halfHeight },
      { name: "before head 1", x: rightNeck, y: bodyHalf },
      { name: "after head 2", x: leftNeck, y: bodyHalf },
      { name: "after tip 2", x: leftBase, y: halfHeight },
      { name: "tip 2", x: -halfWidth, y: 0 },
      { name: "before tip 2", x: leftBase, y: -halfHeight },
      { name: "before head 2", x: leftNeck, y: -bodyHalf },
      { name: "after head 1", x: rightNeck, y: -bodyHalf },
      { name: "after tip 1", x: rightBase, y: -halfHeight }
    ];
  } else {
    points = [
      { name: "tip", x: halfWidth, y: 0 },
      { name: "before tip", x: rightBase, y: halfHeight },
      { name: "before head", x: rightNeck, y: bodyHalf },
      { name: "after tail", x: -halfWidth, y: bodyHalf },
      { name: "tail", x: -halfWidth, y: 0 },
      { name: "before tail", x: -halfWidth, y: -bodyHalf },
      { name: "after head", x: rightNeck, y: -bodyHalf },
      { name: "after tip", x: rightBase, y: -halfHeight }
    ];
  }
  return rotate ? points.map((point) => ({ ...point, ...rotateVector(point.x, point.y, rotate) })) : points;
}

function topmostPoint(points) {
  return points.reduce((best, point) => (point.y > best.y ? point : best), points[0] || { x: 0, y: 0 });
}

function bottommostPoint(points) {
  return points.reduce((best, point) => (point.y < best.y ? point : best), points[0] || { x: 0, y: 0 });
}

function cornerPoint(points, xSign, ySign) {
  return points.reduce((best, point) => {
    const score = point.x * xSign + point.y * ySign;
    return score > best.score ? { point, score } : best;
  }, { point: points[0] || { x: 0, y: 0 }, score: -Infinity }).point;
}

function angleAnchor(node, angle, halfWidth, halfHeight) {
  const radians = (angle * Math.PI) / 180;
  return nodeBorderPoint(node, node.point, {
    x: node.point.x + Math.cos(radians),
    y: node.point.y + Math.sin(radians)
  });
}

function diamondAnchorCoordinate(node, anchor, halfWidth, halfHeight) {
  const local = {
    north: { x: 0, y: halfHeight },
    south: { x: 0, y: -halfHeight },
    east: { x: halfWidth, y: 0 },
    west: { x: -halfWidth, y: 0 },
    "north east": { x: halfWidth / 2, y: halfHeight / 2 },
    "north west": { x: -halfWidth / 2, y: halfHeight / 2 },
    "south east": { x: halfWidth / 2, y: -halfHeight / 2 },
    "south west": { x: -halfWidth / 2, y: -halfHeight / 2 }
  }[anchor];
  if (!local) return roundPoint(node.point);
  const rotated = rotateVector(local.x, local.y, Number(node.rotation) || 0);
  return roundPoint({ x: node.point.x + rotated.x, y: node.point.y + rotated.y });
}

function resolveCurrentBoundingBoxCoordinate(text, env) {
  const match = String(text || "").trim().toLowerCase().match(/^current bounding box(?:\.(.+))?$/);
  if (!match || typeof env.currentBoundingBox !== "function") return null;
  const bounds = env.currentBoundingBox();
  if (!bounds) return null;
  const anchor = (match[1] || "center").replace(/-/g, " ").trim();
  const xCenter = (bounds.minX + bounds.maxX) / 2;
  const yCenter = (bounds.minY + bounds.maxY) / 2;
  let x = xCenter;
  let y = yCenter;
  if (anchor.includes("west")) x = bounds.minX;
  if (anchor.includes("east")) x = bounds.maxX;
  if (anchor.includes("south")) y = bounds.minY;
  if (anchor.includes("north")) y = bounds.maxY;
  return roundPoint({ x, y });
}

function computeCurrentBoundingBox(ir) {
  return computeItemsBoundingBox([...(ir.backgroundItems || []), ...(ir.items || [])]);
}

function computeItemsBoundingBox(items = [], fallback = { minX: 0, minY: 0, maxX: 0, maxY: 0 }) {
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const include = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);
  };
  for (const item of items) {
    includeItemBounds(item, include);
  }
  if (!Number.isFinite(bounds.minX)) return fallback;
  return bounds;
}

function includeItemBounds(item, include) {
  if (item.overlay || item.excludeFromBounds) return;
  if (item.type === "nodeBox") {
    const foregroundOuterX = Math.max(0, Number(item.foregroundOuterSep?.x) || 0);
    const foregroundOuterY = Math.max(0, Number(item.foregroundOuterSep?.y) || 0);
    if (item.shape === "cylinder") {
      const bounds = geometricCylinderGeometry(item, item.shapeData || {}).bounds;
      includeRotatedItemRectangle(
        item.x + bounds.minX - foregroundOuterX,
        item.y + bounds.minY - foregroundOuterY,
        item.x + bounds.maxX + foregroundOuterX,
        item.y + bounds.maxY + foregroundOuterY,
        item,
        include
      );
      return;
    }
    if (item.shape === "signal") {
      const bounds = symbolSignalGeometry(item, item.shapeData || {}).bounds;
      includeRotatedItemRectangle(
        item.x + bounds.minX - foregroundOuterX,
        item.y + bounds.minY - foregroundOuterY,
        item.x + bounds.maxX + foregroundOuterX,
        item.y + bounds.maxY + foregroundOuterY,
        item,
        include
      );
      return;
    }
    includeRotatedItemRectangle(
      item.x - item.width / 2 - foregroundOuterX,
      item.y - item.height / 2 - foregroundOuterY,
      item.x + item.width / 2 + foregroundOuterX,
      item.y + item.height / 2 + foregroundOuterY,
      item,
      include
    );
    return;
  }
  if (item.projected && item.type === "path") {
    includePathItemBounds(item, include);
    return;
  }
  if (item.shape === "circle") {
    include(item.cx - item.r, item.cy - item.r);
    include(item.cx + item.r, item.cy + item.r);
    return;
  }
  if (item.shape === "ellipse") {
    include(item.cx - item.rx, item.cy - item.ry);
    include(item.cx + item.rx, item.cy + item.ry);
    return;
  }
  if (item.type === "path") {
    includePathItemBounds(item, include);
    return;
  }
  if (item.type === "bbox") {
    includePathItemBounds(item, include);
    return;
  }
  if (item.type === "textNode") {
    includeTextNodeItemBounds(item, include);
    return;
  }
  if (item.type === "marker") {
    include(item.x, item.y);
  }
}

function excludeExistingItemsFromBoundingBox(ir) {
  for (const item of [...(ir.backgroundItems || []), ...(ir.items || [])]) {
    item.excludeFromBounds = true;
  }
}

function includeTextNodeItemBounds(item, include) {
  const normalized = normalizeTikzText(item.text);
  if (normalized.invisible) return;
  const scale = Number(item.style?.fontScale) || 1;
  let width = 0;
  let height = 0;
  if (normalized.kind === "image") {
    width = normalized.width * scale;
    height = normalized.height * scale;
  } else {
    const typewriter = fontFamilyUsesTypewriter(item.style?.fontFamily || normalized.fontFamily);
    const wrapWidth = Number(item.wrapWidth);
    const usesWrappedWidth = Number.isFinite(wrapWidth) && wrapWidth > 0;
    const metricNormalized = usesWrappedWidth
      ? wrappedTextMetricNormalized(normalized, wrapWidth, item.textWrapMode, {
          hyphenate: item.textWrapHyphenation
        })
      : normalized;
    const textMetricScale = nodeTextMetricScaleForText(
      metricNormalized,
      normalized.explicitFontSize ? Number(item.style?.fontSizeBaseScale) || 1 : scale
    );
    const textBox = scaleTextMetricBox(estimateTextMetricBox(metricNormalized, {
      widthFactor: typewriter ? 0.184516 : 0.13,
      fixedCharWidth: typewriter ? 0.184516 : undefined,
      lineHeight: typewriter ? 0.236 : usesWrappedWidth ? 0.32 : 0.18,
      lineGap: typewriter ? 0.184516 : usesWrappedWidth ? 0.08 : undefined,
      minHeight: 0.18,
      formulaMinWidth: 0.08,
      formulaWidthPadding: 0
    }), textMetricScale);
    width = Math.max(0.08, usesWrappedWidth ? Math.min(textBox.width, wrapWidth) : textBox.width);
    height = Math.max(0.08, textBox.height);
  }
  includeRotatedItemRectangle(
    item.x - width / 2,
    item.y - height / 2,
    item.x + width / 2,
    item.y + height / 2,
    item,
    include
  );
}

function includeRotatedItemRectangle(minX, minY, maxX, maxY, item, include) {
  const angle = Number(item.rotation) || 0;
  if (Math.abs(angle % 360) < 1e-12) {
    include(minX, minY);
    include(maxX, maxY);
    return;
  }
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  for (const [x, y] of [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]]) {
    const dx = x - item.x;
    const dy = y - item.y;
    include(item.x + dx * cos - dy * sin, item.y + dx * sin + dy * cos);
  }
}

function wrappedTextMetricNormalized(normalized, wrapWidth, lineBreakMode, wrapOptions = {}) {
  const sourceLines = normalized.lines.length ? normalized.lines : String(normalized.text || "").split(/\\\\|\n/);
  const metricLines = textMetricLines(normalized);
  const lineStyles = Array.isArray(normalized.lineStyles) ? normalized.lineStyles : [];
  const wrappedLines = [];
  const wrappedStyles = [];
  metricLines.forEach((line, index) => {
    const wrapped = wrapTeXTextLineByWidth(line, wrapWidth, Number(lineStyles[index]?.scale) || 1, {
      lineBreakMode,
      ...wrapOptions
    });
    for (const wrappedLine of wrapped) {
      wrappedLines.push(wrappedLine);
      wrappedStyles.push(lineStyles[index] || {});
    }
  });
  return {
    ...normalized,
    text: wrappedLines.join(String.raw`\\`),
    raw: sourceLines.join(String.raw`\\`),
    lines: wrappedLines,
    lineStyles: wrappedStyles
  };
}

function includePathItemBounds(item, include) {
  includePathCommandBounds(item.commands || [], include, { tightBezierBounds: item.tightBezierBounds });
}

function polygonNodeShape(shape) {
  return shape === "regularPolygon" || shape === "star" || shape === "trapezium" || shape === "isoscelesTriangle" || arrowNodeShape(shape);
}

function nodePolygonPoints(node, center, halfWidth, halfHeight) {
  const data = node.shapeData || {};
  if (node.shape === "regularPolygon") {
    const sides = data.regularPolygonSides || 5;
    return regularPolygonPoints(
      center,
      halfWidth,
      halfHeight,
      sides,
      data.regularPolygonStartAngle ?? regularPolygonStartAngle(sides, data.shapeBorderRotate)
    );
  }
  if (node.shape === "star") {
    return starPolygonPoints(center, Math.max(halfWidth, halfHeight), data);
  }
  if (node.shape === "trapezium") {
    return trapeziumPoints(center, halfWidth, halfHeight, data);
  }
  if (node.shape === "isoscelesTriangle") {
    return isoscelesTrianglePoints(center, halfWidth, halfHeight);
  }
  if (arrowNodeShape(node.shape)) {
    return arrowNodeLocalPoints(node.shape, { width: halfWidth * 2, height: halfHeight * 2, shapeData: data }).map((point) => ({
      x: center.x + point.x,
      y: center.y + point.y
    }));
  }
  return rectanglePoints(center, halfWidth, halfHeight);
}

function regularPolygonPoints(center, halfWidth, halfHeight, sides, startAngle = 90) {
  return Array.from({ length: sides }, (_unused, index) => {
    const angle = ((startAngle + (360 * index) / sides) * Math.PI) / 180;
    return {
      x: center.x + Math.cos(angle) * halfWidth,
      y: center.y + Math.sin(angle) * halfHeight
    };
  });
}

function starPolygonPoints(center, outerRadius, data = {}) {
  return geometricStarNodePoints(center, outerRadius, data);
}

function trapeziumPoints(center, halfWidth, halfHeight, data = {}) {
  return geometricTrapeziumNodePoints(center, halfWidth, halfHeight, data);
}

function isoscelesTrianglePoints(center, halfWidth, halfHeight) {
  return [
    { x: center.x + halfWidth, y: center.y },
    { x: center.x - halfWidth, y: center.y + halfHeight },
    { x: center.x - halfWidth, y: center.y - halfHeight }
  ];
}

function rectanglePoints(center, halfWidth, halfHeight) {
  return [
    { x: center.x - halfWidth, y: center.y + halfHeight },
    { x: center.x + halfWidth, y: center.y + halfHeight },
    { x: center.x + halfWidth, y: center.y - halfHeight },
    { x: center.x - halfWidth, y: center.y - halfHeight }
  ];
}

function polygonBorderPoint(center, toward, points) {
  const hit = polygonBorderHit(center, toward, points);
  return hit ? roundPoint(hit.point) : roundPoint(center);
}

function polygonBorderPointWithPadding(center, toward, points, padding = 0) {
  const hit = polygonBorderHit(center, toward, points);
  if (!hit) return roundPoint(center);
  const distance = Math.max(0, Number(padding) || 0);
  if (distance <= 1e-12) return roundPoint(hit.point);

  // PGF's convex geometric shapes build border anchors from all of the
  // expanded side lines. Intersecting the ray with that mitered contour keeps
  // an asymmetric trapezium corner on the shared corner instead of
  // arbitrarily choosing the first adjacent side. Concave stars retain the
  // established active-side path until their source-specific anchor math is
  // implemented.
  if (isConvexPolygon(points)) {
    const miteredHit = polygonBorderHit(center, toward, polygonMiterOffsetPoints(points, distance));
    if (miteredHit) return roundPoint(miteredHit.point);
  }

  const direction = { x: toward.x - center.x, y: toward.y - center.y };
  const directionLength = Math.hypot(direction.x, direction.y);
  const edge = { x: hit.b.x - hit.a.x, y: hit.b.y - hit.a.y };
  const edgeLength = Math.hypot(edge.x, edge.y);
  if (directionLength <= 1e-12 || edgeLength <= 1e-12) return roundPoint(hit.point);

  // PGF grows geometric node borders by the outer separation measured
  // perpendicular to the active side, then joins adjacent sides with a miter.
  // A curved arrow only needs the side hit by its tangent-directed ray.
  const clockwise = polygonSignedArea(points) < 0;
  const outward = clockwise
    ? { x: -edge.y / edgeLength, y: edge.x / edgeLength }
    : { x: edge.y / edgeLength, y: -edge.x / edgeLength };
  const unitDirection = { x: direction.x / directionLength, y: direction.y / directionLength };
  const outwardProjection = unitDirection.x * outward.x + unitDirection.y * outward.y;
  if (outwardProjection <= 1e-12) return roundPoint(hit.point);
  const offset = distance / outwardProjection;
  return roundPoint({
    x: hit.point.x + unitDirection.x * offset,
    y: hit.point.y + unitDirection.y * offset
  });
}

function polygonMiterOffsetPoints(points, distance) {
  if (!Array.isArray(points) || points.length < 3) return points;
  const clockwise = polygonSignedArea(points) < 0;
  return points.map((vertex, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const previousEdge = { x: vertex.x - previous.x, y: vertex.y - previous.y };
    const nextEdge = { x: next.x - vertex.x, y: next.y - vertex.y };
    const previousNormal = polygonOutwardNormal(previousEdge, clockwise);
    const nextNormal = polygonOutwardNormal(nextEdge, clockwise);
    if (!previousNormal || !nextNormal) return vertex;
    const previousOffset = {
      x: vertex.x + previousNormal.x * distance,
      y: vertex.y + previousNormal.y * distance
    };
    const nextOffset = {
      x: vertex.x + nextNormal.x * distance,
      y: vertex.y + nextNormal.y * distance
    };
    return lineIntersection(previousOffset, previousEdge, nextOffset, nextEdge) || vertex;
  });
}

function isConvexPolygon(points) {
  if (!Array.isArray(points) || points.length < 3) return false;
  let sign = 0;
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[(index - 1 + points.length) % points.length];
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const first = { x: current.x - previous.x, y: current.y - previous.y };
    const second = { x: next.x - current.x, y: next.y - current.y };
    const turn = cross(first, second);
    if (Math.abs(turn) <= 1e-12) continue;
    const turnSign = Math.sign(turn);
    if (sign && turnSign !== sign) return false;
    sign = turnSign;
  }
  return Boolean(sign);
}

function polygonOutwardNormal(edge, clockwise) {
  const length = Math.hypot(edge.x, edge.y);
  if (length <= 1e-12) return null;
  return clockwise
    ? { x: -edge.y / length, y: edge.x / length }
    : { x: edge.y / length, y: -edge.x / length };
}

function lineIntersection(firstPoint, firstDirection, secondPoint, secondDirection) {
  const denominator = cross(firstDirection, secondDirection);
  if (Math.abs(denominator) <= 1e-12) return null;
  const delta = { x: secondPoint.x - firstPoint.x, y: secondPoint.y - firstPoint.y };
  const t = cross(delta, secondDirection) / denominator;
  return {
    x: firstPoint.x + firstDirection.x * t,
    y: firstPoint.y + firstDirection.y * t
  };
}

function polygonBorderHit(center, toward, points) {
  const direction = { x: toward.x - center.x, y: toward.y - center.y };
  const candidates = [];
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const hit = raySegmentIntersection(center, direction, a, b);
    if (hit && hit.t >= -1e-9) candidates.push({ ...hit, a, b });
  }
  candidates.sort((a, b) => a.t - b.t);
  return candidates[0] || null;
}

function polygonSignedArea(points) {
  return points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length];
    return area + point.x * next.y - next.x * point.y;
  }, 0) / 2;
}

function raySegmentIntersection(origin, direction, a, b) {
  const edge = { x: b.x - a.x, y: b.y - a.y };
  const denom = cross(direction, edge);
  if (Math.abs(denom) < 1e-12) return null;
  const delta = { x: a.x - origin.x, y: a.y - origin.y };
  const t = cross(delta, edge) / denom;
  const u = cross(delta, direction) / denom;
  if (t < -1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
  return {
    t,
    point: {
      x: origin.x + direction.x * t,
      y: origin.y + direction.y * t
    }
  };
}

function cross(a, b) {
  return a.x * b.y - a.y * b.x;
}

function projectBasisPoint(x, y, z, basis = parsePictureBasis()) {
  return roundPoint({
    x: x * basis.x.x + y * basis.y.x + z * basis.z.x,
    y: x * basis.x.y + y * basis.y.y + z * basis.z.y
  });
}

function resolveCalc(text, env, diagnostics) {
  return resolveCalcExpression(text, env, diagnostics, calcLibraryHelpers());
}

function resolveCalcOffset(text, env, diagnostics) {
  return resolveCalcOffsetExpression(text, env, diagnostics, calcLibraryHelpers());
}

function calcLibraryHelpers() {
  return {
    resolveCoordinate,
    applyTransformVector,
    projectBasisPoint,
    identityTransform
  };
}

function materializeIntersections(raw, env, diagnostics, ir) {
  const parsed = parseOptions(raw);
  const of = parsed.of || "";
  const by = parsed.by || "";
  const [first, second] = String(of)
    .split(/\s+and\s+/)
    .map((part) => part.trim());
  const aliases = parseIntersectionAliases(by);
  const pathA = env.namedPaths[first];
  const pathB = env.namedPaths[second];
  if (!pathA || !pathB) {
    diagnostics.push({ severity: "warning", message: `Cannot resolve named paths for intersection: ${of}` });
    return;
  }
  const intersections = pathIntersectionDetails(pathA, pathB);
  const sortBy = stripOuterBraces(substituteTextVariables(String(parsed["sort by"] || ""), env.variables)).trim();
  if (sortBy === first || sortBy === second) {
    const time = sortBy === first ? "firstTime" : "secondTime";
    intersections.sort((left, right) => left[time] - right[time]);
  }
  intersections.forEach(({ point }, index) => {
    const baseName = parsed.name ? String(parsed.name).trim() : "intersection";
    const alias = aliases[index];
    const name = alias?.name || `${baseName}-${index + 1}`;
    const coordinate = roundPoint(point);
    if (alias && ir && coordinateRendersAsNode(alias.options, env)) {
      createNode(
        {
          type: "coordinate",
          name,
          absolutePoint: coordinate,
          options: alias.options,
          text: ""
        },
        env,
        ir,
        diagnostics
      );
      return;
    }
    env.coordinates[name] = coordinate;
    if (alias?.options && ir) addCoordinateLabels(alias.options, coordinate, env, ir);
  });
  if (parsed.total) {
    env.variables[String(parsed.total).replace(/^\\/, "").trim()] = intersections.length;
  }
}

function parseIntersectionAliases(raw) {
  return splitTopLevel(stripOuterBraces(String(raw || "")), ",")
    .map((part) => {
      let name = stripOuterBraces(part).trim();
      let options = {};
      if (name.startsWith("[")) {
        const coordinateOptions = readBalancedPrefix(name, "[", "]");
        if (coordinateOptions) {
          options = parseOptions(coordinateOptions.content);
          name = name.slice(coordinateOptions.end).trim();
        }
      }
      name = stripOuterBraces(name).trim();
      return name ? { name, options } : null;
    })
    .filter(Boolean);
}

function repeatedSemanticValues(value) {
  return Array.isArray(value) ? value : [value];
}

function optionList(value) {
  return value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];
}

function addDecorationMarkers(item, options, ir) {
  const decorations = markingsDecorationFromOptions(options);
  if (!decorations.length) return;
  const flat = flattenPath(item.commands || []);
  for (const decoration of decorations) {
    const mark = String(decoration).match(/mark\s*=\s*at\s+position\s+([0-9.]+)\s+with\s*\{([\s\S]+)\}/);
    if (mark) {
      addArrowMarkerAt(Number(mark[1]), mark[2], flat, item, ir);
      continue;
    }
    const between = String(decoration).match(
      /mark\s*=\s*between\s+positions\s+([0-9.]+)\s+and\s+([0-9.]+)\s+step\s+([0-9.]+)\s+with\s*\{([\s\S]+)\}/
    );
    if (!between) continue;
    const start = Number(between[1]);
    const end = Number(between[2]);
    const step = Number(between[3]);
    for (let position = start; position <= end + 1e-9; position += step) {
      addArrowMarkerAt(position, between[4], flat, item, ir);
    }
  }
}

function markingsDecorationFromOptions(options = {}) {
  const decorations = [];
  const topLevelDecoration = options.decoration === undefined ? "" : String(options.decoration);
  if (topLevelDecoration.includes("markings")) decorations.push(topLevelDecoration);
  for (const rawPostaction of optionList(options.postaction)) {
    const postaction = String(rawPostaction || "");
    if (!postaction.includes("decorate")) continue;
    const postOptions = parseOptions(postaction);
    const nestedDecoration = postOptions.decoration === undefined ? "" : String(postOptions.decoration);
    if (nestedDecoration.includes("markings")) decorations.push(nestedDecoration);
  }
  return decorations;
}

function addArrowMarkerAt(position, body, flat, item, ir) {
  const arrow = String(body).match(/\\arrow\s*\{([^}]*)\}/);
  if (!arrow) return;
  const tip = createArrowTip(arrow[1].trim() || "to");
  const point = pointAtLength(flat, position);
  ir.items.push(createMarkerShape({
    subtype: /feynman momentum/.test(String(body))
      ? "feynman-momentum"
      : /feynhand momentum/.test(String(body))
        ? "feynhand-momentum"
        : undefined,
    kind: tip.kind,
    tip,
    x: roundNumber(point.x),
    y: roundNumber(point.y),
    angle: roundNumber(point.angle),
    style: {
      stroke: item.style.stroke === "none" ? "black" : item.style.stroke,
      fill: item.style.stroke === "none" ? "black" : item.style.stroke
    }
  }));
}

function drawablePathStyle(style, styleHints = {}) {
  const merged = { ...style, ...styleHints };
  if ((merged.markerStart || merged.markerEnd) && merged.stroke === "none") merged.stroke = "black";
  return merged;
}

function pathShadingStyle(style = {}, semantic = {}, env = {}) {
  const shadingName = String(semantic.shading || "").trim();
  const hasAxisColor = ["top color", "middle color", "bottom color", "left color", "right color"]
    .some((key) => semantic[key] !== undefined);
  const isAxisShading = hasAxisColor || shadingName === "axis" || (!shadingName && semantic["shading angle"] !== undefined);
  if (isAxisShading) {
    const top = normalizeColor(String(semantic["top color"] ?? semantic["left color"] ?? "gray"));
    const bottom = normalizeColor(String(semantic["bottom color"] ?? semantic["right color"] ?? "white"));
    const middle = semantic["tikzkit axis middle color"] === undefined
      ? normalizeColor(`${top}!50!${bottom}`)
      : normalizeColor(String(semantic["tikzkit axis middle color"]));
    const defaultAngle = semantic["left color"] !== undefined || semantic["right color"] !== undefined ? 90 : 0;
    const rawAngle = semantic["shading angle"] === undefined
      ? defaultAngle
      : evaluateMath(String(semantic["shading angle"]), env.variables || {});
    const shadingAngle = Number.isFinite(rawAngle)
      ? roundNumber(((rawAngle % 360) + 360) % 360)
      : defaultAngle;
    return {
      shading: "axis",
      topColor: top,
      middleColor: middle,
      bottomColor: bottom,
      shadingAngle,
      fill: bottom
    };
  }
  const declared = shadingName ? env.shadings?.[shadingName] : null;
  if (declared?.type === "radial") {
    const stops = (declared.stops || []).map((stop) => ({
      offset: Math.max(0, Math.min(1, Number(stop.offset) || 0)),
      color: normalizeColor(String(stop.color || style.fill || "black")),
      opacity: Math.max(0, Math.min(1, Number(stop.opacity ?? 1)))
    }));
    return {
      shading: "radial",
      shadingName,
      radialStops: stops.length ? stops : [
        { offset: 0, color: "white", opacity: 1 },
        { offset: 1, color: normalizeColor(String(style.fill || "black")), opacity: 1 }
      ],
      fill: normalizeColor(String(style.fill === "none" ? "black" : style.fill || "black"))
    };
  }
  if (shadingName !== "ball") return {};
  const color = normalizeColor(String(semantic["ball color"] || style.fill || "gray!30"));
  return {
    shading: "ball",
    ballColor: color,
    fill: color
  };
}

function doublePathStyle(semantic = {}, env = { variables: {} }) {
  if (semantic.double === undefined) return {};
  const rawColor = semantic.double;
  if (rawColor === false || String(rawColor).trim().toLowerCase() === "none") return {};
  const style = {
    doubleColor: rawColor === true || rawColor === "" ? "white" : normalizeColor(String(rawColor))
  };
  if (semantic["double distance"] !== undefined) {
    const distance = parseDimension(semantic["double distance"], env.variables) * TIKZ_UNIT * canvasLengthScale(env);
    if (Number.isFinite(distance) && distance >= 0) style.doubleDistance = distance;
  }
  return style;
}

function isVisiblePath(command, style, semantic, styleHints = {}) {
  if (command === "draw" || command === "fill") return true;
  if (styleHints.pathAction) return true;
  if (style.markerStart || style.markerEnd || styleHints.markerStart || styleHints.markerEnd) return true;
  if (styleHints.visiblePic) return true;
  if (styleHints.stroke && styleHints.stroke !== "none") return true;
  if (styleHints.fill && styleHints.fill !== "none") return true;
  if (semantic["name path"] && style.stroke === "none" && style.fill === "none") return false;
  return style.stroke !== "none" || style.fill !== "none";
}
