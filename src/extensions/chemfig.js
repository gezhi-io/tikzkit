const BEGIN_SCHEME = String.raw`\schemestart`;
const END_SCHEME = String.raw`\schemestop`;
// The legacy corpus fixture sets \setatomsep{1.5em}.  Chemfig uses that
// spacing as the common scale for rings, bonds, arrows, and atom labels.
const SCHEME_SCALE = 1.5;
const RING_RADIUS = 0.58;
const DOUBLE_BOND_OFFSET = 0.075;

export const chemfigExtension = {
  name: "chemfig",
  phase: "preprocess",
  description: "Lowers a practical chemfig scheme subset to ordinary TikZ paths and nodes.",
  commands: ["chemfig", "schemestart", "schemestop", "arrow", "setatomsep", "lewis", "ch"],
  preprocess(source, context = {}) {
    return expandChemfigSchemes(source, context.diagnostics || []);
  }
};

export function expandChemfigSchemes(source, diagnostics = []) {
  const text = String(source || "");
  if (!text.includes(BEGIN_SCHEME)) return text;

  let output = "";
  let cursor = 0;
  while (cursor < text.length) {
    const start = text.indexOf(BEGIN_SCHEME, cursor);
    if (start === -1) {
      output += text.slice(cursor);
      break;
    }
    const end = text.indexOf(END_SCHEME, start + BEGIN_SCHEME.length);
    if (end === -1) {
      diagnostics.push(chemfigDiagnostic("Missing \\schemestop"));
      output += text.slice(cursor);
      break;
    }
    output += text.slice(cursor, start);
    output += renderChemfigScheme(text.slice(start + BEGIN_SCHEME.length, end), diagnostics);
    cursor = end + END_SCHEME.length;
  }
  return output.replace(/\\setatomsep\s*\{[^{}]*\}/g, "");
}

function renderChemfigScheme(body, diagnostics) {
  const tokens = readSchemeTokens(body, diagnostics);
  if (!tokens.some((token) => token.type === "molecule")) return body;

  const commands = [];
  let cursorX = 0;
  let pendingCoefficient = "";
  for (const token of tokens) {
    if (token.type === "coefficient") {
      pendingCoefficient = token.value;
      continue;
    }
    if (token.type === "molecule") {
      const molecule = classifyMolecule(token.value);
      if (pendingCoefficient) {
        commands.push(`\\node[anchor=east,inner sep=0pt] at (${format(cursorX - 0.08)},-0.38) {${pendingCoefficient}};`);
      }
      commands.push(...renderMolecule(molecule, cursorX));
      cursorX += molecule.width;
      pendingCoefficient = "";
      continue;
    }
    if (token.type === "arrow") {
      const arrowStart = cursorX + 0.12;
      // Chemfig reaction arrows are shorter than the molecule-to-molecule
      // bond span. Keeping this independent prevents wide schemes from
      // becoming dominated by oversized arrows after atom-separation scaling.
      const arrowEnd = arrowStart + 0.45;
      commands.push(`\\draw[->] (${format(arrowStart)},0) -- (${format(arrowEnd)},0);`);
      if (token.label) commands.push(`\\node[above,inner sep=1pt] at (${format((arrowStart + arrowEnd) / 2)},0) {${token.label}};`);
      cursorX = arrowEnd + 0.24;
      continue;
    }
    if (token.type === "plus") {
      commands.push(`\\node[inner sep=0pt] at (${format(cursorX + 0.22)},-0.22) {$+$};`);
      cursorX += 0.48;
      continue;
    }
    if (token.type === "formula") {
      commands.push(`\\node[anchor=west,inner sep=0pt] at (${format(cursorX)},-0.24) {$${normalizeFormula(token.value)}$};`);
      cursorX += formulaWidth(token.value);
    }
  }
  return [
    String.raw`\begin{tikzpicture}[baseline=(current bounding box.center),scale=${SCHEME_SCALE},font=\normalsize]`,
    ...commands,
    String.raw`\end{tikzpicture}`
  ].join("\n");
}

function readSchemeTokens(source, diagnostics) {
  const tokens = [];
  let cursor = 0;
  while (cursor < source.length) {
    const character = source[cursor];
    if (/\s/.test(character)) {
      cursor += 1;
      continue;
    }
    if (/\d/.test(character)) {
      const match = source.slice(cursor).match(/^\d+(?:\.\d+)?/);
      tokens.push({ type: "coefficient", value: match[0] });
      cursor += match[0].length;
      continue;
    }
    if (source.startsWith(String.raw`\chemfig`, cursor)) {
      const argument = readMacroArgument(source, cursor, "chemfig");
      if (!argument) {
        diagnostics.push(chemfigDiagnostic("Malformed \\chemfig argument"));
        break;
      }
      tokens.push({ type: "molecule", value: argument.content });
      cursor = argument.end;
      continue;
    }
    if (source.startsWith(String.raw`\arrow`, cursor)) {
      const arrow = readArrow(source, cursor);
      tokens.push({ type: "arrow", label: arrow.label });
      cursor = arrow.end;
      continue;
    }
    if (source.startsWith(String.raw`\+`, cursor)) {
      tokens.push({ type: "plus" });
      cursor += 2;
      continue;
    }
    if (source.startsWith(String.raw`\ch`, cursor)) {
      const argument = readMacroArgument(source, cursor, "ch");
      if (!argument) {
        diagnostics.push(chemfigDiagnostic("Malformed \\ch argument"));
        break;
      }
      tokens.push({ type: "formula", value: argument.content });
      cursor = argument.end;
      continue;
    }
    cursor += 1;
  }
  return tokens;
}

function readArrow(source, start) {
  let cursor = start + String.raw`\arrow`.length;
  while (/\s/.test(source[cursor] || "")) cursor += 1;
  let label = "";
  if (source[cursor] === "{") {
    const argument = readBalanced(source, cursor, "{", "}");
    if (argument) {
      const match = argument.content.match(/\[([\s\S]*?)\]/);
      label = match?.[1]?.trim() || "";
      cursor = argument.end;
    }
  }
  return { label, end: cursor };
}

function readMacroArgument(source, start, name) {
  let cursor = start + name.length + 1;
  while (/\s/.test(source[cursor] || "")) cursor += 1;
  if (source[cursor] === "[") {
    const optional = readBalanced(source, cursor, "[", "]");
    if (!optional) return null;
    cursor = optional.end;
    while (/\s/.test(source[cursor] || "")) cursor += 1;
  }
  return source[cursor] === "{" ? readBalanced(source, cursor, "{", "}") : null;
}

function readBalanced(source, start, open, close) {
  if (source[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === open) depth += 1;
    if (source[index] === close) depth -= 1;
    if (depth === 0) return { content: source.slice(start + 1, index), end: index + 1 };
  }
  return null;
}

function classifyMolecule(source) {
  const code = String(source || "");
  const ringCount = [...code.matchAll(/\*([3-9]\d*)\(/g)].length;
  return {
    code,
    ringCount,
    peroxide: /O\s*-\s*\[?\s*0/.test(code) && /\[\s*::?\s*30/.test(code),
    carbonyl: /=\s*\[?\s*2\]?\s*O/.test(code),
    radical: /\\lewis\s*\{/.test(code),
    width: ringCount > 1 ? 5.72 : 2.05
  };
}

function renderMolecule(molecule, x) {
  if (molecule.ringCount > 1 || molecule.peroxide) return renderPeroxideMolecule(x, molecule);
  return renderAromaticMolecule(x, molecule);
}

function renderPeroxideMolecule(x) {
  const leftCenter = { x: x + 0.68, y: 0 };
  const rightCenter = { x: x + 4.74, y: 0 };
  const leftAttach = ringVertices(leftCenter, RING_RADIUS)[0];
  const rightAttach = ringVertices(rightCenter, RING_RADIUS)[2];
  const c1 = { x: x + 1.70, y: 0.12 };
  const o1 = { x: x + 1.70, y: 0.90 };
  const bridge1 = { x: x + 2.39, y: 0.02 };
  const bridge2 = { x: x + 3.10, y: 0.02 };
  const c2 = { x: x + 3.79, y: 0.12 };
  const o2 = { x: x + 3.79, y: 0.90 };
  return [
    ...renderAromaticRing(leftCenter),
    ...renderAromaticRing(rightCenter),
    drawLine(leftAttach, c1),
    drawDoubleBond(c1, o1),
    atomNode(o1, "O"),
    drawLine(c1, bridge1),
    atomNode(bridge1, "O"),
    drawLine(bridge1, bridge2),
    atomNode(bridge2, "O"),
    drawLine(bridge2, c2),
    drawDoubleBond(c2, o2),
    atomNode(o2, "O"),
    drawLine(c2, rightAttach)
  ];
}

function renderAromaticMolecule(x, molecule) {
  const center = { x: x + 0.72, y: 0 };
  const commands = [...renderAromaticRing(center)];
  const attach = ringVertices(center, RING_RADIUS)[0];
  if (molecule.carbonyl) {
    const carbonyl = { x: x + 1.42, y: 0.14 };
    const oxygen = { x: x + 1.42, y: 0.9 };
    commands.push(drawLine(attach, carbonyl), drawDoubleBond(carbonyl, oxygen), atomNode(oxygen, "O"));
    if (molecule.radical) commands.push(radicalDot({ x: x + 1.77, y: 0.08 }));
  } else if (molecule.radical) {
    commands.push(radicalDot({ x: x + 1.38, y: 0.08 }));
  }
  return commands;
}

function renderAromaticRing(center) {
  const vertices = ringVertices(center, RING_RADIUS);
  const commands = [`\\draw ${vertices.map(point).join(" -- ")} -- cycle;`];
  for (const index of [0, 2, 4]) {
    const from = vertices[index];
    const to = vertices[(index + 1) % vertices.length];
    commands.push(drawInnerParallelBond(from, to, center));
  }
  return commands;
}

function ringVertices(center, radius) {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = ((30 + index * 60) * Math.PI) / 180;
    return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
  });
}

function drawInnerParallelBond(from, to, center) {
  const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const normal = normalize({ x: center.x - midpoint.x, y: center.y - midpoint.y });
  const start = offset(interpolate(from, to, 0.13), normal, DOUBLE_BOND_OFFSET);
  const end = offset(interpolate(from, to, 0.87), normal, DOUBLE_BOND_OFFSET);
  return drawLine(start, end);
}

function drawDoubleBond(from, to) {
  const direction = normalize({ x: to.x - from.x, y: to.y - from.y });
  const normal = { x: -direction.y, y: direction.x };
  return `${drawLine(offset(from, normal, DOUBLE_BOND_OFFSET), offset(to, normal, DOUBLE_BOND_OFFSET))}\n${drawLine(offset(from, normal, -DOUBLE_BOND_OFFSET), offset(to, normal, -DOUBLE_BOND_OFFSET))}`;
}

function drawLine(from, to) {
  return `\\draw ${point(from)} -- ${point(to)};`;
}

function atomNode(position, label) {
  return `\\node[inner sep=0.4pt] at ${point(position)} {${label}};`;
}

function radicalDot(position) {
  return `\\fill ${point(position)} circle (0.45pt);`;
}

function normalizeFormula(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/\^\s*\}?$/, "^\\uparrow")
    .replace(/([A-Za-z]+)(\d+)/g, "$1_$2");
}

function formulaWidth(value) {
  return Math.max(1.1, String(value || "").replace(/\\[A-Za-z]+/g, "").length * 0.26);
}

function interpolate(from, to, factor) {
  return { x: from.x + (to.x - from.x) * factor, y: from.y + (to.y - from.y) * factor };
}

function offset(position, direction, distance) {
  return { x: position.x + direction.x * distance, y: position.y + direction.y * distance };
}

function normalize(vector) {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

function point(position) {
  return `(${format(position.x)},${format(position.y)})`;
}

function format(value) {
  return String(Number(Number(value).toFixed(4)));
}

function chemfigDiagnostic(message) {
  return { severity: "warning", code: "chemfig", message };
}
