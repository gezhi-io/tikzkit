import { circleToPath, ellipseToPath, flattenPath, pathIntersections, pointAtLength } from "./geometry.js";
import { evaluateMath, parseDimension, roundNumber, roundPoint, substituteTextVariables, substituteVariables } from "./math.js";
import { estimateFormulaBox, formulaTotalHeight, mathTextMetricUnits, parseMathText, texTextWidthCm } from "./math-metrics.js";
import {
  edgeStyleHintsFromOptions,
  normalizeColor,
  normalizeOptions,
  parseOptions,
  splitTopLevel,
  styleDefinitionsFromOptions,
  stripOuterBraces
} from "./options.js";
import { fontScaleFromTikzFont, mathFallbackText, normalizeTikzText } from "./tex-text.js";
import { TIKZ_FONT_FAMILY, TIKZ_MONOSPACE_FONT_FAMILY, TIKZ_SANS_SERIF_FONT_FAMILY, TIKZ_UNIT, createArrowTip } from "./tikz-metrics.js";

const TIKZ_DEFAULT_INNER_SEP = ".3333em";
const PGF_DEFAULT_Z_VECTOR = { x: -0.385, y: -0.385 };

const BUILTIN_STYLES = {
  "every state": {},
  "state without output": { circle: true, draw: true, "minimum size": "2.5em", "every state": true },
  state: { "state without output": true },
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
  }
};

export function interpretTikz(ast, options = {}) {
  const diagnostics = [];
  const ir = { type: "drawing", items: [], backgroundItems: [], coordinates: {} };

  for (const picture of ast.pictures || []) {
    const baseStyles = { ...BUILTIN_STYLES, ...(picture.styles || {}) };
    const styles = { ...baseStyles, ...styleDefinitionsFromOptions(picture.options || {}, baseStyles) };
    const pictureOptions = stripStyleDefinitionOptions(normalizeOptions("path", picture.options || {}, { variables: {}, styles }).options);
    const pictureBasis = parsePictureBasis(pictureOptions);
    const pictureTransformEnv = {
      variables: {},
      coordinates: ir.coordinates,
      nodes: {},
      basis: pictureBasis,
      transform: identityTransform()
    };
    const env = {
      variables: {},
      coordinates: ir.coordinates,
      nodes: {},
      styles,
      randomLists: { ...(picture.randomLists || {}) },
      randomListCounters: {},
      namedPaths: {},
      chains: initialChains(pictureOptions),
      activeChain: initialActiveChain(pictureOptions),
      toggles: {},
      transform: composeTransform(identityTransform(), pictureOptions, pictureTransformEnv),
      canvasScale: transformCanvasScale(pictureOptions, pictureTransformEnv),
      basis: pictureBasis,
      pictureOptions
    };
    for (const statement of picture.statements || []) {
      interpretStatement(statement, env, ir, diagnostics, options);
    }
  }

  if (ir.backgroundItems.length) {
    ir.items = [...ir.backgroundItems, ...ir.items];
  }
  delete ir.backgroundItems;
  return { ir, diagnostics };
}

function interpretStatement(statement, env, ir, diagnostics, options) {
  env.currentBoundingBox ||= () => computeCurrentBoundingBox(ir);
  if (statement.type === "unsupported") {
    diagnostics.push(statement.diagnostic);
    return;
  }
  if (statement.type === "noop") {
    applyNoopSideEffects(statement, env);
    return;
  }
  if (statement.type === "foreach") {
    let foreachIndex = 0;
    for (const values of expandForeachValues(statement.values, env)) {
      const childVariables = { ...env.variables };
      const valueText = stripOuterBraces(values.trim());
      const rawParts = splitTopLevel(valueText, "/").map((part) => stripOuterBraces(part.trim()));
      statement.variables.forEach((name, index) => {
        childVariables[name] = rawParts[index] ?? values.trim();
      });
      applyForeachOptions(childVariables, statement.options || {}, foreachIndex, env);
      const childEnv = { ...env, variables: childVariables };
      for (const child of statement.body) interpretStatement(child, childEnv, ir, diagnostics, options);
      foreachIndex += 1;
    }
    return;
  }
  if (statement.type === "pgfmathsetmacro") {
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
  if (statement.type === "pgftransformcm") {
    env.transform = composePgfTransform(env.transform, statement, env);
    return;
  }
  if (statement.type === "pgftransformreset") {
    env.transform = identityTransform();
    return;
  }
  if (statement.type === "coordinate") {
    const point = statement.at
      ? resolveCoordinate(statement.at, env, diagnostics)
      : resolvePositioning(statement.options || {}, env) || applyTransform({ x: 0, y: 0 }, env.transform);
    const name = resolveDynamicName(statement.name, env);
    env.coordinates[name] = point;
    addCoordinateLabels(statement.options || {}, point, env, ir);
    return;
  }
  if (statement.type === "tikzset") {
    env.styles = {
      ...env.styles,
      ...(statement.styleOptions ? styleDefinitionsFromOptions(statement.styleOptions, env.styles) : statement.styles)
    };
    return;
  }
  if (statement.type === "matrix") {
    createMatrix(statement, env, ir, diagnostics);
    return;
  }
  if (statement.type === "pic") {
    createPic(statement, env, ir);
    return;
  }
  if (statement.type === "node") {
    const node = createNode(statement, env, ir, diagnostics);
    if (node && statement.children?.length) {
      createNodeTreeChildren(node, statement.children, env, ir, diagnostics, 1, statement.treeOptions || {});
    }
    return;
  }
  if (statement.type === "scope") {
    const scopedEnv = {
      ...env,
      transform: composeTransform(env.transform, statement.options, env),
      canvasScale: env.canvasScale * transformCanvasScale(statement.options || {}, env),
      basis: composeBasis(env.basis, statement.options, env),
      pictureOptions: mergeScopePictureOptions(env.pictureOptions || {}, statement.options || {}),
      styles: { ...env.styles, ...styleDefinitionsFromOptions(statement.options || {}, env.styles) }
    };
    if (isBackgroundScope(statement.options || {})) {
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

function isBackgroundScope(options = {}) {
  return String(options.layer || "").trim() === "background" || options["on background layer"] === true;
}

function mergeScopePictureOptions(parentOptions = {}, scopeOptions = {}) {
  const merged = { ...parentOptions };
  for (const [key, value] of Object.entries(scopeOptions || {})) {
    if (isScopeTransformOption(key) || isScopeDefinitionOption(key)) continue;
    merged[key] = value;
  }
  return merged;
}

function isScopeTransformOption(key) {
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
  ].includes(String(key).trim());
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

function interpretPathStatement(statement, env, ir, diagnostics) {
  const rawOptions = resolveDynamicOptions({ ...(env.pictureOptions || {}), ...(statement.options || {}) }, env);
  const normalized = normalizeOptions(statement.command, rawOptions, env);
  const style = scaleCanvasStyle(normalized.style, env);
  const { semantic, options } = normalized;
  const pathOptions = { ...options, ...semantic };
  const pathEnv = {
    ...env,
    transform: shouldApplyStatementTransformToPath(statement) ? composeTransform(env.transform, statement.options || {}, env) : env.transform,
    basis: composeBasis(env.basis, options, env)
  };
  const subtype = semanticSubtype(pathOptions);

  if (semantic["name intersections"]) {
    materializeIntersections(semantic["name intersections"], pathEnv, diagnostics);
  }

  const built = buildPath(statement.path.segments, pathEnv, diagnostics, pathOptions, style);
  if (semantic["name path"]) {
    pathEnv.namedPaths[String(semantic["name path"]).trim()] = built.commands.length
      ? built.commands
      : built.shapes.flatMap((shape) => shape.commands || []);
  }

  const visible = isVisiblePath(statement.command, style, semantic, built.styleHints);
  if (visible) {
    const doubleStyle = doublePathStyle(semantic, env);
    const shadingStyle = pathShadingStyle(style, semantic);
    const styledShapes = built.shapes.map((shape) => ({
      ...shape,
      subtype: shape.subtype || subtype,
      style: { ...style, ...shadingStyle, ...doubleStyle, ...(shape.style || {}) }
    }));
    for (const shape of styledShapes) {
      ir.items.push(shape);
    }
    if (hasDrawableCommands(built.commands, built.shapes)) {
      const pathStyle = drawablePathStyle(style, { ...shadingStyle, ...built.styleHints, ...doubleStyle });
      const item = {
        type: "path",
        subtype: built.styleHints.subtype || subtype,
        tightBezierBounds: tikzBoolean(pathOptions["bezier bounding box"]),
        style: pathStyle,
        commands: applyArrowEndpointShortening(built.commands, pathStyle, built.endpointRefs)
      };
      ir.items.push(item);
      addDecorationMarkers(item, options, ir);
    }
    for (const shape of styledShapes) {
      addDecorationMarkers(shape, options, ir);
    }
  }
  for (const node of built.nodes) {
    addNodeItems(node, ir, pathEnv);
  }
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
  let currentNodeRef = null;
  let start = null;
  let startNodeRef = null;
  let endNodeRef = null;
  let pending = null;
  let pendingInlineNodes = [];
  let lastSegment = null;
  let pendingPlotMark = null;

  for (const segment of segments) {
    if (segment.kind === "unknown") {
      const mark = String(segment.raw || "").match(/\bplot\s*\[[^\]]*\bmark\s*=\s*([^\],\s]+)[^\]]*\]/);
      if (mark) pendingPlotMark = mark[1];
      continue;
    }
    if (segment.kind === "operator") {
      pending = { value: segment.value, options: segment.options || {} };
      continue;
    }
    if (segment.kind === "coordinate") {
      const pendingValue = pending?.value ?? pending;
      const pendingOptions = pending?.options || {};
      const point = segment.relative ? resolveRelativeCoordinate(segment.raw, current, env, diagnostics) : resolveCoordinate(segment.raw, env, diagnostics);
      if (pendingPlotMark) {
        shapes.push(buildPlotMark(point, pendingPlotMark, pathStyle, effectivePathOptions, env));
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
        const origin = applyTransform({ x: 0, y: 0 }, env.transform);
        commands.push({ type: "moveTo", x: origin.x, y: origin.y });
        current = origin;
        currentLocal = { x: 0, y: 0 };
        currentBase = origin;
        start = origin;
        startNodeRef = null;
      }
      if (!current) {
        commands.push({ type: "moveTo", x: point.x, y: point.y });
        current = point;
        currentLocal = localPoint || point;
        currentBase = point;
        currentNodeRef = nodeRef;
        start = point;
        startNodeRef = nodeRef;
        endNodeRef = nodeRef;
      } else if (pendingValue === "grid") {
        shapes.push(...buildGrid(current, point, effectivePathOptions, env));
        current = point;
        currentLocal = localPoint || point;
        currentBase = point;
        currentNodeRef = nodeRef;
        endNodeRef = nodeRef;
      } else if (pendingValue === "rectangle") {
        const corners =
          currentLocal && localPoint
            ? transformedRectangleCorners(currentLocal, localPoint, env.transform)
            : [
                { x: point.x, y: current.y },
                point,
                { x: current.x, y: point.y }
              ];
        commands.push({ type: "lineTo", x: corners[0].x, y: corners[0].y });
        commands.push({ type: "lineTo", x: corners[1].x, y: corners[1].y });
        commands.push({ type: "lineTo", x: corners[2].x, y: corners[2].y });
        commands.push({ type: "closePath" });
        current = point;
        currentLocal = localPoint || point;
        currentBase = point;
        currentNodeRef = nodeRef;
        endNodeRef = nodeRef;
      } else if (pendingValue === "--") {
        const clipped = clipNodeLineEndpoints(currentBase || current, currentNodeRef, point, nodeRef, env);
        if (shouldBreakAtNodeExit(currentNodeRef)) moveToNodeExit(commands, clipped.from);
        commands.push({ type: "lineTo", x: clipped.to.x, y: clipped.to.y });
        flushInlinePathNodes(pendingInlineNodes, clipped.from, clipped.to, nodes, env, pathStyle);
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
        commands.push({ type: "lineTo", x: first.to.x, y: first.to.y });
        commands.push({ type: "lineTo", x: second.to.x, y: second.to.y });
        flushInlinePathNodes(pendingInlineNodes, first.from, first.to, nodes, env, pathStyle);
        lastSegment = { from: first.from, to: first.to };
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
        flushInlinePathNodes(pendingInlineNodes, drawn.from, drawn.to, nodes, env, pathStyle);
        lastSegment = { from: drawn.from, to: drawn.to };
        pendingInlineNodes = [];
        current = drawn.to;
        currentLocal = localPoint || point;
        currentBase = point;
        currentNodeRef = nodeRef;
        endNodeRef = nodeRef;
      } else {
        flushInlinePathNodes(pendingInlineNodes, current, current, nodes, env, pathStyle);
        pendingInlineNodes = [];
        commands.push({ type: "moveTo", x: point.x, y: point.y });
        current = point;
        currentLocal = localPoint || point;
        currentBase = point;
        currentNodeRef = nodeRef;
        start = point;
        endNodeRef = nodeRef;
        lastSegment = null;
      }
      pending = null;
      continue;
    }
    if (segment.kind === "coordinateName" && current) {
      const name = resolveDynamicName(segment.name, env);
      env.coordinates[name] = roundPoint(current);
      continue;
    }
    if ((segment.kind === "edge" || segment.kind === "to") && current) {
      const to = resolveCoordinate(segment.to, env, diagnostics);
      const toNodeRef = defaultPathNodeReference(segment.to, env);
      if (segment.nodes?.length) {
        for (const labelNode of segment.nodes) {
          pendingInlineNodes.push({
            ...labelNode,
            text: substituteTextVariables(labelNode.text, env.variables)
          });
        }
      }
      const combinedEdgeOptions = { ...effectivePathOptions, ...(segment.options || {}) };
      Object.assign(styleHints, edgeStyleHintsFromOptions(combinedEdgeOptions, env));
      Object.assign(effectivePathOptions, edgePathOptions(combinedEdgeOptions));
      const loopDirection = loopDirectionFromOptions(combinedEdgeOptions);
      const arcThrough = parseTikzExtArcThrough(combinedEdgeOptions);
      if (arcThrough) {
        styleHints.subtype = "tikz-ext-arc";
        const through = resolveCoordinate(arcThrough.through, env, diagnostics);
        const arc = tikzExtArcThroughCommands(currentBase || current, through, to, arcThrough, env);
        if (arc.center) env.coordinates[`arc through center${arcThrough.suffix || ""}`] = arc.center;
        commands.push(...arc.commands);
        flushInlinePathNodes(pendingInlineNodes, currentBase || current, to, nodes, env, pathStyle);
        lastSegment = { from: currentBase || current, to };
        pendingInlineNodes = [];
        current = to;
        currentLocal = null;
        currentBase = to;
        currentNodeRef = toNodeRef;
        endNodeRef = toNodeRef;
        pending = null;
        continue;
      }
      if (loopDirection && pointsAlmostEqual(currentBase || current, to)) {
        const loop = buildSelfLoop(currentBase || current, currentNodeRef, loopDirection, combinedEdgeOptions, env);
        if (shouldBreakAtNodeExit(currentNodeRef)) moveToNodeExit(commands, loop.start);
        commands.push(...loop.commands);
        flushInlinePathNodesAt(pendingInlineNodes, loop.labelPoint, nodes, env, pathStyle);
        lastSegment = { from: loop.start, to: loop.end };
        pendingInlineNodes = [];
        current = loop.end;
        currentBase = to;
        currentNodeRef = toNodeRef;
        endNodeRef = toNodeRef;
        pending = null;
        continue;
      }
      const edgeFrom = currentBase || current;
      // Claude: 先按"直线弦"裁一次得到端点角度基准，再判断有没有弯（bend/out-in）。
      // 有弯时端点要沿曲线"切线方向"重新裁到节点边框，否则箭头会挂在角上（见 case 020 的两条 bend 弧）。
      const straightClipped = clipNodeLineEndpoints(edgeFrom, currentNodeRef, to, toNodeRef, env);
      const curve = edgeCurveSpec(combinedEdgeOptions, straightClipped.from, straightClipped.to, env, currentNodeRef, toNodeRef);
      const clipped = curve
        ? clipNodeCurveEndpoints(edgeFrom, currentNodeRef, to, toNodeRef, curve, env)
        : straightClipped;
      if (curve) {
        if (shouldBreakAtNodeExit(currentNodeRef)) moveToNodeExit(commands, clipped.from);
        const distance = tikzCurveControlDistance(clipped.from, clipped.to);
        const c1 = polarOffset(clipped.from, curve.out, distance * curve.outLooseness);
        const c2 = polarOffset(clipped.to, curve.in, distance * curve.inLooseness);
        commands.push({ type: "curveTo", x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y, x: clipped.to.x, y: clipped.to.y });
        const labelGeometry = cubicLabelGeometry(clipped.from, c1, c2, clipped.to);
        flushInlinePathNodesAt(pendingInlineNodes, labelGeometry.point, nodes, env, pathStyle, labelGeometry.segment);
        lastSegment = { from: clipped.from, to: clipped.to };
      } else {
        if (shouldBreakAtNodeExit(currentNodeRef)) moveToNodeExit(commands, clipped.from);
        commands.push({ type: "lineTo", x: clipped.to.x, y: clipped.to.y });
        flushInlinePathNodes(pendingInlineNodes, clipped.from, clipped.to, nodes, env, pathStyle);
        lastSegment = { from: clipped.from, to: clipped.to };
      }
      pendingInlineNodes = [];
      current = clipped.to;
      currentLocal = null;
      currentBase = to;
      currentNodeRef = toNodeRef;
      endNodeRef = toNodeRef;
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
      flushInlinePathNodes(pendingInlineNodes, currentBase || current, to, nodes, env, pathStyle);
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
      const c1 = resolveControlPoint(segment.c1, current, env, diagnostics);
      const c2 = resolveControlPoint(segment.c2, current, env, diagnostics);
      const to = resolveCoordinate(segment.to, env, diagnostics);
      commands.push({
        type: "curveTo",
        x1: c1.x,
        y1: c1.y,
        x2: c2.x,
        y2: c2.y,
        x: to.x,
        y: to.y
      });
      lastSegment = { from: current, to };
      current = to;
      currentLocal = null;
      currentBase = to;
      currentNodeRef = null;
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
      const center = current || applyTransform({ x: 0, y: 0 }, env.transform);
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
      shapes.push(arc);
      current = arc.endPoint;
      currentLocal = null;
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
    if (segment.kind === "plotCoordinates") {
      const plot = buildPlotCoordinates(segment.coordinates || [], env, diagnostics, { ...pathOptions, ...(segment.options || {}) });
      const mark = segment.options?.mark ?? pathOptions.mark;
      if (mark && String(mark).trim().toLowerCase() !== "none") {
        const markOptions = { ...pathOptions, ...(segment.options || {}) };
        shapes.push(...plot.points.map((point) => buildPlotMark(point, mark, pathStyle, markOptions, env)));
      }
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
    if (segment.kind === "node") {
      const text = substituteTextVariables(segment.text, env.variables);
      if (!segment.at && current && pending) {
        pendingInlineNodes.push({ ...segment, text });
        continue;
      }
      const point = segment.at
        ? resolveCoordinate(segment.at, env, diagnostics)
        : inlineNodePathPoint(segment.options, lastSegment) || current || applyTransform({ x: 0, y: 0 }, env.transform);
      addInlinePathNode(segment, text, point, nodes, env, pathStyle, lastSegment);
      continue;
    }
    if (segment.kind === "close" && start) {
      commands.push({ type: "closePath" });
      if (current) lastSegment = { from: current, to: start };
      current = start;
      endNodeRef = startNodeRef;
    }
  }

  flushInlinePathNodes(pendingInlineNodes, current, current, nodes, env, pathStyle);
  return {
    commands: applyPathMorphing(commands, effectivePathOptions, env),
    shapes,
    nodes,
    styleHints,
    endpointRefs: { start: startNodeRef, end: endNodeRef }
  };
}

function inlineNodePathPoint(options = {}, lastSegment) {
  if (!lastSegment) return null;
  let pos = null;
  if (Object.hasOwn(options, "pos")) pos = Number(options.pos);
  else if (Object.hasOwn(options, "midway")) pos = 0.5;
  else if (Object.hasOwn(options, "near start")) pos = 0.25;
  else if (Object.hasOwn(options, "near end")) pos = 0.75;
  if (!Number.isFinite(pos)) return null;
  const t = Math.max(0, Math.min(1, pos));
  return roundPoint({
    x: lastSegment.from.x + (lastSegment.to.x - lastSegment.from.x) * t,
    y: lastSegment.from.y + (lastSegment.to.y - lastSegment.from.y) * t
  });
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
    commands.push({ type: "lineTo", x: clipped.to.x, y: clipped.to.y });
    lastTo = clipped.to;
  }
  return { from: firstFrom, to: lastTo };
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
  return resolveCoordinate(raw, { ...env, transform: identityTransform() }, diagnostics);
}

function shouldResolveAsLocalRectangleCorner(raw) {
  let text = String(raw || "").trim();
  if (text.startsWith("(") && text.endsWith(")")) text = text.slice(1, -1).trim();
  if (text.startsWith("[")) return false;
  return text.startsWith("$") || looksLikeExplicitCoordinate(text);
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
  const transform = normalizeTransform(env.transform);
  return roundPoint({
    x: projected.x * transform.a + projected.y * transform.c,
    y: projected.x * transform.b + projected.y * transform.d
  });
}

function usesCustomBasis(basis = parsePictureBasis()) {
  return (
    Math.abs((basis.x?.x ?? 1) - 1) > 1e-9 ||
    Math.abs(basis.x?.y ?? 0) > 1e-9 ||
    Math.abs(basis.y?.x ?? 0) > 1e-9 ||
    Math.abs((basis.y?.y ?? 1) - 1) > 1e-9 ||
    Math.abs(basis.z?.x ?? 0) > 1e-9 ||
    Math.abs(basis.z?.y ?? 0) > 1e-9
  );
}

function usesProjectedLocalGeometry(env = {}) {
  if (usesCustomBasis(env.basis)) return true;
  const transform = normalizeTransform(env.transform);
  return (
    Math.abs(transform.a - 1) > 1e-9 ||
    Math.abs(transform.b) > 1e-9 ||
    Math.abs(transform.c) > 1e-9 ||
    Math.abs(transform.d - 1) > 1e-9
  );
}

function flushInlinePathNodes(pendingInlineNodes, from, to, nodes, env, pathStyle = {}) {
  if (!pendingInlineNodes.length || !from || !to) return;
  const pathSegment = { from, to };
  for (const segment of pendingInlineNodes) {
    const point = inlineNodePathPoint(segment.options, pathSegment) || roundPoint({
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2
    });
    addInlinePathNode(segment, segment.text, point, nodes, env, pathStyle, pathSegment);
  }
}

function flushInlinePathNodesAt(pendingInlineNodes, point, nodes, env, pathStyle = {}, pathSegment = null) {
  if (!pendingInlineNodes.length || !point) return;
  for (const segment of pendingInlineNodes) {
    addInlinePathNode(segment, segment.text, point, nodes, env, pathStyle, pathSegment);
  }
}

function addInlinePathNode(segment, text, point, nodes, env, pathStyle = {}, pathSegment = null) {
  const rawOptions = resolveDynamicOptions(segment.options || {}, env);
  const expandedOptions = normalizeOptions("node", {
    ...inheritedNodeOptions(env),
    ...inlineNodeOptions(rawOptions, pathStyle)
  }, env).options;
  const size = estimateNodeLayoutSize(text, expandedOptions, env);
  const anchorSize = estimateNodeAnchorSize(text, expandedOptions, env, size);
  const slopedRotation = slopedInlineNodeRotation(expandedOptions, pathSegment, env);
  const displayPoint =
    slopedRotation === null
      ? resolveAutoInlineNodePoint(point, expandedOptions, size, env, pathSegment)
      : resolveSlopedInlineNodePoint(point, expandedOptions, size, env, slopedRotation);
  const nodePoint = displayPoint || point;
  if (segment.name) {
    const name = resolveDynamicName(segment.name, env);
    env.nodes[name] = {
      point: nodePoint,
      width: size.width,
      height: size.height,
      layoutWidth: anchorSize.width,
      layoutHeight: anchorSize.height,
      shape: nodeShape(expandedOptions),
      shapeData: nodeShapeData(expandedOptions)
    };
    env.coordinates[name] = nodePoint;
  }
  nodes.push({
    at: point,
    displayPoint,
    text,
    options: expandedOptions,
    size,
    anchorSize,
    rotation: slopedRotation ?? undefined,
    fitTextToBox: shouldFitTextToNodeBox(expandedOptions)
  });
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
  const dx = pathSegment.to.x - pathSegment.from.x;
  const dy = pathSegment.to.y - pathSegment.from.y;
  if (Math.hypot(dx, dy) < 1e-9) return null;
  const base = (Math.atan2(dy, dx) * 180) / Math.PI;
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
  const direction = nodeDirection(options);
  const explicitShift = nodeExplicitShift(options, env);
  if (!direction) {
    return roundPoint({
      x: point.x + explicitShift.x,
      y: point.y + explicitShift.y
    });
  }
  const sep = parseDimension(options["inner sep"] || options["outer sep"] || "0.08", env.variables);
  const distance = options[direction] === true ? 0 : nodeDirectionDistance(options[direction], sep, env);
  const local = {
    x: direction.includes("right") ? distance + size.width / 2 : direction.includes("left") ? -(distance + size.width / 2) : 0,
    y: direction.includes("above") ? distance + size.height / 2 : direction.includes("below") ? -(distance + size.height / 2) : 0
  };
  const rotated = rotateVector(local.x, local.y, rotation);
  return roundPoint({
    x: point.x + rotated.x + explicitShift.x,
    y: point.y + rotated.y + explicitShift.y
  });
}

function isTruthyTikzOption(value) {
  if (value === undefined || value === null || value === false) return false;
  if (value === true || value === "") return true;
  return !/^(false|0|no)$/i.test(String(value).trim());
}

function inlineNodeOptions(options = {}, pathStyle = {}) {
  if (!pathStyle.stroke || pathStyle.stroke === "none" || hasExplicitTextColor(options)) return options;
  const inheritedText = pathStyle.textFill || pathStyle.stroke;
  return {
    text: inheritedText,
    "tikzkit inherited path text": inheritedText,
    ...options
  };
}

function hasExplicitTextColor(options = {}) {
  return Object.hasOwn(options, "text") || Object.hasOwn(options, "color");
}

function createNode(statement, env, ir, diagnostics) {
  const text = substituteTextVariables(statement.text, env.variables);
  let expandedOptions = normalizeOptions("node", {
    ...inheritedNodeOptions(env),
    ...resolveDynamicOptions(statement.options || {}, env)
  }, env).options;
  expandedOptions = applyConceptNodeOptions(expandedOptions, env);
  const rawSize = estimateNodeLayoutSize(text, expandedOptions, env);
  const rawAnchorSize = estimateNodeAnchorSize(text, expandedOptions, env, rawSize);
  const rawPositioningSize = estimatePositioningSelfSize(text, expandedOptions, env, rawAnchorSize);
  const size = scaleSize(rawSize, env.canvasScale);
  const anchorSize = scaleSize(rawAnchorSize, env.canvasScale);
  const positioningSize = scaleSize(rawPositioningSize, env.canvasScale);
  const point = resolveNodePoint({ ...statement, options: expandedOptions }, env, diagnostics, positioningSize);
  const displayPoint = resolveNodeAnchorPoint(point, expandedOptions, text, env, size);
  const name = statement.name
    ? resolveDynamicName(statement.name, env)
    : expandedOptions.name && expandedOptions.name !== true
      ? resolveDynamicName(String(expandedOptions.name), env)
      : null;
  const node = {
    at: point,
    text,
    options: expandedOptions,
    name,
    size,
    anchorSize,
    displayPoint,
    fitTextToBox: shouldFitTextToNodeBox(expandedOptions)
  };
  if (name) {
    env.nodes[name] = {
      point: displayPoint,
      width: size.width,
      height: size.height,
      layoutWidth: anchorSize.width,
      layoutHeight: anchorSize.height,
      shape: nodeShape(expandedOptions),
      shapeData: nodeShapeData(expandedOptions)
    };
    env.coordinates[name] = displayPoint;
  }
  updateChainState(expandedOptions, env, displayPoint, positioningSize);
  addNodeItems(node, ir, env);
  if (name && statement.path?.segments?.length) {
    addNodeAttachedPath(name, statement.path.segments, expandedOptions, env, ir, diagnostics);
  }
  return {
    name,
    text,
    point: displayPoint,
    width: size.width,
    height: size.height,
    shape: nodeShape(expandedOptions),
    shapeData: nodeShapeData(expandedOptions),
    options: expandedOptions
  };
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
  const resolvedTreeOptions = resolveDynamicOptions(treeOptions || {}, env);
  const levelOptions = treeLevelOptions(level, env);
  for (const [index, child] of children.entries()) {
    const childTreeOptions = resolveDynamicOptions(child.options || {}, env);
    const layoutOptions = { ...levelOptions, ...resolvedTreeOptions, ...childTreeOptions };
    const grow = treeGrowDirection(env, layoutOptions);
    const siblingDistance = treeSiblingDistance(level, env, layoutOptions);
    const levelDistance = treeLevelDistance(level, env, layoutOptions);
    const offset = treeChildOffset(index, children.length, siblingDistance, levelDistance, grow, layoutOptions, env);
    const projected = projectLocalOffset(offset.x, offset.y, env);
    const point = roundPoint({
      x: parentNode.point.x + projected.x,
      y: parentNode.point.y + projected.y
    });
    const childEnv = {
      ...env,
      pictureOptions: {
        ...(env.pictureOptions || {}),
        ...levelOptions,
        ...childTreeOptions
      }
    };
    const childNode = createNode(
      {
        ...child.node,
        options: {
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
    addTreeEdge(parentNode, childNode, layoutOptions, childEnv, ir);
    createNodeTreeChildren(childNode, child.children || child.node.children || [], childEnv, ir, diagnostics, level + 1, child.node.treeOptions || {});
  }
}

function treeGrowDirection(env, options = {}) {
  if (options["grow cyclic"] || env.pictureOptions?.["grow cyclic"] || options["tikzkit mindmap"] || env.pictureOptions?.["tikzkit mindmap"]) {
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
    ...(env.styles?.level || {}),
    ...(env.styles?.[`level ${level}`] || {})
  };
  if (isMindmapOptions(env.pictureOptions || {})) {
    Object.assign(options, env.styles?.[`level ${level} concept`] || {});
  }
  return options;
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
  return { x: siblingOffset, y: -levelDistance };
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
  const normalized = normalizeOptions("draw", options || {}, env);
  const style = scaleCanvasStyle(normalized.style, env);
  if (isMindmapOptions(env.pictureOptions || {}) || isMindmapOptions(options || {})) {
    const conceptColor = options?.["concept color"] ?? env.pictureOptions?.["concept color"];
    if (conceptColor) style.stroke = normalizeColor(String(conceptColor));
    style.lineWidth = Math.max(Number(style.lineWidth) || 0, 0.1 * TIKZ_UNIT * canvasLengthScale(env));
    style.lineCap = "round";
  }
  const parentClipNode = treeEdgeClipNode(parentNode, env);
  const childClipNode = treeEdgeClipNode(childNode, env);
  const clipped = clipNodeLineEndpoints(
    parentNode.point,
    { node: parentClipNode, mode: "center" },
    childNode.point,
    { node: childClipNode, mode: "center" },
    env
  );
  ir.items.push({
    type: "path",
    subtype: "tree-edge",
    style,
    commands: [
      { type: "moveTo", x: clipped.from.x, y: clipped.from.y },
      { type: "lineTo", x: clipped.to.x, y: clipped.to.y }
    ]
  });
}

function treeEdgeClipNode(node, env) {
  if (!nodeUsesMonospaceFont(node.text, node.options, env)) return node;
  const normalized = normalizeTikzText(node.text);
  const textBox = scaleTextMetricBox(estimateTextMetricBox(normalized, {
    widthFactor: 0.184,
    lineHeight: 0.32,
    minHeight: 0.18,
    formulaMinWidth: 0.08,
    formulaWidthPadding: 0
  }), nodeFontScaleForText(normalized, node.options || {}, env));
  const innerSep = parseDimension(node.options?.["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env.variables);
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

function splitAttachedPathSegments(segments = []) {
  if (!segments.every((segment) => segment.kind === "edge" || segment.kind === "to")) return [segments];
  return segments.map((segment) => [segment]);
}

function createMatrix(statement, env, ir, diagnostics = []) {
  const name = statement.name ? resolveDynamicName(statement.name, env) : null;
  const matrixOptions = normalizeOptions("node", statement.options || {}, env).options;
  const matrixNodeOptions = matrixOptions.nodes ? parseOptions(matrixOptions.nodes) : {};
  const inheritedNodeOptions = matrixInheritedNodeOptions(matrixOptions);
  const cellBaseOptions = { ...inheritedNodeOptions, ...matrixNodeOptions };
  const keepEmptyCells = Boolean(matrixOptions["nodes in empty cells"]);
  const rows = splitMatrixRows(statement.body)
    .map((row) =>
      splitMatrixCells(row)
        .map(parseMatrixCell)
        .filter((cell) => keepEmptyCells || cell.text.length || Object.keys(cell.options).length)
    )
    .filter((row) => row.length);
  if (!rows.length) return;

  let baseCellWidth = 0.02;
  let baseCellHeight = 0.02;
  for (const row of rows) {
    for (const cell of row) {
      const size = estimateMatrixCellSize(cell.text, { ...cellBaseOptions, ...cell.options }, env);
      baseCellWidth = Math.max(baseCellWidth, size.width);
      baseCellHeight = Math.max(baseCellHeight, size.height);
    }
  }

  const matrixScale = parseMatrixScale(matrixOptions, env);
  const cellWidth = roundNumber(baseCellWidth * matrixScale);
  const cellHeight = roundNumber(baseCellHeight * matrixScale);
  const colSep = parseFiniteDimension(matrixOptions["column sep"], env, 0) * matrixScale;
  const rowSep = parseFiniteDimension(matrixOptions["row sep"], env, 0) * matrixScale;
  const stepX = Math.max(Math.max(0.02, cellWidth * 0.25), cellWidth + colSep);
  const stepY = Math.max(Math.max(0.02, cellHeight * 0.25), cellHeight + rowSep);
  const cols = Math.max(...rows.map((row) => row.length));
  const totalWidth = cellWidth + (cols - 1) * stepX;
  const totalHeight = cellHeight + (rows.length - 1) * stepY;
  const visibleInnerXSep = matrixInnerSepForAxis(matrixOptions, "x", env, matrixScale, 0);
  const visibleInnerYSep = matrixInnerSepForAxis(matrixOptions, "y", env, matrixScale, 0);
  const layoutInnerXSep = matrixInnerSepForAxis(matrixOptions, "x", env, matrixScale, parseDimension(TIKZ_DEFAULT_INNER_SEP, env.variables));
  const layoutInnerYSep = matrixInnerSepForAxis(matrixOptions, "y", env, matrixScale, parseDimension(TIKZ_DEFAULT_INNER_SEP, env.variables));
  const boundsWidth = roundNumber(totalWidth + visibleInnerXSep * 2);
  const boundsHeight = roundNumber(totalHeight + visibleInnerYSep * 2);
  const layoutWidth = roundNumber(totalWidth + layoutInnerXSep * 2);
  const layoutHeight = roundNumber(totalHeight + layoutInnerYSep * 2);
  const origin =
    (statement.at ? resolveCoordinate(statement.at, env, diagnostics) : null) ||
    resolvePositioning(matrixOptions || {}, env, { width: layoutWidth, height: layoutHeight }) ||
    applyTransform({ x: 0, y: 0 }, env.transform);
  const startX = origin.x - ((cols - 1) * stepX) / 2;
  const startY = origin.y + ((rows.length - 1) * stepY) / 2;

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
    rx: nodeCornerRadius(matrixShape, matrixSemantic, { width: boundsWidth, height: boundsHeight }),
    style: { ...matrixFrameStyle, ...style }
  });
  const matrixFill = matrixStyle.fill || "none";
  const matrixStroke = matrixSemantic.draw || matrixStyle.stroke !== "none" ? matrixStyle.stroke || "black" : "none";
  if (matrixFill !== "none") {
    ir.items.push(matrixFrameItem({ stroke: "none", fill: matrixFill }));
  }

  rows.forEach((row, rowIndex) => {
    const rowOptions = matrixRowNodeOptions(matrixOptions, rowIndex + 1);
    row.forEach((cell, columnIndex) => {
      if (!name) return;
      const cellName = `${name}-${rowIndex + 1}-${columnIndex + 1}`;
      const point = roundPoint({
        x: startX + columnIndex * stepX,
        y: startY - rowIndex * stepY
      });
      const options = {
        ...cellBaseOptions,
        ...rowOptions,
        ...cell.options,
        "minimum width": `${cellWidth}`,
        "minimum height": `${cellHeight}`
      };
      env.nodes[cellName] = {
        point,
        width: cellWidth,
        height: cellHeight,
        shape: nodeShape(options),
        shapeData: nodeShapeData(options)
      };
      env.coordinates[cellName] = point;
      if (cell.explicitName) {
        const explicitName = resolveDynamicName(cell.explicitName, env);
        env.nodes[explicitName] = {
          point,
          width: cellWidth,
          height: cellHeight,
          shape: nodeShape(options),
          shapeData: nodeShapeData(options)
        };
        env.coordinates[explicitName] = point;
      }
      addNodeItems(
        {
          at: point,
          text: cell.text,
          options,
          name: cellName,
          size: { width: cellWidth, height: cellHeight },
          fitTextToBox: true
        },
        ir,
        env
      );
    });
  });

  if (matrixStroke !== "none") {
    ir.items.push(matrixFrameItem({ stroke: matrixStroke, fill: "none" }));
  }
}

function matrixRowNodeOptions(matrixOptions = {}, rowNumber) {
  const rowStyle = matrixOptions[`row ${rowNumber}/.style`];
  if (rowStyle === undefined || rowStyle === true) return {};
  const rowOptions = parseOptions(rowStyle);
  const nodeOptions = rowOptions.nodes ? parseOptions(rowOptions.nodes) : {};
  return { ...matrixInheritedNodeOptions(rowOptions), ...nodeOptions };
}

function matrixInheritedNodeOptions(options = {}) {
  const inherited = {};
  for (const key of ["text height", "text depth", "font", "text", "align", "text width", "minimum width", "minimum height", "minimum size"]) {
    if (Object.hasOwn(options, key)) inherited[key] = options[key];
  }
  return inherited;
}

function parseMatrixScale(options = {}, env) {
  if (!tikzBoolean(options["transform shape"])) return 1;
  if (options.scale === undefined || options.scale === true || options.scale === "") return 1;
  const scale = evaluateMath(options.scale, env.variables);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function matrixInnerSepForAxis(options = {}, axis, env, scale, fallback) {
  const axisKey = axis === "x" ? "inner xsep" : "inner ysep";
  const raw = Object.hasOwn(options, axisKey) ? options[axisKey] : options["inner sep"];
  return parseFiniteDimension(raw, env, fallback) * scale;
}

function createPic(statement, env, ir) {
  const name = statement.name ? resolveDynamicName(statement.name, env) : null;
  const origin = resolvePositioning(statement.options || {}, env) || applyTransform({ x: 0, y: 0 }, env.transform);
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

function applyNoopSideEffects(statement, env) {
  const raw = String(statement.raw || "").trim();
  const toggle = raw.match(/^\\toggle(true|false)\s*\{([^{}]+)\}/);
  if (!toggle) return;
  env.toggles ||= {};
  env.toggles[toggle[2].trim()] = toggle[1] === "true";
}

// Claude: 读取节点自身的 rotate 选项（如 \node[rotate=90]{...}），转成角度。
// 用于把文字竖排/斜排，见 case 047 的 self-awareness / immunisation 标签。
function nodeRotation(options = {}, env) {
  const raw = options.rotate;
  if (raw === undefined || raw === true || raw === "") return 0;
  const angle = evaluateMath(raw, env.variables);
  return Number.isFinite(angle) ? angle : 0;
}

function addNodeItems(node, ir, env) {
  const { style: rawStyle, semantic } = normalizeOptions("node", node.options || {}, env);
  const style = scaleCanvasStyle(rawStyle, env);
  const rotation = node.rotation ?? nodeRotation(node.options || {}, env);
  const point = node.displayPoint || resolveNodeAnchorPoint(node.at, node.options, node.text, env, node.size);
  const shape = nodeShape(node.options || {});
  const shapeData = nodeShapeData(node.options || {});
  const size = node.size || scaleSize(estimateNodeLayoutSize(node.text, node.options, env), env.canvasScale);
  const shadingStyle = pathShadingStyle(style, semantic);
  const shadedFill = shadingStyle.fill || null;
  const textStyle = {
    ...style,
    fill: style.textFill || semantic.text || "black",
    fontScale: roundNumber(env.canvasScale * (node.textFontScale || nodeFontScale(node.options || {}, env))),
    fontSizeBaseScale: roundNumber(env.canvasScale * nodeOptionScale(node.options || {}, env)),
    fontFamily: resolveFontFamily(node.text) || resolveFontFamily(node.options?.font || env.pictureOptions?.font)
  };
  if (style.fill !== "none" || style.stroke !== "none" || semantic.draw || shadedFill) {
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
      rx: nodeCornerRadius(shape, semantic, size),
      pathPicture: semantic["path picture"],
      bpmnIcon: semantic["bpmn icon"],
      bpmnMarker: semantic["bpmn marker"],
      tikzquadsKind: semantic["tikzquads kind"],
      tikzquadsOptions: tikzquadsNodeOptions(semantic),
      doubleColor: semantic.double === undefined ? undefined : semantic.double || "white",
      shadows: nodeGeneralShadows(semantic, env),
      parts: shape === "rectangleSplit" ? rectangleSplitParts(semantic) : undefined,
      partFills: shape === "rectangleSplit" ? rectangleSplitPartFills(semantic) : undefined,
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
        shading: shadingStyle.shading,
        ballColor: shadingStyle.ballColor,
        topColor: shadingStyle.topColor,
        bottomColor: shadingStyle.bottomColor
      }
    });
  }
  ir.items.push({
    type: "textNode",
    x: point.x,
    y: point.y,
    text: node.text,
    style: textStyle,
    rotation: rotation || undefined,
    wrapWidth: node.options?.["text width"] ? parseDimension(node.options["text width"], env.variables) : undefined,
    fitBox: node.fitTextToBox ? { width: size.width, height: size.height } : undefined
  });
  for (const label of nodeLabels(node.options || {}, point, size, env, textStyle)) {
    ir.items.push(label);
  }
}

function nodeGeneralShadows(semantic = {}, env) {
  if (semantic["general shadow"] === undefined) return undefined;
  const shadows = optionValueList(semantic["general shadow"])
    .map((value) => parseGeneralShadow(value, env))
    .filter(Boolean);
  return shadows.length ? shadows : undefined;
}

function parseGeneralShadow(value, env) {
  const shadowOptions = parseOptions(String(value === true ? "" : value));
  const xshift = parseDimension(shadowOptions["shadow xshift"] || "0", env.variables) * env.canvasScale;
  const yshift = parseDimension(shadowOptions["shadow yshift"] || "0", env.variables) * env.canvasScale;
  const scale = evaluateMath(shadowOptions["shadow scale"] || 1, env.variables);
  const { style: rawStyle, semantic } = normalizeOptions("node", shadowOptions, env);
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

function nodeLabels(options = {}, point, size, env, textStyle = {}) {
  if (options.label === undefined || options.label === true || options.label === "") return [];
  const sep = parseDimension(options["label distance"] || "0.12", env.variables);
  const labels = [];
  for (const value of optionValueList(options.label)) {
    const label = parseNodeLabel(value);
    if (!label.text) continue;
    const labelPoint = labelPointForDirection(label.direction, point, size, sep);
    labels.push({
      type: "textNode",
      x: labelPoint.x,
      y: labelPoint.y,
      text: label.text,
      style: labelTextStyle(label, env, textStyle, options)
    });
  }
  return labels;
}

function optionValueList(value) {
  return Array.isArray(value) ? value : [value];
}

function labelTextStyle(label, env, fallbackStyle = {}, parentOptions = {}) {
  const inheritedPathText = parentOptions["tikzkit inherited path text"];
  const labelOptions = label.options || {};
  const pathTextOptions = inheritedPathText && !hasExplicitTextColor(labelOptions)
    ? { text: inheritedPathText }
    : {};
  const rawLabelOptions = {
    ...inheritedNodeOptions(env),
    "every label": true,
    ...pathTextOptions,
    ...labelOptions
  };
  const { style: rawStyle, semantic, options: normalizedLabelOptions } = normalizeOptions("node", rawLabelOptions, env);
  const style = scaleCanvasStyle(rawStyle, env);
  return {
    ...style,
    fill: style.textFill || semantic.text || "black",
    fontScale: roundNumber(env.canvasScale * nodeFontScale(normalizedLabelOptions, env)),
    fontSizeBaseScale: roundNumber(env.canvasScale * nodeOptionScale(normalizedLabelOptions, env)),
    fontFamily: resolveFontFamily(label.text) || resolveFontFamily(normalizedLabelOptions.font || env.pictureOptions?.font) || fallbackStyle.fontFamily
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
    fontFamily: resolveFontFamily(String(expandedOptions.label || "")) || resolveFontFamily(expandedOptions.font || env.pictureOptions?.font)
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

function labelPointForDirection(direction, point, size, sep) {
  const normalized = String(direction || "above").toLowerCase().replace(/-/g, " ");
  if (normalized === "center" || normalized === "centre") return roundPoint(point);
  let x = point.x;
  let y = point.y;
  if (normalized.includes("right") || normalized.includes("east")) x += size.width / 2 + sep;
  if (normalized.includes("left") || normalized.includes("west")) x -= size.width / 2 + sep;
  if (normalized.includes("above") || normalized.includes("north")) y += size.height / 2 + sep;
  if (normalized.includes("below") || normalized.includes("south")) y -= size.height / 2 + sep;
  if (x === point.x && y === point.y) y += size.height / 2 + sep;
  return roundPoint({ x, y });
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
  return applyTransform({ x: 0, y: 0 }, env.transform);
}

function initialChains(pictureOptions = {}) {
  const chains = {};
  const parsed = parseStartChainSpec(pictureOptions["start chain"]);
  if (parsed) chains[parsed.name] = { direction: parsed.direction, last: null };
  return chains;
}

function initialActiveChain(pictureOptions = {}) {
  return parseStartChainSpec(pictureOptions["start chain"])?.name || null;
}

function parseStartChainSpec(value) {
  if (value === undefined || value === null || value === false) return null;
  const text = String(value === true ? "" : value).trim();
  if (!text) return { name: "default", direction: "right" };
  const match = text.match(/^(?:(.+?)\s+)?going\s+(.+)$/);
  if (match) {
    return {
      name: normalizeChainName(match[1] || "default"),
      direction: normalizeChainDirection(match[2])
    };
  }
  return { name: normalizeChainName(text), direction: "right" };
}

function chainNameFromOptions(options = {}, env = {}) {
  if (!Object.hasOwn(options, "on chain")) return null;
  const value = options["on chain"];
  if (value === false || value === null) return null;
  if (value === true || value === "") return env.activeChain || "default";
  return normalizeChainName(value);
}

function normalizeChainName(value) {
  return String(value ?? "default").trim() || "default";
}

function normalizeChainDirection(value) {
  return String(value || "right").trim().toLowerCase().replace(/-/g, " ") || "right";
}

function ensureChain(name, env) {
  env.chains ||= {};
  if (!env.chains[name]) env.chains[name] = { direction: "right", last: null };
  env.activeChain ||= name;
  return env.chains[name];
}

function resolveChainPosition(options = {}, env, selfSize = { width: 0, height: 0 }) {
  const name = chainNameFromOptions(options, env);
  if (!name) return null;
  const chain = ensureChain(name, env);
  if (!chain.last) return applyTransform({ x: 0, y: 0 }, env.transform);
  const distance = scalePositioningDistance(defaultPositioningDistance(env), env);
  const direction = chain.direction || "right";
  return roundPoint({
    x: chain.last.point.x + positioningDelta(direction, "x", distance, chain.last, selfSize),
    y: chain.last.point.y + positioningDelta(direction, "y", distance, chain.last, selfSize)
  });
}

function updateChainState(options = {}, env, point, size = { width: 0, height: 0 }) {
  const name = chainNameFromOptions(options, env);
  if (!name) return;
  const chain = ensureChain(name, env);
  chain.last = {
    point,
    width: Number(size?.width) || 0,
    height: Number(size?.height) || 0
  };
}

function resolvePositioning(options, env, selfSize = { width: 0, height: 0 }) {
  const legacy = resolveLegacyPositioning(options, env);
  if (legacy) return legacy;
  const placement = resolvePositioningPlacement(options, env);
  if (!placement) return null;
  const dx = positioningDelta(placement.direction, "x", placement.distance, placement.reference, selfSize);
  const dy = positioningDelta(placement.direction, "y", placement.distance, placement.reference, selfSize);
  return roundPoint({ x: placement.reference.point.x + dx, y: placement.reference.point.y + dy });
}

function resolveExplicitAtPositioningOffset(options, env, selfSize = { width: 0, height: 0 }) {
  const placement = resolvePositioningPlacement(options, env);
  if (!placement) return null;
  const origin = { point: { x: 0, y: 0 }, width: 0, height: 0 };
  return {
    x: positioningDelta(placement.direction, "x", placement.distance, origin, selfSize),
    y: positioningDelta(placement.direction, "y", placement.distance, origin, selfSize)
  };
}

function resolvePositioningPlacement(options, env) {
  const entries = Object.entries(options || {});
  for (const [key, value] of entries) {
    const direction = key.trim().toLowerCase().replace(/\s+/g, " ");
    if (!["right", "left", "above", "below", "above right", "above left", "below right", "below left"].includes(direction)) {
      continue;
    }
    const text = String(value === true ? "" : value).trim();
    const placement = parsePositioningOfExpression(text, env);
    if (!placement) continue;
    const distance = scalePositioningDistance(placement.distance, env);
    const reference = resolvePositioningReference(placement.reference, env);
    if (!reference) continue;
    return { direction, distance, reference };
  }
  return null;
}

function parsePositioningOfExpression(text, env) {
  const match = String(text || "").trim().match(/^(.*?)\s*of\s+(.+)$/);
  if (!match) return null;
  const distanceText = match[1].trim();
  const distance = distanceText ? parsePositioningDistance(distanceText, env) : defaultPositioningDistance(env);
  if (!Number.isFinite(distance.x) || !Number.isFinite(distance.y)) return null;
  return { distance, reference: match[2].trim() };
}

function defaultPositioningDistance(env) {
  // Claude: TikZ positioning 库的默认 node distance 是 1cm（边到边），原来写死成 0.6cm
  // 会让 right=of/below=of 等没显式设距离的节点挤得过近，相邻列的边标签互相碰撞（见 case 004）。
  return parsePositioningDistance(env.pictureOptions?.["node distance"] || "1cm", env);
}

function parsePositioningDistance(value, env) {
  const text = String(value || "").trim();
  const pair = text.match(/^([\s\S]+?)\s+and\s+([\s\S]+)$/);
  if (pair) {
    return {
      y: parseDimension(pair[1], env.variables),
      x: parseDimension(pair[2], env.variables),
      isPair: true
    };
  }
  const distance = parseDimension(text, env.variables);
  return { x: distance, y: distance, isPair: false };
}

function positioningDelta(direction, axis, distance, reference, selfSize) {
  const hasHorizontal = direction.includes("right") || direction.includes("left");
  const hasVertical = direction.includes("above") || direction.includes("below");
  const rawDistance = axis === "x" ? distance.x : distance.y;
  const axisDistance = hasHorizontal && hasVertical && !distance.isPair ? rawDistance * Math.SQRT1_2 : rawDistance;
  if (axis === "x") {
    if (direction.includes("right")) return reference.width / 2 + selfSize.width / 2 + axisDistance;
    if (direction.includes("left")) return -(reference.width / 2 + selfSize.width / 2 + axisDistance);
    return 0;
  }
  if (direction.includes("above")) return reference.height / 2 + selfSize.height / 2 + axisDistance;
  if (direction.includes("below")) return -(reference.height / 2 + selfSize.height / 2 + axisDistance);
  return 0;
}

function scalePositioningDistance(distance, env) {
  const scale = canvasLengthScale(env);
  if (Math.abs(scale - 1) < 1e-9) return distance;
  return {
    ...distance,
    x: distance.x * scale,
    y: distance.y * scale
  };
}

function resolveLegacyPositioning(options, env) {
  const directions = {
    "right of": { x: 1, y: 0, factor: 1 },
    "left of": { x: -1, y: 0, factor: 1 },
    "above of": { x: 0, y: 1, factor: 1 },
    "below of": { x: 0, y: -1, factor: 1 },
    "above right of": { x: 1, y: 1, factor: Math.SQRT1_2 },
    "above left of": { x: -1, y: 1, factor: Math.SQRT1_2 },
    "below right of": { x: 1, y: -1, factor: Math.SQRT1_2 },
    "below left of": { x: -1, y: -1, factor: Math.SQRT1_2 }
  };
  for (const [key, direction] of Object.entries(directions)) {
    if (!Object.hasOwn(options, key)) continue;
    const target = resolveReferencePoint(options[key], env);
    if (!target) continue;
    const distance = parseDimension(options["node distance"] || env.pictureOptions?.["node distance"] || 1, env.variables) * canvasLengthScale(env);
    return roundPoint({
      x: target.x + direction.x * distance * direction.factor,
      y: target.y + direction.y * distance * direction.factor
    });
  }
  return null;
}

function resolveReferencePoint(raw, env) {
  const reference = resolvePositioningReference(raw, env);
  if (reference) return reference.point;
  return null;
}

function resolvePositioningReference(raw, env) {
  const text = resolveDynamicName(raw, env);
  if (Object.hasOwn(env.nodes, text)) {
    const node = env.nodes[text];
    return { point: node.point, width: node.layoutWidth || node.width || 0, height: node.layoutHeight || node.height || 0 };
  }
  if (Object.hasOwn(env.coordinates, text)) return { point: env.coordinates[text], width: 0, height: 0 };
  const anchored = resolveAnchoredNodeCoordinate(text, env);
  if (anchored) return { point: anchored, width: 0, height: 0 };
  if (text.startsWith("$") || text.includes(",") || /^-?\d/.test(text)) {
    return { point: resolveCoordinate(text, env, []), width: 0, height: 0 };
  }
  return null;
}

function resolveNodeAnchorPoint(point, options = {}, text = "", env = { variables: {} }, sizeOverride = null) {
  const size = sizeOverride || estimateNodeLayoutSize(text, options, env);
  const sep = parseDimension(options["inner sep"] || options["outer sep"] || "0.08", env.variables);
  const shift = nodeAnchorShift(options, size, sep, env, nodeRotation(options, env));
  const explicitShift = nodeExplicitShift(options, env);
  return roundPoint({
    x: point.x + shift.x + explicitShift.x,
    y: point.y + shift.y + explicitShift.y
  });
}

// Claude: 把向量按角度(度, 数学坐标系逆时针为正)旋转。
function rotateVector(x, y, degrees) {
  if (!degrees) return { x, y };
  const r = (degrees * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

function nodeAnchorShift(options = {}, size, sep, env, rotation = 0) {
  const direction = nodeDirection(options);
  const scaledSep = sep * canvasLengthScale(env);
  if (direction) {
    const distance = nodeDirectionDistance(options[direction], sep, env) * canvasLengthScale(env);
    // Claude: above=d 等价于 anchor=south + 沿页面方向移动 d。把它拆成两部分：
    //   ① gap：间距 d，沿页面方向（不随节点旋转）；
    //   ② anchor→center 的半尺寸偏移：随节点 rotate 一起旋转。
    // 否则 \node[above=1em,rotate=90]{...} 的文字会以锚点为中心、旋转后压在路径线上（见 case 047）。
    // rotation=0 时与原公式逐项相同，保持向后兼容。
    const gapX = direction.includes("right") ? distance : direction.includes("left") ? -distance : 0;
    const gapY = direction.includes("above") ? distance : direction.includes("below") ? -distance : 0;
    const anchorX = direction.includes("right") ? size.width / 2 : direction.includes("left") ? -size.width / 2 : 0;
    const anchorY = direction.includes("above") ? size.height / 2 : direction.includes("below") ? -size.height / 2 : 0;
    const rotated = rotateVector(anchorX, anchorY, rotation);
    return { x: gapX + rotated.x, y: gapY + rotated.y };
  }

  const anchor = String(options.anchor || "").trim();
  if (!anchor) return { x: 0, y: 0 };
  const customAnchor = customNodeLocalAnchor(nodeShape(options), anchor, size);
  if (customAnchor) return { x: -customAnchor.x, y: -customAnchor.y };
  const outerSep = nodeOuterSep(options, env);
  const scaledOuterX = outerSep.x * canvasLengthScale(env);
  const scaledOuterY = outerSep.y * canvasLengthScale(env);
  return {
    x: anchor.includes("west") ? size.width / 2 + scaledOuterX : anchor.includes("east") ? -(size.width / 2 + scaledOuterX) : 0,
    y: anchor.includes("south") ? size.height / 2 + scaledOuterY : anchor.includes("north") ? -(size.height / 2 + scaledOuterY) : 0
  };
}

function nodeDirection(options = {}) {
  const directions = ["above right", "above left", "below right", "below left", "right", "left", "above", "below"];
  return directions.find((direction) => {
    if (!Object.hasOwn(options, direction)) return false;
    const value = options[direction];
    return value === true || !String(value).includes("of");
  });
}

function nodeDirectionDistance(value, fallback, env) {
  if (value === true || value === undefined || value === null || value === "") return fallback;
  const parsed = parseDimension(normalizeNodeDirectionDistance(value), env.variables);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeNodeDirectionDistance(value) {
  const text = String(value).trim();
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return `${text}pt`;
  return text;
}

function nodeExplicitShift(options = {}, env) {
  let x = options.xshift ? parseDimension(options.xshift, env.variables) : 0;
  let y = options.yshift ? parseDimension(options.yshift, env.variables) : 0;
  if (options.shift) {
    const shifted = parseShift(options.shift, env);
    x += shifted.x;
    y += shifted.y;
  }
  return { x, y };
}

function resolveDynamicName(name, env) {
  return substituteTextVariables(String(name || "").trim(), env.variables).trim();
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
  text = text.replace(/^\{([\s\S]*)\}$/, "$1").trim();
  if (text.startsWith("(") && text.endsWith(")")) text = text.slice(1, -1).trim();
  const shifted = parseCoordinateOptionPrefix(text, env);
  if (shifted) text = shifted.coordinate;
  if (!text || text.startsWith("$") || text.includes(",")) return null;
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
function clipNodeCurveEndpoints(from, fromRef, to, toRef, curve, env) {
  return {
    from: fromRef ? clipNodeReferenceAlongAngle(fromRef, from, curve.out, env) : roundPoint(from),
    to: toRef ? clipNodeReferenceAlongAngle(toRef, to, curve.in, env) : roundPoint(to)
  };
}

function clipNodeReferenceAlongAngle(ref, center, angleDegrees, env) {
  if (ref.mode === "anchor") return roundPoint(center);
  const radians = (angleDegrees * Math.PI) / 180;
  const toward = { x: center.x + Math.cos(radians), y: center.y + Math.sin(radians) };
  return nodeBorderPoint(ref.node, center, toward, env);
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
    return {
      out: parseAngleOption(options.out, 0, env),
      in: parseAngleOption(options.in, 180, env),
      outLooseness,
      inLooseness
    };
  }
  if (Object.hasOwn(options, "bend left")) return bendCurveSpec(options["bend left"], 1, from, to, env, { outLooseness, inLooseness });
  if (Object.hasOwn(options, "bend right")) return bendCurveSpec(options["bend right"], -1, from, to, env, { outLooseness, inLooseness });
  if (Object.hasOwn(options, "looseness")) return sameNodeAnchorLoosenessCurveSpec(fromRef, toRef, from, to, { outLooseness, inLooseness });
  return null;
}

function sameNodeAnchorLoosenessCurveSpec(fromRef, toRef, from, to, looseness = { outLooseness: 1, inLooseness: 1 }) {
  if (!fromRef || !toRef || fromRef.mode !== "anchor" || toRef.mode !== "anchor" || fromRef.name !== toRef.name) return null;
  const center = fromRef.node?.point;
  if (!center) return null;
  const startAngle = nodeReferenceAngle(fromRef, from, center);
  const endAngle = nodeReferenceAngle(toRef, to, center);
  const delta = shortestAngleDelta(startAngle, endAngle);
  const sign = delta >= 0 ? 1 : -1;
  return {
    out: startAngle + sign * 90,
    in: endAngle - sign * 90,
    outLooseness: looseness.outLooseness,
    inLooseness: looseness.inLooseness
  };
}

function nodeReferenceAngle(ref, point, center) {
  const parsed = Number(ref.anchor);
  if (Number.isFinite(parsed)) return parsed;
  return (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI;
}

function shortestAngleDelta(start, end) {
  let delta = ((end - start + 180) % 360) - 180;
  if (delta < -180) delta += 360;
  return delta;
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

function nodeBorderPoint(node, center, toward, env) {
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1e-12) return roundPoint(center);
  const halfWidth = (Number(node.width) || 0) / 2;
  const halfHeight = (Number(node.height) || 0) / 2;
  if (halfWidth <= 0 || halfHeight <= 0) return roundPoint(center);
  if (node.shape === "circle" || node.shape === "circleCrossSplit") {
    const radius = Math.max(halfWidth, halfHeight);
    return roundPoint({ x: center.x + (dx / distance) * radius, y: center.y + (dy / distance) * radius });
  }
  if (node.shape === "ellipse") {
    const factor = 1 / Math.sqrt((dx * dx) / (halfWidth * halfWidth) + (dy * dy) / (halfHeight * halfHeight));
    return roundPoint({ x: center.x + dx * factor, y: center.y + dy * factor });
  }
  if (node.shape === "diamond") {
    const factor = distance / (Math.abs(dx) / halfWidth + Math.abs(dy) / halfHeight);
    return roundPoint({ x: center.x + (dx / distance) * factor, y: center.y + (dy / distance) * factor });
  }
  if (node.shape === "cloud") {
    const factor = 1 / Math.sqrt((dx * dx) / (halfWidth * halfWidth) + (dy * dy) / (halfHeight * halfHeight));
    return roundPoint({ x: center.x + dx * factor, y: center.y + dy * factor });
  }
  if (polygonNodeShape(node.shape)) {
    return polygonBorderPoint(center, toward, nodePolygonPoints(node, center, halfWidth, halfHeight));
  }
  const xScale = Math.abs(dx) > 1e-12 ? halfWidth / Math.abs(dx) : Number.POSITIVE_INFINITY;
  const yScale = Math.abs(dy) > 1e-12 ? halfHeight / Math.abs(dy) : Number.POSITIVE_INFINITY;
  const factor = Math.min(xScale, yScale);
  if (!Number.isFinite(factor)) return roundPoint(center);
  return roundPoint({ x: center.x + dx * factor, y: center.y + dy * factor });
}

function nodeShape(options = {}) {
  const shape = normalizeShapeName(options.shape);
  if (shape === "tikzquads quad") return "tikzquadsQuad";
  if (shape === "tikzquads black box") return "tikzquadsBlackBox";
  if (shape === "tikzquads pg load line") return "tikzquadsPgLoadLine";
  if (options["rectangle split"]) return "rectangleSplit";
  if (options.circle || shape === "circle") return "circle";
  if (options["circle cross split"] || shape === "circle cross split") return "circleCrossSplit";
  if (options.ellipse || shape === "ellipse") return "ellipse";
  if (options.diamond || shape === "diamond") return "diamond";
  if (options["rounded rectangle"] || shape === "rounded rectangle" || shape === "rectangle with rounded corners") return "roundedRectangle";
  if (options.superellipse || shape === "superellipse") return "superellipse";
  if (options["regular polygon"] || shape === "regular polygon") return "regularPolygon";
  if (options.star || shape === "star") return "star";
  if (options.trapezium || shape === "trapezium") return "trapezium";
  if (options.cloud || shape === "cloud") return "cloud";
  return "rectangle";
}

function nodeShapeData(options = {}) {
  return {
    regularPolygonSides: Math.max(3, Math.round(numberOption(options["regular polygon sides"], 5))),
    starPoints: Math.max(3, Math.round(numberOption(options["star points"], 5))),
    starPointRatio: Math.max(1.05, numberOption(options["star point ratio"], 1.5)),
    trapeziumLeftAngle: numberOption(options["trapezium left angle"] ?? options["trapezium angle"], 60),
    trapeziumRightAngle: numberOption(options["trapezium right angle"] ?? options["trapezium angle"], 60)
  };
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

function nodeCornerRadius(shape, semantic, size) {
  if (shape === "roundedRectangle") return roundNumber(Math.min(size.width, size.height) * 0.45);
  if (shape === "superellipse") return roundNumber(Math.min(size.width, size.height) * 0.28);
  if (semantic["rounded corners"]) return 0.08;
  return 0;
}

function resolveFontFamily(raw) {
  const text = String(raw || "").trim();
  if (!text) return undefined;
  if (/\\(?:tt|ttfamily|texttt)\b|monospace/i.test(text)) {
    return TIKZ_MONOSPACE_FONT_FAMILY;
  }
  if (/\\(?:sf|sffamily|textsf)\b|sans/i.test(text)) {
    return TIKZ_SANS_SERIF_FONT_FAMILY;
  }
  if (/\\(?:rm|rmfamily|textrm)\b|serif/i.test(text)) {
    return TIKZ_FONT_FAMILY;
  }
  return undefined;
}

function rectangleSplitParts(semantic = {}) {
  const parts = Number(semantic["rectangle split parts"] || 1);
  return Number.isFinite(parts) && parts > 0 ? Math.round(parts) : 1;
}

function rectangleSplitPartFills(semantic = {}) {
  if (!semantic["rectangle split part fill"]) return [];
  return splitTopLevel(String(semantic["rectangle split part fill"])).map((color) => normalizeColor(color));
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
  const optionMatch = text.match(/^\|\s*\[([\s\S]*?)\]\s*\|\s*([\s\S]*)$/);
  if (optionMatch) {
    options = parseOptions(optionMatch[1]);
    text = optionMatch[2].trim();
  }
  const nodeMatch = text.match(/^\\node\s*(?:\[([^\]]*)\])?\s*\(([^)]*)\)\s*\{([\s\S]*)\}\s*;?$/);
  if (nodeMatch) {
    return {
      text: stripOuterBraces(nodeMatch[3]),
      options: { ...options, ...(nodeMatch[1] ? parseOptions(nodeMatch[1]) : {}) },
      explicitName: nodeMatch[2].trim()
    };
  }
  return { text: stripOuterBraces(text), options, explicitName: null };
}

function parseFiniteDimension(value, env, fallback) {
  if (value === undefined || value === null || value === true || value === "") return fallback;
  const parsed = parseDimension(value, env.variables);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function scaleSize(size, scale = 1) {
  const factor = Number.isFinite(scale) && scale > 0 ? scale : 1;
  if (Math.abs(factor - 1) < 1e-9) return size;
  return {
    width: roundNumber((Number(size?.width) || 0) * factor),
    height: roundNumber((Number(size?.height) || 0) * factor)
  };
}

function canvasLengthScale(env = {}) {
  const scale = Number(env.canvasScale);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function scaleCanvasStyle(style = {}, env = {}) {
  const scale = canvasLengthScale(env);
  if (Math.abs(scale - 1) < 1e-9) return style;
  const scaled = { ...style };
  if (Number.isFinite(Number(scaled.lineWidth))) scaled.lineWidth = Number(scaled.lineWidth) * scale;
  if (Array.isArray(scaled.dashArray)) scaled.dashArray = scaled.dashArray.map((value) => value * scale);
  if (scaled.markerStart) scaled.markerStart = scaleArrowTipMetrics(scaled.markerStart, scale);
  if (scaled.markerEnd) scaled.markerEnd = scaleArrowTipMetrics(scaled.markerEnd, scale);
  return scaled;
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

function nodeFontScaleForText(normalized, options = {}, env = {}) {
  return normalized?.explicitFontSize ? nodeOptionScale(options, env) : nodeFontScale(options, env);
}

function nodeOptionScale(options = {}, env = { variables: {} }) {
  if (options.scale === undefined || options.scale === null || options.scale === true || options.scale === "") return 1;
  const scale = evaluateMath(options.scale, env.variables);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function inheritedNodeOptions(env = {}) {
  const options = { ...(env.pictureOptions || {}) };
  delete options.scale;
  delete options.rotate;
  delete options.xshift;
  delete options.yshift;
  delete options.shift;
  if (env.styles?.["every node"]) options["every node"] = true;
  return resolveDynamicOptions(options, env);
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

function estimateMatrixCellSize(text, options = {}, env = { variables: {} }) {
  if (options.circle || options.shape === "circle") return estimateNodeSize(text, options, env);

  const normalized = normalizeTikzText(text);
  if (normalized.kind === "image") return estimateNodeSize(text, options, env);

  const textBox = scaleTextMetricBox(estimateTextMetricBox(normalized, {
    widthFactor: 0.12,
    lineHeight: 0.24,
    minHeight: 0.24,
    formulaMinWidth: 0.08,
    formulaWidthPadding: 0
  }), nodeFontScaleForText(normalized, options, env));
  const innerSep = parseDimension(options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env.variables);
  const textWidth = options["text width"] ? parseDimension(options["text width"], env.variables) : null;
  const textHeight = options["text height"] ? parseDimension(options["text height"], env.variables) : null;
  const textDepth = options["text depth"] ? parseDimension(options["text depth"], env.variables) : 0;
  const isEmptyText = normalized.kind === "text" && String(normalized.text || "").trim().length === 0;
  if (isEmptyText) {
    let width = Number.isFinite(textWidth) ? textWidth + innerSep * 2 : innerSep * 2;
    let height = Number.isFinite(textHeight) ? textHeight + textDepth + innerSep * 2 : innerSep * 2;
    width = Math.max(0.02, width);
    height = Math.max(0.02, height);
    if (options["minimum width"]) width = Math.max(width, parseDimension(options["minimum width"], env.variables));
    if (options["minimum height"]) height = Math.max(height, parseDimension(options["minimum height"], env.variables));
    if (options["minimum size"]) {
      const size = parseDimension(options["minimum size"], env.variables);
      width = Math.max(width, size);
      height = Math.max(height, size);
    }
    return { width: roundNumber(width), height: roundNumber(height) };
  }
  let width = Math.max(0.22, textBox.width + 0.06 + innerSep * 2);
  let height = Math.max(0.24, textBox.height + innerSep * 2);

  if (Number.isFinite(textWidth)) width = Math.max(0.22, textWidth + innerSep * 2);
  if (Number.isFinite(textHeight)) height = Math.max(0.22, textHeight + textDepth + innerSep * 2);
  if (options["minimum width"]) width = Math.max(width, parseDimension(options["minimum width"], env.variables));
  if (options["minimum height"]) height = Math.max(height, parseDimension(options["minimum height"], env.variables));
  if (options["minimum size"]) {
    const size = parseDimension(options["minimum size"], env.variables);
    width = Math.max(width, size);
    height = Math.max(height, size);
  }

  return { width: roundNumber(width), height: roundNumber(height) };
}

function estimateNodeLayoutSize(text, options = {}, env = { variables: {} }) {
  if (nodeUsesBoxSizing(options, env)) return estimateNodeSize(text, options, env);
  return estimateCompactTextSize(text, options, env);
}

function estimateNodeAnchorSize(text, options = {}, env = { variables: {} }, visibleSize = null) {
  const size = visibleSize || estimateNodeLayoutSize(text, options, env);
  const outerSep = nodeOuterSep(options, env);
  return {
    width: roundNumber((Number(size.width) || 0) + outerSep.x * 2),
    height: roundNumber((Number(size.height) || 0) + outerSep.y * 2)
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

function parseOuterSepDimension(value, fallback, env) {
  if (value === undefined || value === null || value === true || value === "" || String(value).trim() === "auto") {
    return fallback;
  }
  const parsed = parseDimension(value, env.variables);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nodeUsesBoxSizing(options = {}, env = { variables: {} }) {
  const { style, semantic } = normalizeOptions("node", options, env);
  return Boolean(
    style.stroke !== "none" ||
      style.fill !== "none" ||
      semantic.draw ||
      semantic.shading ||
      options.circle ||
      options.ellipse ||
      options.shape ||
      options["minimum width"] ||
      options["minimum height"] ||
      options["minimum size"] ||
      options["text width"]
  );
}

function shouldFitTextToNodeBox(options = {}) {
  return Boolean((options.circle || options.shape === "circle") && options["minimum size"]);
}

function estimateCompactTextSize(text, options = {}, env = { variables: {} }) {
  const normalized = normalizeTikzText(text);
  if (normalized.kind === "image") return estimateNodeSize(text, options, env);
  if (isEmptyNormalizedText(normalized)) return estimateEmptyTextNodeSize(options, env);

  const textBox = scaleTextMetricBox(estimateTextMetricBox(normalized, {
    widthFactor: 0.13,
    lineHeight: 0.18,
    minHeight: 0.18,
    formulaMinWidth: 0.08,
    formulaWidthPadding: 0.08
  }), nodeFontScaleForText(normalized, options, env));
  const innerSep = parseDimension(options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env.variables);
  const width = Math.max(0.08, textBox.width + innerSep * 2);
  const height = Math.max(0.08, textBox.height + innerSep * 2);

  return { width: roundNumber(width), height: roundNumber(height) };
}

function nodeUsesMonospaceFont(text, options = {}, env = {}) {
  return Boolean(resolveFontFamily(options.font || env.pictureOptions?.font) || resolveFontFamily(text));
}

function estimatePositioningSelfSize(text, options = {}, env = { variables: {} }, fallback = null) {
  if (!hasPositioningOfOption(options) || nodeUsesBoxSizing(options, env)) return fallback || estimateNodeAnchorSize(text, options, env);
  const normalized = normalizeTikzText(text);
  if (normalized.kind !== "text" || parseMathText(String(normalized.text || "").trim())) {
    return fallback || estimateNodeAnchorSize(text, options, env);
  }
  if (isEmptyNormalizedText(normalized)) return estimateEmptyTextNodeSize(options, env);
  const textBox = scaleTextMetricBox(estimateTextMetricBox(normalized, {
    widthFactor: 0.187,
    lineHeight: 0.18,
    minHeight: 0.18,
    formulaMinWidth: 0.08,
    formulaWidthPadding: 0
  }), nodeFontScaleForText(normalized, options, env));
  const innerSep = parseDimension(options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env.variables);
  return {
    width: roundNumber(Math.max(fallback?.width || 0.08, textBox.width + innerSep * 2)),
    height: roundNumber(Math.max(fallback?.height || 0.08, textBox.height + innerSep * 2))
  };
}

function isEmptyNormalizedText(normalized) {
  return normalized?.kind === "text" && String(normalized.text || "").trim().length === 0;
}

function estimateEmptyTextNodeSize(options = {}, env = { variables: {} }) {
  const innerXSep = parseDimension(options["inner xsep"] ?? options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env.variables);
  const innerYSep = parseDimension(options["inner ysep"] ?? options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env.variables);
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
  const normalized = normalizeTikzText(text);
  if (normalized.kind === "image") {
    const contentScale = nodeFontScale(options, env);
    const innerSep = parseDimension(options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env.variables);
    let width = normalized.width * contentScale + innerSep * 2;
    let height = normalized.height * contentScale + innerSep * 2;
    if (options["minimum width"]) width = Math.max(width, parseDimension(options["minimum width"], env.variables) * contentScale);
    if (options["minimum height"]) height = Math.max(height, parseDimension(options["minimum height"], env.variables) * contentScale);
    if (options["minimum size"]) {
      const size = parseDimension(options["minimum size"], env.variables) * contentScale;
      width = Math.max(width, size);
      height = Math.max(height, size);
    }
    return {
      width: roundNumber(width),
      height: roundNumber(height)
    };
  }
  const lines = textMetricLines(normalized);
  const isCircleShape = options.circle || options.shape === "circle";
  const textBox = scaleTextMetricBox(estimateTextMetricBox(
    normalized,
    isCircleShape
      ? {
          texTextMetrics: true,
          widthFactor: 0.09,
          formulaWidthFactor: 0.09,
          lineHeight: 0.32,
          minHeight: 0.28,
          widthPadding: 0,
          formulaWidthPadding: 0.08
        }
      : {
          texTextMetrics: true,
          widthFactor: 0.16,
          formulaWidthFactor: 0.17,
          formulaMinWidth: 0.08,
          lineHeight: 0.32,
          minHeight: 0.28,
          widthPadding: 0,
          formulaWidthPadding: 0.14,
          shortFormulaWidthPadding: 0.08,
          shortFormulaMaxUnits: 3
        }
  ), nodeFontScaleForText(normalized, options, env));
  textBox.width += explicitHspaceWidth(text, env);
  const innerXSep = parseDimension(options["inner xsep"] ?? options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env.variables);
  const innerYSep = parseDimension(options["inner ysep"] ?? options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env.variables);
  const isEmptyText = lines.every((line) => !line.trim());
  const isEmptyCircle = isCircleShape && isEmptyText;
  const fixedCircleSize = fixedCircularMinimumSize(options, env);
  const textWidth = options["text width"] ? parseDimension(options["text width"], env.variables) : null;
  if (Number.isFinite(textWidth) && textWidth > 0 && !isCircleShape) {
    const wrappedLines = wrapTextMetricLines(lines, textWidth, options, env);
    if (wrappedLines.length > lines.length) {
      const contentScale = nodeFontScaleForText(normalized, options, env);
      textBox.height = Math.max(textBox.height, (wrappedLines.length * 0.32 + Math.max(0, wrappedLines.length - 1) * 0.08) * contentScale);
    }
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
  if (
    isEmptyText &&
    !isCircleShape &&
    !["roundedRectangle", "rectangleSplit"].includes(emptyNodeShape) &&
    (options["minimum width"] || options["minimum height"] || options["minimum size"] || options["text width"] || options["text height"])
  ) {
    let emptyWidth = Number.isFinite(textWidth) && textWidth > 0 ? textWidth + innerXSep * 2 : innerXSep * 2;
    let emptyHeight = Number.isFinite(textHeight) ? textHeight + textDepth + innerYSep * 2 : innerYSep * 2;
    if (options["minimum width"]) emptyWidth = Math.max(emptyWidth, parseDimension(options["minimum width"], env.variables));
    if (options["minimum height"]) emptyHeight = Math.max(emptyHeight, parseDimension(options["minimum height"], env.variables));
    if (options["minimum size"]) {
      const size = parseDimension(options["minimum size"], env.variables);
      emptyWidth = Math.max(emptyWidth, size);
      emptyHeight = Math.max(emptyHeight, size);
    }
    return {
      width: roundNumber(Math.max(0.02, emptyWidth)),
      height: roundNumber(Math.max(0.02, emptyHeight))
    };
  }
  let width = fixedCircleSize ?? (isEmptyCircle
    ? emptyCircleSize
    : textWidth
      ? textWidth + innerXSep * 2
      : Math.max(0.22, textBox.width + innerXSep * 2));
  let height = fixedCircleSize ?? (isEmptyCircle ? width : Math.max(0.35, textBox.height + innerYSep * 2));
  if (fixedCircleSize === null) {
    if (options["minimum width"]) width = Math.max(width, parseDimension(options["minimum width"], env.variables));
    if (options["minimum height"]) height = Math.max(height, parseDimension(options["minimum height"], env.variables));
    if (options["minimum size"]) {
      const size = parseDimension(options["minimum size"], env.variables);
      width = Math.max(width, size);
      height = Math.max(height, size);
    }
  }
  if (options["rectangle split"] && options["rectangle split horizontal"]) {
    const parts = Number(options["rectangle split parts"] || 1);
    const count = Number.isFinite(parts) && parts > 0 ? Math.round(parts) : 1;
    width = Math.max(width, height * count * 0.45);
  }
  if (isCircleShape) {
    const shouldCircumscribe = circleNeedsDiagonalFit(normalized, textBox, isEmptyCircle, fixedCircleSize);
    const circumscribed = shouldCircumscribe ? pgfCircleDiameter : 0;
    const diameter = Math.max(width, height, circumscribed);
    width = diameter;
    height = diameter;
  }
  const shape = nodeShape(options);
  if (shape === "ellipse") {
    width *= Math.SQRT2;
    height *= Math.SQRT2;
  }
  if (options.diamond || options.shape === "diamond") {
    if (options["bpmn gateway"]) {
      const diameter = Math.max(width, height);
      width = diameter;
      height = diameter;
    } else {
      const contentWidth = width;
      const contentHeight = height;
      width = contentWidth + contentHeight;
      height = Math.max(contentHeight + contentWidth * 0.72, contentHeight * 2);
    }
  }
  if (shape === "roundedRectangle" && isEmptyText && options["minimum width"]) {
    width = Math.max(parseDimension("1pt", env.variables), parseDimension(options["minimum width"], env.variables) - innerXSep * 2);
  }
  if (shape === "regularPolygon") {
    const diameter = Math.max(width, height) * 1.12;
    width = diameter;
    height = diameter;
  }
  if (shape === "star") {
    const diameter = Math.max(width, height) * 1.35;
    width = diameter;
    height = diameter;
  }
  if (shape === "trapezium") {
    width += Math.max(0.25, height * 0.45);
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
  return { width: roundNumber(width), height: roundNumber(height) };
}

function circleNeedsDiagonalFit(normalized, textBox, isEmptyCircle, fixedCircleSize) {
  if (isEmptyCircle || fixedCircleSize !== null) return false;
  if (normalized?.kind === "text" && !parseMathText(String(normalized.text || "").trim())) return true;
  const lines = normalized?.lines?.length ? normalized.lines : String(normalized?.text || "").split(/\\\\|\n/);
  const nonEmptyLines = lines.filter((line) => String(line || "").trim().length);
  if (nonEmptyLines.length > 1) return true;
  const raw = String(normalized?.raw || normalized?.text || "");
  if (/\\(?:vec|overrightarrow|hat|bar|overline)\b|[_^]/.test(raw)) return true;
  const width = Number(textBox?.width) || 0;
  const height = Number(textBox?.height) || 0;
  return height > 0.34 && width > 0 && height / width > 0.72;
}

function estimateTikzCdLabelSize(text, options = {}, env = { variables: {} }) {
  const normalized = normalizeTikzText(text);
  const textBox = scaleTextMetricBox(estimateTextMetricBox(normalized, {
    widthFactor: 0.1,
    lineHeight: 0.16,
    minHeight: 0.13,
    formulaMinWidth: 0.04,
    formulaWidthPadding: 0
  }), nodeFontScaleForText(normalized, options, env));
  const innerXSep = parseDimension(options["inner xsep"] ?? options["inner sep"] ?? "0.015", env.variables);
  const innerYSep = parseDimension(options["inner ysep"] ?? options["inner sep"] ?? "0.015", env.variables);
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
  const size = parseDimension(options["minimum size"], env.variables);
  return Number.isFinite(size) && size > 0 ? size : null;
}

function estimateTextMetricBox(normalized, options = {}) {
  const rawLines = normalized.lines.length ? normalized.lines : String(normalized.text || "").split(/\\\\|\n/);
  const scale = normalized.scale || 1;
  const widthFactor = options.widthFactor ?? 0.16;
  const lineHeight = options.lineHeight ?? 0.35;
  const minHeight = options.minHeight ?? lineHeight;
  const widthPadding = options.widthPadding ?? 0;
  const lineStyles = Array.isArray(normalized.lineStyles) ? normalized.lineStyles : [];
  const boxes = rawLines.map((line, index) => {
    const text = String(line).trim();
    const lineScale = scale * (Number(lineStyles[index]?.scale) || 1);
    const math = parseMathText(text);
    if (math) {
      const formula = estimateFormulaBox(math.tex, {
        displayMode: math.displayMode,
        scale: lineScale,
        minWidth: options.formulaMinWidth,
        widthFactor: options.formulaWidthFactor ?? widthFactor,
        widthPadding: formulaWidthPaddingFor(math.tex, options, widthPadding)
      });
      return {
        width: formula.width,
        height: Math.max(minHeight * lineScale, formulaTotalHeight(formula))
      };
    }
    const fallback = text.replace(/\$([^$]+)\$/g, (_match, tex) => mathFallbackText(tex));
    return {
      width: (options.texTextMetrics ? texTextWidthCm(fallback, lineScale) : mathTextMetricUnits(fallback) * widthFactor * lineScale) + widthPadding,
      height: Math.max(minHeight * lineScale, lineHeight * lineScale)
    };
  });
  const maxLineScale = Math.max(scale, ...lineStyles.map((style) => scale * (Number(style?.scale) || 1)));
  return {
    width: Math.max(...boxes.map((box) => box.width), 0),
    height: boxes.reduce((sum, box) => sum + box.height, 0) + Math.max(0, boxes.length - 1) * 0.1 * maxLineScale
  };
}

function formulaWidthPaddingFor(tex, options, fallback) {
  const regular = options.formulaWidthPadding ?? fallback;
  const short = options.shortFormulaWidthPadding;
  if (!Number.isFinite(short)) return regular;
  const units = mathTextMetricUnits(mathFallbackText(tex));
  const maxUnits = Number.isFinite(options.shortFormulaMaxUnits) ? options.shortFormulaMaxUnits : 3;
  return units <= maxUnits ? short : regular;
}

function textMetricLines(normalized) {
  const rawLines = normalized.lines.length ? normalized.lines : String(normalized.text || "").split(/\\\\|\n/);
  return rawLines.map((line) => {
    const text = String(line).trim();
    if (/^\$[\s\S]*\$$/.test(text) || /^\\\([\s\S]*\\\)$/.test(text)) return mathFallbackText(text);
    return text.replace(/\$([^$]+)\$/g, (_match, tex) => mathFallbackText(tex));
  });
}

function wrapTextMetricLines(lines, textWidth, options = {}, env = { variables: {} }) {
  const maxChars = textWidthMaxChars(textWidth, options, env);
  return lines.flatMap((line) => wrapTextMetricLine(line, maxChars));
}

function textWidthMaxChars(textWidth, options = {}, env = { variables: {} }) {
  const emWidth = parseDimension("1em", env.variables) * nodeFontScale(options, env) * 0.49;
  if (!Number.isFinite(textWidth) || !Number.isFinite(emWidth) || emWidth <= 0) return Infinity;
  return Math.max(1, Math.floor(textWidth / emWidth));
}

function wrapTextMetricLine(line, maxChars) {
  const text = String(line || "").trim();
  if (!text || !Number.isFinite(maxChars) || text.length <= maxChars || !/\s/.test(text)) return [text];
  const output = [];
  let current = "";
  for (const word of text.split(/\s+/)) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars || !current) {
      current = next;
    } else {
      output.push(current);
      current = word;
    }
  }
  if (current) output.push(current);
  return output.length ? output : [text];
}

function maxTextMetricUnits(lines) {
  return Math.max(...lines.map((line) => textMetricUnits(line)), 0);
}

function textMetricUnits(line) {
  return mathTextMetricUnits(line);
}

function expandForeachValues(values, env) {
  const expanded = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index].trim();
    if (value === "..." && expanded.length > 0 && index < values.length - 1) {
      const previous = Number(expanded.at(-1));
      const beforePrevious = Number(expanded.at(-2));
      const end = evaluateMath(values[index + 1], env.variables);
      const step = Number.isFinite(beforePrevious) ? previous - beforePrevious : 1;
      for (let current = previous + step; step >= 0 ? current <= end : current >= end; current += step) {
        expanded.push(String(roundNumber(current)));
      }
      index += 1;
    } else {
      expanded.push(value);
    }
  }
  return expanded;
}

function applyForeachOptions(variables, options = {}, foreachIndex = 0, env = { variables: {} }) {
  applyForeachCountOption(variables, options.count, foreachIndex, env);
  const evaluateOptions = Array.isArray(options.evaluate) ? options.evaluate : options.evaluate !== undefined ? [options.evaluate] : [];
  for (const spec of evaluateOptions) applyForeachEvaluateOption(variables, spec, env);
}

function applyForeachCountOption(variables, spec, foreachIndex, env) {
  if (spec === undefined || spec === null || spec === false) return;
  const text = stripOuterBraces(String(spec === true ? "" : spec)).trim();
  const match = text.match(/^\\?([A-Za-z@]+)(?:\s+from\s+([\s\S]+))?$/);
  if (!match) return;
  const start = match[2] ? evaluateMath(match[2], { ...env.variables, ...variables }) : 1;
  variables[match[1]] = roundNumber((Number.isFinite(start) ? start : 1) + foreachIndex);
}

function applyForeachEvaluateOption(variables, spec, env) {
  if (spec === undefined || spec === null || spec === false) return;
  const text = stripOuterBraces(String(spec === true ? "" : spec)).trim();
  const match = text.match(/^\\?([A-Za-z@]+)\s+as\s+\\?([A-Za-z@]+)\s+using\s+\{?([\s\S]*?)\}?$/);
  if (!match) return;
  const expression = match[3].trim();
  variables[match[2]] = roundNumber(evaluateMath(expression, { ...env.variables, ...variables }));
}

function buildGrid(from, to, pathOptions, env = {}) {
  const step = parseDimension(pathOptions.step || 1) * gridStepScale(env);
  if (!Number.isFinite(step) || step <= 0) return [];
  const lines = [];
  const subtype = semanticSubtype(pathOptions) || "grid-line";
  const minX = Math.min(from.x, to.x);
  const maxX = Math.max(from.x, to.x);
  const minY = Math.min(from.y, to.y);
  const maxY = Math.max(from.y, to.y);
  const tolerance = Math.max(1e-9, step * 0.05);
  const addHorizontal = (y) => {
    lines.push({
      type: "path",
      subtype,
      commands: [
        { type: "moveTo", x: minX, y: roundNumber(y) },
        { type: "lineTo", x: maxX, y: roundNumber(y) }
      ]
    });
  };
  for (let x = Math.ceil((minX - tolerance) / step) * step; x <= maxX + tolerance; x += step) {
    lines.push({
      type: "path",
      subtype,
      commands: [
        { type: "moveTo", x: roundNumber(x), y: minY },
        { type: "lineTo", x: roundNumber(x), y: maxY }
      ]
    });
  }
  let horizontalCount = 0;
  for (let y = Math.ceil((minY - tolerance) / step) * step; y <= maxY + tolerance; y += step) {
    addHorizontal(y);
    horizontalCount += 1;
  }
  const transformedCap = transformedGridUpperCap(minY, maxY, step, tolerance, env);
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
  const start = evaluateMath(options["start angle"] || 0, env.variables);
  const end = evaluateMath(options["end angle"] || 360, env.variables);
  const rx = parseDimension(options["x radius"] || options.radius || 1, env.variables);
  const ry = parseDimension(options["y radius"] || options.radius || rx, env.variables);
  const startRad = (start * Math.PI) / 180;
  const center = {
    x: current.x - rx * Math.cos(startRad),
    y: current.y - ry * Math.sin(startRad)
  };
  const steps = Math.max(8, Math.ceil(Math.abs(end - start) / 12));
  const commands = [{ type: "moveTo", x: current.x, y: current.y }];
  for (let i = 1; i <= steps; i += 1) {
    const angle = ((start + ((end - start) * i) / steps) * Math.PI) / 180;
    commands.push({
      type: "lineTo",
      x: roundNumber(center.x + rx * Math.cos(angle)),
      y: roundNumber(center.y + ry * Math.sin(angle))
    });
  }
  return {
    type: "path",
    shape: "arc",
    commands,
    endPoint: { x: commands.at(-1).x, y: commands.at(-1).y }
  };
}

function applyPathMorphing(commands, pathOptions, env) {
  const decoration = parseOptions(String(pathOptions.decoration || ""));
  if (pathOptions.decorate && decoration.brace) return applyBraceDecoration(commands, decoration, env);
  const mode = decoration.snake ? "snake" : decoration.zigzag ? "zigzag" : null;
  if (!pathOptions.decorate || !mode) return commands;
  const amplitude = Math.max(0, parseFiniteDimension(decoration.amplitude || "0.04", env, 0.04));
  const segmentLength = Math.max(0.03, parseFiniteDimension(decoration["segment length"] || "0.18", env, 0.18));
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
      appendMorphedLine(morphed, current, { x: command.x, y: command.y }, amplitude, segmentLength, mode);
      current = { x: command.x, y: command.y };
      continue;
    }
    if (command.type === "curveTo" && current) {
      appendMorphedCurve(morphed, current, command, amplitude, segmentLength, mode);
      current = { x: command.x, y: command.y };
      continue;
    }
    if (command.type === "closePath" && current && start) {
      appendMorphedLine(morphed, current, start, amplitude, segmentLength, mode);
      morphed.push(command);
      current = start;
      continue;
    }
    morphed.push(command);
    if ("x" in command) current = { x: command.x, y: command.y };
  }
  return morphed;
}

function applyBraceDecoration(commands, decoration, env) {
  const replaced = [];
  let current = null;
  for (const command of commands) {
    if (command.type === "moveTo") {
      current = { x: command.x, y: command.y };
      continue;
    }
    if (command.type === "lineTo" && current) {
      appendBraceLine(replaced, current, { x: command.x, y: command.y }, decoration, env);
      current = { x: command.x, y: command.y };
      continue;
    }
    if (!replaced.length && current) replaced.push({ type: "moveTo", x: current.x, y: current.y });
    replaced.push(command);
    if ("x" in command) current = { x: command.x, y: command.y };
  }
  return replaced.length ? replaced : commands;
}

function appendBraceLine(commands, from, to, decoration, env) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-12) {
    commands.push({ type: "moveTo", x: from.x, y: from.y });
    return;
  }
  const raise = parseFiniteDimension(decoration.raise || "0", env, 0);
  const mirrored = decoration.mirror === true || String(decoration.mirror).trim() === "true";
  const side = mirrored ? -1 : 1;
  const ux = dx / length;
  const uy = dy / length;
  const nx = -uy * side;
  const ny = ux * side;
  const amplitude = Math.max(0, parseFiniteDimension(decoration.amplitude ?? "2.5pt", env, parseDimension("2.5pt", env.variables)));
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

function appendMorphedLine(commands, from, to, amplitude, segmentLength, mode) {
  appendMorphedPolyline(commands, [from, to], amplitude, segmentLength, mode);
}

function appendMorphedCurve(commands, from, curve, amplitude, segmentLength, mode) {
  const flat = flattenPath([{ type: "moveTo", x: from.x, y: from.y }, curve], 0.04);
  appendMorphedPolyline(commands, flat, amplitude, segmentLength, mode);
}

function appendMorphedPolyline(commands, points, amplitude, segmentLength, mode) {
  const length = polylineLength(points);
  const to = points.at(-1);
  if (!to) return;
  if (length < 1e-12 || amplitude <= 0) {
    commands.push({ type: "lineTo", x: to.x, y: to.y });
    return;
  }
  const cycles = Math.max(1, Math.round(length / segmentLength));
  const steps = Math.max(4, cycles * 8);
  const morphedPoints = [];
  for (let index = 1; index <= steps; index += 1) {
    const sample = pointOnPolyline(points, (length * index) / steps);
    const offset =
      index === steps
        ? 0
        : mode === "zigzag"
          ? amplitude * (Math.floor((sample.walked / segmentLength) * 2) % 2 === 0 ? 1 : -1)
          : amplitude * Math.sin((sample.walked / segmentLength) * Math.PI * 2);
    morphedPoints.push({
      x: roundNumber(sample.x + sample.normal.x * offset),
      y: roundNumber(sample.y + sample.normal.y * offset)
    });
  }
  if (mode === "snake") {
    appendSmoothCurveThroughPoints(commands, [points[0], ...morphedPoints]);
    return;
  }
  for (const point of morphedPoints) commands.push({ type: "lineTo", x: point.x, y: point.y });
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

  if (kind === "*" || kind === "." || kind === "o") {
    return {
      type: "path",
      shape: "plot-mark",
      mark: kind,
      commands: circleToPath(point.x, point.y, size),
      style: kind === "o" ? lineStyle : filledStyle
    };
  }
  if (kind === "+" || kind === "|") {
    const commands = [
      { type: "moveTo", x: roundNumber(point.x), y: roundNumber(point.y - size) },
      { type: "lineTo", x: roundNumber(point.x), y: roundNumber(point.y + size) }
    ];
    if (kind === "+") {
      commands.push(
        { type: "moveTo", x: roundNumber(point.x - size), y: roundNumber(point.y) },
        { type: "lineTo", x: roundNumber(point.x + size), y: roundNumber(point.y) }
      );
    }
    return {
      type: "path",
      shape: "plot-mark",
      mark: kind,
      commands,
      style: lineStyle
    };
  }
  if (kind === "-") {
    return {
      type: "path",
      shape: "plot-mark",
      mark: kind,
      commands: [
        { type: "moveTo", x: roundNumber(point.x - size), y: roundNumber(point.y) },
        { type: "lineTo", x: roundNumber(point.x + size), y: roundNumber(point.y) }
      ],
      style: lineStyle
    };
  }
  if (kind === "square" || kind === "square*") {
    return {
      type: "path",
      shape: "plot-mark",
      mark: kind,
      commands: [
        { type: "moveTo", x: roundNumber(point.x - size), y: roundNumber(point.y - size) },
        { type: "lineTo", x: roundNumber(point.x + size), y: roundNumber(point.y - size) },
        { type: "lineTo", x: roundNumber(point.x + size), y: roundNumber(point.y + size) },
        { type: "lineTo", x: roundNumber(point.x - size), y: roundNumber(point.y + size) },
        { type: "closePath" }
      ],
      style: kind.endsWith("*") ? filledStyle : lineStyle
    };
  }
  if (kind === "triangle" || kind === "triangle*") {
    const top = polarOffset(point, 90, size);
    const right = polarOffset(point, -30, size);
    const left = polarOffset(point, -150, size);
    return {
      type: "path",
      shape: "plot-mark",
      mark: kind,
      commands: [
        { type: "moveTo", x: top.x, y: top.y },
        { type: "lineTo", x: right.x, y: right.y },
        { type: "lineTo", x: left.x, y: left.y },
        { type: "closePath" }
      ],
      style: kind.endsWith("*") ? filledStyle : lineStyle
    };
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

function plotMarkSize(markOptions = {}, env = {}) {
  const parsed = parseDimension(markOptions["mark size"] || "2pt", env.variables || {});
  return Number.isFinite(parsed) && parsed > 0 ? parsed : parseDimension("2pt", env.variables || {});
}

function resolveControlPoint(raw, current, env, diagnostics) {
  const text = String(raw).trim();
  const relative = text.match(/^\+\((.+)\)$/);
  if (!relative) return resolveCoordinate(text, env, diagnostics);
  const offset = resolveCoordinate(relative[1], { ...env, transform: identityTransform() }, diagnostics);
  return roundPoint({ x: current.x + offset.x, y: current.y + offset.y });
}

function resolveRelativeCoordinate(raw, current, env, diagnostics) {
  const base = current || applyTransform({ x: 0, y: 0 }, env.transform);
  const offset = resolveCoordinate(raw, { ...env, transform: scaleOnlyTransform(env.transform) }, diagnostics);
  return roundPoint({
    x: base.x + offset.x,
    y: base.y + offset.y
  });
}

function semanticSubtype(options = {}) {
  if (options["tikzquads parallel path"]) return "tikzquads-parallel-connect";
  if (options["tikzquads kind"]) return `tikzquads-${String(options["tikzquads kind"]).trim().replace(/\s+/g, "-")}`;
  if (options["axis mark"]) return "axis-mark";
  if (options["axis bar"]) return "axis-bar";
  if (options["axis comb"]) return "axis-comb";
  if (options["axis closed cycle"]) return "axis-closed-cycle";
  if (options["axis tick"]) return "axis-tick";
  if (options["axis frame"]) return "axis-frame";
  if (options["axis grid"]) return "axis-grid-line";
  if (options["axis line"]) return "axis-line";
  if (options["axis plot"]) return "axis-plot";
  if (options["axis legend"]) return "axis-legend";
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
  if (options["feynman fermion"]) return "feynman-fermion";
  if (options["feynman gluon"]) return "feynman-gluon";
  if (options["feynman boson"]) return "feynman-boson";
  if (options["feynman scalar"]) return "feynman-scalar";
  if (options["feynman ghost"]) return "feynman-ghost";
  if (options["feynman majorana"]) return "feynman-majorana";
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
  if (commands.length === 1 && commands[0].type === "moveTo" && shapes.length > 0) return false;
  return true;
}

function polarOffset(point, angle, distance) {
  const radians = (angle * Math.PI) / 180;
  return roundPoint({
    x: point.x + Math.cos(radians) * distance,
    y: point.y + Math.sin(radians) * distance
  });
}

function composeTransform(parent, options = {}, env) {
  const coordinateScale = evaluateMath(options.scale || 1, env.variables);
  const scale = Number.isFinite(coordinateScale) ? coordinateScale : 1;
  const canvasScale = transformCanvasScale(options, env);
  const rotate = evaluateMath(options.rotate || 0, env.variables);
  const radians = (Number.isFinite(rotate) ? rotate : 0) * (Math.PI / 180);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const shift = parseTransformShift(options, env);
  // Claude: 原版完全没处理 TikZ 的 xslant/yslant 斜切变换（多层网络/伪三维图常用）。
  // xslant=s: (x,y)->(x+s·y, y)；yslant=s: (x,y)->(x, s·x+y)。把斜切折进线性部分(R∘slant)，
  // 平移仍只用 shift。这样矩形/圆/路径才会被剪成平行四边形，而不是保持轴对齐。
  const rotateScale = { a: scale * cos, b: scale * sin, c: -scale * sin, d: scale * cos, x: 0, y: 0, scale };
  const linear = multiplyTransforms(rotateScale, slantTransform(options, env));
  const base = {
    a: linear.a,
    b: linear.b,
    c: linear.c,
    d: linear.d,
    x: shift.x,
    y: shift.y,
    scale
  };
  const local = multiplyTransforms(base, tikzExtMirrorTransform(options, env));
  const canvas = canvasScale === 1 ? identityTransform() : { a: canvasScale, b: 0, c: 0, d: canvasScale, x: 0, y: 0, scale: canvasScale };
  return multiplyTransforms(parent, multiplyTransforms(canvas, local));
}

// Claude: 构造 xslant/yslant 的合成斜切矩阵。按该文件里 yslant,xslant 的书写顺序，
// 等价于 current = yslant_T ∘ xslant_T。无 slant 选项时返回单位阵（不影响既有行为）。
function slantTransform(options = {}, env) {
  const xslant = evaluateMath(options.xslant ?? 0, env.variables);
  const yslant = evaluateMath(options.yslant ?? 0, env.variables);
  const xs = Number.isFinite(xslant) ? xslant : 0;
  const ys = Number.isFinite(yslant) ? yslant : 0;
  if (xs === 0 && ys === 0) return identityTransform();
  return multiplyTransforms(
    { a: 1, b: ys, c: 0, d: 1, x: 0, y: 0, scale: 1 },
    { a: 1, b: 0, c: xs, d: 1, x: 0, y: 0, scale: 1 }
  );
}

function transformCanvasScale(options = {}, env) {
  const raw = options["transform canvas"];
  if (raw === undefined || raw === null || raw === true || raw === "") return 1;
  const parsed = parseOptions(String(raw));
  const value = parsed.scale ?? parsed["scale around"] ?? 1;
  const scale = evaluateMath(value, env.variables);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function parseTransformShift(options = {}, env) {
  let x = options.xshift ? parseShiftDimension(options.xshift, env.variables) : 0;
  let y = options.yshift ? parseShiftDimension(options.yshift, env.variables) : 0;
  if (options.shift) {
    const shifted = parseShift(options.shift, env);
    x += shifted.x;
    y += shifted.y;
  }
  return { x, y };
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
  if (text.startsWith("(")) return resolveCoordinate(text, { ...env, transform: identityTransform() }, []);
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
  return { a: scale, b: 0, c: 0, d: scale, x: 0, y: 0, scale };
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
    z: { x: 0, y: 0 }
  };
  for (const key of ["x", "y", "z"]) {
    if (options[key]) basis[key] = parseBasisVector(options[key], variables) || basis[key];
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
    if (options[key]) next[key] = parseBasisVector(options[key], env.variables) || next[key];
  }
  return next;
}

function parseBasisVector(value, variables = {}) {
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
  if (parts.length < 2) return null;
  return roundPoint({
    x: parseDimension(parts[0], variables),
    y: parseDimension(parts[1], variables)
  });
}

function parseShift(value, env) {
  if (!value) return { x: 0, y: 0 };
  if (typeof value === "string" && value.startsWith("(")) {
    const point = resolveCoordinate(value, { ...env, transform: identityTransform() }, []);
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
  text = stripOuterBraces(text);
  if (/^\+\(.+\)$/.test(text)) text = text.slice(1);
  if (text.startsWith("(") && text.endsWith(")")) text = text.slice(1, -1).trim();
  text = stripOuterBraces(text);

  const shifted = parseCoordinateOptionPrefix(text, env);
  if (shifted) {
    const point = resolveCoordinate(shifted.coordinate, env, diagnostics);
    return roundPoint({
      x: point.x + shifted.shift.x,
      y: point.y + shifted.shift.y
    });
  }

  if (text.startsWith("$") && text.endsWith("$")) {
    return resolveCalc(text.slice(1, -1).trim(), env, diagnostics);
  }
  const projection = splitCoordinateProjection(text);
  if (projection) {
    const localEnv = { ...env, transform: identityTransform() };
    const left = resolveCoordinate(projection.left, localEnv, diagnostics);
    const right = resolveCoordinate(projection.right, localEnv, diagnostics);
    const projected = projection.operator === "|-" ? { x: left.x, y: right.y } : { x: right.x, y: left.y };
    return applyTransform(roundPoint(projected), env.transform);
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
  const polar = text.match(/^(.+):(.+)$/);
  if (polar) {
    const angle = (evaluateMath(polar[1], env.variables) * Math.PI) / 180;
    const radius = parseDimension(polar[2], env.variables);
    return applyTransform(roundPoint({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }), env.transform);
  }
  const comma = splitTopLevel(text, ",");
  if (comma.length >= 2) {
    if (comma.length >= 3) {
      const projected = projectBasisPoint(
        parseDimension(comma[0], env.variables),
        parseDimension(comma[1], env.variables),
        parseDimension(comma[2], env.variables),
        env.basis
      );
      return applyTransform(projected, env.transform);
    }
    return applyTransform(roundPoint({
      ...projectBasisPoint(
        parseDimension(comma[0], env.variables),
        parseDimension(comma[1], env.variables),
        0,
        env.basis
      )
    }), env.transform);
  }
  diagnostics.push({ severity: "warning", message: `Unknown coordinate ${raw}` });
  return { x: 0, y: 0 };
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
  const shift = coordinateOptionShift(parsed, env);
  return { coordinate, shift };
}

function coordinateOptionShift(options, env) {
  let x = options.xshift ? parseDimension(options.xshift, env.variables) : 0;
  let y = options.yshift ? parseDimension(options.yshift, env.variables) : 0;
  if (options.shift) {
    const shifted = parseShift(options.shift, env);
    x += shifted.x;
    y += shifted.y;
  }
  return { x, y };
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
  const width = Number(node.width) || 0;
  const height = Number(node.height) || 0;
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const angle = Number(rawAnchor);
  if (Number.isFinite(angle)) {
    return angleAnchor(node, angle, halfWidth, halfHeight);
  }
  const anchor = rawAnchor.replace(/-/g, " ");
  if (!anchor || anchor === "center") return roundPoint(node.point);
  if (anchor === "text") return roundPoint({ x: node.point.x - width * 0.18, y: node.point.y - height * 0.04 });
  if (anchor === "base") return roundPoint({ x: node.point.x, y: node.point.y - height * 0.08 });
  if (anchor === "mid") return roundPoint(node.point);
  const customAnchor = customNodeLocalAnchor(node.shape, rawAnchor, { width, height });
  if (customAnchor) return roundPoint({ x: node.point.x + customAnchor.x, y: node.point.y + customAnchor.y });
  if (node.shape === "diamond") {
    return diamondAnchorCoordinate(node, anchor, halfWidth, halfHeight);
  }
  let x = node.point.x;
  let y = node.point.y;
  if (anchor.includes("east")) x += halfWidth;
  if (anchor.includes("west")) x -= halfWidth;
  if (anchor.includes("north")) y += halfHeight;
  if (anchor.includes("south")) y -= halfHeight;
  return roundPoint({ x, y });
}

function customNodeLocalAnchor(shape, anchorRaw, size) {
  const rawAnchor = String(anchorRaw || "").trim().toLowerCase();
  const anchor = rawAnchor.replace(/-/g, " ");
  const halfWidth = (Number(size.width) || 0) / 2;
  const halfHeight = (Number(size.height) || 0) / 2;
  const shapeAnchor = shapeCompassLocalAnchor(shape, anchor, halfWidth, halfHeight);
  if (shapeAnchor) return shapeAnchor;
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
  if (shape !== "circle" && shape !== "circleCrossSplit" && shape !== "ellipse") return null;
  if (halfWidth <= 0 || halfHeight <= 0) return null;
  const dx = anchor.includes("east") ? 1 : anchor.includes("west") ? -1 : 0;
  const dy = anchor.includes("north") ? 1 : anchor.includes("south") ? -1 : 0;
  if (!dx && !dy) return null;
  if (shape === "circle" || shape === "circleCrossSplit") {
    const radius = Math.max(halfWidth, halfHeight);
    const length = Math.hypot(dx, dy) || 1;
    return { x: (dx / length) * radius, y: (dy / length) * radius };
  }
  const scale = 1 / Math.sqrt((dx * dx) / (halfWidth * halfWidth) + (dy * dy) / (halfHeight * halfHeight));
  return { x: dx * scale, y: dy * scale };
}

function angleAnchor(node, angle, halfWidth, halfHeight) {
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  if (node.shape === "circle" || node.shape === "circleCrossSplit") {
    const radius = Math.max(halfWidth, halfHeight);
    return roundPoint({ x: node.point.x + cos * radius, y: node.point.y + sin * radius });
  }
  if (node.shape === "ellipse") {
    const scale = 1 / Math.sqrt((cos * cos) / (halfWidth * halfWidth) + (sin * sin) / (halfHeight * halfHeight));
    return roundPoint({ x: node.point.x + cos * scale, y: node.point.y + sin * scale });
  }
  if (node.shape === "diamond") {
    const scale = 1 / (Math.abs(cos) / halfWidth + Math.abs(sin) / halfHeight);
    return roundPoint({ x: node.point.x + cos * scale, y: node.point.y + sin * scale });
  }
  if (node.shape === "cloud") {
    const scale = 1 / Math.sqrt((cos * cos) / (halfWidth * halfWidth) + (sin * sin) / (halfHeight * halfHeight));
    return roundPoint({ x: node.point.x + cos * scale, y: node.point.y + sin * scale });
  }
  if (polygonNodeShape(node.shape)) {
    const toward = { x: node.point.x + cos, y: node.point.y + sin };
    return polygonBorderPoint(node.point, toward, nodePolygonPoints(node, node.point, halfWidth, halfHeight));
  }
  const xScale = Math.abs(cos) > 1e-12 ? halfWidth / Math.abs(cos) : Number.POSITIVE_INFINITY;
  const yScale = Math.abs(sin) > 1e-12 ? halfHeight / Math.abs(sin) : Number.POSITIVE_INFINITY;
  const scale = Math.min(xScale, yScale);
  if (!Number.isFinite(scale)) return roundPoint(node.point);
  return roundPoint({ x: node.point.x + cos * scale, y: node.point.y + sin * scale });
}

function diamondAnchorCoordinate(node, anchor, halfWidth, halfHeight) {
  if (anchor === "north") return roundPoint({ x: node.point.x, y: node.point.y + halfHeight });
  if (anchor === "south") return roundPoint({ x: node.point.x, y: node.point.y - halfHeight });
  if (anchor === "east") return roundPoint({ x: node.point.x + halfWidth, y: node.point.y });
  if (anchor === "west") return roundPoint({ x: node.point.x - halfWidth, y: node.point.y });
  if (anchor === "north east") return roundPoint({ x: node.point.x + halfWidth / 2, y: node.point.y + halfHeight / 2 });
  if (anchor === "north west") return roundPoint({ x: node.point.x - halfWidth / 2, y: node.point.y + halfHeight / 2 });
  if (anchor === "south east") return roundPoint({ x: node.point.x + halfWidth / 2, y: node.point.y - halfHeight / 2 });
  if (anchor === "south west") return roundPoint({ x: node.point.x - halfWidth / 2, y: node.point.y - halfHeight / 2 });
  return roundPoint(node.point);
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
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const include = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);
  };
  for (const item of [...(ir.backgroundItems || []), ...(ir.items || [])]) {
    includeItemBounds(item, include);
  }
  if (!Number.isFinite(bounds.minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return bounds;
}

function includeItemBounds(item, include) {
  if (item.type === "nodeBox") {
    include(item.x - item.width / 2, item.y - item.height / 2);
    include(item.x + item.width / 2, item.y + item.height / 2);
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
  if (item.type === "textNode") {
    includeTextNodeItemBounds(item, include);
    return;
  }
  if (item.type === "marker") {
    include(item.x, item.y);
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
    const textBox = scaleTextMetricBox(estimateTextMetricBox(normalized, {
      widthFactor: 0.13,
      lineHeight: 0.18,
      minHeight: 0.18,
      formulaMinWidth: 0.08,
      formulaWidthPadding: 0
    }), normalized.explicitFontSize ? Number(item.style?.fontSizeBaseScale) || 1 : scale);
    width = Math.max(0.08, textBox.width);
    height = Math.max(0.08, textBox.height);
  }
  include(item.x - width / 2, item.y - height / 2);
  include(item.x + width / 2, item.y + height / 2);
}

function includePathItemBounds(item, include) {
  let current = null;
  let start = null;
  for (const command of item.commands || []) {
    if (command.type === "moveTo") {
      current = { x: command.x, y: command.y };
      start = current;
      include(command.x, command.y);
      continue;
    }
    if (command.type === "lineTo") {
      current = { x: command.x, y: command.y };
      include(command.x, command.y);
      continue;
    }
    if (command.type === "curveTo") {
      if (current && item.tightBezierBounds) includeCubicBounds(current, command, include);
      else {
        include(command.x1, command.y1);
        include(command.x2, command.y2);
        include(command.x, command.y);
      }
      current = { x: command.x, y: command.y };
      continue;
    }
    if (command.type === "closePath" && start) {
      include(start.x, start.y);
      current = start;
      continue;
    }
    if ("x" in command && "y" in command) {
      include(command.x, command.y);
      current = { x: command.x, y: command.y };
    }
  }
}

function includeCubicBounds(from, curve, include) {
  const p0 = from;
  const p1 = { x: curve.x1, y: curve.y1 };
  const p2 = { x: curve.x2, y: curve.y2 };
  const p3 = { x: curve.x, y: curve.y };
  include(p0.x, p0.y);
  include(p3.x, p3.y);
  for (const t of cubicExtrema(p0.x, p1.x, p2.x, p3.x)) {
    const point = cubicPoint(p0, p1, p2, p3, t);
    include(point.x, point.y);
  }
  for (const t of cubicExtrema(p0.y, p1.y, p2.y, p3.y)) {
    const point = cubicPoint(p0, p1, p2, p3, t);
    include(point.x, point.y);
  }
}

function cubicExtrema(p0, p1, p2, p3) {
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = p1 - p0;
  const roots = [];
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) >= 1e-12) roots.push(-c / b);
  } else {
    const discriminant = b * b - 4 * a * c;
    if (discriminant >= -1e-12) {
      const sqrt = Math.sqrt(Math.max(0, discriminant));
      roots.push((-b - sqrt) / (2 * a), (-b + sqrt) / (2 * a));
    }
  }
  return roots.filter((t) => t > 1e-9 && t < 1 - 1e-9);
}

function cubicPoint(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return {
    x: p0.x * a + p1.x * b + p2.x * c + p3.x * d,
    y: p0.y * a + p1.y * b + p2.y * c + p3.y * d
  };
}

function polygonNodeShape(shape) {
  return shape === "regularPolygon" || shape === "star" || shape === "trapezium";
}

function nodePolygonPoints(node, center, halfWidth, halfHeight) {
  const data = node.shapeData || {};
  if (node.shape === "regularPolygon") {
    return regularPolygonPoints(center, halfWidth, halfHeight, data.regularPolygonSides || 5, 90);
  }
  if (node.shape === "star") {
    return starPolygonPoints(center, halfWidth, halfHeight, data.starPoints || 5, data.starPointRatio || 1.5);
  }
  if (node.shape === "trapezium") {
    return trapeziumPoints(center, halfWidth, halfHeight, data);
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

function starPolygonPoints(center, halfWidth, halfHeight, points, ratio) {
  const total = points * 2;
  const innerRatio = 1 / ratio;
  return Array.from({ length: total }, (_unused, index) => {
    const outer = index % 2 === 0;
    const angle = ((90 + (360 * index) / total) * Math.PI) / 180;
    const scale = outer ? 1 : innerRatio;
    return {
      x: center.x + Math.cos(angle) * halfWidth * scale,
      y: center.y + Math.sin(angle) * halfHeight * scale
    };
  });
}

function trapeziumPoints(center, halfWidth, halfHeight, data = {}) {
  const left = Math.max(10, Math.min(170, data.trapeziumLeftAngle || 60));
  const right = Math.max(10, Math.min(170, data.trapeziumRightAngle || 60));
  const leftInset = Math.cos((left * Math.PI) / 180) * halfHeight * 0.7;
  const rightInset = Math.cos((right * Math.PI) / 180) * halfHeight * 0.7;
  return [
    { x: center.x - halfWidth + leftInset, y: center.y + halfHeight },
    { x: center.x + halfWidth - rightInset, y: center.y + halfHeight },
    { x: center.x + halfWidth + rightInset, y: center.y - halfHeight },
    { x: center.x - halfWidth - leftInset, y: center.y - halfHeight }
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
  const direction = { x: toward.x - center.x, y: toward.y - center.y };
  const candidates = [];
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const hit = raySegmentIntersection(center, direction, a, b);
    if (hit && hit.t >= -1e-9) candidates.push(hit);
  }
  candidates.sort((a, b) => a.t - b.t);
  return candidates[0] ? roundPoint(candidates[0].point) : roundPoint(center);
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
  const interpolationPlusOffset = text.match(/^\((.+)\)!(.+)!\((.+)\)([+-])\((.+)\)$/);
  if (interpolationPlusOffset) {
    const a = resolveCoordinate(interpolationPlusOffset[1], env, diagnostics);
    const t = evaluateMath(interpolationPlusOffset[2], env.variables);
    const b = resolveCoordinate(interpolationPlusOffset[3], env, diagnostics);
    const offset = resolveCalcOffset(interpolationPlusOffset[5], env, diagnostics);
    const sign = interpolationPlusOffset[4] === "+" ? 1 : -1;
    return roundPoint({
      x: a.x + (b.x - a.x) * t + sign * offset.x,
      y: a.y + (b.y - a.y) * t + sign * offset.y
    });
  }
  const interpolation = text.match(/^\((.+)\)!(.+)!\((.+)\)$/);
  if (interpolation) {
    const a = resolveCoordinate(interpolation[1], env, diagnostics);
    const t = evaluateMath(interpolation[2], env.variables);
    const b = resolveCoordinate(interpolation[3], env, diagnostics);
    return roundPoint({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }

  const addition = splitCalcAddition(text);
  if (addition) {
    const left = addition.left.includes("!") ? resolveCalc(addition.left, env, diagnostics) : resolveCoordinate(addition.left, env, diagnostics);
    const right = addition.right.includes("!") ? resolveCalc(addition.right, env, diagnostics) : resolveCalcOffset(addition.right, env, diagnostics);
    return roundPoint({
      x: left.x + addition.sign * right.x,
      y: left.y + addition.sign * right.y
    });
  }

  return resolveCoordinate(text, env, diagnostics);
}

function resolveCalcOffset(text, env, diagnostics) {
  const raw = String(text || "").trim();
  const coordinateText = raw.startsWith("(") && raw.endsWith(")") ? raw.slice(1, -1).trim() : raw;
  if (splitTopLevel(coordinateText, ",").length >= 2 || /^.+:.+$/.test(coordinateText)) {
    return resolveLocalVectorCoordinate(coordinateText, env, diagnostics);
  }
  return resolveCoordinate(coordinateText, env, diagnostics);
}

function resolveLocalVectorCoordinate(text, env, diagnostics) {
  const normalized = stripOuterBraces(String(text || "").trim());
  const polar = normalized.match(/^(.+):(.+)$/);
  if (polar) {
    const angle = (evaluateMath(polar[1], env.variables) * Math.PI) / 180;
    const radius = parseDimension(polar[2], env.variables);
    return applyTransformVector(
      roundPoint({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }),
      env.transform
    );
  }
  const comma = splitTopLevel(normalized, ",");
  if (comma.length >= 2) {
    const projected = projectBasisPoint(
      parseDimension(comma[0], env.variables),
      parseDimension(comma[1], env.variables),
      comma.length >= 3 ? parseDimension(comma[2], env.variables) : 0,
      env.basis
    );
    return applyTransformVector(projected, env.transform);
  }
  diagnostics.push({ severity: "warning", message: `Unknown calc offset ${text}` });
  return { x: 0, y: 0 };
}

function splitCalcAddition(text) {
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if ((char === "+" || char === "-") && depth === 0) {
      return {
        left: stripPointParens(text.slice(0, i).trim()),
        right: stripPointParens(text.slice(i + 1).trim()),
        sign: char === "+" ? 1 : -1
      };
    }
  }
  return null;
}

function stripPointParens(text) {
  const trimmed = text.trim();
  return hasSingleOuterParenPair(trimmed) ? trimmed.slice(1, -1).trim() : trimmed;
}

function hasSingleOuterParenPair(text) {
  if (!text.startsWith("(") || !text.endsWith(")")) return false;
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "(") depth += 1;
    if (text[i] === ")") depth -= 1;
    if (depth === 0 && i < text.length - 1) return false;
  }
  return true;
}

function materializeIntersections(raw, env, diagnostics) {
  const parsed = parseOptions(raw);
  const of = parsed.of || "";
  const by = parsed.by || "";
  const [first, second] = String(of)
    .split(/\s+and\s+/)
    .map((part) => part.trim());
  const names = stripOuterBraces(by)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const pathA = env.namedPaths[first];
  const pathB = env.namedPaths[second];
  if (!pathA || !pathB) {
    diagnostics.push({ severity: "warning", message: `Cannot resolve named paths for intersection: ${of}` });
    return;
  }
  const intersections = pathIntersections(pathA, pathB);
  intersections.forEach((point, index) => {
    const baseName = parsed.name ? String(parsed.name).trim() : "intersection";
    const name = names[index] || `${baseName}-${index + 1}`;
    env.coordinates[name] = roundPoint(point);
  });
  if (parsed.total) {
    env.variables[String(parsed.total).replace(/^\\/, "").trim()] = intersections.length;
  }
}

function addDecorationMarkers(item, options, ir) {
  const decoration = markingsDecorationFromOptions(options);
  if (!decoration) return;
  const mark = String(decoration).match(/mark\s*=\s*at\s+position\s+([0-9.]+)\s+with\s*\{([\s\S]+)\}/);
  const flat = flattenPath(item.commands || []);
  if (mark) {
    addArrowMarkerAt(Number(mark[1]), mark[2], flat, item, ir);
    return;
  }
  const between = String(decoration).match(
    /mark\s*=\s*between\s+positions\s+([0-9.]+)\s+and\s+([0-9.]+)\s+step\s+([0-9.]+)\s+with\s*\{([\s\S]+)\}/
  );
  if (!between) return;
  const start = Number(between[1]);
  const end = Number(between[2]);
  const step = Number(between[3]);
  for (let position = start; position <= end + 1e-9; position += step) {
    addArrowMarkerAt(position, between[4], flat, item, ir);
  }
}

function markingsDecorationFromOptions(options = {}) {
  const topLevelDecoration = options.decoration === undefined ? "" : String(options.decoration);
  if (topLevelDecoration.includes("markings")) return topLevelDecoration;
  const postaction = options.postaction === undefined ? "" : String(options.postaction);
  if (!postaction.includes("decorate")) return "";
  const postOptions = parseOptions(postaction);
  const nestedDecoration = postOptions.decoration === undefined ? "" : String(postOptions.decoration);
  return nestedDecoration.includes("markings") ? nestedDecoration : "";
}

function addArrowMarkerAt(position, body, flat, item, ir) {
  const arrow = String(body).match(/\\arrow\s*\{([^}]*)\}/);
  if (!arrow) return;
  const tip = createArrowTip(arrow[1].trim() || "to");
  const point = pointAtLength(flat, position);
  ir.items.push({
    type: "marker",
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
  });
}

function drawablePathStyle(style, styleHints = {}) {
  const merged = { ...style, ...styleHints };
  if ((merged.markerStart || merged.markerEnd) && merged.stroke === "none") merged.stroke = "black";
  return merged;
}

function pathShadingStyle(style = {}, semantic = {}) {
  const topColor = semantic["top color"];
  const bottomColor = semantic["bottom color"];
  if (topColor || bottomColor) {
    const top = normalizeColor(String(topColor || "white"));
    const bottom = normalizeColor(String(bottomColor || style.fill || "black"));
    return {
      shading: "axis",
      topColor: top,
      bottomColor: bottom,
      fill: bottom
    };
  }
  if (String(semantic.shading || "").trim() !== "ball") return {};
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
  if (style.markerStart || style.markerEnd || styleHints.markerStart || styleHints.markerEnd) return true;
  if (semantic["name path"] && style.stroke === "none" && style.fill === "none") return false;
  return style.stroke !== "none" || style.fill !== "none";
}
