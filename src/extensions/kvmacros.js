const KARNAUGH_COMMANDS = [String.raw`\karnaughmap`, String.raw`\kvmap`];
const DRAW_ARROW = String.raw`\DrawArrow`;
const UNIT_CM = 0.8;
const TEX_INTERWORD_SPACE_CM = (10 / 3) / 28.4527559;
const BEZIER_CIRCLE = 0.5522847498;

export const kvmacrosExtension = {
  name: "kvmacros",
  phase: "preprocess",
  description: "Lowers kvmacros Karnaugh maps, grouping ovals, marks, and overlay arrows into ordinary TikZ.",
  commands: ["karnaughmap", "kvmap", "DrawArrow", "tikzmark", "put", "oval"],
  preprocess(source, context = {}) {
    return expandKvmacros(source, context.diagnostics || []);
  }
};

export function expandKvmacros(source, diagnostics = []) {
  const text = String(source || "");
  if (!KARNAUGH_COMMANDS.some((command) => text.includes(command))) return text;

  const arrows = collectDrawArrows(text, diagnostics);
  const documentShell = /\\documentclass(?:\[[^\]]*\])?\s*\{[^{}]+\}/.test(text);
  let output = "";
  let cursor = 0;
  while (cursor < text.length) {
    const next = findNextKarnaughCommand(text, cursor);
    if (!next) {
      output += text.slice(cursor);
      break;
    }
    output += text.slice(cursor, next.index);
    const parsed = parseKarnaughMap(text, next.index, next.command, diagnostics);
    if (!parsed) {
      output += next.command;
      cursor = next.index + next.command.length;
      continue;
    }
    output += renderKarnaughMap(parsed, arrows, diagnostics, { documentShell });
    cursor = parsed.end;
  }

  return stripKvmacrosInput(stripDrawArrowCalls(output, diagnostics));
}

function findNextKarnaughCommand(source, start) {
  let found = null;
  for (const command of KARNAUGH_COMMANDS) {
    const index = source.indexOf(command, start);
    if (index !== -1 && (!found || index < found.index)) found = { command, index };
  }
  return found;
}

function parseKarnaughMap(source, start, command, diagnostics) {
  let cursor = start + command.length;
  const args = [];
  for (let index = 0; index < 5; index += 1) {
    cursor = skipWhitespaceAndPercent(source, cursor);
    const arg = readBalanced(source, cursor, "{", "}");
    if (!arg) {
      diagnostics.push(kvmacrosDiagnostic(`Malformed ${command}: expected argument ${index + 1}`));
      return null;
    }
    args.push(arg.content);
    cursor = arg.end;
  }
  return {
    variableCount: Number(args[0].trim()),
    functionLabel: args[1].trim(),
    variableLabels: tokenizeKvmacrosItems(args[2]),
    values: tokenizeKvmacrosItems(args[3]),
    overlays: args[4],
    end: cursor
  };
}

function renderKarnaughMap(map, arrows, diagnostics, options = {}) {
  const variableCount = Number(map.variableCount);
  if (!Number.isInteger(variableCount) || variableCount < 2 || variableCount > 8) {
    diagnostics.push(kvmacrosDiagnostic(`Karnaugh maps currently support 2 through 8 variables, got ${map.variableCount}`));
    return "";
  }

  const axisVariables = karnaughAxisVariables(variableCount);
  const columns = 2 ** axisVariables.top.length;
  const rows = 2 ** axisVariables.left.length;
  const expectedCells = columns * rows;
  const values = [...map.values];
  while (values.length < expectedCells) values.push("");
  if (map.values.length !== expectedCells) {
    diagnostics.push(kvmacrosDiagnostic(`Expected ${expectedCells} Karnaugh values, got ${map.values.length}`));
  }

  const overlay = parseKarnaughOverlays(map.overlays, rows, diagnostics);
  const lines = [String.raw`\begin{tikzpicture}[x=8mm,y=8mm]`];
  const pictureBounds = karnaughPictureBounds(axisVariables, columns, rows, arrows, options);
  lines.push(
    `\\path[use as bounding box] (${fmt(pictureBounds.left)},${fmt(pictureBounds.bottom)}) rectangle (${fmt(pictureBounds.right)},${fmt(pictureBounds.top)});`,
    String.raw`\begin{scope}[overlay]`
  );
  lines.push(...renderGrid(columns, rows));
  lines.push(...renderCells(values, variableCount, axisVariables, columns, rows));
  lines.push(...renderVariableBrackets(map.variableLabels, axisVariables, columns, rows));
  lines.push(`\\node[inner sep=0pt] at (${fmt(-axisVariables.left.length / 2)},${fmt(axisVariables.top.length / 2)}) {${map.functionLabel}};`);
  lines.push(...overlay.commands);
  lines.push(...renderKarnaughArrows(arrows, overlay.markers));
  lines.push(String.raw`\end{scope}`);
  lines.push(String.raw`\end{tikzpicture}`);
  return lines.join("\n");
}

function karnaughPictureBounds(axisVariables, columns, rows, arrows, options = {}) {
  let left = -axisVariables.left.length;
  let right = columns;

  if (options.documentShell) {
    // A standalone legacy map is a fixed picture box inside a paragraph.
    // Keep the paragraph's leading box and the trailing overlay picture in
    // the canvas instead of deriving the canvas from the visible strokes.
    left -= 0.966;
    right += arrows.length ? 0.38 : 0.088;
  }

  return {
    left,
    right,
    bottom: -rows - (options.documentShell ? 0.088 : 0),
    top: axisVariables.top.length + (options.documentShell ? 0.088 : 0)
  };
}

function karnaughAxisVariables(variableCount) {
  const top = [];
  const left = [];
  for (let index = 0; index < variableCount; index += 1) {
    ((variableCount - index) % 2 === 1 ? top : left).push(index);
  }
  return { top, left };
}

function renderGrid(columns, rows) {
  const lines = [];
  for (let column = 0; column <= columns; column += 1) {
    lines.push(`\\draw (${column},${-rows}) -- (${column},0);`);
  }
  for (let row = 0; row <= rows; row += 1) {
    lines.push(`\\draw (0,${-row}) -- (${columns},${-row});`);
  }
  return lines;
}

function renderCells(values, variableCount, axisVariables, columns, rows) {
  const lines = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const cellIndex = karnaughCellIndex(row, column, variableCount, axisVariables);
      const value = values[cellIndex] ?? "";
      lines.push(`\\node[inner sep=0pt] at (${fmt(column + 0.5)},${fmt(-row - 0.5)}) {${value}};`);
      lines.push(`\\node[font=\\tiny,inner sep=0pt,anchor=south west] at (${fmt(column + 0.05)},${fmt(-row - 0.95)}) {${cellIndex}};`);
    }
  }
  return lines;
}

function karnaughCellIndex(row, column, variableCount, axisVariables) {
  let index = 0;
  const assign = (gray, variables) => {
    for (let bit = 0; bit < variables.length; bit += 1) {
      const grayBit = (gray >> (variables.length - bit - 1)) & 1;
      if (grayBit) index += 2 ** (variableCount - variables[bit] - 1);
    }
  };
  assign(grayCode(column), axisVariables.top);
  assign(grayCode(row), axisVariables.left);
  return index;
}

function grayCode(value) {
  return value ^ (value >> 1);
}

function renderVariableBrackets(labels, axisVariables, columns, rows) {
  const lines = [];
  const labelFor = (variableIndex) => labels[variableIndex] || "";
  axisVariables.top.forEach((variableIndex, depth) => {
    const runs = activeGrayRuns(columns, axisVariables.top.indexOf(variableIndex), axisVariables.top.length);
    const y = axisVariables.top.length - depth - 1;
    for (const [start, end] of runs) {
      lines.push(`\\draw (${start},${fmt(y + 0.1)}) -- (${start},${fmt(y + 0.5)});`);
      lines.push(`\\draw (${end},${fmt(y + 0.1)}) -- (${end},${fmt(y + 0.5)});`);
      lines.push(`\\draw (${start},${fmt(y + 0.3)}) -- (${end},${fmt(y + 0.3)});`);
      lines.push(`\\node[inner sep=0pt] at (${fmt((start + end) / 2)},${fmt(y + 0.65)}) {${labelFor(variableIndex)}};`);
    }
  });
  axisVariables.left.forEach((variableIndex, depth) => {
    const runs = activeGrayRuns(rows, axisVariables.left.indexOf(variableIndex), axisVariables.left.length);
    const x = -(axisVariables.left.length - depth - 1);
    for (const [start, end] of runs) {
      const top = -start;
      const bottom = -end;
      lines.push(`\\draw (${fmt(x - 0.1)},${top}) -- (${fmt(x - 0.5)},${top});`);
      lines.push(`\\draw (${fmt(x - 0.1)},${bottom}) -- (${fmt(x - 0.5)},${bottom});`);
      lines.push(`\\draw (${fmt(x - 0.3)},${top}) -- (${fmt(x - 0.3)},${bottom});`);
      lines.push(`\\node[inner sep=0pt] at (${fmt(x - 0.65)},${fmt((top + bottom) / 2)}) {${labelFor(variableIndex)}};`);
    }
  });
  return lines;
}

function activeGrayRuns(size, bitIndex, bitCount) {
  const active = Array.from({ length: size }, (_, index) => (grayCode(index) >> (bitCount - bitIndex - 1)) & 1);
  const runs = [];
  let start = null;
  for (let index = 0; index <= size; index += 1) {
    if (active[index] && start === null) start = index;
    if ((!active[index] || index === size) && start !== null) {
      runs.push([start, index]);
      start = null;
    }
  }
  return runs;
}

function parseKarnaughOverlays(source, rows, diagnostics) {
  const commands = [];
  const markers = new Map();
  let cursor = 0;
  let colorGroupIndex = 0;
  while (cursor < source.length) {
    const colorStart = source.indexOf(String.raw`\textcolor`, cursor);
    if (colorStart === -1) break;
    const colorArg = readRequiredArgument(source, colorStart + String.raw`\textcolor`.length);
    const bodyArg = colorArg && readRequiredArgument(source, colorArg.end);
    if (!colorArg || !bodyArg) {
      diagnostics.push(kvmacrosDiagnostic("Malformed colored Karnaugh overlay"));
      break;
    }
    const flowOffset = (colorGroupIndex * TEX_INTERWORD_SPACE_CM) / UNIT_CM;
    parseColoredPuts(bodyArg.content, colorArg.content.trim(), rows, flowOffset, commands, markers, diagnostics);
    colorGroupIndex += 1;
    cursor = bodyArg.end;
  }
  return { commands, markers };
}

function parseColoredPuts(source, color, rows, flowOffset, commands, markers, diagnostics) {
  let cursor = 0;
  while (cursor < source.length) {
    const putStart = source.indexOf(String.raw`\put`, cursor);
    if (putStart === -1) break;
    const point = readParenthesized(source, putStart + String.raw`\put`.length);
    const body = point && readRequiredArgument(source, point.end);
    if (!point || !body) {
      diagnostics.push(kvmacrosDiagnostic("Malformed \\put in Karnaugh overlay"));
      break;
    }
    const [rawX, rawY] = splitCoordinate(point.content);
    // LaTeX's picture environment keeps one interword-space box between
    // adjacent color groups. The following \put coordinates are therefore
    // shifted in the native output even though every \put itself is zero-width.
    const x = Number(rawX) + flowOffset;
    const y = Number(rawY) - rows;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      diagnostics.push(kvmacrosDiagnostic(`Invalid Karnaugh overlay coordinate (${point.content})`));
      cursor = body.end;
      continue;
    }
    for (const marker of body.content.matchAll(/\\tikzmark\s*\{([^{}]+)\}/g)) {
      markers.set(marker[1].trim(), { x, y });
      commands.push(`\\coordinate (${marker[1].trim()}) at (${fmt(x)},${fmt(y)});`);
    }
    const oval = body.content.match(/\\oval\s*\(\s*([^,]+)\s*,\s*([^\)]+)\s*\)\s*(?:\[([^\]]*)\])?/);
    if (oval) {
      const width = Number(oval[1]);
      const height = Number(oval[2]);
      if (Number.isFinite(width) && Number.isFinite(height)) {
        commands.push(renderOvalPath(color, x, y, width, height, oval[3]?.trim().toLowerCase() || ""));
      } else {
        diagnostics.push(kvmacrosDiagnostic(`Invalid \\oval dimensions (${oval[1]},${oval[2]})`));
      }
    }
    cursor = body.end;
  }
}

function renderOvalPath(color, cx, cy, width, height, part) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const radius = Math.min(halfWidth, halfHeight);
  const k = radius * BEZIER_CIRCLE;
  const left = cx - halfWidth;
  const right = cx + halfWidth;
  const top = cy + halfHeight;
  const bottom = cy - halfHeight;
  const upper = [
    `(${fmt(left)},${fmt(cy)})`,
    `-- (${fmt(left)},${fmt(top - radius)})`,
    `.. controls (${fmt(left)},${fmt(top - radius + k)}) and (${fmt(left + radius - k)},${fmt(top)}) .. (${fmt(left + radius)},${fmt(top)})`,
    `-- (${fmt(right - radius)},${fmt(top)})`,
    `.. controls (${fmt(right - radius + k)},${fmt(top)}) and (${fmt(right)},${fmt(top - radius + k)}) .. (${fmt(right)},${fmt(top - radius)})`,
    `-- (${fmt(right)},${fmt(cy)})`
  ];
  const lower = [
    `(${fmt(right)},${fmt(cy)})`,
    `-- (${fmt(right)},${fmt(bottom + radius)})`,
    `.. controls (${fmt(right)},${fmt(bottom + radius - k)}) and (${fmt(right - radius + k)},${fmt(bottom)}) .. (${fmt(right - radius)},${fmt(bottom)})`,
    `-- (${fmt(left + radius)},${fmt(bottom)})`,
    `.. controls (${fmt(left + radius - k)},${fmt(bottom)}) and (${fmt(left)},${fmt(bottom + radius - k)}) .. (${fmt(left)},${fmt(bottom + radius)})`,
    `-- (${fmt(left)},${fmt(cy)})`
  ];
  const path = part === "t" ? upper : part === "b" ? lower : [...upper, ...lower.slice(1)];
  return `\\draw[draw=${color}] ${path.join(" ")};`;
}

function renderKarnaughArrows(arrows, markers) {
  const lines = [];
  for (const arrow of arrows) {
    if (!markers.has(arrow.from) || !markers.has(arrow.to)) continue;
    const options = arrow.options ? `,${arrow.options}` : "";
    lines.push(`\\draw[->,thick${options}] ($(${arrow.from})+(-0.50em,3.5ex)$) to ($(${arrow.to})+(1.5em,0.0ex)$);`);
  }
  return lines;
}

function collectDrawArrows(source, diagnostics) {
  const arrows = [];
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf(DRAW_ARROW, cursor);
    if (start === -1) break;
    const parsed = parseDrawArrow(source, start);
    if (!parsed) {
      diagnostics.push(kvmacrosDiagnostic("Malformed \\DrawArrow command"));
      cursor = start + DRAW_ARROW.length;
      continue;
    }
    arrows.push(parsed);
    cursor = parsed.end;
  }
  return arrows;
}

function parseDrawArrow(source, start) {
  let cursor = skipWhitespaceAndPercent(source, start + DRAW_ARROW.length);
  let options = "";
  if (source[cursor] === "[") {
    const optional = readBalanced(source, cursor, "[", "]");
    if (!optional) return null;
    options = optional.content.trim();
    cursor = optional.end;
  }
  const from = readRequiredArgument(source, cursor);
  const to = from && readRequiredArgument(source, from.end);
  if (!from || !to) return null;
  return { options, from: from.content.trim(), to: to.content.trim(), start, end: to.end };
}

function stripDrawArrowCalls(source, diagnostics) {
  let output = "";
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf(DRAW_ARROW, cursor);
    if (start === -1) {
      output += source.slice(cursor);
      break;
    }
    output += source.slice(cursor, start);
    const parsed = parseDrawArrow(source, start);
    if (!parsed) {
      diagnostics.push(kvmacrosDiagnostic("Could not consume \\DrawArrow command"));
      output += DRAW_ARROW;
      cursor = start + DRAW_ARROW.length;
      continue;
    }
    cursor = parsed.end;
  }
  return output;
}

function stripKvmacrosInput(source) {
  return source.replace(/\\input\s*(?:\{\s*kvmacros(?:\.tex)?\s*\}|kvmacros(?:\.tex)?)/g, "");
}

function tokenizeKvmacrosItems(source) {
  const items = [];
  let cursor = 0;
  while (cursor < source.length) {
    if (/\s/.test(source[cursor])) {
      cursor += 1;
      continue;
    }
    if (source[cursor] === "{") {
      const group = readBalanced(source, cursor, "{", "}");
      if (!group) break;
      items.push(group.content.trim());
      cursor = group.end;
      continue;
    }
    if (source[cursor] === "\\") {
      const command = source.slice(cursor).match(/^\\[A-Za-z@]+/);
      if (command) {
        items.push(command[0]);
        cursor += command[0].length;
        continue;
      }
    }
    items.push(source[cursor]);
    cursor += 1;
  }
  return items;
}

function readRequiredArgument(source, start) {
  const cursor = skipWhitespaceAndPercent(source, start);
  return readBalanced(source, cursor, "{", "}");
}

function readParenthesized(source, start) {
  const cursor = skipWhitespaceAndPercent(source, start);
  return readBalanced(source, cursor, "(", ")");
}

function readBalanced(source, start, open, close) {
  if (source[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === open) depth += 1;
    if (char === close) depth -= 1;
    if (depth === 0) return { content: source.slice(start + 1, index), end: index + 1 };
  }
  return null;
}

function skipWhitespaceAndPercent(source, start) {
  let cursor = start;
  while (cursor < source.length) {
    if (/\s/.test(source[cursor]) || source[cursor] === "%") {
      cursor += 1;
      continue;
    }
    break;
  }
  return cursor;
}

function splitCoordinate(source) {
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth = Math.max(0, depth - 1);
    if (source[index] === "," && depth === 0) return [source.slice(0, index).trim(), source.slice(index + 1).trim()];
  }
  return [source.trim(), ""];
}

function kvmacrosDiagnostic(message) {
  return { severity: "warning", message: `kvmacros: ${message}` };
}

function fmt(value) {
  return String(Math.round(Number(value) * 1e6) / 1e6);
}

export const KVMACROS_UNIT_CM = UNIT_CM;
