import { normalizeColor } from "../../engine/colors.js";
import { evaluateMath, parseDimension, substituteVariables } from "../../engine/math.js";
import { pgfFixedMultiply } from "../../engine/pgf-fixed-math.js";
import { lineWidthFromPt, literalRegisterLengthCm } from "../../engine/units.js";

const ptPerCm = 72.27 / 2.54;
const defaultRlen = literalRegisterLengthCm("1.4cm");

function ink(raw) {
  return typeof raw === "string" && raw !== "" && raw !== "none" ? normalizeColor(raw) : undefined;
}

export function roundTerminalSettings(kind, keys = {}, wire = {}, variables = {}) {
  // circ and ocirc in pgfcircshapes.tex both use nodes width * Rlen, not the
  // scaled Rlen of the adjacent bipole. Rlen is a scanned TeX length register.
  const raw = substituteVariables(String(keys["bipoles/length"] ?? "1.4cm"), variables);
  const literal = literalRegisterLengthCm(raw);
  const length = Number.isFinite(literal) ? literal : parseDimension(raw, variables);
  const width = evaluateMath(keys["nodes width"] ?? ".04", variables);
  const radius = pgfFixedMultiply(Number.isFinite(width) ? width : .04,
    (Number.isFinite(length) ? length : defaultRlen) * ptPerCm) / ptPerCm;

  // setcolor sets the component pen. fill@strokecolor prefers explicit TikZ
  // draw ink, then CircuitikZ's tracked color. Bare [red] does not set that
  // register in the unpatched package. drawpoles nodes have no bipole class.
  const color = ink(keys.color);
  const stroke = color ?? ink(wire.stroke) ?? "black";
  const open = kind === "open";
  const fill = open
    ? ink(keys.tikzFillInk) ?? ink(keys["open poles fill"]) ?? "white"
    : ink(keys.tikzDrawInk) ?? color ?? "black";
  const alpha = evaluateMath(keys[open ? "poles/open fill opacity" : "poles/full fill opacity"] ?? 1, variables);
  return { radius, style: {
    stroke, fill, lineWidth: wire.lineWidth ?? lineWidthFromPt(.4),
    // The shape sets fill opacity *after* the path installs its draw/fill
    // opacities. A combined SVG opacity would incorrectly dim the fill again.
    opacity: undefined, strokeOpacity: wire.strokeOpacity ?? wire.opacity,
    fillOpacity: Number.isFinite(alpha) ? alpha : 1
  } };
}
