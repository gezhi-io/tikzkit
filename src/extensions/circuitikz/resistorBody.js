import { roundNumber, roundPoint, substituteVariables } from "../../engine/math.js";
import { pgfFixedVectorLength } from "../../engine/pgf-fixed-math.js";
import { PGF_SP, pgfDimension, pgfFixedMultiply, pgfFixedReciprocal } from "../../engine/pgf-fixed-point.js";
import { literalRegisterLengthCm } from "../../engine/units.js";
import { pgfNormalisedDirectionSp } from "../../pgf/normalisedDirection.js";
import { TIKZ_UNIT, lineWidthFromPt } from "../../tikz/metrics.js";
import { fixedResistorItem } from "./resistors.js";
import { fixedBipoleClass } from "./settings.js";

const SP_PER_CM = PGF_SP * 72.27 / 2.54;
const toSp = cm => Math.sign(cm) * Math.round(Math.abs(cm) * SP_PER_CM);
export const scaledRegister = (factor, sp) => Math.trunc(pgfDimension(factor) * sp);
const half = sp => Math.trunc(sp / 2);

// PGF halves its saved width and divides the zig step as integer TeX lengths.
// Both calculations start from the full width, before the shape transform.
export function resistorBodyRegisters(kind, prefix, keys, variables, shapeScale) {
  const { rlen, number, thickness, fill } = fixedBipoleClass("resistors", keys, variables);
  const raw = substituteVariables(String(keys["bipoles/length"] ?? "1.4cm"), variables);
  const literal = literalRegisterLengthCm(raw);
  const scaledRlen = Number.isFinite(literal) && literal >= 0
    ? scaledRegister(number("resistors/scale", 1), toSp(literal)) : toSp(rlen);
  const cm = sp => sp * shapeScale / SP_PER_CM;
  const width = scaledRegister(number(prefix + "width", number("resistors/width", .8)), scaledRlen);
  const zigs = Math.max(1, Math.min(4096, Math.round(number("resistors/zigs", 3))));
  const stub = number("resistors/zigzag stub", 0), stubSp = scaledRegister(stub, width);
  const halfHeight = (key, fallback) => half(scaledRegister(number(prefix + key, fallback), scaledRlen));
  return { width, cm, halfHeight, number, settings: { kind, bodyLength: cm(2 * half(width)),
    shapeScale, zigs, stub, zigStub: cm(stubSp), zigStep: cm(Math.trunc((width - 2 * stubSp) / (4 * zigs))),
    thickness, modifierThickness: number("resistors/modifier thickness", 1), fill } };
}

function frameFor({ mid, u, length = 1, localDelta }) {
  // pgfcircpath.tex rotates the shape by the PGF angle of the two named ends.
  const dx = toSp(localDelta?.x ?? u.x * length), dy = toSp(localDelta?.y ?? u.y * length);
  const dir = pgfNormalisedDirectionSp(dx, dy);
  const x = dir.x / PGF_SP, y = dir.y / PGF_SP;
  return { mid, u: { x, y }, n: { x: -y, y: x } };
}

function place({ mid, u, n }, inverted, mirrored) {
  return (x, y) => {
    if (inverted) x = -x;
    if (mirrored) y = -y;
    return roundPoint({ x: mid.x + x * u.x + y * n.x, y: mid.y + x * u.y + y * n.y });
  };
}

export function resistorLocalPoint(geometry, inverted, mirrored) {
  return place(frameFor(geometry), inverted, mirrored);
}

export function resistorCompassAnchors(point, center, right, up, down) {
  const n = point(0, up), s = point(0, -down), e = point(right, 0), w = point(-right, 0);
  const ne = point(right, up), nw = point(-right, up), se = point(right, -down), sw = point(-right, -down);
  // pgfcirc.defines.tex: compass names are local, including a=east and b=west.
  return { center, n, north: n, above: n, s, south: s, below: s,
      e, east: e, right: e, a: e, w, west: w, left: w, b: w,
      ne, "north east": ne, nw, "north west": nw, se, "south east": se, sw, "south west": sw };
}

export function resistorBodyPath(geometry, settings, pathStyle, fill, inverted, mirrored) {
  const frame = frameFor(geometry);
  const { kind, thickness, halfNormal, bodyLength, zigs, zigStep, zigStub, shapeScale } = settings;
  const wireWidth = pathStyle.lineWidth ?? lineWidthFromPt(.4);
  const penSp = scaledRegister(thickness, toSp(wireWidth / TIKZ_UNIT));
  const lineWidth = roundNumber(penSp * TIKZ_UNIT / SP_PER_CM);
  // CircuitikZ starts component drawing with arrows and corner arcs reset,
  // but inherits the surrounding dash and opacity (pgfcirc.defines.tex).
  const { dashArray, dashLineCap, opacity, fillOpacity, strokeOpacity } = pathStyle;
  const paint = { dashArray, dashLineCap, opacity, fillOpacity, strokeOpacity };
  if (kind === "european") {
    const body = fixedResistorItem(frame, settings,
      { ...pathStyle, lineWidth: wireWidth }, fill, inverted, mirrored);
    // pgfpathrectanglecorners emits a PDF rectangle for an identity matrix.
    // Its transformed path starts at the opposite corner (visible for dashes).
    const identity = frame.u.x * (inverted ? -1 : 1) === 1 && frame.u.y === 0 &&
      frame.n.y * (mirrored ? -1 : 1) === 1 && shapeScale === 1;
    if (!identity) {
      const [a, b, c, d, close] = body.commands;
      body.commands = [{ ...c, type: "moveTo" }, d, { ...a, type: "lineTo" }, b, close];
    }
    return { ...body, style: { ...paint, ...body.style, lineWidth } };
  }

  // pgf@circ@zigzag adds successive integer steps from the saved LEFT edge;
  // it does not center the rounded zigzag or move the wiper onto a peak.
  const point = place(frame, inverted, mirrored);
  const axisLength = pgfFixedVectorLength(shapeScale * frame.u.x, shapeScale * frame.u.y);
  const adjustment = axisLength ? pgfFixedReciprocal(axisLength) : 0;
  const overlap = scaledRegister(pgfFixedMultiply(adjustment, .5), penSp) * shapeScale / SP_PER_CM;
  let x = -bodyLength / 2;
  const commands = [{ type: "moveTo", ...point(x - overlap, 0) }];
  const line = (along, normal) => commands.push({ type: "lineTo", ...point(along, normal) });
  x += zigStub;
  if (zigStub > 0) line(x - overlap, 0);
  for (let i = 0; i < 2 * zigs; i++) line(x + (2 * i + 1) * zigStep, i % 2 ? -halfNormal : halfNormal);
  x += 4 * zigs * zigStep;
  line(x + overlap, 0);
  if (zigStub > 0) line(x + zigStub + overlap, 0);
  return { type: "path", resistorKind: kind, zigs, paintAfterPath: true, commands,
    style: { ...paint, stroke: pathStyle.stroke || "black", fill: "none", lineWidth,
      lineCap: pathStyle.lineCap, lineJoin: "bevel", markerStart: undefined, markerEnd: undefined } };
}
