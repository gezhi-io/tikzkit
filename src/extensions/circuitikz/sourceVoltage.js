import { evaluateMath, parseDimension, roundPoint } from "../../engine/math.js";

const kinds = { plain: "vsource", dc: "dcvsource", sinusoidal: "vsourcesin", square: "vsourcesquare", triangular: "vsourcetri" };

export function generatorSettings(kind, keys = {}, variables, scale = 1) {
  const prefix = "bipoles/" + kinds[kind] + "/";
  const num = (value, fallback) => {
    if (value == null || value === true) return fallback;
    const n = evaluateMath(String(value), variables);
    return Number.isFinite(n) ? n : fallback;
  };
  const setting = (key, fallback) => num(keys[key], fallback);
  const shapeSetting = (key, fallback) => num(keys[prefix + key], fallback);
  const length = parseDimension(String(keys["bipoles/length"] ?? "1.4cm"), variables);
  const rlen = (Number.isFinite(length) ? Math.max(0, length) : 1.4) * scale;
  const size = rlen * Math.max(0, setting("sources/scale", 1));
  const halfAlong = size * Math.max(0, shapeSetting("width", .6)) / 2;
  const halfNormal = size * Math.max(0, shapeSetting("height", .6)) / 2;
  const labelKey = keys["voltage/generator label mode"] === "straight"
    ? "voltage/straight label distance" : "voltage/european label distance";
  const divisor = setting("current arrow scale", 16);
  return { halfAlong, halfNormal, bodyLength: halfAlong * 2,
    border: setting("bipoles/border margin", 1.1),
    bump: shapeSetting("voltage/bump a", setting("voltage/bump a", 1.2)) +
      setting("voltage shift sources adjust", .5) * setting("voltage/shift", 0),
    additional: shapeSetting("voltage/additional shift", 0),
    labelOffset: (shapeSetting(labelKey, setting(labelKey, 1.4)) - 1.2) * halfNormal,
    arrowStep: rlen / (divisor > 0 ? divisor : 16), symbols: keys["voltage/symbols"] !== false };
}

const at = (p, u, t) => roundPoint({ x: p.x + u.x * t, y: p.y + u.y * t });

export function currarrowHead(tip, u, step, style, subtype) {
  // pgfcircshapes: relative to the tip, the flat base is 1.7 steps back.
  const base = at(tip, u, -1.7 * step), n = { x: -u.y, y: u.x };
  return { type: "path", subtype, style: { ...style, fill: style.stroke },
    commands: [{ type: "moveTo", ...base }, { type: "lineTo", ...at(base, n, -.8 * step) },
      { type: "lineTo", ...tip }, { type: "lineTo", ...at(base, n, .8 * step) }, { type: "closePath" }] };
}

function labelAnchor(u, n) {
  // pgfcircvoltage snaps to cardinal anchors within its integer angle bands.
  const angle = Math.floor((Math.atan2(u.y, u.x) * 180 / Math.PI + 360) % 360);
  const vertical = n.y >= 0 ? "south" : "north", horizontal = n.x >= 0 ? "west" : "east";
  if (angle <= 4 || angle >= 356 || (angle >= 176 && angle <= 184)) return vertical;
  if ((angle >= 86 && angle <= 94) || (angle >= 266 && angle <= 274)) return horizontal;
  return vertical + " " + horizontal;
}

export function generatorVoltage(geometry, normal, backward, settings, pathStyle) {
  // The 60/120 degree anchors lie on the saved rectangular *border*, even
  // for a circular symbol. Move the voltage endpoints, not the wire leads.
  const x = Math.min(settings.halfAlong, settings.halfNormal / Math.sqrt(3)) * settings.border * settings.bump;
  const mid = at(geometry.mid, normal, x * Math.sqrt(3) + 2 * x * settings.additional);
  const u = backward ? { x: -geometry.u.x, y: -geometry.u.y } : geometry.u;
  const start = at(mid, u, -x), tip = at(mid, u, x);
  const style = { stroke: pathStyle.stroke || "black", fill: "none", lineWidth: pathStyle.lineWidth,
    markerStart: undefined, markerEnd: undefined, lineCap: "butt", lineJoin: "miter" };
  const shapes = settings.symbols ? [
    { type: "path", subtype: "circuitikz-voltage-arrow", style,
      commands: [{ type: "moveTo", ...start }, { type: "lineTo", ...tip }] },
    currarrowHead(tip, u, settings.arrowStep, style, "circuitikz-voltage-arrow-head")
  ] : [];
  return { shapes, point: at(mid, normal, settings.labelOffset), anchor: labelAnchor(geometry.u, normal) };
}
