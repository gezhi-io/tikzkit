import { parseDimension, roundNumber } from "../math.js";
import { parseOptions, splitTopLevel, stripOuterBraces } from "../options.js";

const ROW_SEP = {
  huge: "+3.6em",
  large: "+2.7em",
  normal: "+1.8em",
  scriptsize: "+1.35em",
  small: "+0.9em",
  tiny: "+0.45em"
};

const COLUMN_SEP = {
  huge: "+4.8em",
  large: "+3.6em",
  normal: "+2.4em",
  scriptsize: "+1.8em",
  small: "+1.2em",
  tiny: "+0.6em"
};

const TIKZCD_CELL_MIN_WIDTH = 0.58;
const TIKZCD_CELL_MIN_HEIGHT = 0.5;

const TIKZCD_COMPARE_GRID_SCOPE = String.raw`\begin{scope}[on background layer]
  \draw[black!45,line width=0.18pt,dash pattern=on 1pt off 1.2pt,step=1cm] ($(current bounding box.south west)+(-1,-1)$) grid ($(current bounding box.north east)+(1,1)$);
\end{scope}`;

export const tikzCdExtension = {
  name: "tikz-cd",
  phase: "preprocess",
  description: "Expands practical tikz-cd commutative diagram environments into ordinary TikZ nodes and arrows.",
  commands: ["tikzcd", "arrow", "ar", "rar", "lar", "dar", "uar"],
  preprocess(source, context = {}) {
    return expandTikzCd(String(source), context.diagnostics || []);
  }
};

function expandTikzCd(source, diagnostics = []) {
  let output = "";
  let index = 0;
  while (index < source.length) {
    const begin = source.indexOf("\\begin{tikzcd}", index);
    if (begin === -1) {
      output += source.slice(index);
      break;
    }
    output += source.slice(index, begin);
    const parsed = parseTikzCdEnvironment(source, begin, diagnostics);
    if (!parsed) {
      output += source.slice(begin, begin + "\\begin{tikzcd}".length);
      index = begin + "\\begin{tikzcd}".length;
      continue;
    }
    output += parsed.replacement;
    index = parsed.end;
  }
  return output;
}

function parseTikzCdEnvironment(source, begin, diagnostics) {
  let cursor = begin + "\\begin{tikzcd}".length;
  cursor = skipWhitespace(source, cursor);
  let optionsRaw = "";
  if (source[cursor] === "[") {
    const options = extractBalanced(source, cursor, "[", "]");
    if (!options) return null;
    optionsRaw = options.content;
    cursor = options.end;
  }
  const endToken = "\\end{tikzcd}";
  const end = source.indexOf(endToken, cursor);
  if (end === -1) {
    diagnostics.push({ severity: "warning", message: "Malformed tikzcd environment" });
    return null;
  }
  const body = source.slice(cursor, end);
  return {
    replacement: renderTikzCd(body, optionsRaw, diagnostics),
    end: end + endToken.length
  };
}

function renderTikzCd(body, optionsRaw, diagnostics) {
  const id = nextDiagramId();
  const options = parseOptions(optionsRaw);
  const rowSep = tikzCdSep(options["row sep"] ?? options.sep, ROW_SEP);
  const columnSep = tikzCdSep(options["column sep"] ?? options.sep, COLUMN_SEP);
  const rows = splitRows(body).map((row, rowIndex) =>
    splitCells(row).map((rawCell, columnIndex) =>
      parseCell(rawCell, { id, row: rowIndex + 1, column: columnIndex + 1, diagnostics })
    )
  );
  const layout = layoutTikzCdCells(rows, { id, rowSep, columnSep });
  const statements = [`\\begin{tikzpicture}[tikzcd diagram]`];
  const arrows = [];

  rows.forEach((cells, rowIndex) => {
    cells.forEach((parsed, columnIndex) => {
      const row = rowIndex + 1;
      const column = columnIndex + 1;
      const name = cellName(id, row, column);
      const position = layout.positions.get(name) || { x: columnIndex * columnSep, y: -rowIndex * rowSep };
      const nodeOptions = [
        "inner sep=0.12cm",
        `minimum width=${fmt(layout.columnWidths[columnIndex] || TIKZCD_CELL_MIN_WIDTH)}cm`,
        `minimum height=${fmt(layout.rowHeights[rowIndex] || TIKZCD_CELL_MIN_HEIGHT)}cm`
      ];
      if (parsed.nodeOptions) nodeOptions.push(parsed.nodeOptions);
      statements.push(`\\node[${nodeOptions.join(",")}] (${name}) at (${fmt(position.x)},${fmt(position.y)}) {${tikzCdCellText(parsed.text)}};`);
      for (const alias of parsed.aliases) {
        statements.push(`\\coordinate (${alias}) at (${name});`);
      }
      for (const arrow of parsed.arrows) {
        arrows.push(renderArrow(arrow, layout));
      }
    });
  });

  statements.push(...arrows.filter(Boolean));
  if (options["tikzkit compare grid"]) statements.push(TIKZCD_COMPARE_GRID_SCOPE);
  statements.push("\\end{tikzpicture}");
  return statements.join("\n");
}

function layoutTikzCdCells(rows, context) {
  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const columnWidths = Array.from({ length: columnCount }, () => TIKZCD_CELL_MIN_WIDTH);
  const rowHeights = rows.map(() => TIKZCD_CELL_MIN_HEIGHT);
  rows.forEach((cells, rowIndex) => {
    cells.forEach((cell, columnIndex) => {
      const size = estimateTikzCdCellSize(cell.text);
      columnWidths[columnIndex] = Math.max(columnWidths[columnIndex], size.width);
      rowHeights[rowIndex] = Math.max(rowHeights[rowIndex], size.height);
    });
  });

  const xs = [];
  for (let column = 0; column < columnCount; column += 1) {
    xs[column] =
      column === 0
        ? 0
        : xs[column - 1] + context.columnSep + columnWidths[column - 1] / 2 + columnWidths[column] / 2;
  }

  const ys = [];
  for (let row = 0; row < rows.length; row += 1) {
    ys[row] =
      row === 0
        ? 0
        : ys[row - 1] - context.rowSep - rowHeights[row - 1] / 2 - rowHeights[row] / 2;
  }

  const positions = new Map();
  rows.forEach((cells, rowIndex) => {
    cells.forEach((_cell, columnIndex) => {
      positions.set(cellName(context.id, rowIndex + 1, columnIndex + 1), {
        x: roundNumber(xs[columnIndex], 6),
        y: roundNumber(ys[rowIndex], 6)
      });
    });
  });
  return { ...context, positions, columnWidths, rowHeights };
}

function estimateTikzCdCellSize(text) {
  const normalized = normalizeCellText(text);
  if (!normalized) return { width: TIKZCD_CELL_MIN_WIDTH, height: TIKZCD_CELL_MIN_HEIGHT };
  const width = Math.max(TIKZCD_CELL_MIN_WIDTH, 0.24 + normalized.length * 0.105);
  const height = Math.max(TIKZCD_CELL_MIN_HEIGHT, /[_^]|\\(?:frac|sum|int|prod)\b/.test(String(text || "")) ? 0.62 : 0.5);
  return {
    width: roundNumber(width, 6),
    height: roundNumber(height, 6)
  };
}

function normalizeCellText(text) {
  return String(text || "")
    .replace(/\\(?:small|scriptsize|tiny|displaystyle|textstyle)\b/g, "")
    .replace(/\\(?:times|otimes|oplus|cdot)\b/g, "x")
    .replace(/\\[A-Za-z]+/g, "x")
    .replace(/[{}$]/g, "")
    .replace(/\s+/g, "");
}

let diagramCounter = 0;

function nextDiagramId() {
  diagramCounter += 1;
  return diagramCounter;
}

function parseCell(rawCell, context) {
  const aliases = [];
  let text = String(rawCell || "").trim();
  let nodeOptions = "";
  const optionPrefix = text.match(/^\|\[([\s\S]*?)\]\|/);
  if (optionPrefix) {
    nodeOptions = optionPrefix[1].trim();
    const options = parseOptions(nodeOptions);
    if (options.alias && options.alias !== true) aliases.push(String(options.alias).trim());
    if (options.name && options.name !== true) aliases.push(String(options.name).trim());
    text = text.slice(optionPrefix[0].length).trim();
  }

  const arrows = [];
  let output = "";
  let index = 0;
  while (index < text.length) {
    const parsed = parseArrowCommandAt(text, index, context);
    if (parsed) {
      arrows.push(parsed.arrow);
      index = parsed.end;
      continue;
    }
    output += text[index];
    index += 1;
  }
  return { text: output.trim(), arrows, aliases, nodeOptions };
}

function parseArrowCommandAt(source, index, context) {
  const shortcut = parseArrowShortcut(source, index);
  if (!shortcut) return null;
  let cursor = shortcut.end;
  cursor = skipWhitespace(source, cursor);
  let optionsRaw = shortcut.direction || "";
  if (source[cursor] === "[") {
    const options = extractBalanced(source, cursor, "[", "]");
    if (!options) return null;
    optionsRaw = optionsRaw ? `${optionsRaw},${options.content}` : options.content;
    cursor = options.end;
  }
  cursor = skipWhitespace(source, cursor);
  if (source[cursor] === "{") {
    const oldLabel = extractBalanced(source, cursor, "{", "}");
    if (oldLabel) {
      optionsRaw += `${optionsRaw ? "," : ""}"${oldLabel.content}"`;
      cursor = oldLabel.end;
    }
  }
  return {
    arrow: parseArrowOptions(optionsRaw, context),
    end: cursor
  };
}

function parseArrowShortcut(source, index) {
  const commands = [
    ["\\arrow", ""],
    ["\\ar", ""],
    ["\\rar", "r"],
    ["\\lar", "l"],
    ["\\dar", "d"],
    ["\\uar", "u"],
    ["\\urar", "ur"],
    ["\\ular", "ul"],
    ["\\drar", "dr"],
    ["\\dlar", "dl"]
  ];
  for (const [command, direction] of commands) {
    if (!source.startsWith(command, index)) continue;
    const next = source[index + command.length];
    if (/[A-Za-z@]/.test(next || "")) continue;
    return { direction, end: index + command.length };
  }
  return null;
}

function parseArrowOptions(optionsRaw, context) {
  const arrow = {
    start: null,
    target: null,
    labels: [],
    style: ["->"],
    bend: null,
    phantom: false
  };
  for (const rawPart of splitTopLevel(optionsRaw || ",")) {
    const part = rawPart.trim();
    if (!part) continue;
    const label = parseQuotedLabel(part);
    if (label) {
      arrow.labels.push(label);
      continue;
    }
    if (arrow.labels.length && (part === "'" || part === "swap" || part === "description" || /near (?:start|end)/.test(part))) {
      Object.assign(arrow.labels.at(-1), labelOptionsFromText(part));
      continue;
    }
    if (/^[rlud]+$/.test(part)) {
      arrow.target = relativeCell(context, part);
      continue;
    }
    const equals = part.indexOf("=");
    if (equals !== -1) {
      const key = part.slice(0, equals).trim();
      const value = stripOuterBraces(part.slice(equals + 1).trim());
      if (key === "to") {
        arrow.target = targetCell(context, value);
        continue;
      }
      if (key === "from") {
        arrow.start = targetCell(context, value);
        continue;
      }
      if (key === "bend left" || key === "bend right") {
        arrow.bend = `${key}=${value || "30"}`;
        continue;
      }
      arrow.style.push(`${key}=${value}`);
      continue;
    }
    applyBareArrowOption(arrow, part);
  }
  arrow.start ||= cellName(context.id, context.row, context.column);
  arrow.target ||= cellName(context.id, context.row, context.column);
  return arrow;
}

function applyBareArrowOption(arrow, part) {
  if (part === "phantom") {
    arrow.phantom = true;
    return;
  }
  if (part === "bend left" || part === "bend right") {
    arrow.bend = part;
    return;
  }
  if (part === "dashed" || part === "dotted" || part === "densely dotted" || part === "red" || part === "blue" || part === "purple" || part === "green") {
    arrow.style.push(part);
    return;
  }
  if (part === "dashrightarrow") {
    arrow.style.push("dashed");
    return;
  }
  if (part === "dashleftarrow" || part === "leftarrow") {
    arrow.style = arrow.style.filter((item) => item !== "->");
    arrow.style.push("<-");
    if (part === "dashleftarrow") arrow.style.push("dashed");
    return;
  }
  if (part === "leftrightarrow" || part === "Leftrightarrow") {
    arrow.style = arrow.style.filter((item) => item !== "->");
    arrow.style.push("<->");
    return;
  }
  if (part === "Rightarrow" || part === "Leftarrow") {
    arrow.style.push("very thick");
    if (part === "Leftarrow") {
      arrow.style = arrow.style.filter((item) => item !== "->");
      arrow.style.push("<-");
    }
    return;
  }
  if (part === "no head" || part === "dash" || part === "equal" || part === "equals") {
    arrow.style = arrow.style.filter((item) => item !== "->");
    if (part === "equal" || part === "equals") arrow.style.push("double");
    return;
  }
  if (part === "two heads") {
    arrow.style = arrow.style.filter((item) => item !== "->");
    arrow.style.push("-{two heads}");
    return;
  }
  if (part === "hook" || part === "hook'" || part === "tail") {
    if (!arrow.style.some((item) => item === "hook-" || item === "{hook}-")) arrow.style.push("{hook}-");
    return;
  }
  if (part === "rightarrow" || part === "to head") return;
  if (part === "mapsto" || part === "maps to") {
    if (!arrow.style.some((item) => item === "hook-" || item === "{hook}-")) arrow.style.push("{hook}-");
    return;
  }
  arrow.style.push(part);
}

function parseQuotedLabel(part) {
  if (!part.startsWith("\"")) return null;
  let index = 1;
  let content = "";
  while (index < part.length) {
    if (part[index] === "\"" && part[index - 1] !== "\\") break;
    content += part[index];
    index += 1;
  }
  if (index >= part.length) return null;
  const rest = part.slice(index + 1).trim();
  return {
    text: content,
    ...labelOptionsFromText(rest)
  };
}

function labelOptionsFromText(text) {
  const normalized = String(text || "").trim();
  return {
    swap: normalized.includes("'") || /\bswap\b/.test(normalized),
    description: /\bdescription\b/.test(normalized),
    position: normalized.includes("very near start")
      ? "0.12"
      : normalized.includes("near start")
        ? "0.25"
        : normalized.includes("near end")
          ? "0.75"
          : "0.5"
  };
}

function renderArrow(arrow, layout = {}) {
  if (arrow.phantom && !arrow.labels.length) return "";
  const style = arrow.phantom ? "" : `[${arrow.style.join(",")}${arrow.bend ? `,${arrow.bend}` : ""}]`;
  const connector = arrow.bend && !arrow.phantom ? "to" : "--";
  const command = arrow.phantom ? "\\path" : "\\draw";
  const labelNodes = renderArrowLabelNodes(arrow, layout);
  const inlineLabels = labelNodes ? "" : arrow.labels.map(renderArrowLabel).join(" ");
  const path = arrow.phantom ? "" : `${command}${style} (${arrow.start}) ${connector} ${inlineLabels} (${arrow.target});`;
  return [path, labelNodes].filter(Boolean).join("\n");
}

function renderArrowLabel(label) {
  const side = label.description ? "" : label.swap ? "below" : "above";
  const options = ["midway"];
  if (label.position && label.position !== "0.5") options.push(`pos=${label.position}`);
  if (side) options.push(side);
  return `node[${options.join(",")}] {${tikzCdLabelText(label.text)}}`;
}

function renderArrowLabelNodes(arrow, layout = {}) {
  if (!arrow.labels.length) return "";
  const start = tikzCdCellPosition(arrow.start, layout);
  const target = tikzCdCellPosition(arrow.target, layout);
  if (!start || !target) return "";
  const dx = target.x - start.x;
  const dy = target.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const normal = { x: -dy / length, y: dx / length };
  const gap = 0.11;
  return arrow.labels
    .map((label) => {
      const position = Number(label.position || "0.5");
      const t = Number.isFinite(position) ? position : 0.5;
      const side = label.description ? 0 : label.swap ? -1 : 1;
      const point = {
        x: start.x + dx * t + normal.x * side * gap,
        y: start.y + dy * t + normal.y * side * gap
      };
      const options = ["tikzcd label", "inner sep=0.02cm"];
      if (label.description) options.push("fill=white");
      return `\\node[${options.join(",")}] at (${fmt(point.x)},${fmt(point.y)}) {${tikzCdLabelText(label.text)}};`;
    })
    .join("\n");
}

function tikzCdCellPosition(name, layout = {}) {
  if (layout.positions?.has?.(name)) return layout.positions.get(name);
  const match = String(name || "").match(/^tikzcd-\d+-(\d+)-(\d+)$/);
  if (!match) return null;
  const row = Number(match[1]);
  const column = Number(match[2]);
  if (!Number.isFinite(row) || !Number.isFinite(column)) return null;
  return {
    x: (column - 1) * (layout.columnSep || 0),
    y: -(row - 1) * (layout.rowSep || 0)
  };
}

function targetCell(context, rawTarget) {
  const target = String(rawTarget || "").trim();
  if (/^[rlud]+$/.test(target)) return relativeCell(context, target);
  const absolute = target.match(/^(\d+)-(\d+)$/);
  if (absolute) return cellName(context.id, Number(absolute[1]), Number(absolute[2]));
  return target;
}

function relativeCell(context, direction) {
  let row = context.row;
  let column = context.column;
  for (const char of String(direction || "")) {
    if (char === "r") column += 1;
    if (char === "l") column -= 1;
    if (char === "d") row += 1;
    if (char === "u") row -= 1;
  }
  return cellName(context.id, row, column);
}

function cellName(id, row, column) {
  return `tikzcd-${id}-${row}-${column}`;
}

function tikzCdCellText(text) {
  const trimmed = String(text || "").trim();
  return trimmed ? `\\small ${wrapMath(trimmed)}` : "";
}

function tikzCdLabelText(text) {
  return `\\tiny ${wrapMath(String(text || "").trim())}`;
}

function wrapMath(text) {
  if (!text) return "";
  if (/^\$[\s\S]*\$$/.test(text)) return text;
  return `$${text}$`;
}

function tikzCdSep(value, table) {
  const raw = value === undefined || value === true || value === "" ? "normal" : String(value).trim();
  return parseDimension(table[raw] || raw || table.normal);
}

function splitRows(body) {
  const rows = [];
  let current = "";
  let brace = 0;
  let bracket = 0;
  let paren = 0;
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (char === "{" && body[index - 1] !== "\\") brace += 1;
    if (char === "}" && body[index - 1] !== "\\") brace = Math.max(0, brace - 1);
    if (char === "[") bracket += 1;
    if (char === "]") bracket = Math.max(0, bracket - 1);
    if (char === "(") paren += 1;
    if (char === ")") paren = Math.max(0, paren - 1);
    if (char === "\\" && body[index + 1] === "\\" && brace === 0 && bracket === 0 && paren === 0) {
      rows.push(current);
      current = "";
      index += 1;
      continue;
    }
    current += char;
  }
  if (current.trim() || rows.length) rows.push(current);
  return rows;
}

function splitCells(row) {
  const cells = [];
  let current = "";
  let brace = 0;
  let bracket = 0;
  let paren = 0;
  for (let index = 0; index < row.length; index += 1) {
    const char = row[index];
    if (char === "{" && row[index - 1] !== "\\") brace += 1;
    if (char === "}" && row[index - 1] !== "\\") brace = Math.max(0, brace - 1);
    if (char === "[") bracket += 1;
    if (char === "]") bracket = Math.max(0, bracket - 1);
    if (char === "(") paren += 1;
    if (char === ")") paren = Math.max(0, paren - 1);
    if (char === "&" && row[index - 1] !== "\\" && brace === 0 && bracket === 0 && paren === 0) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

function extractBalanced(source, start, open, close) {
  if (source[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === open && source[index - 1] !== "\\") depth += 1;
    if (source[index] === close && source[index - 1] !== "\\") depth -= 1;
    if (depth === 0) {
      return { content: source.slice(start + 1, index), end: index + 1 };
    }
  }
  return null;
}

function skipWhitespace(source, index) {
  while (/\s/.test(source[index] || "")) index += 1;
  return index;
}

function fmt(value) {
  return String(roundNumber(value, 6));
}
