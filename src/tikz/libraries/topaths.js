const CURVE_DISTANCE_KEYS = new Set([
  "distance",
  "min distance",
  "max distance",
  "out distance",
  "in distance",
  "out min distance",
  "out max distance",
  "in min distance",
  "in max distance"
]);

export const TO_PATH_START_ALIAS = "tikzkit@to@start";
export const TO_PATH_TARGET_ALIAS = "tikzkit@to@target";
const TO_PATH_NODES_SENTINEL = "tikzkit@to@nodes";
const SUPPORTED_TEMPLATE_OPERATORS = new Set(["--", "|-", "-|"]);

export function parseCustomToPathTemplate(value, parsePathSegments) {
  if (value === undefined || value === null || value === true || value === "") return null;
  if (typeof parsePathSegments !== "function") return null;

  let source = stripTexComments(stripBalancedOuterBraces(String(value).trim()));
  if (!/\\tikztotarget\b/.test(source)) return null;
  source = replaceCoordinatePlaceholder(source, "tikztostart", TO_PATH_START_ALIAS);
  source = replaceCoordinatePlaceholder(source, "tikztotarget", TO_PATH_TARGET_ALIAS);
  source = source.replace(/\\tikztonodes\b/g, ` node {${TO_PATH_NODES_SENTINEL}} `);

  const parsed = parsePathSegments(source);
  const segments = [];
  const nodeSlots = [];
  let pendingOperator = null;
  let targetOperation = null;

  for (const segment of parsed) {
    if (segment.kind === "node") {
      if (segment.at) return null;
      if (String(segment.text || "").trim() === TO_PATH_NODES_SENTINEL) {
        nodeSlots.push({ kind: "to-nodes" });
      } else {
        nodeSlots.push({ kind: "template-node", node: segment });
      }
      continue;
    }
    if (segment.kind === "operator") {
      if (!SUPPORTED_TEMPLATE_OPERATORS.has(segment.value)) return null;
      pendingOperator = segment.value;
      segments.push(segment);
      continue;
    }
    if (segment.kind === "coordinate") {
      if (isTemplateAliasCoordinate(segment.raw, TO_PATH_TARGET_ALIAS)) {
        targetOperation = pendingOperator || "move";
      }
      pendingOperator = null;
      segments.push(segment);
      continue;
    }
    if (segment.kind === "curveTo") {
      if (isTemplateAliasCoordinate(segment.to, TO_PATH_TARGET_ALIAS)) targetOperation = "curve";
      pendingOperator = null;
      segments.push(segment);
      continue;
    }
    if (segment.kind === "options") {
      segments.push(segment);
      continue;
    }
    return null;
  }

  if (!targetOperation) return null;
  return {
    segments,
    nodeSlots,
    targetOperation,
    startsAtSource: firstCoordinateIsAlias(segments, TO_PATH_START_ALIAS)
  };
}

export function curveToSpecFromOptions(options = {}, from, to, helpers = {}) {
  const state = createCurveToState();
  const parseAngle = helpers.parseAngle || ((value, fallback) => numericOption(value, fallback));
  const parseLooseness = helpers.parseLooseness || ((value, fallback) => numericOption(value, fallback));
  const parseDistance = helpers.parseDistance || (() => null);

  for (const [key, value] of Object.entries(options || {})) {
    if (key === "bend angle") {
      state.bendAngle = parseAngle(value, state.bendAngle);
    } else if (key === "bend left" || key === "bend right") {
      state.bendAngle = parseAngle(value, state.bendAngle);
      state.out = key === "bend left" ? state.bendAngle : -state.bendAngle;
      state.in = 180 - state.out;
      state.relative = true;
      state.active = true;
    } else if (key === "relative") {
      state.relative = curveRelativeOption(value);
    } else if (key === "out" || key === "in") {
      state[key] = parseAngle(value, state[key]);
      state.active = true;
    } else if (key === "looseness") {
      const looseness = parseLooseness(value, state.outLooseness);
      setCurveLooseness(state, "out", looseness);
      setCurveLooseness(state, "in", looseness);
    } else if (key === "out looseness" || key === "in looseness") {
      const side = key.startsWith("out") ? "out" : "in";
      setCurveLooseness(state, side, parseLooseness(value, state[`${side}Looseness`]));
    } else if (key === "out control" || key === "in control") {
      setCurveControl(state, key.startsWith("out") ? "out" : "in", value);
    } else if (key === "controls") {
      const controls = parseCurveControls(value);
      if (controls) {
        // PGF installs the incoming callback first and the outgoing callback second.
        setCurveControl(state, "in", controls.in);
        setCurveControl(state, "out", controls.out);
      }
    } else if (CURVE_DISTANCE_KEYS.has(key)) {
      applyCurveDistanceOption(state, key, parseDistance(value));
    }
  }

  if (!state.active) return null;
  const base = state.relative ? chordAngle(from, to) : 0;
  return {
    out: base + state.out,
    in: base + state.in,
    outLooseness: state.outLooseness,
    inLooseness: state.inLooseness,
    outMinDistance: state.outMinDistance,
    outMaxDistance: state.outMaxDistance,
    inMinDistance: state.inMinDistance,
    inMaxDistance: state.inMaxDistance,
    // PGF's relative branch computes both controls from angles and looseness.
    outControl: !state.relative && state.outMode === "control" ? state.outControl : null,
    inControl: !state.relative && state.inMode === "control" ? state.inControl : null
  };
}

export function createCurveToState() {
  return {
    active: false,
    relative: false,
    bendAngle: 30,
    out: 45,
    in: 135,
    outLooseness: 1,
    inLooseness: 1,
    outMinDistance: 0,
    outMaxDistance: Number.POSITIVE_INFINITY,
    inMinDistance: 0,
    inMaxDistance: Number.POSITIVE_INFINITY,
    outMode: "looseness",
    inMode: "looseness",
    outControl: null,
    inControl: null
  };
}

export function parseCurveControls(value) {
  const text = stripBalancedOuterBraces(String(value === true ? "" : value || "").trim());
  const match = text.match(/^([\s\S]+?)\s+and\s+([\s\S]+)$/);
  if (!match) return null;
  const out = match[1].trim();
  const incoming = match[2].trim();
  return out && incoming ? { out, in: incoming } : null;
}

export function constrainedCurveControlDistance(distance, minimum = 0, maximum = Number.POSITIVE_INFINITY) {
  let constrained = distance;
  if (Number.isFinite(minimum) && constrained < minimum) constrained = minimum;
  if (Number.isFinite(maximum) && constrained > maximum) constrained = maximum;
  return constrained;
}

function setCurveControl(state, side, value) {
  const control = stripBalancedOuterBraces(String(value === true ? "" : value || "").trim());
  if (!control) return;
  state[`${side}Control`] = control;
  state[`${side}Mode`] = "control";
  state.active = true;
}

function setCurveLooseness(state, side, value) {
  state[`${side}Looseness`] = value;
  state[`${side}Mode`] = "looseness";
  state.active = true;
}

function applyCurveDistanceOption(state, key, distance) {
  if (!Number.isFinite(distance) || distance < 0) return;
  if (key === "distance") {
    setCurveDistanceRange(state, "out", distance, distance);
    setCurveDistanceRange(state, "in", distance, distance);
  } else if (key === "min distance") {
    setCurveDistanceRange(state, "out", distance, null);
    setCurveDistanceRange(state, "in", distance, null);
  } else if (key === "max distance") {
    setCurveDistanceRange(state, "out", null, distance);
    setCurveDistanceRange(state, "in", null, distance);
  } else if (key === "out distance") {
    setCurveDistanceRange(state, "out", distance, distance);
  } else if (key === "in distance") {
    setCurveDistanceRange(state, "in", distance, distance);
  } else if (key === "out min distance") {
    setCurveDistanceRange(state, "out", distance, null);
  } else if (key === "out max distance") {
    setCurveDistanceRange(state, "out", null, distance);
  } else if (key === "in min distance") {
    setCurveDistanceRange(state, "in", distance, null);
  } else if (key === "in max distance") {
    setCurveDistanceRange(state, "in", null, distance);
  }
  state.active = true;
}

function setCurveDistanceRange(state, side, minimum, maximum) {
  if (minimum !== null) state[`${side}MinDistance`] = minimum;
  if (maximum !== null) state[`${side}MaxDistance`] = maximum;
  state[`${side}Mode`] = "looseness";
}

function curveRelativeOption(value) {
  if (value === false) return false;
  if (value === true || value === undefined || value === null || value === "") return true;
  return !/^(?:false|0|no|off)$/i.test(String(value).trim());
}

function chordAngle(from = {}, to = {}) {
  return (Math.atan2((to.y || 0) - (from.y || 0), (to.x || 0) - (from.x || 0)) * 180) / Math.PI;
}

function numericOption(value, fallback) {
  if (value === true || value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stripBalancedOuterBraces(value) {
  let text = String(value || "").trim();
  while (text.startsWith("{") && text.endsWith("}") && enclosesWholeValue(text)) {
    text = text.slice(1, -1).trim();
  }
  return text;
}

function stripTexComments(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => {
      for (let index = 0; index < line.length; index += 1) {
        if (line[index] !== "%") continue;
        let escapes = 0;
        for (let cursor = index - 1; cursor >= 0 && line[cursor] === "\\"; cursor -= 1) escapes += 1;
        if (escapes % 2 === 0) return line.slice(0, index);
      }
      return line;
    })
    .join("\n");
}

function replaceCoordinatePlaceholder(source, macro, alias) {
  const parenthesized = new RegExp(`\\(\\s*\\\\${macro}\\s*\\)`, "g");
  const bare = new RegExp(`\\\\${macro}\\b`, "g");
  return source.replace(parenthesized, `(${alias})`).replace(bare, `(${alias})`);
}

function firstCoordinateIsAlias(segments, alias) {
  const first = segments.find((segment) => segment.kind !== "options");
  return first?.kind === "coordinate" && isTemplateAliasCoordinate(first.raw, alias);
}

function isTemplateAliasCoordinate(raw, alias) {
  let text = String(raw || "").trim().replace(/^\+\+?/, "").trim();
  while (text.startsWith("(") && text.endsWith(")")) text = text.slice(1, -1).trim();
  while (text.startsWith("{") && text.endsWith("}")) text = text.slice(1, -1).trim();
  return text === alias;
}

function enclosesWholeValue(text) {
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "{") depth += 1;
    else if (text[index] === "}") depth -= 1;
    if (depth === 0 && index < text.length - 1) return false;
  }
  return depth === 0;
}

export const tikzLibrary = {
  name: "topaths",
  status: "partial",
  implementedBy: "src/tikz/libraries/topaths.js:curveToSpecFromOptions/parseCustomToPathTemplate; src/engine/evaluate.js:customToPathEnvironment/flushCustomToPathNodes and edge curve coordinate resolution/node-border clipping",
  features: [
    "default curve-to angles out=45 and in=135",
    "bend left/right with relative chord directions",
    "out/in and relative angle controls",
    "looseness plus independent out/in looseness",
    "distance and independent in/out exact distances",
    "min/max distance and independent in/out bounds",
    "source-ordered updates for distinct curve option keys",
    "explicit out control, in control, and paired controls",
    "mixed explicit and automatic control arms",
    "custom path-only to path templates for to and edge",
    "tikztostart and tikztotarget coordinate substitution",
    "tikztonodes reinsertion with template-owned nodes",
    "straight, orthogonal, relative preleg, and explicit cubic template geometry"
  ],
  implements: [
    "to",
    "edge",
    "bend left",
    "bend right",
    "out",
    "in",
    "relative",
    "looseness",
    "out looseness",
    "in looseness",
    "distance",
    "min distance",
    "max distance",
    "out distance",
    "in distance",
    "out min distance",
    "out max distance",
    "in min distance",
    "in max distance",
    "out control",
    "in control",
    "controls",
    "to path",
    "tikztostart",
    "tikztotarget",
    "tikztonodes"
  ],
  localSource: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarytopaths.code.tex",
  localDoc: "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-edges.tex",
  localSourceReviewed: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarytopaths.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex (to/edge collection, placeholders, and template execution); /usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-edges.tex; /usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-paths.tex; /usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tutorial-chains.tex",
  notes: "Reviewed locally on 2026-09-04. PGF initializes curve-to with out=45, in=135 and a 30-degree bend angle. Its base control distance is approximately 0.3915 times the endpoint distance, then each side applies its looseness and independent minimum/maximum clamp. Exact distance sets both bounds. Explicit controls replace distance computation independently per side; a later same-side looseness or distance key restores automatic computation. The relative branch computes controls from angles and looseness, matching the local PGF implementation even when explicit controls are also present. TikZ core collects to/edge nodes first, binds tikztostart and tikztotarget, executes the configured to path replacement, and expands tikztonodes at the replacement's chosen position. TikZKit now compiles path-only custom templates into ordinary path segments and reuses the shared path engine for node-border clipping, arrows, straight/orthogonal routing, relative prelegs, explicit cubic controls, and template/original node placement across both to and edge. Arbitrary pgfextra callbacks, execute-at-begin/end hooks, nested to/edge operations inside a template, arc/plot template bodies, and repeated identical-key timeline preservation remain partial."
};
