import { evaluateMath, roundNumber } from "../math.js";
import { splitTopLevel } from "../options.js";

const DEFAULT_Z_VECTOR = { x: -0.385, y: -0.385 };
const INSET = 0.02;
const EDGE_STYLE = "line width=0.3mm,tikz-cnn-edge";

export const tikzCnnExtension = {
  name: "tikz-cnn",
  phase: "preprocess",
  description: "Expands jettan/tikz_cnn networkLayer commands into ordinary TikZ layer boxes.",
  commands: ["networkLayer"],
  preprocess(source, context = {}) {
    return expandTikzCnn(source, context.diagnostics || []);
  }
};

export function expandTikzCnn(source, diagnostics = []) {
  const state = { totalOffset: 0, layerIndex: 0 };
  let output = "";
  let index = 0;
  const text = String(source);
  while (index < text.length) {
    if (!text.startsWith("\\networkLayer", index) || /[A-Za-z@]/.test(text[index + "\\networkLayer".length] || "")) {
      output += text[index];
      index += 1;
      continue;
    }
    const parsed = parseNetworkLayer(text, index, state, diagnostics);
    output += parsed?.body ?? text[index];
    index = parsed?.end ?? index + 1;
  }
  return output;
}

function parseNetworkLayer(source, start, state, diagnostics) {
  let cursor = start + "\\networkLayer".length;
  const args = [];
  for (let argIndex = 0; argIndex < 9; argIndex += 1) {
    cursor = skipWhitespace(source, cursor);
    const arg = extractBalanced(source, cursor, "{", "}");
    if (!arg) {
      diagnostics.push({ severity: "warning", message: "Malformed \\networkLayer command" });
      return { body: "", end: cursor };
    }
    args.push(arg.content.trim());
    cursor = arg.end;
  }
  return {
    body: renderNetworkLayer(args, state),
    end: cursor
  };
}

function renderNetworkLayer(args, state) {
  const [hwRaw, depthRaw, xOffsetRaw, yOffsetRaw, zOffsetRaw, styleRaw, labelRaw, nameRaw, linksRaw] = args;
  const hw = numberExpression(hwRaw, 1);
  const depth = numberExpression(depthRaw, 0.25);
  const xOffset = numberExpression(xOffsetRaw, 0);
  const yOffset = numberExpression(yOffsetRaw, 0);
  const zOffset = numberExpression(zOffsetRaw, 0);
  const style = stripOuterBraces(styleRaw).trim();
  const label = stripOuterBraces(labelRaw).trim();
  const name = stripOuterBraces(nameRaw).trim();
  if (name === "start") state.totalOffset = 0;
  const currentOffset = state.totalOffset + xOffset;
  state.totalOffset = currentOffset + depth;
  state.layerIndex += 1;

  const id = safeId(name || `tikzcnn${state.layerIndex}`);
  const prefix = `tikzcnn-${state.layerIndex}`;
  const point = (x, z, y) => projectPoint(x, z, y);
  const named = {
    front: point(currentOffset + depth, zOffset, yOffset),
    back: point(currentOffset, zOffset, yOffset),
    top: point(currentOffset + depth / 2, zOffset + hw / 2, yOffset),
    bottom: point(currentOffset + depth / 2, zOffset - hw / 2, yOffset)
  };
  const corners = {
    blr: point(depth + currentOffset, -hw / 2 + zOffset, -hw / 2 + yOffset),
    bur: point(depth + currentOffset, hw / 2 + zOffset, -hw / 2 + yOffset),
    bul: point(currentOffset, hw / 2 + zOffset, -hw / 2 + yOffset),
    fll: point(currentOffset, -hw / 2 + zOffset, hw / 2 + yOffset),
    flr: point(depth + currentOffset, -hw / 2 + zOffset, hw / 2 + yOffset),
    fur: point(depth + currentOffset, hw / 2 + zOffset, hw / 2 + yOffset),
    ful: point(currentOffset, hw / 2 + zOffset, hw / 2 + yOffset)
  };

  const lines = [];
  for (const [key, value] of Object.entries(corners)) {
    lines.push(`\\coordinate (${prefix}-${key}) at ${coord(value)};`);
  }
  for (const [key, value] of Object.entries(named)) {
    lines.push(`\\coordinate (${prefix}-${key}) at ${coord(value)};`);
    if (name) lines.push(`\\coordinate (${id}_${key}) at (${prefix}-${key});`);
  }

  const backTarget = name ? `${id}_back` : `${prefix}-back`;
  for (const link of parseConnectionTargets(linksRaw)) {
    lines.push(`\\draw[line width=0.3mm,tikz-cnn-connection] (${link}) -- (${backTarget});`);
  }

  lines.push(`\\draw[${EDGE_STYLE}] (${prefix}-blr) -- (${prefix}-bur) -- (${prefix}-bul);`);
  const labelNode = label ? ` node[midway,below] {${label}}` : "";
  lines.push(
    `\\draw[${EDGE_STYLE}] (${prefix}-fll) -- (${prefix}-flr)${labelNode} -- (${prefix}-fur) -- (${prefix}-ful) -- (${prefix}-fll);`
  );
  lines.push(`\\draw[${EDGE_STYLE}] (${prefix}-blr) -- (${prefix}-flr);`);
  lines.push(`\\draw[${EDGE_STYLE}] (${prefix}-bur) -- (${prefix}-fur);`);
  lines.push(`\\draw[${EDGE_STYLE}] (${prefix}-bul) -- (${prefix}-ful);`);

  if (style) {
    const faceStyle = `${style},tikz-cnn-face`;
    lines.push(
      `\\filldraw[${faceStyle}] ${offset3(corners.fll, INSET, INSET, 0)} -- ${offset3(
        corners.flr,
        -INSET,
        INSET,
        0
      )} -- ${offset3(corners.fur, -INSET, -INSET, 0)} -- ${offset3(corners.ful, INSET, -INSET, 0)} -- cycle;`
    );
    lines.push(
      `\\filldraw[${faceStyle}] ${offset3(corners.ful, INSET, 0, -INSET)} -- ${offset3(
        corners.fur,
        -INSET,
        0,
        -INSET
      )} -- ${offset3(corners.bur, -INSET, 0, INSET)} -- ${offset3(corners.bul, INSET, 0, INSET)} -- cycle;`
    );
    lines.push(
      `\\filldraw[${faceStyle}] ${offset3(corners.flr, 0, INSET, -INSET)} -- ${offset3(
        corners.blr,
        0,
        INSET,
        INSET
      )} -- ${offset3(corners.bur, 0, -INSET, INSET)} -- ${offset3(corners.fur, 0, -INSET, -INSET)} -- cycle;`
    );
  }

  return lines.join("\n");
}

function parseConnectionTargets(raw) {
  const text = stripOuterBraces(raw).trim();
  if (!text) return [];
  return splitTopLevel(text, ",").map((part) => stripOuterBraces(part).trim()).filter(Boolean);
}

function numberExpression(value, fallback) {
  const parsed = evaluateMath(stripOuterBraces(value), {});
  return Number.isFinite(parsed) ? parsed : fallback;
}

function projectPoint(x, z, y) {
  return {
    x: roundNumber(x + y * DEFAULT_Z_VECTOR.x),
    y: roundNumber(z + y * DEFAULT_Z_VECTOR.y)
  };
}

function coord(point) {
  return `(${fmt(point.x)},${fmt(point.y)})`;
}

function offset3(point, dx, dz, dy) {
  return coord({
    x: point.x + dx + dy * DEFAULT_Z_VECTOR.x,
    y: point.y + dz + dy * DEFAULT_Z_VECTOR.y
  });
}

function safeId(name) {
  return String(name).trim().replace(/[^A-Za-z0-9_.:-]+/g, "-") || "tikzcnn";
}

function stripOuterBraces(value) {
  let text = String(value ?? "").trim();
  while (text.startsWith("{") && text.endsWith("}")) {
    const parsed = extractBalanced(text, 0, "{", "}");
    if (!parsed || parsed.end !== text.length) break;
    text = parsed.content.trim();
  }
  return text;
}

function fmt(value) {
  return String(roundNumber(value, 6));
}

function skipWhitespace(text, index) {
  let cursor = index;
  while (/\s/.test(text[cursor] || "")) cursor += 1;
  return cursor;
}

function extractBalanced(text, start, open, close) {
  if (text[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (char === open) depth += 1;
    if (char === close) depth -= 1;
    if (depth === 0) {
      return {
        content: text.slice(start + 1, index),
        start,
        end: index + 1
      };
    }
  }
  return null;
}
