import { flattenPath, pathLength, pointAtDistance } from "../../engine/geometry.js";
import { evaluateMath, parseDimension, roundNumber, substituteVariables } from "../../engine/math.js";
import {
  edgeStyleHintsFromOptions,
  findTopLevel,
  parseArrowTipSpec,
  parseOptions,
  splitTopLevel,
  stripOuterBraces
} from "../../engine/options.js";
import { createMarkerShape } from "../../scene/index.js";

const EPSILON = 1e-9;
const DIMENSION_UNIT = /(?:cm|mm|pt|em|ex|in|px)\b/i;

export function markingItemsForPath(item, options = {}, env = {}) {
  const points = flattenPath(item.commands || []);
  const total = pathLength(points);
  if (points.length < 2 || total <= EPSILON) return [];

  const markers = [];
  for (const decoration of activeMarkingDecorations(options)) {
    for (const mark of markingDeclarations(decoration)) {
      const at = mark.match(/^at\s+position\s+([\s\S]+?)\s+with\s+([\s\S]+)$/i);
      if (at) {
        appendMarkingActions(markers, item, points, total, markingDistance(at[1], total, env), at[2], env);
        continue;
      }

      const between = mark.match(
        /^between\s+positions\s+([\s\S]+?)\s+and\s+([\s\S]+?)\s+step\s+([\s\S]+?)\s+with\s+([\s\S]+)$/i
      );
      if (!between) continue;
      const start = markingDistance(between[1], total, env);
      const end = markingDistance(between[2], total, env);
      const step = markingStepDistance(between[3], total, env);
      if (![start, end, step].every(Number.isFinite) || step <= EPSILON || end < start - EPSILON) continue;
      for (let distance = start; distance <= end + EPSILON; distance += step) {
        appendMarkingActions(markers, item, points, total, distance, between[4], env);
      }
    }
  }
  return markers;
}

function activeMarkingDecorations(options) {
  const decorations = [];
  const outerDecoration = optionText(options.decoration);
  if (options.decorate && outerDecoration.includes("markings")) decorations.push(outerDecoration);

  for (const rawPostaction of optionValues(options.postaction)) {
    const postaction = String(rawPostaction || "");
    const parsed = parseOptions(postaction);
    if (!Object.hasOwn(parsed, "decorate")) continue;
    const nestedDecoration = optionText(parsed.decoration);
    const effectiveDecoration = nestedDecoration || outerDecoration;
    if (effectiveDecoration.includes("markings")) decorations.push(effectiveDecoration);
  }
  return decorations;
}

function markingDeclarations(decoration) {
  const declarations = [];
  for (const part of splitTopLevel(stripOuterBraces(decoration), ",")) {
    const equals = findTopLevel(part, "=");
    if (equals < 0 || part.slice(0, equals).trim() !== "mark") continue;
    declarations.push(stripOuterBraces(part.slice(equals + 1).trim()));
  }
  return declarations;
}

function markingDistance(raw, total, env) {
  const text = substituteVariables(stripOuterBraces(String(raw || "")).trim(), env.variables || {}).trim();
  const value = DIMENSION_UNIT.test(text)
    ? parseDimension(text, env.variables || {})
    : evaluateMath(text, env.variables || {}) * total;
  return value < 0 ? total + value : value;
}

function markingStepDistance(raw, total, env) {
  const text = substituteVariables(stripOuterBraces(String(raw || "")).trim(), env.variables || {}).trim();
  return DIMENSION_UNIT.test(text)
    ? parseDimension(text, env.variables || {})
    : evaluateMath(text, env.variables || {}) * total;
}

function appendMarkingActions(markers, item, points, total, distance, rawBody, env) {
  if (!Number.isFinite(distance) || distance < -EPSILON || distance > total + EPSILON) return;
  const body = stripOuterBraces(String(rawBody || "").trim());
  const actionPattern = /\\(arrowreversed|arrow)\s*(?:\[([^\]]*)\])?\s*\{([^{}]*)\}/g;
  let action;
  while ((action = actionPattern.exec(body))) {
    const point = pointAtDistance(points, distance);
    const actionOptions = action[2] ? parseOptions(action[2]) : {};
    const style = {
      ...(item.style || {}),
      ...edgeStyleHintsFromOptions(actionOptions, env)
    };
    const tip = parseArrowTipSpec(action[3].trim() || "to");
    const stroke = style.stroke === "none" ? "black" : style.stroke || "black";
    style.stroke = stroke;
    style.fill = style.fill === "none" ? stroke : style.fill || stroke;
    markers.push(createMarkerShape({
      subtype: /feynman momentum/.test(body)
        ? "feynman-momentum"
        : /feynhand momentum/.test(body)
          ? "feynhand-momentum"
          : undefined,
      kind: tip.kind,
      tip,
      reversed: action[1] === "arrowreversed",
      x: roundNumber(point.x),
      y: roundNumber(point.y),
      angle: roundNumber(point.angle),
      style
    }));
  }
}

function optionValues(value) {
  return value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];
}

function optionText(value) {
  if (value === undefined || value === null || value === true || value === false) return "";
  return String(value);
}

export const tikzLibrary = {
  name: "decorations.markings",
  status: "partial",
  implementedBy: "src/tikz/libraries/decorations.markings.js:markingItemsForPath",
  localSource: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.markings.code.tex",
  localDoc: "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex",
  localSourceReviewed: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.markings.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.markings.code.tex; /usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex",
  features: [
    "mark=at position ... with {...}",
    "mark=between positions ... step ... with {...}",
    "fractional and absolute dimension positions",
    "negative positions measured from path end",
    "arrow and arrowreversed marking actions",
    "TikZ options scoped to marking arrows",
    "decorate and postaction=decorate"
  ],
  implements: [
    "mark=at position ... with {...}",
    "mark=between positions ... step ... with {...}",
    "arrow",
    "arrowreversed",
    "postaction decorate"
  ],
  notes: "Reviewed locally on 2026-09-05: PGF resolves unitless positions as path fractions, negative values from the path end, and dimensioned values as absolute distances; between positions repeatedly advances by the parsed step. TikZ arrow and arrowreversed actions accept local scope options, with reversed implemented as a local x reflection. TikZKit follows those rules for arrow actions and reuses the shared arrows renderer. Mark nodes, mark connection node, mark info keys, and arbitrary marking code remain unsupported."
};
