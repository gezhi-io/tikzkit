import { evaluateMath, roundNumber, roundPoint, substituteVariables } from "../../engine/math.js";
import { pgfFixedVectorLength } from "../../engine/pgf-fixed-math.js";
import { PGF_SP, pgfDimension, pgfFixedMultiply, pgfFixedReciprocal } from "../../engine/pgf-fixed-point.js";
import { literalRegisterLengthCm } from "../../engine/units.js";
import { pgfNormalisedDirectionSp } from "../../pgf/normalisedDirection.js";
import { TIKZ_UNIT, lineWidthFromPt } from "../../tikz/metrics.js";
import { fixedResistorItem } from "./resistors.js";
import { fixedBipoleClass } from "./settings.js";

const SP_PER_CM = PGF_SP * 72.27 / 2.54;
const toSp = cm => Math.sign(cm) * Math.round(Math.abs(cm) * SP_PER_CM);
const times = (factor, sp) => Math.trunc(pgfDimension(factor) * sp);
const half = sp => Math.trunc(sp / 2);

// pgfcircbipoles.tex: genericpotentiometer and potentiometer use the same
// resistors class but have independent width, height, height 2 and wiper pos.
export function potentiometerSettings(kind = "american", keys = {}, variables = {}, shapeScale = 1) {
  const { rlen, number, thickness, fill } = fixedBipoleClass("resistors", keys, variables);
  const prefix = kind === "european" ? "bipoles/generic potentiometer/" : "bipoles/potentiometer/";
  const raw = substituteVariables(String(keys["bipoles/length"] ?? "1.4cm"), variables);
  const literal = literalRegisterLengthCm(raw);
  const scaledRlen = Number.isFinite(literal) && literal >= 0
    ? times(number("resistors/scale", 1), toSp(literal)) : toSp(rlen);
  const cm = sp => sp * shapeScale / SP_PER_CM;
  const width = times(number(prefix + "width", number("resistors/width", .8)), scaledRlen);
  const zigs = Math.max(1, Math.min(4096, Math.round(number("resistors/zigs", 3))));
  const stub = number("resistors/zigzag stub", 0), stubSp = times(stub, width);
  const pos = evaluateMath(String(keys[prefix + "wiper pos"] ?? keys["wiper pos"] ?? .5), variables);
  const wiperPos = Number.isFinite(pos) ? pos : .5;
  const modifierThickness = number("resistors/modifier thickness", 1);
  return { kind, bodyLength: cm(2 * half(width)), halfNormal: cm(half(times(number(prefix + "height 2", .3), scaledRlen))),
    wiperHalfNormal: cm(half(times(number(prefix + "height", .8), scaledRlen))),
    wiperPos, wiperOffset: cm(times(pgfDimension(wiperPos) - .5, width)),
    shapeScale, zigs, stub, zigStub: cm(stubSp), zigStep: cm(Math.trunc((width - 2 * stubSp) / (4 * zigs))),
    thickness, modifierThickness, fill, wiperThickness: kind === "european" ? 1 : thickness * modifierThickness };
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

export function potentiometerGeometry(geometry, settings, inverted = false, mirrored = false) {
  const point = place(frameFor(geometry), inverted, mirrored);
  const { bodyLength, halfNormal: down, wiperHalfNormal: up, wiperOffset: x } = settings;
  const right = bodyLength / 2;
  const wiper = point(x, up), tip = point(x, down);
  const n = point(0, up), s = point(0, -down), e = point(right, 0), w = point(-right, 0);
  const ne = point(right, up), nw = point(-right, up), se = point(right, -down), sw = point(-right, -down);
  // pgfcirc.defines.tex: compass names are local, including a=east and b=west.
  // Numeric label borders use unequal upper/lower radii; only mirror swaps them.
  return { wiper, tip, labelHalfNormal: { positive: mirrored ? down : up, negative: mirrored ? up : down },
    anchors: { center: geometry.mid, wiper, W: wiper, tip, n, north: n, above: n, s, south: s, below: s,
      e, east: e, right: e, a: e, w, west: w, left: w, b: w,
      ne, "north east": ne, nw, "north west": nw, se, "south east": se, sw, "south west": sw } };
}

export function potentiometerBodyItem(geometry, settings, pathStyle = {}, fill, inverted = false, mirrored = false) {
  const frame = frameFor(geometry);
  const { kind, thickness, halfNormal, bodyLength, zigs, zigStep, zigStub, shapeScale } = settings;
  const subtype = "circuitikz-potentiometer-body";
  const wireWidth = pathStyle.lineWidth ?? lineWidthFromPt(.4);
  const penSp = times(thickness, toSp(wireWidth / TIKZ_UNIT));
  const lineWidth = roundNumber(penSp * TIKZ_UNIT / SP_PER_CM);
  // CircuitikZ starts component drawing with arrows and corner arcs reset,
  // but inherits the surrounding dash and opacity (pgfcirc.defines.tex).
  const { dashArray, dashLineCap, opacity, fillOpacity, strokeOpacity } = pathStyle;
  const paint = { dashArray, dashLineCap, opacity, fillOpacity, strokeOpacity };
  if (kind === "european") {
    const { resistorKind: potentiometerKind, ...body } = fixedResistorItem(frame, settings,
      { ...pathStyle, lineWidth: wireWidth }, fill, inverted, mirrored);
    // pgfpathrectanglecorners emits a PDF rectangle for an identity matrix.
    // Its transformed path starts at the opposite corner (visible for dashes).
    const identity = frame.u.x * (inverted ? -1 : 1) === 1 && frame.u.y === 0 &&
      frame.n.y * (mirrored ? -1 : 1) === 1 && shapeScale === 1;
    if (!identity) {
      const [a, b, c, d, close] = body.commands;
      body.commands = [{ ...c, type: "moveTo" }, d, { ...a, type: "lineTo" }, b, close];
    }
    return { ...body, subtype, potentiometerKind, style: { ...paint, ...body.style, lineWidth } };
  }

  // pgf@circ@zigzag adds successive integer steps from the saved LEFT edge;
  // it does not center the rounded zigzag or move the wiper onto a peak.
  const point = place(frame, inverted, mirrored);
  const axisLength = pgfFixedVectorLength(shapeScale * frame.u.x, shapeScale * frame.u.y);
  const adjustment = axisLength ? pgfFixedReciprocal(axisLength) : 0;
  const overlap = times(pgfFixedMultiply(adjustment, .5), penSp) * shapeScale / SP_PER_CM;
  let x = -bodyLength / 2;
  const commands = [{ type: "moveTo", ...point(x - overlap, 0) }];
  const line = (along, normal) => commands.push({ type: "lineTo", ...point(along, normal) });
  x += zigStub;
  if (zigStub > 0) line(x - overlap, 0);
  for (let i = 0; i < 2 * zigs; i++) line(x + (2 * i + 1) * zigStep, i % 2 ? -halfNormal : halfNormal);
  x += 4 * zigs * zigStep;
  line(x + overlap, 0);
  if (zigStub > 0) line(x + zigStub + overlap, 0);
  return { type: "path", subtype, potentiometerKind: kind, zigs, paintAfterPath: true, commands,
    style: { ...paint, stroke: pathStyle.stroke || "black", fill: "none", lineWidth,
      lineCap: pathStyle.lineCap, lineJoin: "bevel", markerStart: undefined, markerEnd: undefined } };
}
