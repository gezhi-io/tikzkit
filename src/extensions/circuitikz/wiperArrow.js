import { parseArrowTipSpec, stripOuterBraces } from "../../engine/options.js";
import { closePathCommand, curveToCommand, lineToCommand, moveToCommand } from "../../engine/pathBuilder.js";
import { pgfFixedMultiply, pgfFixedPoint } from "../../engine/pgf-fixed-math.js";
import { PGF_SP } from "../../engine/pgf-fixed-point.js";
import { pgfNormalisedDirectionSp } from "../../pgf/normalisedDirection.js";
import { TIKZ_UNIT } from "../../tikz/metrics.js";

const cmPerPt = 2.54 / 72.27;
const ink = value => value && value !== "none" ? value : undefined;
const nonnegative = (value, fallback) => Number.isFinite(value) && value >= 0 ? value : fallback;
const item = { type: "path", paintAfterPath: true };

function familyTip(raw, fallback) {
  const name = raw == null ? "default" : stripOuterBraces(String(raw).trim());
  return name === "default" ? fallback : name;
}

// pgfcirc.defines.tex: latexslim has extents -4d / +6d and no line-end
// offset. Reversing it reflects its x coordinates and puts -4d at the anchor.
function slimTerminal(anchor, other, name, d, canvasScale, headStyle, subtype) {
  if (name !== "latexslim" && name !== "latexslim reversed") {
    return { shaft: anchor, marker: name ? parseArrowTipSpec(name) : undefined };
  }
  const sp = PGF_SP / (cmPerPt * canvasScale);
  const dx = Math.round(anchor.x * sp) - Math.round(other.x * sp);
  const dy = Math.round(anchor.y * sp) - Math.round(other.y * sp);
  const outward = pgfNormalisedDirectionSp(dx, dy);
  const inward = pgfNormalisedDirectionSp(-dx, -dy); // Both normalize to +y for coincident anchors.
  const ux = outward.x / PGF_SP, uy = outward.y / PGF_SP;
  const reversed = name === "latexslim reversed", cut = reversed ? 4 : 6;
  function point(x, y) {
    const along = (reversed ? -x : x) - cut;
    return { x: anchor.x + d * (along * ux - y * uy), y: anchor.y + d * (along * uy + y * ux) };
  }
  return {
    shaft: { x: anchor.x + cut * d * inward.x / PGF_SP, y: anchor.y + cut * d * inward.y / PGF_SP },
    head: { ...item, subtype: subtype + "-head", style: headStyle, commands: [
      moveToCommand(point(6, 0)),
      curveToCommand(point(3.5, .5), point(-1, 1.5), point(-4, 3.75)),
      curveToCommand(point(-1.5, 1), point(-1.5, -1), point(-4, -3.75)),
      curveToCommand(point(-1, -1.5), point(3.5, -.5), point(6, 0)),
      closePathCommand()
    ] }
  };
}

// Anchors are in scene cm; lineWidth is the incoming wire pen in scene-style
// units. Only a backend canvas scale enlarges the physical .28pt tip constant.
export function resistorModifierArrowItems(from, to, settings, pathStyle, subtype) {
  const canvas = nonnegative(settings.canvasScale, 1) || 1;
  const drawnPt = cmPerPt * TIKZ_UNIT * canvas;
  const wirePt = pgfFixedPoint(nonnegative(pathStyle.lineWidth, .4 * drawnPt) / drawnPt);
  const penPt = pgfFixedMultiply(pgfFixedMultiply(wirePt, settings.bodyFactor), settings.modifierFactor);
  const d = (pgfFixedPoint(.28) + pgfFixedMultiply(.3, penPt)) * cmPerPt * canvas;
  const color = ink(settings.color);
  const stroke = color ?? ink(pathStyle.stroke) ?? "black";
  const fill = color ?? ink(settings.headFill) ?? ink(pathStyle.fill) ?? "black";
  const reset = { markerStart: undefined, markerEnd: undefined, shortenStart: undefined, shortenEnd: undefined,
    doubleColor: undefined, opacity: undefined };
  const fillOpacity = pathStyle.fillOpacity ?? pathStyle.opacity;
  const headStyle = { ...reset, fill, fillOpacity, stroke: "none", lineWidth: 0 };
  // PGF shortens the end first. A very short two-headed line may cross
  // its start, so the start tip must see the rewritten opposite endpoint.
  const end = slimTerminal(to, from, familyTip(settings.endTip, "latexslim"), d, canvas, headStyle, subtype);
  const start = slimTerminal(from, end.shaft, familyTip(settings.startTip, ""), d, canvas, headStyle, subtype);
  const items = [{ ...item, subtype,
    style: { ...reset, stroke, fill: "none", lineWidth: penPt * drawnPt,
      lineCap: pathStyle.lineCap ?? "butt", lineJoin: settings.join,
      dashArray: pathStyle.dashArray, strokeOpacity: pathStyle.strokeOpacity ?? pathStyle.opacity, fillOpacity,
      markerStart: start.marker, markerEnd: end.marker },
    commands: [moveToCommand(start.shaft), lineToCommand(end.shaft)] }];
  if (start.head) items.push(start.head);
  if (end.head) items.push(end.head);
  return items;
}

export function potentiometerWiperItems({ wiper, tip }, settings = {}, pathStyle = {}) {
  const european = settings.kind === "european", explicit = Number.isFinite(settings.wiperThickness);
  return resistorModifierArrowItems(wiper, tip, {
    canvasScale: settings.canvasScale, color: settings.color, headFill: settings.wiperHeadFill,
    bodyFactor: explicit ? settings.wiperThickness : european ? 1 : nonnegative(settings.thickness, 2),
    modifierFactor: explicit || european ? 1 : nonnegative(settings.modifierThickness, 1),
    startTip: settings.wiperStartArrow, endTip: settings.wiperEndArrow,
    join: european ? pathStyle.lineJoin ?? "miter" : "bevel"
  }, pathStyle, "circuitikz-potentiometer-wiper");
}
