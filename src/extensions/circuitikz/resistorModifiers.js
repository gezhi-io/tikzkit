import { tikzBoolean } from "../../engine/options.js";
import { lineToCommand, moveToCommand } from "../../engine/pathBuilder.js";
import { potentiometerBodyItem, potentiometerGeometry, potentiometerSettings } from "./potentiometers.js";
import { resistorBodyPath, resistorBodyRegisters, resistorCompassAnchors, resistorLocalPoint, scaledRegister } from "./resistorBody.js";
import { potentiometerWiperItems, resistorModifierArrowItems } from "./wiperArrow.js";

// The shorthand selects the current region; the explicit names never do.
const aliases = new Map();
function family(name, automatic, american, european) {
  for (const [region, names] of [[null, automatic], ["american", american], ["european", european]]) {
    for (const key of names) aliases.set(key, { family: name, region });
  }
}
family("potentiometer", ["pR", "potentiometer"], ["american potentiometer"], ["european potentiometer"]);
family("variable-resistor", ["vR", "variable resistor"], ["variable american resistor"], ["variable european resistor", "tgeneric"]);
family("resistive-sensor", ["sR", "resistive sensor"], ["american resistive sensor"], ["european resistive sensor", "thermistor", "thR"]);

export function resistorModifierSpec(options) {
  for (const [key, value] of Object.entries(options)) {
    const alias = aliases.get(key);
    if (alias) return { ...alias, kind: "resistorWithModifier", label: typeof value === "string" ? value.trim() : "" };
  }
  return null;
}

function diagonalResistor(spec, geometry, region, context) {
  const { keys, variables, shapeScale, inverted, mirrored, style, fill } = context;
  const european = region === "european", sensor = spec.family === "resistive-sensor";
  const register = sensor ? (european ? "thermistor" : "resistivesens") : (european ? "tgeneric" : "vresistor");
  const { cm, width, halfHeight, number, settings } = resistorBodyRegisters(region, "bipoles/" + register + "/", keys, variables, shapeScale);
  const half = halfHeight("height", european ? (sensor ? .428 : .7) : .6);
  const along = factor => cm(scaledRegister(factor, Math.trunc(width / 2)));
  const normal = factor => cm(scaledRegister(factor, half));
  const point = resistorLocalPoint(geometry, inverted, mirrored);
  const prefix = "circuitikz-" + spec.family;

  // The compass anchors describe the saved envelope, not the painted body.
  // The European sensor also extends its numeric lower label border by 20%.
  const compass = resistorCompassAnchors(point, geometry.mid, along(1), normal(1), normal(1));
  const down = european && sensor ? 1.2 : 1;
  const wiperX = sensor ? (european ? -1 : -.9) : (european ? -.5 : -.4);
  const tipX = european ? (sensor ? 1 : .5) : .4;
  const wiper = point(along(wiperX), normal(-down)), tip = point(along(tipX), normal(1));
  const anchors = { ...compass, wiper, W: wiper, tip };
  const bodyFraction = european ? (sensor ? number("bipoles/thermistor/main", .7) : .4) : .5;
  const body = resistorBodyPath(geometry, { ...settings, halfNormal: normal(bodyFraction) }, style, fill, inverted, mirrored);
  body.subtype = prefix + "-body";
  const items = [body];
  if (sensor) {
    const elbow = point(along(-.4), normal(-down));
    anchors.label = elbow;
    items.push({ type: "path", subtype: prefix + "-modifier", paintAfterPath: true,
      style: { ...body.style, fill: "none", lineWidth: settings.modifierThickness * body.style.lineWidth },
      commands: [moveToCommand(tip), lineToCommand(elbow), lineToCommand(wiper)] });
  } else {
    // Before CircuitikZ 1.3.3, vresistor reversed the segment, but tgeneric
    // reflected only its y coordinates. Neither switch changes the anchors.
    const modern = tikzBoolean(keys["bipoles/fix tunable direction"] ?? true);
    const from = modern ? wiper : european ? point(along(wiperX), normal(1)) : tip;
    const to = modern ? tip : european ? point(along(tipX), normal(-1)) : wiper;
    // Filling tgeneric updates PGF's recorded fill. Its arrow-color setup
    // then restores the recorded pen, not the box ink or the deferred wire
    // stroke. An unfilled zigzag leaves the original backend fill intact.
    const headFill = context.color ?? (european && body.style.fill !== "none" ? context.currentColor : context.headFill);
    items.push(...resistorModifierArrowItems(from, to, { headFill, canvasScale: context.canvasScale,
      bodyFactor: settings.thickness, modifierFactor: settings.modifierThickness,
      startTip: keys["tunable start arrow"], endTip: keys["tunable end arrow"],
      join: body.style.lineJoin ?? "miter" }, style, prefix + "-modifier"));
  }
  return { items, bodyLength: settings.bodyLength, anchors,
    nodeShape: sensor ? "circuitikzResistiveSensor" : "circuitikzVariableResistor",
    labelHalfNormal: { positive: normal(mirrored ? down : 1), negative: normal(mirrored ? 1 : down) } };
}

export function resistorWithModifier(spec, geometry, context) {
  const { keys, variables, shapeScale, inverted, mirrored, style, fill } = context;
  const region = spec.region ?? keys["resistor/kind"] ?? "american";
  if (spec.family !== "potentiometer") return diagonalResistor(spec, geometry, region, context);
  const settings = potentiometerSettings(region, keys, variables, shapeScale);
  const shape = potentiometerGeometry(geometry, settings, inverted, mirrored);
  const wiper = { ...settings, color: context.color, wiperHeadFill: context.headFill, canvasScale: context.canvasScale,
    wiperStartArrow: keys["wiper start arrow"], wiperEndArrow: keys["wiper end arrow"] };
  return { ...shape, nodeShape: "circuitikzPotentiometer", bodyLength: settings.bodyLength,
    items: [potentiometerBodyItem(geometry, settings, style, fill, inverted, mirrored), ...potentiometerWiperItems(shape, wiper, style)] };
}
