import { circleToPath, flattenPath, pathIntersections, pointAtLength } from "./geometry.js";
import { evaluateMath, parseDimension, roundNumber, roundPoint, substituteTextVariables, substituteVariables } from "./math.js";
import {
  edgeStyleHintsFromOptions,
  normalizeColor,
  normalizeOptions,
  parseOptions,
  splitTopLevel,
  stripOuterBraces
} from "./options.js";
import { mathFallbackText, normalizeTikzText } from "./tex-text.js";
import { createArrowTip, TIKZ_UNIT } from "./tikz-metrics.js";

export function interpretTikz(ast, options = {}) {
  const diagnostics = [];
  const ir = { type: "drawing", items: [], coordinates: {} };

  for (const picture of ast.pictures || []) {
    const env = {
      variables: {},
      coordinates: ir.coordinates,
      nodes: {},
      styles: {},
      namedPaths: {},
      transform: identityTransform(),
      basis: parsePictureBasis(picture.options || {}),
      pictureOptions: picture.options || {}
    };
    for (const statement of picture.statements || []) {
      interpretStatement(statement, env, ir, diagnostics, options);
    }
  }

  return { ir, diagnostics };
}

function interpretStatement(statement, env, ir, diagnostics, options) {
  if (statement.type === "unsupported") {
    diagnostics.push(statement.diagnostic);
    return;
  }
  if (statement.type === "noop") {
    return;
  }
  if (statement.type === "foreach") {
    for (const values of expandForeachValues(statement.values, env)) {
      const childVariables = { ...env.variables };
      const valueText = stripOuterBraces(values.trim());
      const rawParts = splitTopLevel(valueText, "/").map((part) => stripOuterBraces(part.trim()));
      statement.variables.forEach((name, index) => {
        childVariables[name] = rawParts[index] ?? values.trim();
      });
      const childEnv = { ...env, variables: childVariables };
      for (const child of statement.body) interpretStatement(child, childEnv, ir, diagnostics, options);
    }
    return;
  }
  if (statement.type === "pgfmathsetmacro") {
    env.variables[statement.name] = evaluateMath(statement.expression, env.variables);
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
    env.coordinates[resolveDynamicName(statement.name, env)] = point;
    return;
  }
  if (statement.type === "tikzset") {
    env.styles = { ...env.styles, ...statement.styles };
    return;
  }
  if (statement.type === "matrix") {
    createMatrix(statement, env, ir);
    return;
  }
  if (statement.type === "pic") {
    createPic(statement, env, ir);
    return;
  }
  if (statement.type === "node") {
    createNode(statement, env, ir, diagnostics);
    return;
  }
  if (statement.type === "scope") {
    const scopedEnv = {
      ...env,
      transform: composeTransform(env.transform, statement.options, env),
      basis: composeBasis(env.basis, statement.options, env)
    };
    for (const child of statement.body) interpretStatement(child, scopedEnv, ir, diagnostics, options);
    return;
  }
  if (statement.type === "path") {
    interpretPathStatement(statement, env, ir, diagnostics);
  }
}

function interpretPathStatement(statement, env, ir, diagnostics) {
  const { style, semantic, options } = normalizeOptions(statement.command, statement.options, env);
  const pathOptions = { ...options, ...semantic };
  const subtype = semanticSubtype(pathOptions);

  if (semantic["name intersections"]) {
    materializeIntersections(semantic["name intersections"], env, diagnostics);
  }

  const built = buildPath(statement.path.segments, env, diagnostics, pathOptions);
  if (semantic["name path"]) {
    env.namedPaths[String(semantic["name path"]).trim()] = built.commands.length
      ? built.commands
      : built.shapes.flatMap((shape) => shape.commands || []);
  }

  const visible = isVisiblePath(statement.command, style, semantic, built.styleHints);
  if (visible) {
    for (const shape of built.shapes) {
      ir.items.push({
        ...shape,
        subtype: shape.subtype || subtype,
        style: { ...style, ...(shape.style || {}) }
      });
    }
    if (hasDrawableCommands(built.commands, built.shapes)) {
      const pathStyle = drawablePathStyle(style, built.styleHints);
      const item = {
        type: "path",
        subtype,
        style: pathStyle,
        commands: applyArrowEndpointShortening(built.commands, pathStyle, built.endpointRefs)
      };
      ir.items.push(item);
      addDecorationMarkers(item, options, ir);
    }
    for (const shape of built.shapes) {
      addDecorationMarkers(shape, options, ir);
    }
  }
  for (const node of built.nodes) {
    addNodeItems(node, ir, env);
  }
}

function buildPath(segments, env, diagnostics, pathOptions = {}) {
  const commands = [];
  const shapes = [];
  const nodes = [];
  const styleHints = {};
  const effectivePathOptions = { ...pathOptions };
  let current = null;
  let currentBase = null;
  let currentNodeRef = null;
  let start = null;
  let startNodeRef = null;
  let endNodeRef = null;
  let pending = null;
  let pendingInlineNodes = [];

  for (const segment of segments) {
    if (segment.kind === "operator") {
      pending = segment.value;
      continue;
    }
    if (segment.kind === "coordinate") {
      const point = segment.relative ? resolveRelativeCoordinate(segment.raw, current, env, diagnostics) : resolveCoordinate(segment.raw, env, diagnostics);
      const nodeRef = segment.relative ? null : defaultPathNodeReference(segment.raw, env);
      if (!current) {
        commands.push({ type: "moveTo", x: point.x, y: point.y });
        current = point;
        currentBase = point;
        currentNodeRef = nodeRef;
        start = point;
        startNodeRef = nodeRef;
        endNodeRef = nodeRef;
      } else if (pending === "grid") {
        shapes.push(...buildGrid(current, point, effectivePathOptions));
        current = point;
        currentBase = point;
        currentNodeRef = nodeRef;
        endNodeRef = nodeRef;
      } else if (pending === "rectangle") {
        commands.push({ type: "lineTo", x: point.x, y: current.y });
        commands.push({ type: "lineTo", x: point.x, y: point.y });
        commands.push({ type: "lineTo", x: current.x, y: point.y });
        commands.push({ type: "closePath" });
        current = point;
        currentBase = point;
        currentNodeRef = nodeRef;
        endNodeRef = nodeRef;
      } else if (pending === "--") {
        const clipped = clipNodeLineEndpoints(currentBase || current, currentNodeRef, point, nodeRef, env);
        if (currentNodeRef) updateCurrentMoveTo(commands, clipped.from);
        commands.push({ type: "lineTo", x: clipped.to.x, y: clipped.to.y });
        flushInlinePathNodes(pendingInlineNodes, clipped.from, clipped.to, nodes, env);
        pendingInlineNodes = [];
        current = clipped.to;
        currentBase = point;
        currentNodeRef = nodeRef;
        endNodeRef = nodeRef;
      } else {
        flushInlinePathNodes(pendingInlineNodes, current, current, nodes, env);
        pendingInlineNodes = [];
        commands.push({ type: "moveTo", x: point.x, y: point.y });
        current = point;
        currentBase = point;
        currentNodeRef = nodeRef;
        start = point;
        endNodeRef = nodeRef;
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
      Object.assign(styleHints, edgeStyleHintsFromOptions(segment.options, env));
      Object.assign(effectivePathOptions, edgePathOptions(segment.options));
      const clipped = clipNodeLineEndpoints(currentBase || current, currentNodeRef, to, toNodeRef, env);
      const curve = edgeCurveSpec(segment.options, clipped.from, clipped.to, env);
      if (curve) {
        if (currentNodeRef) updateCurrentMoveTo(commands, clipped.from);
        const distance = Math.hypot(clipped.to.x - clipped.from.x, clipped.to.y - clipped.from.y) / 2 || 1;
        const c1 = polarOffset(clipped.from, curve.out, distance);
        const c2 = polarOffset(clipped.to, curve.in, distance);
        commands.push({ type: "curveTo", x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y, x: clipped.to.x, y: clipped.to.y });
        flushInlinePathNodes(pendingInlineNodes, clipped.from, clipped.to, nodes, env);
      } else {
        if (currentNodeRef) updateCurrentMoveTo(commands, clipped.from);
        commands.push({ type: "lineTo", x: clipped.to.x, y: clipped.to.y });
        flushInlinePathNodes(pendingInlineNodes, clipped.from, clipped.to, nodes, env);
      }
      pendingInlineNodes = [];
      current = clipped.to;
      currentBase = to;
      currentNodeRef = toNodeRef;
      endNodeRef = toNodeRef;
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
      current = to;
      currentBase = to;
      currentNodeRef = null;
      continue;
    }
    if (segment.kind === "circle") {
      const center = current || applyTransform({ x: 0, y: 0 }, env.transform);
      const r = parseDimension(segment.radius, env.variables);
      shapes.push({
        type: "path",
        shape: "circle",
        subtype: semanticSubtype(pathOptions),
        cx: center.x,
        cy: center.y,
        r,
        commands: circleToPath(center.x, center.y, r),
        style: segment.options?.fill ? { fill: "black" } : {}
      });
      continue;
    }
    if (segment.kind === "ellipse" && current) {
      const [rxRaw, ryRaw] = segment.radius.split(/\s+and\s+/);
      const rx = parseDimension(segment.options?.["x radius"] || rxRaw, env.variables);
      const ry = parseDimension(segment.options?.["y radius"] || ryRaw || rxRaw, env.variables);
      shapes.push({
        type: "path",
        shape: "ellipse",
        cx: current.x,
        cy: current.y,
        rx,
        ry,
        commands: []
      });
      continue;
    }
    if (segment.kind === "arc" && current) {
      const arc = buildArc(current, segment.options, env);
      shapes.push(arc);
      current = arc.endPoint;
      continue;
    }
    if (segment.kind === "plot") {
      const plot = buildPlot(segment.coordinate, env, pathOptions);
      for (const command of plot) commands.push(command);
      current = plot.at(-1) ? { x: plot.at(-1).x, y: plot.at(-1).y } : current;
      currentBase = current;
      currentNodeRef = null;
      continue;
    }
    if (segment.kind === "node") {
      const text = substituteTextVariables(segment.text, env.variables);
      if (!segment.at && current && pending) {
        pendingInlineNodes.push({ ...segment, text });
        continue;
      }
      const point = segment.at ? resolveCoordinate(segment.at, env, diagnostics) : current || applyTransform({ x: 0, y: 0 }, env.transform);
      addInlinePathNode(segment, text, point, nodes, env);
      continue;
    }
    if (segment.kind === "close" && start) {
      commands.push({ type: "closePath" });
      current = start;
      endNodeRef = startNodeRef;
    }
  }

  flushInlinePathNodes(pendingInlineNodes, current, current, nodes, env);
  return {
    commands: applyPathMorphing(commands, effectivePathOptions, env),
    shapes,
    nodes,
    styleHints,
    endpointRefs: { start: startNodeRef, end: endNodeRef }
  };
}

function flushInlinePathNodes(pendingInlineNodes, from, to, nodes, env) {
  if (!pendingInlineNodes.length || !from || !to) return;
  const point = roundPoint({
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2
  });
  for (const segment of pendingInlineNodes) {
    addInlinePathNode(segment, segment.text, point, nodes, env);
  }
}

function addInlinePathNode(segment, text, point, nodes, env) {
  const size = estimateNodeLayoutSize(text, segment.options, env);
  if (segment.name) {
    const name = resolveDynamicName(segment.name, env);
    env.nodes[name] = { point, width: size.width, height: size.height, shape: nodeShape(segment.options) };
    env.coordinates[name] = point;
  }
  nodes.push({ at: point, text, options: segment.options, size });
}

function createNode(statement, env, ir, diagnostics) {
  const text = substituteTextVariables(statement.text, env.variables);
  const size = estimateNodeLayoutSize(text, statement.options, env);
  const point = resolveNodePoint(statement, env, diagnostics, size);
  const displayPoint = resolveNodeAnchorPoint(point, statement.options, text, env);
  const name = statement.name ? resolveDynamicName(statement.name, env) : null;
  const node = {
    at: point,
    text,
    options: statement.options,
    name,
    size
  };
  if (name) {
    env.nodes[name] = {
      point: displayPoint,
      width: size.width,
      height: size.height,
      shape: nodeShape(statement.options)
    };
    env.coordinates[name] = displayPoint;
  }
  addNodeItems(node, ir, env);
}

function createMatrix(statement, env, ir) {
  const name = statement.name ? resolveDynamicName(statement.name, env) : null;
  const matrixNodeOptions = statement.options?.nodes ? parseOptions(statement.options.nodes) : {};
  const rows = splitMatrixRows(statement.body)
    .map((row) => splitTopLevel(row, "&").map(parseMatrixCell).filter((cell) => cell.text.length || Object.keys(cell.options).length))
    .filter((row) => row.length);
  if (!rows.length) return;

  let cellWidth = 0.22;
  let cellHeight = 0.24;
  for (const row of rows) {
    for (const cell of row) {
      const size = estimateMatrixCellSize(cell.text, { ...matrixNodeOptions, ...cell.options }, env);
      cellWidth = Math.max(cellWidth, size.width);
      cellHeight = Math.max(cellHeight, size.height);
    }
  }

  const colSep = parseFiniteDimension(statement.options["column sep"], env, 0);
  const rowSep = parseFiniteDimension(statement.options["row sep"], env, 0);
  const stepX = Math.max(0.1, cellWidth + colSep);
  const stepY = Math.max(0.1, cellHeight + rowSep);
  const cols = Math.max(...rows.map((row) => row.length));
  const totalWidth = cellWidth + (cols - 1) * stepX;
  const totalHeight = cellHeight + (rows.length - 1) * stepY;
  const origin =
    resolvePositioning(statement.options || {}, env, { width: totalWidth, height: totalHeight }) ||
    applyTransform({ x: 0, y: 0 }, env.transform);
  const startX = origin.x - ((cols - 1) * stepX) / 2;
  const startY = origin.y + ((rows.length - 1) * stepY) / 2;

  if (name) {
    env.nodes[name] = { point: origin, width: roundNumber(totalWidth), height: roundNumber(totalHeight), shape: "rectangle" };
    env.coordinates[name] = origin;
  }

  rows.forEach((row, rowIndex) => {
    row.forEach((cell, columnIndex) => {
      if (!name) return;
      const cellName = `${name}-${rowIndex + 1}-${columnIndex + 1}`;
      const point = roundPoint({
        x: startX + columnIndex * stepX,
        y: startY - rowIndex * stepY
      });
      const options = {
        ...matrixNodeOptions,
        ...cell.options,
        "minimum width": `${cellWidth}`,
        "minimum height": `${cellHeight}`
      };
      env.nodes[cellName] = { point, width: cellWidth, height: cellHeight, shape: nodeShape(options) };
      env.coordinates[cellName] = point;
      if (cell.explicitName) {
        const explicitName = resolveDynamicName(cell.explicitName, env);
        env.nodes[explicitName] = { point, width: cellWidth, height: cellHeight, shape: nodeShape(options) };
        env.coordinates[explicitName] = point;
      }
      addNodeItems(
        { at: point, text: cell.text, options, name: cellName, size: { width: cellWidth, height: cellHeight }, fitTextToBox: true },
        ir,
        env
      );
    });
  });
}

function createPic(statement, env, ir) {
  const name = statement.name ? resolveDynamicName(statement.name, env) : null;
  const origin = resolvePositioning(statement.options || {}, env) || applyTransform({ x: 0, y: 0 }, env.transform);
  const cube = statement.body.match(/cube\s*=\s*\{([^}]*)\}/);
  if (!cube) return;
  const [widthRaw = "1", heightRaw = "1", depthRaw = "0.5"] = cube[1].split("/").map((part) => part.trim());
  const width = parseDimension(widthRaw, env.variables);
  const height = parseDimension(heightRaw, env.variables);
  const depth = parseDimension(depthRaw, env.variables);
  const skew = depth * 0.5;
  const points = {
    A: roundPoint({ x: origin.x - width - skew, y: origin.y }),
    B: roundPoint({ x: origin.x + width - skew, y: origin.y }),
    V: roundPoint({ x: origin.x + width, y: origin.y + height }),
    W: roundPoint({ x: origin.x + width, y: origin.y - height })
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

  const { style } = normalizeOptions("filldraw", statement.options || {}, env);
  const leftTop = { x: origin.x - width, y: origin.y + height };
  const rightTop = { x: origin.x + width, y: origin.y + height };
  const rightBottom = { x: origin.x + width, y: origin.y - height };
  const leftBottom = { x: origin.x - width, y: origin.y - height };
  const backLeftTop = { x: leftTop.x - depth, y: leftTop.y + skew };
  const backRightTop = { x: rightTop.x - depth, y: rightTop.y + skew };
  ir.items.push({
    type: "path",
    shape: "pic-cube",
    style,
    commands: [
      { type: "moveTo", x: leftBottom.x, y: leftBottom.y },
      { type: "lineTo", x: rightBottom.x, y: rightBottom.y },
      { type: "lineTo", x: rightTop.x, y: rightTop.y },
      { type: "lineTo", x: leftTop.x, y: leftTop.y },
      { type: "closePath" },
      { type: "moveTo", x: leftTop.x, y: leftTop.y },
      { type: "lineTo", x: backLeftTop.x, y: backLeftTop.y },
      { type: "lineTo", x: backRightTop.x, y: backRightTop.y },
      { type: "lineTo", x: rightTop.x, y: rightTop.y },
      { type: "closePath" }
    ].map((command) => ("x" in command ? { ...command, x: roundNumber(command.x), y: roundNumber(command.y) } : command))
  });
}

function addNodeItems(node, ir, env) {
  const { style, semantic } = normalizeOptions("node", node.options || {}, env);
  const point = resolveNodeAnchorPoint(node.at, node.options, node.text, env);
  const shape = nodeShape(node.options || {});
  const size = node.size || estimateNodeSize(node.text, node.options, env);
  const shadedFill =
    semantic.shading === "ball" ? normalizeColor(String(semantic["ball color"] || style.fill || "gray!30")) : null;
  const textStyle = {
    ...style,
    fill: style.textFill || semantic.text || "black",
    fontFamily: resolveFontFamily(node.options?.font || env.pictureOptions?.font)
  };
  if (style.fill !== "none" || style.stroke !== "none" || semantic.draw || shadedFill) {
    ir.items.push({
      type: "nodeBox",
      shape,
      x: point.x,
      y: point.y,
      width: size.width,
      height: size.height,
      rx: nodeCornerRadius(shape, semantic, size),
      parts: shape === "rectangleSplit" ? rectangleSplitParts(semantic) : undefined,
      partFills: shape === "rectangleSplit" ? rectangleSplitPartFills(semantic) : undefined,
      style: {
        stroke: semantic.draw || style.stroke !== "none" ? style.stroke || "black" : "none",
        fill: shadedFill || style.fill,
        lineWidth: style.lineWidth || 1,
        dashArray: style.dashArray,
        opacity: style.opacity,
        fillOpacity: style.fillOpacity,
        strokeOpacity: style.strokeOpacity
      }
    });
  }
  ir.items.push({
    type: "textNode",
    x: point.x,
    y: point.y,
    text: node.text,
    style: textStyle,
    fitBox: node.fitTextToBox ? { width: size.width, height: size.height } : undefined
  });
}

function resolveNodePoint(statement, env, diagnostics, selfSize) {
  if (statement.at) return resolveCoordinate(statement.at, env, diagnostics);
  const positioning = resolvePositioning(statement.options || {}, env, selfSize);
  if (positioning) return positioning;
  return applyTransform({ x: 0, y: 0 }, env.transform);
}

function resolvePositioning(options, env, selfSize = { width: 0, height: 0 }) {
  const legacy = resolveLegacyPositioning(options, env);
  if (legacy) return legacy;
  const entries = Object.entries(options || {});
  for (const [key, value] of entries) {
    const direction = key.trim();
    if (!["right", "left", "above", "below", "above right", "above left", "below right", "below left"].includes(direction)) {
      continue;
    }
    const text = String(value === true ? "" : value).trim();
    const match = text.match(/^(?:(.+?)\s+)?of\s+(.+)$/);
    if (!match) continue;
    const distance = match[1] ? parseDimension(match[1], env.variables) : defaultPositioningDistance(env);
    const reference = resolvePositioningReference(match[2], env);
    if (!reference) continue;
    const dx = positioningDelta(direction, "x", distance, reference, selfSize);
    const dy = positioningDelta(direction, "y", distance, reference, selfSize);
    return roundPoint({ x: reference.point.x + dx, y: reference.point.y + dy });
  }
  return null;
}

function defaultPositioningDistance(env) {
  return parseDimension(env.pictureOptions?.["node distance"] || "0.6", env.variables);
}

function positioningDelta(direction, axis, distance, reference, selfSize) {
  if (axis === "x") {
    if (direction.includes("right")) return reference.width / 2 + selfSize.width / 2 + distance;
    if (direction.includes("left")) return -(reference.width / 2 + selfSize.width / 2 + distance);
    return 0;
  }
  if (direction.includes("above")) return reference.height / 2 + selfSize.height / 2 + distance;
  if (direction.includes("below")) return -(reference.height / 2 + selfSize.height / 2 + distance);
  return 0;
}

function resolveLegacyPositioning(options, env) {
  const directions = {
    "right of": "right",
    "left of": "left",
    "above of": "above",
    "below of": "below"
  };
  for (const [key, direction] of Object.entries(directions)) {
    if (!Object.hasOwn(options, key)) continue;
    const target = resolveReferencePoint(options[key], env);
    if (!target) continue;
    const distance = parseDimension(options["node distance"] || env.pictureOptions?.["node distance"] || 1, env.variables);
    return roundPoint({
      x: target.x + (direction === "right" ? distance : direction === "left" ? -distance : 0),
      y: target.y + (direction === "above" ? distance : direction === "below" ? -distance : 0)
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
    return { point: node.point, width: node.width || 0, height: node.height || 0 };
  }
  if (Object.hasOwn(env.coordinates, text)) return { point: env.coordinates[text], width: 0, height: 0 };
  const anchored = resolveAnchoredNodeCoordinate(text, env);
  if (anchored) return { point: anchored, width: 0, height: 0 };
  if (text.startsWith("$") || text.includes(",") || /^-?\d/.test(text)) {
    return { point: resolveCoordinate(text, env, []), width: 0, height: 0 };
  }
  return null;
}

function resolveNodeAnchorPoint(point, options = {}, text = "", env = { variables: {} }) {
  const size = estimateNodeLayoutSize(text, options, env);
  const sep = parseDimension(options["inner sep"] || options["outer sep"] || "0.08", env.variables);
  const shift = nodeAnchorShift(options, size, sep, env);
  const explicitShift = nodeExplicitShift(options, env);
  return roundPoint({
    x: point.x + shift.x + explicitShift.x,
    y: point.y + shift.y + explicitShift.y
  });
}

function nodeAnchorShift(options = {}, size, sep, env) {
  const direction = nodeDirection(options);
  if (direction) {
    const distance = nodeDirectionDistance(options[direction], sep, env);
    return {
      x: direction.includes("right") ? size.width / 2 + distance : direction.includes("left") ? -(size.width / 2 + distance) : 0,
      y: direction.includes("above") ? size.height / 2 + distance : direction.includes("below") ? -(size.height / 2 + distance) : 0
    };
  }

  const anchor = String(options.anchor || "").trim();
  if (!anchor) return { x: 0, y: 0 };
  return {
    x: anchor.includes("west") ? size.width / 2 + sep : anchor.includes("east") ? -(size.width / 2 + sep) : 0,
    y: anchor.includes("south") ? size.height / 2 + sep : anchor.includes("north") ? -(size.height / 2 + sep) : 0
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
  const parsed = parseDimension(value, env.variables);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function defaultPathNodeReference(raw, env) {
  let text = substituteTextVariables(String(raw || "").trim(), env.variables);
  text = text.replace(/^\{([\s\S]*)\}$/, "$1").trim();
  if (text.startsWith("(") && text.endsWith(")")) text = text.slice(1, -1).trim();
  const shifted = parseCoordinateOptionPrefix(text, env);
  if (shifted) text = shifted.coordinate;
  if (!text || text.startsWith("$") || text.includes(",") || /^-?\d/.test(text)) return null;
  const anchored = text.match(/^(.+)\.([^.]+)$/);
  if (anchored) {
    const name = resolveDynamicName(anchored[1], env);
    const node = env.nodes[name];
    return node ? { name, node, mode: "anchor" } : null;
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

function updateCurrentMoveTo(commands, point) {
  const command = commands.at(-1);
  if (command?.type === "moveTo") {
    command.x = point.x;
    command.y = point.y;
  }
}

function edgePathOptions(options = {}) {
  const picked = {};
  if (Object.hasOwn(options, "decorate")) picked.decorate = options.decorate;
  if (Object.hasOwn(options, "decoration")) picked.decoration = options.decoration;
  return picked;
}

function edgeCurveSpec(options = {}, from, to, env) {
  if (Object.hasOwn(options, "out") || Object.hasOwn(options, "in")) {
    return {
      out: parseAngleOption(options.out, 0, env),
      in: parseAngleOption(options.in, 180, env)
    };
  }
  if (Object.hasOwn(options, "bend left")) return bendCurveSpec(options["bend left"], 1, from, to, env);
  if (Object.hasOwn(options, "bend right")) return bendCurveSpec(options["bend right"], -1, from, to, env);
  return null;
}

function bendCurveSpec(value, direction, from, to, env) {
  const angle = parseAngleOption(value, 30, env);
  const base = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
  return {
    out: base + direction * angle,
    in: base + 180 - direction * angle
  };
}

function parseAngleOption(value, fallback, env) {
  if (value === true || value === undefined || value === null || value === "") return fallback;
  const angle = evaluateMath(value, env.variables);
  return Number.isFinite(angle) ? angle : fallback;
}

function applyArrowEndpointShortening(commands, style = {}, endpointRefs = {}) {
  if (!commands.length || (!style.markerStart && !style.markerEnd)) return commands;
  const adjusted = commands.map((command) => ({ ...command }));
  if (style.markerStart && endpointRefs.start) shortenPathStart(adjusted, arrowInset(style.markerStart));
  if (style.markerEnd && endpointRefs.end) shortenPathEnd(adjusted, arrowInset(style.markerEnd));
  return adjusted;
}

function arrowInset(tip) {
  const normalized = typeof tip === "string" ? createArrowTip(tip === "arrow" ? "to" : tip) : createArrowTip(tip?.kind, tip || {});
  const length = Number(normalized.length) || 0;
  return Math.max(0, (length / TIKZ_UNIT) * 0.9);
}

function shortenPathStart(commands, inset) {
  if (inset <= 0) return;
  const startIndex = commands.findIndex((command) => command.type === "moveTo");
  if (startIndex === -1) return;
  const start = commandPoint(commands[startIndex]);
  const next = commands.slice(startIndex + 1).find((command) => commandHasEndPoint(command));
  if (!next) return;
  const toward = startTangentPoint(next);
  const adjusted = movePointToward(start, toward, inset);
  commands[startIndex].x = adjusted.x;
  commands[startIndex].y = adjusted.y;
}

function shortenPathEnd(commands, inset) {
  if (inset <= 0) return;
  for (let index = commands.length - 1; index >= 0; index -= 1) {
    const command = commands[index];
    if (!commandHasEndPoint(command)) continue;
    const previous = previousPathPoint(commands, index);
    if (!previous) return;
    const toward = endTangentPoint(command, previous);
    const adjusted = movePointToward(commandPoint(command), toward, inset);
    command.x = adjusted.x;
    command.y = adjusted.y;
    return;
  }
}

function commandHasEndPoint(command) {
  return command && command.type !== "moveTo" && typeof command.x === "number" && typeof command.y === "number";
}

function commandPoint(command) {
  return { x: command.x, y: command.y };
}

function startTangentPoint(command) {
  if (command.type === "curveTo") return { x: command.x1, y: command.y1 };
  if (command.type === "quadTo") return { x: command.x1, y: command.y1 };
  return commandPoint(command);
}

function endTangentPoint(command, previous) {
  if (command.type === "curveTo") return { x: command.x2, y: command.y2 };
  if (command.type === "quadTo") return { x: command.x1, y: command.y1 };
  return previous;
}

function previousPathPoint(commands, beforeIndex) {
  let current = null;
  let subpathStart = null;
  for (let index = 0; index < beforeIndex; index += 1) {
    const command = commands[index];
    if (command.type === "moveTo") {
      current = commandPoint(command);
      subpathStart = current;
    } else if (commandHasEndPoint(command)) {
      current = commandPoint(command);
    } else if (command.type === "closePath" && subpathStart) {
      current = subpathStart;
    }
  }
  return current;
}

function movePointToward(point, toward, distance) {
  const dx = toward.x - point.x;
  const dy = toward.y - point.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-12) return roundPoint(point);
  const step = Math.min(distance, length * 0.8);
  return roundPoint({
    x: point.x + (dx / length) * step,
    y: point.y + (dy / length) * step
  });
}

function nodeBorderPoint(node, center, toward, env) {
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1e-12) return roundPoint(center);
  const scale = Number.isFinite(env.transform?.scale) ? Math.abs(env.transform.scale) : 1;
  const halfWidth = ((Number(node.width) || 0) * scale) / 2;
  const halfHeight = ((Number(node.height) || 0) * scale) / 2;
  if (halfWidth <= 0 || halfHeight <= 0) return roundPoint(center);
  if (node.shape === "circle") {
    const radius = Math.max(halfWidth, halfHeight);
    return roundPoint({ x: center.x + (dx / distance) * radius, y: center.y + (dy / distance) * radius });
  }
  if (node.shape === "ellipse") {
    const factor = 1 / Math.sqrt((dx * dx) / (halfWidth * halfWidth) + (dy * dy) / (halfHeight * halfHeight));
    return roundPoint({ x: center.x + dx * factor, y: center.y + dy * factor });
  }
  const xScale = Math.abs(dx) > 1e-12 ? halfWidth / Math.abs(dx) : Number.POSITIVE_INFINITY;
  const yScale = Math.abs(dy) > 1e-12 ? halfHeight / Math.abs(dy) : Number.POSITIVE_INFINITY;
  const factor = Math.min(xScale, yScale);
  if (!Number.isFinite(factor)) return roundPoint(center);
  return roundPoint({ x: center.x + dx * factor, y: center.y + dy * factor });
}

function nodeShape(options = {}) {
  if (options["rectangle split"]) return "rectangleSplit";
  if (options.circle || options.shape === "circle") return "circle";
  if (options.ellipse || options.shape === "ellipse") return "ellipse";
  if (options["rounded rectangle"] || options.shape === "rounded rectangle") return "roundedRectangle";
  return "rectangle";
}

function nodeCornerRadius(shape, semantic, size) {
  if (shape === "roundedRectangle") return roundNumber(Math.min(size.width, size.height) * 0.45);
  if (semantic["rounded corners"]) return 0.08;
  return 0;
}

function resolveFontFamily(raw) {
  const text = String(raw || "").trim();
  if (!text) return undefined;
  if (/\\(?:tt|ttfamily|texttt)\b|monospace/i.test(text)) {
    return "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace";
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

function estimateMatrixCellSize(text, options = {}, env = { variables: {} }) {
  const hasExplicitSize =
    options["minimum width"] || options["minimum height"] || options["minimum size"] || options["text width"];
  if (hasExplicitSize || options.circle || options.shape === "circle") return estimateNodeSize(text, options, env);

  const normalized = normalizeTikzText(text);
  if (normalized.kind === "image") return estimateNodeSize(text, options, env);

  const lines = textMetricLines(normalized);
  const scale = normalized.scale || 1;
  const innerSep = parseDimension(options["inner sep"] ?? "0.03", env.variables);
  const maxLineLength = Math.max(...lines.map((line) => line.trim().length), 0);
  const width = Math.max(0.22, maxLineLength * 0.12 * scale + 0.08 + innerSep * 2);
  const height = Math.max(0.24, lines.length * 0.22 * scale + innerSep * 2);

  return { width: roundNumber(width), height: roundNumber(height) };
}

function estimateNodeLayoutSize(text, options = {}, env = { variables: {} }) {
  if (nodeUsesBoxSizing(options, env)) return estimateNodeSize(text, options, env);
  return estimateCompactTextSize(text, options, env);
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

function estimateCompactTextSize(text, options = {}, env = { variables: {} }) {
  const normalized = normalizeTikzText(text);
  if (normalized.kind === "image") return estimateNodeSize(text, options, env);

  const lines = textMetricLines(normalized);
  const scale = normalized.scale || 1;
  const innerSep = parseDimension(options["inner sep"] ?? "0.08", env.variables);
  const maxLineLength = Math.max(...lines.map((line) => line.trim().length), 0);
  const width = Math.max(0.08, maxLineLength * 0.13 * scale + innerSep * 2);
  const height = Math.max(0.08, lines.length * 0.18 * scale + innerSep * 2);

  return { width: roundNumber(width), height: roundNumber(height) };
}

function estimateNodeSize(text, options = {}, env = { variables: {} }) {
  const normalized = normalizeTikzText(text);
  if (normalized.kind === "image") {
    return {
      width: roundNumber(normalized.width),
      height: roundNumber(normalized.height)
    };
  }
  const lines = textMetricLines(normalized);
  const scale = normalized.scale || 1;
  const innerSep = parseDimension(options["inner sep"] ?? "0.08", env.variables);
  const isEmptyCircle = (options.circle || options.shape === "circle") && lines.every((line) => !line.trim());
  let width = isEmptyCircle
    ? Math.max(0.04, innerSep * 2)
    : Math.max(0.5, Math.max(...lines.map((line) => line.length), 0) * 0.16 * scale + 0.35 + innerSep * 2);
  let height = isEmptyCircle ? width : Math.max(0.35, lines.length * 0.35 * scale + innerSep * 2);
  if (options["minimum width"]) width = Math.max(width, parseDimension(options["minimum width"], env.variables));
  if (options["minimum height"]) height = Math.max(height, parseDimension(options["minimum height"], env.variables));
  if (options["text width"]) width = Math.max(width, parseDimension(options["text width"], env.variables));
  if (options["minimum size"]) {
    const size = parseDimension(options["minimum size"], env.variables);
    width = Math.max(width, size);
    height = Math.max(height, size);
  }
  if (options["rectangle split"] && options["rectangle split horizontal"]) {
    const parts = Number(options["rectangle split parts"] || 1);
    const count = Number.isFinite(parts) && parts > 0 ? Math.round(parts) : 1;
    width = Math.max(width, height * count * 0.45);
  }
  if (options.circle || options.shape === "circle") {
    const diameter = Math.max(width, height);
    width = diameter;
    height = diameter;
  }
  return { width: roundNumber(width), height: roundNumber(height) };
}

function textMetricLines(normalized) {
  const rawLines = normalized.lines.length ? normalized.lines : String(normalized.text || "").split(/\\\\|\n/);
  return rawLines.map((line) => {
    const text = String(line).trim();
    if (/^\$[\s\S]*\$$/.test(text) || /^\\\([\s\S]*\\\)$/.test(text)) return mathFallbackText(text);
    return text.replace(/\$([^$]+)\$/g, (_match, tex) => mathFallbackText(tex));
  });
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

function buildGrid(from, to, pathOptions) {
  const step = parseDimension(pathOptions.step || 1);
  const lines = [];
  const minX = Math.min(from.x, to.x);
  const maxX = Math.max(from.x, to.x);
  const minY = Math.min(from.y, to.y);
  const maxY = Math.max(from.y, to.y);
  for (let x = Math.ceil(minX / step) * step; x <= maxX + 1e-9; x += step) {
    lines.push({
      type: "path",
      subtype: semanticSubtype(pathOptions) || "grid-line",
      commands: [
        { type: "moveTo", x: roundNumber(x), y: minY },
        { type: "lineTo", x: roundNumber(x), y: maxY }
      ]
    });
  }
  for (let y = Math.ceil(minY / step) * step; y <= maxY + 1e-9; y += step) {
    lines.push({
      type: "path",
      subtype: semanticSubtype(pathOptions) || "grid-line",
      commands: [
        { type: "moveTo", x: minX, y: roundNumber(y) },
        { type: "lineTo", x: maxX, y: roundNumber(y) }
      ]
    });
  }
  return lines;
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
  if (!pathOptions.decorate || !String(pathOptions.decoration || "").includes("snake")) return commands;
  const decoration = parseOptions(String(pathOptions.decoration || ""));
  if (!decoration.snake) return commands;
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
      appendSnakeLine(morphed, current, { x: command.x, y: command.y }, amplitude, segmentLength);
      current = { x: command.x, y: command.y };
      continue;
    }
    if (command.type === "curveTo" && current) {
      appendSnakeCurve(morphed, current, command, amplitude, segmentLength);
      current = { x: command.x, y: command.y };
      continue;
    }
    if (command.type === "closePath" && current && start) {
      appendSnakeLine(morphed, current, start, amplitude, segmentLength);
      morphed.push(command);
      current = start;
      continue;
    }
    morphed.push(command);
    if ("x" in command) current = { x: command.x, y: command.y };
  }
  return morphed;
}

function appendSnakeLine(commands, from, to, amplitude, segmentLength) {
  appendSnakePolyline(commands, [from, to], amplitude, segmentLength);
}

function appendSnakeCurve(commands, from, curve, amplitude, segmentLength) {
  const flat = flattenPath([{ type: "moveTo", x: from.x, y: from.y }, curve], 0.04);
  appendSnakePolyline(commands, flat, amplitude, segmentLength);
}

function appendSnakePolyline(commands, points, amplitude, segmentLength) {
  const length = polylineLength(points);
  const to = points.at(-1);
  if (!to) return;
  if (length < 1e-12 || amplitude <= 0) {
    commands.push({ type: "lineTo", x: to.x, y: to.y });
    return;
  }
  const cycles = Math.max(1, Math.round(length / segmentLength));
  const steps = Math.max(4, cycles * 8);
  for (let index = 1; index <= steps; index += 1) {
    const sample = pointOnPolyline(points, (length * index) / steps);
    const offset = index === steps ? 0 : amplitude * Math.sin((sample.walked / segmentLength) * Math.PI * 2);
    commands.push({
      type: "lineTo",
      x: roundNumber(sample.x + sample.normal.x * offset),
      y: roundNumber(sample.y + sample.normal.y * offset)
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
  if (options["axis mark"]) return "axis-mark";
  if (options["axis frame"]) return "axis-frame";
  if (options["axis grid"]) return "axis-grid-line";
  if (options["axis line"]) return "axis-line";
  if (options["axis plot"]) return "axis-plot";
  if (options["axis legend"]) return "axis-legend";
  return undefined;
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
  const scale = evaluateMath(options.scale || 1, env.variables);
  const shift = parseShift(options.shift || options.xshift || options.yshift, env);
  return multiplyTransforms(parent, {
    a: scale,
    b: 0,
    c: 0,
    d: scale,
    x: shift.x,
    y: shift.y,
    scale
  });
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

export function resolveCoordinate(raw, env, diagnostics = []) {
  let text = substituteTextVariables(String(raw).trim(), env.variables);
  text = text.replace(/^\{([\s\S]*)\}$/, "$1").trim();
  if (/^\+\(.+\)$/.test(text)) text = text.slice(1);
  if (text.startsWith("(") && text.endsWith(")")) text = text.slice(1, -1).trim();

  const shifted = parseCoordinateOptionPrefix(text, env);
  if (shifted) {
    const point = resolveCoordinate(shifted.coordinate, env, diagnostics);
    return roundPoint({
      x: point.x + shifted.shift.x,
      y: point.y + shifted.shift.y
    });
  }

  if (text.startsWith("$") && text.endsWith("$")) {
    return applyTransform(resolveCalc(text.slice(1, -1).trim(), env, diagnostics), env.transform);
  }
  if (Object.hasOwn(env.coordinates, text)) {
    return applyTransform(env.coordinates[text], env.transform);
  }
  if (Object.hasOwn(env.nodes, text)) {
    return applyTransform(env.nodes[text].point, env.transform);
  }
  const anchored = resolveAnchoredNodeCoordinate(text, env);
  if (anchored) {
    return applyTransform(anchored, env.transform);
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
      x: parseDimension(comma[0], env.variables),
      y: parseDimension(comma[1], env.variables)
    }), env.transform);
  }
  diagnostics.push({ severity: "warning", message: `Unknown coordinate ${raw}` });
  return { x: 0, y: 0 };
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
  const dot = text.lastIndexOf(".");
  if (dot <= 0 || dot === text.length - 1) return null;
  const name = text.slice(0, dot).trim();
  const anchor = text.slice(dot + 1).trim();
  const node = env.nodes[name];
  if (node) return nodeAnchorCoordinate(node, anchor);
  if (Object.hasOwn(env.coordinates, name)) return env.coordinates[name];
  return null;
}

function nodeAnchorCoordinate(node, anchorRaw) {
  const anchor = String(anchorRaw || "center").trim().toLowerCase().replace(/-/g, " ");
  const width = Number(node.width) || 0;
  const height = Number(node.height) || 0;
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  if (!anchor || ["center", "base", "mid"].includes(anchor)) return roundPoint(node.point);
  const angle = Number(anchor);
  if (Number.isFinite(angle)) {
    return angleAnchor(node, angle, halfWidth, halfHeight);
  }
  let x = node.point.x;
  let y = node.point.y;
  if (anchor.includes("east")) x += halfWidth;
  if (anchor.includes("west")) x -= halfWidth;
  if (anchor.includes("north")) y += halfHeight;
  if (anchor.includes("south")) y -= halfHeight;
  return roundPoint({ x, y });
}

function angleAnchor(node, angle, halfWidth, halfHeight) {
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  if (node.shape === "circle") {
    const radius = Math.max(halfWidth, halfHeight);
    return roundPoint({ x: node.point.x + cos * radius, y: node.point.y + sin * radius });
  }
  const xScale = Math.abs(cos) > 1e-12 ? halfWidth / Math.abs(cos) : Number.POSITIVE_INFINITY;
  const yScale = Math.abs(sin) > 1e-12 ? halfHeight / Math.abs(sin) : Number.POSITIVE_INFINITY;
  const scale = Math.min(xScale, yScale);
  if (!Number.isFinite(scale)) return roundPoint(node.point);
  return roundPoint({ x: node.point.x + cos * scale, y: node.point.y + sin * scale });
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
    const offset = resolveCoordinate(interpolationPlusOffset[5], env, diagnostics);
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
    const right = addition.right.includes("!") ? resolveCalc(addition.right, env, diagnostics) : resolveCoordinate(addition.right, env, diagnostics);
    return roundPoint({
      x: left.x + addition.sign * right.x,
      y: left.y + addition.sign * right.y
    });
  }

  return resolveCoordinate(text, env, diagnostics);
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
  const decoration = options.decoration;
  if (!options.postaction || !String(options.postaction).includes("decorate") || !decoration) return;
  if (!String(decoration).includes("markings")) return;
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

function addArrowMarkerAt(position, body, flat, item, ir) {
  const arrow = String(body).match(/\\arrow\s*\{([^}]*)\}/);
  if (!arrow) return;
  const tip = createArrowTip(arrow[1].trim() || "to");
  const point = pointAtLength(flat, position);
  ir.items.push({
    type: "marker",
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

function isVisiblePath(command, style, semantic, styleHints = {}) {
  if (command === "draw" || command === "fill") return true;
  if (style.markerStart || style.markerEnd || styleHints.markerStart || styleHints.markerEnd) return true;
  if (semantic["name path"] && style.stroke === "none" && style.fill === "none") return false;
  return style.stroke !== "none" || style.fill !== "none";
}
