import { evaluateMath } from "../../engine/math.js";
import { pgfDimension } from "../../engine/pgf-fixed-point.js";
import { resistorBodyPath, resistorBodyRegisters, resistorCompassAnchors, resistorLocalPoint, scaledRegister } from "./resistorBody.js";

// Unlike a two-terminal variable resistor, a potentiometer has its own
// sliding contact, above a body with a separately configured lower height.
export function potentiometerSettings(kind = "american", keys = {}, variables = {}, shapeScale = 1) {
  const prefix = kind === "european" ? "bipoles/generic potentiometer/" : "bipoles/potentiometer/";
  const { width, cm, halfHeight, settings } = resistorBodyRegisters(kind, prefix, keys, variables, shapeScale);
  const pos = evaluateMath(String(keys[prefix + "wiper pos"] ?? keys["wiper pos"] ?? .5), variables);
  const wiperPos = Number.isFinite(pos) ? pos : .5;
  return { ...settings, halfNormal: cm(halfHeight("height 2", .3)), wiperHalfNormal: cm(halfHeight("height", .8)),
    wiperPos, wiperOffset: cm(scaledRegister(pgfDimension(wiperPos) - .5, width)),
    wiperThickness: kind === "european" ? 1 : settings.thickness * settings.modifierThickness };
}

export function potentiometerGeometry(geometry, settings, inverted = false, mirrored = false) {
  const point = resistorLocalPoint(geometry, inverted, mirrored);
  const { bodyLength, halfNormal: down, wiperHalfNormal: up, wiperOffset: x } = settings;
  const wiper = point(x, up), tip = point(x, down);
  return { wiper, tip, labelHalfNormal: { positive: mirrored ? down : up, negative: mirrored ? up : down },
    anchors: { ...resistorCompassAnchors(point, geometry.mid, bodyLength / 2, up, down), wiper, W: wiper, tip } };
}

export function potentiometerBodyItem(geometry, settings, pathStyle = {}, fill, inverted = false, mirrored = false) {
  const { resistorKind, ...body } = resistorBodyPath(geometry, settings, pathStyle, fill, inverted, mirrored);
  return { ...body, subtype: "circuitikz-potentiometer-body", potentiometerKind: resistorKind };
}
