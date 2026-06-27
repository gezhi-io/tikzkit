import { roundNumber } from "../math.js";
import { parseOptions } from "../options.js";

export const tikzLibrary = {
  name: "matrix",
  status: "builtin",
  implementedBy: "src/libraries/matrix.js + src/parser.js:parseMatrix",
  features: ["matrix of nodes", "matrix of math nodes", "cell anchors", "bracket delimiters"],
  implements: ["matrix of nodes", "matrix of math nodes", "cell anchors", "bracket delimiters"]
};

export function isMatrixNodeOptions(options = {}) {
  return Boolean(options["matrix of nodes"] || options["matrix of math nodes"]);
}

export function matrixCellText(text, matrixOptions = {}) {
  const value = String(text ?? "").trim();
  if (!matrixOptions["matrix of math nodes"] || !value) return value;
  if (/^\$[\s\S]*\$$/.test(value) || /^\\\([\s\S]*\\\)$/.test(value) || /^\\\[[\s\S]*\\\]$/.test(value)) {
    return value;
  }
  return `$${value}$`;
}

export function addMatrixDelimiters(ir, options = {}, origin, width, height, matrixStyle = {}, env = {}, parseFiniteDimension) {
  const left = normalizeMatrixDelimiter(options["left delimiter"]);
  const right = normalizeMatrixDelimiter(options["right delimiter"]);
  if (!left && !right) return;
  const gap = Math.max(0.035, parseFiniteDimension(options["delimiter sep"], env, 0.06));
  const tick = Math.max(0.055, Math.min(0.12, width * 0.16));
  const top = origin.y + height / 2;
  const bottom = origin.y - height / 2;
  const style = {
    stroke: matrixStyle.stroke && matrixStyle.stroke !== "none" ? matrixStyle.stroke : "black",
    fill: "none",
    lineWidth: matrixStyle.lineWidth || 1,
    lineCap: "butt",
    lineJoin: "miter"
  };
  if (left) {
    const x = origin.x - width / 2 - gap;
    ir.items.push(matrixDelimiterPath(left, "left", x, top, bottom, tick, style));
  }
  if (right) {
    const x = origin.x + width / 2 + gap;
    ir.items.push(matrixDelimiterPath(right, "right", x, top, bottom, tick, style));
  }
}

export function matrixRowNodeOptions(matrixOptions = {}, rowNumber) {
  const rowStyle = matrixOptions[`row ${rowNumber}/.style`];
  if (rowStyle === undefined || rowStyle === true) return {};
  const rowOptions = parseOptions(rowStyle);
  const nodeOptions = rowOptions.nodes ? parseOptions(rowOptions.nodes) : {};
  return { ...matrixInheritedNodeOptions(rowOptions), ...nodeOptions };
}

export function matrixInheritedNodeOptions(options = {}) {
  const inherited = {};
  for (const key of ["text height", "text depth", "font", "text", "align", "text width", "minimum width", "minimum height", "minimum size"]) {
    if (Object.hasOwn(options, key)) inherited[key] = options[key];
  }
  return inherited;
}

function normalizeMatrixDelimiter(value) {
  const text = String(value ?? "").trim();
  if (!text || text === "." || /^none$/i.test(text)) return null;
  if (text === "[" || text === "{[}") return "[";
  if (text === "]" || text === "{]}") return "]";
  return null;
}

function matrixDelimiterPath(delimiter, side, x, top, bottom, tick, style) {
  const inward = side === "left" ? 1 : -1;
  if (delimiter === "[" || delimiter === "]") {
    return {
      type: "path",
      subtype: "matrix-delimiter",
      style,
      commands: [
        { type: "moveTo", x: roundNumber(x + inward * tick), y: roundNumber(top) },
        { type: "lineTo", x: roundNumber(x), y: roundNumber(top) },
        { type: "lineTo", x: roundNumber(x), y: roundNumber(bottom) },
        { type: "lineTo", x: roundNumber(x + inward * tick), y: roundNumber(bottom) }
      ]
    };
  }
  return {
    type: "path",
    subtype: "matrix-delimiter",
    style,
    commands: []
  };
}
