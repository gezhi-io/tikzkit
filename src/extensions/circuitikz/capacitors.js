import { roundNumber, roundPoint } from "../../engine/math.js";
import { fixedBipoleClass } from "./settings.js";

export function fixedCapacitorSettings(keys, variables, shapeScale) {
  const { rlen, number, thickness, fill } = fixedBipoleClass("capacitors", keys, variables, shapeScale);
  return { gap: rlen * number("bipoles/capacitor/width", .2),
    height: rlen * number("bipoles/capacitor/height", .6), thickness, fill };
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
