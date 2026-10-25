import { resolveColorSpec, convertColorSpec, colorSpecToRgb } from "../engine/colors.js";
import { dimensionDecimal, pgfFixedPoint, pgfFixedMultiply, pgfFixedDivide } from "../engine/pgf-fixed-math.js";

const printed = value => Number(dimensionDecimal(value));
const clamp = (value, max = 1) => Math.max(0, Math.min(max, value));

export function parsePgfplotsColormaps(raw) {
  const maps = {};
  for (const value of Array.isArray(raw) ? raw : [raw]) {
    if (typeof value !== "string") continue;
    const match = value.trim().match(/^\{([^{}]+)\}\s*\{([\s\S]*)\}$/);
    if (!match) continue;
    const stops = parseStops(match[2]);
    if (stops?.length >= 2) maps[match[1].trim()] = stops;
  }
  return maps;
}

function parseStops(body) {
  const stops = [];
  // Each declaration consumes the complete next token. Unknown declarations
  // must not leave a plausible but incomplete map behind.
  const token = /\s*(?:[;,]\s*)*(color|rgb255|rgb|cmyk|gray)\s*(?:\(([^()]*)\))?\s*=\s*\(([^()]*)\)\s*/y;
  let cursor = 0, step = 1;
  while (cursor < body.length) {
    if (/^[\s;,]*$/.test(body.slice(cursor))) break;
    token.lastIndex = cursor;
    const match = token.exec(body);
    if (!match) return null;
    const [, kind, rawPosition, rawColor] = match;
    const position = rawPosition === undefined ? (stops.length ? stops.at(-1).position + step : 0)
      : colormapPosition(rawPosition);
    if (!Number.isFinite(position) || (stops.length && position <= stops.at(-1).position)) return null;
    if (stops.length) step = stops.length === 1 ? position - stops[0].position
      : Math.min(step, position - stops.at(-1).position);
    if (kind === "color") {
      stops.push({ position, color: rawColor.trim() });
    } else {
      const channels = rawColor.split(",").map(value => value.trim() === "" ? NaN : Number(value));
      const count = kind === "gray" ? 1 : kind === "cmyk" ? 4 : 3;
      if (channels.length !== count || !channels.every(Number.isFinite)) return null;
      // pgfplotscolor.code.tex rescales rgb255 with the basic PGF multiplier,
      // not exact division by 255 (even 255 becomes 0.99998).
      const colorSpec = { model: kind === "rgb255" ? "rgb" : kind,
        channels: channels.map(channel => clamp(kind === "rgb255"
          ? printed(pgfFixedMultiply(.003921568, channel)) : channel)) };
      stops.push({ position, color: colormapColorCss(colorSpec), colorSpec });
    }
    cursor = token.lastIndex;
  }
  return stops;
}

function colormapPosition(raw) {
  const match = raw.trim().match(/^([+-]?(?:\d*\.)?\d+(?:e[+-]?\d+)?)\s*(cm|mm|pt|bp|in)?$/i);
  if (!match) return NaN;
  // Retain the historical public stop coordinates in cm. Bare PGF lengths
  // are points; all stops must share a physical unit before normalization.
  const factor = { cm: 1, mm: .1, pt: 2.54 / 72.27, bp: 2.54 / 72, in: 2.54 };
  return Number(match[1]) * factor[match[2]?.toLowerCase() ?? "pt"];
}

// PGF's FPU restores a decimal exponent after operating on fixed-point
// mantissas in [10,100). Only finite scalar multiply/divide are needed here.
function floatOperation(a, b, divide = false) {
  if (a === 0 || (!divide && b === 0)) return 0;
  const ae = Math.floor(Math.log10(Math.abs(a))) - 1;
  const be = Math.floor(Math.log10(Math.abs(b))) - 1;
  const operation = divide ? pgfFixedDivide : pgfFixedMultiply;
  return printed(operation(a / 10 ** ae, b / 10 ** be)) * 10 ** (divide ? ae - be : ae + be);
}

export function pgfplotsMappedColor(stops, value, min, max) {
  if (!Array.isArray(stops) || stops.length < 2) return null;
  if (![value, min, max].every(Number.isFinite)) return null;
  const specs = stops.map(stop => stop.colorSpec ?? resolveColorSpec(stop.color));
  if (specs.some(spec => !spec)) return null;
  // colorspace=auto selects CMYK only for a CMYK first stop. Conversion
  // precedes interpolation; DeviceCMYK display conversion happens last.
  const model = specs[0].model === "cmyk" ? "cmyk" : "rgb";
  const colors = specs.map(spec => convertColorSpec(spec, model));
  const positions = stops.map(stop => Number(stop.position));
  if (!positions.every((position, i) => Number.isFinite(position) && (!i || position > positions[i - 1]))) return null;
  const span = positions.at(-1) - positions[0];
  if (!(span > 0)) return null;
  const step = positions[1] - positions[0];
  const uniform = positions.every((position, i) => Math.abs(position - positions[0] - i * step) < span * 1e-6);
  const x = clamp(min === 0 && max === 1000 ? value
    : floatOperation(value - min, floatOperation(1000, max - min || 1, true)), 1000);
  let index, factor;
  if (uniform) {
    // Native lookup stores invh as a TeX dimension. Quantizing 0.001 to
    // 66sp changes every two-stop map; a float lerp misses that behavior.
    const invh = printed((positions.length - 1) / 1000);
    const local = pgfFixedMultiply(x, invh);
    index = Math.floor(local);
    factor = printed(local - index);
  } else {
    const normalized = positions.map(position => pgfFixedPoint(1000 * (position - positions[0]) / span));
    index = Math.max(0, normalized.findLastIndex(position => position <= pgfFixedPoint(x)));
    factor = index < colors.length - 1
      ? printed(pgfFixedDivide(pgfFixedPoint(x) - normalized[index], normalized[index + 1] - normalized[index])) : 1;
  }
  if (index >= colors.length - 1) return colors.at(-1);
  const left = colors[index], right = colors[index + 1];
  return { model, channels: left.channels.map((channel, i) => {
    // pgfplotscoloraddweighted performs two dimension assignments, printing
    // and reparsing between them rather than rounding the final RGB bytes.
    const first = printed(pgfFixedMultiply(channel, printed(1 - factor)));
    return clamp(printed(pgfFixedPoint(first) + pgfFixedMultiply(right.channels[i], factor)));
  }) };
}

export function colormapColorCss(spec) {
  return `rgb(${colorSpecToRgb(spec).map(channel => Number((clamp(channel) * 255).toFixed(6))).join(" ")})`;
}
