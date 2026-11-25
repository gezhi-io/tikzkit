import { evaluateMath, parseDimension, roundNumber, roundPoint } from "../../engine/math.js";
import { normalizeColor } from "../../engine/colors.js";

const keys = new Set(["bipoles/length", "bipoles/thickness", "bipoles/capacitor/width",
  "bipoles/capacitor/height", "capacitors/scale", "capacitors/thickness", "capacitors/fill"]);

// The class width/height keys assign the actual bipole keys. Resolve aliases
// when a scope or command executes, so later assignments win in source order.
export function withCapacitorKeys(state, options) {
  let result = state;
  for (const [raw, value] of Object.entries(options || {})) {
    let key = raw.replace(/^(?:\/tikz\/)?circuitikz\//, "");
    if (key === "capacitors/width") key = "bipoles/capacitor/width";
    if (key === "capacitors/height") key = "bipoles/capacitor/height";
    if (!keys.has(key)) continue;
    if (result === state) result = { ...state };
    result[key] = value;
  }
  return result;
}

export function fixedCapacitorSettings(keys = {}, variables, shapeScale = 1) {
  const number = (key, fallback) => {
    const raw = keys[key];
    if (raw == null || raw === true || raw === "none") return fallback;
    const value = evaluateMath(String(raw), variables);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  };
  const length = parseDimension(String(keys["bipoles/length"] ?? "1.4cm"), variables);
  const rlen = (Number.isFinite(length) && length >= 0 ? length : 1.4) *
    number("capacitors/scale", 1) * shapeScale;
  return {
    gap: rlen * number("bipoles/capacitor/width", .2),
    height: rlen * number("bipoles/capacitor/height", .6),
    thickness: number("capacitors/thickness", number("bipoles/thickness", 2)),
    fill: normalizeColor(String(keys["capacitors/fill"] ?? "none"))
  };
}

export function fixedCapacitorItems({start, end}, normal, settings, style, fill) {
  // pgfcircdeclarebipolescaled gives the wires and the plate strokes the
  // same left/right anchors. Do not shrink the component on a short wire.
  const offset = (p, sign) => roundPoint({
    x: p.x + sign * normal.x * settings.height / 2,
    y: p.y + sign * normal.y * settings.height / 2
  });
  const a = offset(start, 1), b = offset(start, -1), c = offset(end, 1), d = offset(end, -1);
  const move = p => ({ type: "moveTo", ...p });
  const line = p => ({ type: "lineTo", ...p });
  const body = { type: "path", paintAfterPath: true };
  const items = [];
  // A cleared TikZ fill falls back to the component class in pgf@circ@maybefill.
  const localFill = fill ?? style.fill;
  const ink = localFill && localFill !== "none" ? localFill : settings.fill;
  if (ink !== "none") items.push({
    ...body, subtype: "circuitikz-capacitor-fill",
    style: { fill: ink, stroke: "none", markerStart: undefined, markerEnd: undefined },
    commands: [move(a), line(b), line(d), line(c), { type: "closePath" }]
  });
  items.push({
    ...body, subtype: "circuitikz-capacitor",
    style: { fill: "none", stroke: style.stroke || "black", lineWidth: roundNumber(style.lineWidth * settings.thickness),
      markerStart: undefined, markerEnd: undefined },
    commands: [move(a), line(b), move(c), line(d)]
  });
  return items;
}
