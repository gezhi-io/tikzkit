import { normalizeColor } from "../../engine/colors.js";
import { substituteVariables } from "../../engine/math.js";
import { normalizeOptions } from "../../engine/options.js";
import { closePathCommand, createPathBuilder, lineToCommand, moveToCommand } from "../../engine/pathBuilder.js";
import { pgfFixedMultiply } from "../../engine/pgf-fixed-math.js";
import { literalRegisterLengthCm } from "../../engine/units.js";
import { fixedBipoleClass, withCircuitikzKeys } from "./settings.js";

// pgfcircmonopoles.tex: the saved southeast anchor, in units of step.
// These are not ink bounds: cground's teeth extend below its south anchor.
const extents = {
  ground: [.6, 1.6], tlground: [.6, .4], rground: [.6, 1], tground: [.6, 0],
  sground: [.6, 1.8], nground: [.9, 1.6], pground: [.9, 1.8], cground: [1, 2],
  eground: [1.1, 1.7], eground2: [1.1, 1.7]
};
const pt = 2.54 / 72.27;
const scaleCm = (cm, factor) => pgfFixedMultiply(cm / pt, factor) * pt || 0;

function groundCircle(y, r, closed) {
  // pgfpathcircle and 90-degree pgfpatharc use this *dimension*, rounded
  // before it is added to the endpoints. nground needs only the upper half.
  const k = scaleCm(r, .55228475);
  const path = createPathBuilder().moveTo(r, y)
    .curveTo(r, y + k, k, y + r, 0, y + r)
    .curveTo(-k, y + r, -r, y + k, -r, y);
  if (closed) path.curveTo(-r, y - k, -k, y - r, 0, y - r)
    .curveTo(k, y - r, r, y - k, r, y).closePath();
  return path.build();
}

export function circuitikzGroundKind(options = {}) {
  let kind = null;
  for (const [raw, value] of Object.entries(options)) {
    const key = raw.replace(/^\/tikz\//, "");
    if (key === "shape") {
      const shape = String(value).trim();
      kind = Object.hasOwn(extents, shape) ? shape : null;
    } else if (Object.hasOwn(extents, key)) kind = key;
    else if (["rectangle", "circle", "coordinate", "ellipse"].includes(key)) kind = null;
  }
  return kind;
}

function groundSettings(options, env) {
  const keys = withCircuitikzKeys(env.circuitikz ?? {}, options);
  return { keys, ...fixedBipoleClass("grounds", keys, env.variables) };
}

export function circuitikzGroundGeometry(kind, options = {}, env = {}) {
  if (!Object.hasOwn(extents, kind)) return null;
  const { keys, number, rlen } = groundSettings(options, env);
  const literal = literalRegisterLengthCm(substituteVariables(String(keys["bipoles/length"] ?? "1.4cm"), env.variables));
  const scaledRlen = Number.isFinite(literal) && literal >= 0 ? scaleCm(literal, number("grounds/scale", 1)) : rlen;
  const step = scaleCm(scaledRlen, number("monopoles/ground/width", .25));
  const [w, d] = extents[kind];
  const halfWidth = scaleCm(step, w), depth = scaleCm(step, d);
  return { kind, step, halfWidth, width: 2 * halfWidth, depth, height: depth };
}

export function circuitikzGroundLocalAnchor(name, geometry) {
  if (!geometry) return null;
  const { halfWidth: w, depth } = geometry;
  const south = -depth || 0, mid = scaleCm(south, .5);
  const anchor = String(name ?? "center").trim();
  // PGF's default text anchor and its border for numeric angles are the origin.
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(anchor)) return { x: 0, y: 0 };
  switch (anchor) {
    case "": case "center": case "text": case "north": case "left": case "right": return { x: 0, y: 0 };
    case "north east": return { x: w, y: 0 };
    case "east": return { x: w, y: mid };
    case "south east": return { x: w, y: south };
    case "south": return { x: 0, y: south };
    case "south west": return { x: -w || 0, y: south };
    case "west": return { x: -w || 0, y: mid };
    case "north west": return { x: -w || 0, y: 0 };
    default: return null;
  }
}

const ink = v => typeof v === "string" && v && v !== "none" ? normalizeColor(v) : undefined;

export function circuitikzGroundParts(kind, geometry, options = {}, env = {}, style = {}) {
  if (!geometry || !Object.hasOwn(extents, kind)) return [];
  const { keys, number, fill: classFill } = groundSettings(options, env);
  // Ground shapes issue pgfusepath directly: draw=none does not erase the
  // actual pen, and unlike bipoles they never call pgf@circ@setcolor.
  let normalized;
  function resolvePen() {
    if (normalized) return normalized;
    const inherited = env.circuitikz?.tikzDrawInk ?? env.texCurrentColor ?? "black";
    const raw = Object.hasOwn(options, "tikzkit stroke ink") ? options : { "tikzkit stroke ink": inherited, ...options };
    normalized = normalizeOptions("draw", raw, { ...env, styles: env.styles ?? {} });
    return normalized;
  }
  let pen = style;
  let stroke = style.stroke;
  if (!stroke || stroke === "none" || style.lineWidth == null || (!style.lineCap && options["line cap"])) {
    if (!stroke || stroke === "none") stroke = resolvePen().strokeInk;
    pen = { ...resolvePen().style, ...style };
  }
  const base = { stroke, lineCap: pen.lineCap ?? "butt", lineJoin: pen.lineJoin ?? "miter" };
  for (const key of ["miterLimit", "dashArray", "dashPhase", "dashLineCap", "opacity", "strokeOpacity", "fillOpacity"]) {
    if (pen[key] != null) base[key] = pen[key];
  }
  // draworfill reselects the TikZ ink (including "."), then falls back to the
  // class register. Neither a bare fill action nor backend ink alone fills it.
  const currentInk = () => resolvePen().semantic["tikzkit current color"] ?? env.texCurrentColor ?? ink(style.fillInk) ?? "black";
  const bareFill = options.fill === true || options.fill === "" || options["tikzkit bare fill"];
  const fill = (keys.tikzFillInk === "." ? currentInk() : ink(keys.tikzFillInk)) ??
    (!bareFill && options.fill !== "none" ? ink(style.fill) : undefined) ??
    (keys["grounds/fill"] === "." ? currentInk() : classFill);
  const legacy = kind === "sground" ? "bipoles" : kind === "rground" ? "monopoles/rground" :
    ["tground", "eground", "eground2"].includes(kind) ? "monopoles/tground" : "monopoles/ground";
  const bodyPen = number("grounds/thickness", number(legacy + "/thickness", legacy === "monopoles/tground" ? 3 : 2));
  const connectionPen = number("monopoles/ground/connectionthickness", 1);
  const length = v => scaleCm(geometry.step, v);
  const m = (x, y) => moveToCommand(length(x), length(y));
  const l = (x, y) => lineToCommand(length(x), length(y));
  const parts = [];
  const add = (role, commands, factor, fillInk = "none", cap = base.lineCap) => parts.push({
    type: "path", subtype: "circuitikz-" + kind + (role ? "-" + role : ""), groundKind: kind, commands,
    style: { ...base, lineWidth: pen.lineWidth * factor, lineCap: cap, fill: fillInk }
  });
  const lead = (y, factor = 1) => add("lead", [m(0, 0), l(0, y)], factor);
  const bars = y => add("", [m(-.6, y), l(.6, y), m(-.4, y - .2), l(.4, y - .2),
    m(-.25, y - .4), l(.25, y - .4)], bodyPen);
  switch (kind) {
    case "ground": case "nground":
      lead(-1.2, connectionPen);
      bars(-1.2);
      if (kind === "nground") add("arc", groundCircle(length(-1.6), length(.9), false), bodyPen);
      break;
    case "tlground": bars(0); break;
    case "rground":
      lead(-1);
      add("", [m(-.6, -1), l(.6, -1)], bodyPen, "none", "round");
      break;
    case "tground":
      // Its native lead consists only of a moveto and paints nothing.
      add("", [m(-.6, 0), l(.6, 0)], bodyPen);
      break;
    case "sground":
      lead(-1);
      add("", [m(-.6, -1), l(.6, -1), l(0, -1.8), closePathCommand()], bodyPen, fill);
      break;
    case "pground":
      add("ring", groundCircle(length(-.9), length(.9), true), bodyPen, fill);
      lead(-1, connectionPen);
      bars(-1);
      break;
    case "cground":
      lead(-1.5, connectionPen);
      add("", [m(-1, -2.1), l(-.75, -1.5), l(.75, -1.5), l(.5, -2.1),
        m(0, -1.5), l(-.25, -2.1)], bodyPen);
      break;
    case "eground": case "eground2": {
      lead(-1);
      add("", [m(-1, -1), l(1, -1)], bodyPen);
      const hatches = kind === "eground" ? [[-1.1, -.6], [-.6, -.1], [-.1, .4], [.4, .9]] :
        [[-1.1, -.4], [-.45, .25], [.2, .9]];
      add("hatch", hatches.flatMap(([a, b]) => [m(a, -1.7), l(b, -1)]), 1);
      break;
    }
  }
  return parts;
}
