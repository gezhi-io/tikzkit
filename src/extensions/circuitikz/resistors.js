import { roundNumber, roundPoint } from "../../engine/math.js";
import { TIKZ_UNIT } from "../../tikz/metrics.js";
import { fixedBipoleClass } from "./settings.js";

export function fixedResistorSettings(kind, keys, variables, shapeScale) {
  const { rlen, number, thickness, fill } = fixedBipoleClass("resistors", keys, variables, shapeScale);
  const prefix = kind === "european" ? "bipoles/generic/" : "bipoles/resistor/";
  return { kind, bodyLength: rlen * number(prefix + "width", .8),
    halfNormal: rlen * number(prefix + "height", .3) / 2, thickness, fill,
    zigs: Math.max(1, Math.min(4096, Math.round(number("resistors/zigs", 3)))),
    stub: number("resistors/zigzag stub", 0) };
}

export function fixedResistorItem({mid, u, n}, settings, style, fill, inverted, mirrored) {
  const {kind, bodyLength, halfNormal, thickness, zigs} = settings;
  const pen = style.lineWidth * thickness;
  const point = (along, side) => roundPoint({
    x: mid.x + (inverted ? -along : along) * u.x + (mirrored ? -side : side) * n.x,
    y: mid.y + (inverted ? -along : along) * u.y + (mirrored ? -side : side) * n.y
  });
  const move = (x,y) => ({ type: "moveTo", ...point(x,y) });
  const line = (x,y) => ({ type: "lineTo", ...point(x,y) });
  const half = bodyLength / 2;
  const rectangle = kind === "european";
  let commands;
  if (rectangle) {
    commands = [move(-half,halfNormal), line(half,halfNormal), line(half,-halfNormal),
      line(-half,-halfNormal), { type: "closePath" }];
  } else {
    // pgf@circ@zigzag: reserve both straight stubs, then divide the remainder
    // into 4 steps per zig. Only the ends of the ramps/stubs overlap the leads.
    const stub = settings.stub * bodyLength, step = (bodyLength - 2*stub) / (4*zigs);
    const overlap = pen / (2*TIKZ_UNIT);
    commands = [move(-half-overlap, 0)];
    if (stub > 0) commands.push(line(-half+stub-overlap, 0));
    for (let i = 0; i < 2*zigs; i++) {
      commands.push(line(-half+stub+(2*i+1)*step, i % 2 ? -halfNormal : halfNormal));
    }
    commands.push(line(half-stub+overlap, 0));
    if (stub > 0) commands.push(line(half+overlap, 0));
  }
  const localFill = fill ?? style.fill;
  return { type: "path", subtype: "circuitikz-resistor", resistorKind: kind, zigs, paintAfterPath: true,
    style: { stroke: style.stroke || "black", fill: rectangle
      ? (localFill && localFill !== "none" ? localFill : settings.fill) : "none",
      lineWidth: roundNumber(pen), lineCap: style.lineCap, lineJoin: rectangle ? style.lineJoin : "bevel",
      markerStart: undefined, markerEnd: undefined }, commands };
}
