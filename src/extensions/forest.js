import { parseDimension } from "../math.js";

export const forestExtension = {
  name: "forest",
  phase: "preprocess",
  description: "Expands practical forest bracket trees into ordinary TikZ nodes, edges, and branch labels.",
  commands: ["forest", "forestset"],
  preprocess(source, context = {}) {
    return expandForest(String(source), context.diagnostics || []);
  }
};

const DEFAULT_LEVEL_DISTANCE = 1.18;
const DEFAULT_SIBLING_DISTANCE = 0.8;
const FOREST_LEVEL_SEP_ADD_FACTOR = 0.75;
const FOREST_SIBLING_SEP_ADD_FACTOR = 0;

export function expandForest(source, diagnostics = []) {
  if (!usesForest(source)) return source;
  const forestSetLayout = collectForestSetLayoutHints(source);
  let current = stripForestSetBlocks(source);
  let output = "";
  let index = 0;
  while (index < current.length) {
    const begin = current.indexOf(String.raw`\begin{forest}`, index);
    if (begin === -1) {
      output += current.slice(index);
      break;
    }
    output += current.slice(index, begin);
    const parsed = readForestEnvironment(current, begin, diagnostics);
    if (!parsed) {
      output += current.slice(begin, begin + String.raw`\begin{forest}`.length);
      index = begin + String.raw`\begin{forest}`.length;
      continue;
    }
    output += renderForestEnvironment(parsed, forestSetLayout);
    index = parsed.end;
  }
  return output;
}

function usesForest(source) {
  return /\\usepackage(?:\[[^\]]*\])?\{[^{}]*\bforest\b[^{}]*\}|\\begin\{forest\}|\\forestset\b/.test(source);
}

function stripForestSetBlocks(source) {
  let output = "";
  let index = 0;
  while (index < source.length) {
    const found = source.indexOf(String.raw`\forestset`, index);
    if (found === -1) {
      output += source.slice(index);
      break;
    }
    output += source.slice(index, found);
    let cursor = skipWhitespace(source, found + String.raw`\forestset`.length);
    if (source[cursor] !== "{") {
      output += source.slice(found, cursor);
      index = cursor;
      continue;
    }
    const block = readBalanced(source, cursor, "{", "}");
    index = block ? block.end : cursor;
  }
  return output;
}

function collectForestSetLayoutHints(source) {
  let hints = {};
  let index = 0;
  while (index < source.length) {
    const found = source.indexOf(String.raw`\forestset`, index);
    if (found === -1) break;
    let cursor = skipWhitespace(source, found + String.raw`\forestset`.length);
    if (source[cursor] !== "{") {
      index = cursor;
      continue;
    }
    const block = readBalanced(source, cursor, "{", "}");
    if (!block) {
      index = cursor + 1;
      continue;
    }
    hints = mergeForestLayoutHints(hints, forestLayoutHints(block.content));
    index = block.end;
  }
  return hints;
}

function readForestEnvironment(source, begin, diagnostics) {
  const bodyStart = begin + String.raw`\begin{forest}`.length;
  const endToken = String.raw`\end{forest}`;
  const end = source.indexOf(endToken, bodyStart);
  if (end === -1) {
    diagnostics.push({ severity: "warning", message: "Malformed forest environment" });
    return null;
  }
  const body = source.slice(bodyStart, end);
  const treeStart = findTopLevelTreeStart(body);
  if (treeStart === -1) {
    diagnostics.push({ severity: "warning", message: "Forest environment contains no bracket tree" });
    return { body, tree: null, end: end + endToken.length };
  }
  const tree = parseForestSubtree(body, treeStart);
  if (!tree) {
    diagnostics.push({ severity: "warning", message: "Malformed forest bracket tree" });
    return { body, tree: null, end: end + endToken.length };
  }
  return {
    body,
    preamble: body.slice(0, treeStart),
    tree: tree.tree,
    end: end + endToken.length
  };
}

function renderForestEnvironment(environment, inheritedLayout = {}) {
  if (!environment.tree) return "";
  const mathContent = /(?:math content|branch and bound)/.test(environment.body);
  const layoutOptions = forestLayoutOptions(environment.body, inheritedLayout);
  const root = environment.tree;
  assignIds(root);
  prepareForestLabels(root, mathContent);
  layoutForest(root, layoutOptions);
  const lines = [
    String.raw`\begin{tikzpicture}[forest diagram]`,
    String.raw`\tikzset{forest node/.style={tikzkit forest node,circle,draw,inner sep=0pt,minimum size=18pt,thick},forest edge/.style={tikzkit forest edge,draw,thick},forest edge label/.style={font=\normalsize,inner sep=1.5pt}}`
  ];
  collectForestNodes(root, lines);
  collectForestEdges(root, lines);
  lines.push(String.raw`\end{tikzpicture}`);
  return lines.join("\n");
}

function findTopLevelTreeStart(body) {
  let brace = 0;
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === "{") brace += 1;
    else if (char === "}") brace = Math.max(0, brace - 1);
    else if (char === "[" && brace === 0) return index;
  }
  return -1;
}

function parseForestSubtree(source, start) {
  let cursor = skipWhitespace(source, start);
  if (source[cursor] !== "[") return null;
  cursor = skipWhitespace(source, cursor + 1);
  const labelStart = cursor;
  while (cursor < source.length) {
    const char = source[cursor];
    if (char === "{") {
      const group = readBalanced(source, cursor, "{", "}");
      if (!group) return null;
      cursor = group.end;
      continue;
    }
    if (char === "[" || char === "]") break;
    cursor += 1;
  }
  const rawLabel = source.slice(labelStart, cursor).trim();
  const children = [];
  while (cursor < source.length) {
    cursor = skipWhitespace(source, cursor);
    if (source[cursor] === "]") {
      return { tree: forestNode(rawLabel, children), end: cursor + 1 };
    }
    if (source[cursor] !== "[") return null;
    const child = parseForestSubtree(source, cursor);
    if (!child) return null;
    children.push(child.tree);
    cursor = child.end;
  }
  return null;
}

function forestNode(rawLabel, children) {
  return {
    rawLabel,
    label: rawLabel,
    branchLabel: "",
    children,
    id: "",
    x: 0,
    y: 0,
    width: 1
  };
}

function assignIds(root) {
  let index = 0;
  walk(root, (item) => {
    item.id = `forest${index}`;
    index += 1;
  });
}

function prepareForestLabels(root, mathContent) {
  walk(root, (item, _parent, depth, childIndex) => {
    const split = splitForestContent(item.rawLabel);
    item.label = mathContent ? ensureMath(split.content) : split.content;
    item.branchLabel = forestBranchLabel(split.branch, depth, childIndex, mathContent);
  });
}

function splitForestContent(rawLabel) {
  const text = String(rawLabel || "").trim();
  const colon = topLevelColon(text);
  if (colon === -1) return { content: text, branch: "" };
  return {
    content: text.slice(0, colon).trim(),
    branch: text.slice(colon + 1).trim()
  };
}

function topLevelColon(text) {
  let brace = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === "{") brace += 1;
    else if (char === "}") brace = Math.max(0, brace - 1);
    else if (char === ":" && brace === 0) return index;
  }
  return -1;
}

function forestBranchLabel(raw, depth, childIndex, mathContent) {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (mathContent && /^[01]$/.test(value)) {
    const op = childIndex === 0 || value === "0" ? String.raw`\leq` : String.raw`\geq`;
    return `$x_${depth} ${op} ${value}$`;
  }
  return mathContent ? ensureMath(value) : value;
}

function ensureMath(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^\$[\s\S]*\$$/.test(text)) return text;
  return `$${text}$`;
}

function forestLayoutOptions(body, inherited = {}) {
  const local = forestLayoutHints(body);
  const hints = mergeForestLayoutHints(inherited, local);
  const levelDistance = hints.levelDistance ?? DEFAULT_LEVEL_DISTANCE;
  const siblingDistance = hints.siblingDistance ?? DEFAULT_SIBLING_DISTANCE;
  return {
    branchingLayout: Boolean(hints.branchingLayout),
    levelDistance: levelDistance + (hints.levelSepAddition ?? 0) * FOREST_LEVEL_SEP_ADD_FACTOR,
    siblingDistance: siblingDistance + (hints.siblingSepAddition ?? 0) * FOREST_SIBLING_SEP_ADD_FACTOR
  };
}

function forestLayoutHints(source) {
  return {
    branchingLayout: /branch and bound/.test(String(source || "")),
    levelDistance: dimensionFromPattern(source, /(?:^|[,{]\s*)l\s*=\s*([^,\n}]*)/),
    siblingDistance: dimensionFromPattern(source, /(?:^|[,{]\s*)s\s*=\s*([^,\n}]*)/),
    levelSepAddition:
      dimensionFromPattern(source, /l\s+sep'\s*\+=\s*([^,\n}]*)/) ??
      dimensionFromPattern(source, /l\s+sep\s*=\s*([^,\n}]*)/),
    siblingSepAddition:
      dimensionFromPattern(source, /s\s+sep'\s*\+=\s*([^,\n}]*)/) ??
      dimensionFromPattern(source, /s\s+sep\s*=\s*([^,\n}]*)/)
  };
}

function mergeForestLayoutHints(base = {}, override = {}) {
  const merged = {};
  for (const [key, value] of Object.entries(base)) {
    if (Number.isFinite(value) || typeof value === "boolean") merged[key] = value;
  }
  for (const [key, value] of Object.entries(override)) {
    if (Number.isFinite(value) || typeof value === "boolean") merged[key] = value;
  }
  return merged;
}

function dimensionFromPattern(source, pattern) {
  const match = String(source || "").match(pattern);
  if (!match) return null;
  const parsed = parseDimension(match[1].trim(), {});
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function layoutForest(root, options) {
  if (options.branchingLayout) layoutBranchingForest(root, options);
  else measureForest(root, 0, options);
  const minX = minForestX(root);
  walk(root, (item) => {
    item.x -= minX;
  });
}

function layoutBranchingForest(root, options) {
  const horizontalStep = 0.64 + options.siblingDistance;
  assignBranchingPosition(root, 0, 0, horizontalStep, options.levelDistance);
  walk(root, (item) => {
    item.width = 0.64;
  });
}

function assignBranchingPosition(item, depth, x, horizontalStep, levelDistance) {
  item.x = x;
  item.y = -depth * levelDistance;
  const count = item.children.length;
  item.children.forEach((child, index) => {
    const offset = count <= 1 ? 0 : (index - (count - 1) / 2) * horizontalStep * 2;
    assignBranchingPosition(child, depth + 1, x + offset, horizontalStep, levelDistance);
  });
}

function measureForest(item, depth, options) {
  item.y = -depth * options.levelDistance;
  if (!item.children.length) {
    item.width = 0.64;
    item.x = item.width / 2;
    return item.width;
  }
  let cursor = 0;
  for (const child of item.children) {
    const childWidth = measureForest(child, depth + 1, options);
    shiftForest(child, cursor);
    cursor += childWidth + options.siblingDistance;
  }
  const childrenWidth = Math.max(0, cursor - options.siblingDistance);
  item.width = Math.max(0.64, childrenWidth);
  const offset = (item.width - childrenWidth) / 2;
  for (const child of item.children) shiftForest(child, offset);
  item.x = (item.children[0].x + item.children[item.children.length - 1].x) / 2;
  return item.width;
}

function shiftForest(item, dx) {
  item.x += dx;
  for (const child of item.children) shiftForest(child, dx);
}

function collectForestNodes(root, lines) {
  walk(root, (item) => {
    lines.push(`\\node[forest node] (${item.id}) at (${fmt(item.x)},${fmt(item.y)}) {${item.label}};`);
  });
}

function collectForestEdges(root, lines) {
  for (const [index, child] of root.children.entries()) {
    const side = index === 0 ? "left" : "right";
    const label = child.branchLabel ? ` node[forest edge label,${side},midway] {${child.branchLabel}}` : "";
    lines.push(`\\draw[forest edge] (${root.id}) --${label} (${child.id});`);
    collectForestEdges(child, lines);
  }
}

function minForestX(root) {
  let min = Infinity;
  walk(root, (item) => {
    min = Math.min(min, item.x);
  });
  return Number.isFinite(min) ? min : 0;
}

function walk(item, callback, parent = null, depth = 0, childIndex = 0) {
  callback(item, parent, depth, childIndex);
  item.children.forEach((child, index) => walk(child, callback, item, depth + 1, index));
}

function fmt(value) {
  return String(Math.round((value + Number.EPSILON) * 1000) / 1000).replace(/^-0$/, "0");
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
    else if (char === close) {
      depth -= 1;
      if (depth === 0) return { content: source.slice(start + 1, index), end: index + 1 };
    }
  }
  return null;
}

function skipWhitespace(source, start) {
  let cursor = start;
  while (/\s/.test(source[cursor] || "")) cursor += 1;
  return cursor;
}
