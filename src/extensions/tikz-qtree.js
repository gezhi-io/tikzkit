import { parseDimension } from "../math.js";
import { texTextWidthCm } from "../math-metrics.js";

export const tikzQtreeExtension = {
  name: "tikz-qtree",
  phase: "preprocess",
  description: "Expands common tikz-qtree \\Tree bracket syntax into ordinary TikZ nodes and edges.",
  commands: ["Tree", "edge", "qroof"],
  preprocess(source, context = {}) {
    return expandTikzQtree(String(source), context.diagnostics || []);
  }
};

const LEVEL_DISTANCE = 0.72;
const SIBLING_DISTANCE = 0.72;
const NODE_INNER_XSEP = 0.24;

export function expandTikzQtree(source, diagnostics = []) {
  if (!usesTikzQtree(source)) return source;
  let output = "";
  let index = 0;
  while (index < source.length) {
    if (!source.startsWith("\\Tree", index) || /[A-Za-z@]/.test(source[index + "\\Tree".length] || "")) {
      output += source[index];
      index += 1;
      continue;
    }
    const parsed = parseTreeCommand(source, index, diagnostics);
    if (!parsed) {
      output += source[index];
      index += 1;
      continue;
    }
    output += renderTree(parsed.tree, qtreeLayoutOptions(source, index));
    index = parsed.end;
  }
  return output;
}

function usesTikzQtree(source) {
  return /\\usepackage(?:\[[^\]]*\])?\{(?:tikz-qtree|tikz-qtree-compat)\}|\\Tree\b/.test(source);
}

function parseTreeCommand(source, start, diagnostics) {
  let cursor = skipWhitespace(source, start + "\\Tree".length);
  if (source[cursor] !== "[") {
    diagnostics.push({ severity: "warning", message: "Malformed \\Tree command" });
    return null;
  }
  const parsed = parseSubtree(source, cursor);
  if (!parsed) {
    diagnostics.push({ severity: "warning", message: "Malformed tikz-qtree bracket tree" });
    return null;
  }
  return parsed;
}

function parseSubtree(source, start) {
  let cursor = skipWhitespace(source, start);
  if (source[cursor] !== "[") return null;
  cursor = skipWhitespace(source, cursor + 1);
  let label = "";
  if (source[cursor] === ".") {
    const parsedLabel = readLabel(source, cursor + 1, { interior: true });
    if (!parsedLabel) return null;
    label = parsedLabel.label;
    cursor = parsedLabel.end;
  }
  const children = [];
  let pendingEdge = null;
  while (cursor < source.length) {
    cursor = skipWhitespace(source, cursor);
    if (source[cursor] === "]") {
      cursor += 1;
      cursor = skipWhitespace(source, cursor);
      if (source[cursor] === "." && !label) {
        const trailing = readLabel(source, cursor + 1, { interior: true });
        if (trailing) {
          label = trailing.label;
          cursor = trailing.end;
        }
      }
      return { tree: node(label, children), end: cursor };
    }
    if (source.startsWith("\\edge", cursor)) {
      const edge = readExplicitEdge(source, cursor);
      if (!edge) return null;
      pendingEdge = edge.edge;
      cursor = edge.end;
      continue;
    }
    const child = source[cursor] === "[" ? parseSubtree(source, cursor) : parseLeaf(source, cursor);
    if (!child) return null;
    child.tree.edge = pendingEdge;
    pendingEdge = null;
    children.push(child.tree);
    cursor = child.end;
  }
  return null;
}

function parseLeaf(source, start) {
  const label = readLabel(source, start, { interior: false });
  if (!label) return null;
  return { tree: node(label.label, []), end: label.end };
}

function readLabel(source, start, { interior }) {
  let cursor = skipWhitespace(source, start);
  if (source.startsWith("\\node", cursor)) return readTikzNodeLabel(source, cursor);
  if (source.startsWith("\\qroof", cursor)) return readQroofLabel(source, cursor);
  if (source[cursor] === "{") {
    const group = extractBalanced(source, cursor, "{", "}");
    if (!group) return null;
    return { label: group.content.trim(), end: skipWhitespace(source, group.end) };
  }
  const begin = cursor;
  while (cursor < source.length) {
    if (source[cursor] === "[" || source[cursor] === "]") break;
    if (/\s/.test(source[cursor])) break;
    cursor += 1;
  }
  const label = source.slice(begin, cursor).trim();
  if (!label && interior) return { label: "", end: cursor };
  return label ? { label, end: skipWhitespace(source, cursor) } : null;
}

function readTikzNodeLabel(source, start) {
  const end = source.indexOf(";", start);
  if (end === -1) return null;
  const raw = source.slice(start, end + 1);
  const match = raw.match(/^\\node\s*(\[[^\]]*\])?\s*(\(([^)]*)\))?\s*\{([\s\S]*)\};$/);
  if (!match) return { label: raw, end: end + 1 };
  return {
    label: {
      kind: "node",
      options: match[1] ? match[1].slice(1, -1) : "",
      name: match[3] || "",
      text: match[4]
    },
    end: skipWhitespace(source, end + 1)
  };
}

function readQroofLabel(source, start) {
  let cursor = skipWhitespace(source, start + "\\qroof".length);
  const body = source[cursor] === "{" ? extractBalanced(source, cursor, "{", "}") : null;
  if (!body) return null;
  cursor = skipWhitespace(source, body.end);
  if (source[cursor] === ".") cursor += 1;
  return {
    label: {
      kind: "roof",
      text: body.content.trim()
    },
    end: skipWhitespace(source, cursor)
  };
}

function readExplicitEdge(source, start) {
  let cursor = skipWhitespace(source, start + "\\edge".length);
  const options = source[cursor] === "[" ? extractBalanced(source, cursor, "[", "]") : null;
  cursor = options ? skipWhitespace(source, options.end) : cursor;
  let label = "";
  if (source.startsWith("node", cursor)) {
    cursor = skipWhitespace(source, cursor + "node".length);
    const nodeOptions = source[cursor] === "[" ? extractBalanced(source, cursor, "[", "]") : null;
    cursor = nodeOptions ? skipWhitespace(source, nodeOptions.end) : cursor;
    const body = source[cursor] === "{" ? extractBalanced(source, cursor, "{", "}") : null;
    if (body) {
      label = body.content.trim();
      cursor = skipWhitespace(source, body.end);
    }
  }
  if (source[cursor] !== ";") return null;
  return {
    edge: {
      options: options?.content || "",
      label
    },
    end: skipWhitespace(source, cursor + 1)
  };
}

function node(label, children) {
  return {
    label,
    children,
    id: "",
    x: 0,
    y: 0,
    width: 1,
    labelWidth: 1,
    edge: null
  };
}

function renderTree(root, layoutOptions = {}) {
  assignIds(root);
  layoutTree(root, layoutOptions);
  const lines = [];
  collectNodes(root, lines);
  collectEdges(root, lines);
  return `\\begin{scope}[qtree]\n${lines.join("\n")}\n\\end{scope}`;
}

function assignIds(root) {
  let index = 0;
  walk(root, (item) => {
    item.id = `qtree${index}`;
    index += 1;
  });
}

function layoutTree(root, layoutOptions = {}) {
  const levelDistance = positiveNumber(layoutOptions.levelDistance, LEVEL_DISTANCE);
  const siblingDistance = positiveNumber(layoutOptions.siblingDistance, SIBLING_DISTANCE);
  measureSubtree(root, 0, { levelDistance, siblingDistance });
  const minX = minNodeX(root);
  walk(root, (item) => {
    item.x -= minX;
  });
}

function measureSubtree(item, depth, layoutOptions) {
  item.y = -depth * layoutOptions.levelDistance;
  item.labelWidth = qtreeLabelWidth(item.label);
  if (!item.children.length) {
    item.width = item.labelWidth;
    item.x = item.width / 2;
    return item.width;
  }
  let cursor = 0;
  for (const child of item.children) {
    const childWidth = measureSubtree(child, depth + 1, layoutOptions);
    shiftSubtree(child, cursor);
    cursor += childWidth + layoutOptions.siblingDistance;
  }
  const childrenWidth = Math.max(0, cursor - layoutOptions.siblingDistance);
  const width = Math.max(item.labelWidth, childrenWidth);
  const offset = (width - childrenWidth) / 2;
  for (const child of item.children) shiftSubtree(child, offset);
  item.width = width;
  item.x = (item.children[0].x + item.children[item.children.length - 1].x) / 2;
  return item.width;
}

function shiftSubtree(item, dx) {
  item.x += dx;
  for (const child of item.children) shiftSubtree(child, dx);
}

function collectNodes(root, lines) {
  walk(root, (item) => {
    const label = normalizeLabel(item.label);
    if (label.kind === "node") {
      const name = label.name ? ` (${label.name})` : ` (${item.id})`;
      const options = ["qtree node", label.options].filter(Boolean).join(",");
      lines.push(`\\node[${options}]${name} at (${fmt(item.x)},${fmt(displayY(item))}) {${label.text}};`);
      return;
    }
    lines.push(`\\node[qtree node] (${item.id}) at (${fmt(item.x)},${fmt(displayY(item))}) {${label.text}};`);
  });
}

function collectEdges(root, lines) {
  for (const child of root.children) {
    const edge = child.edge || {};
    if (edge.options && /roof/.test(edge.options)) {
      lines.push(renderRoof(root, child, edge.label));
    } else {
      const options = ["draw", "qtree edge", edge.options].filter(Boolean).join(",");
      lines.push(`\\draw[${options}] (${nodeRef(root)}) -- (${nodeRef(child)});`);
      if (edge.label) {
        const mid = { x: (root.x + child.x) / 2, y: (root.y + child.y) / 2 };
        lines.push(`\\node[qtree edge label,font=\\scriptsize] at (${fmt(mid.x)},${fmt(mid.y)}) {${edge.label}};`);
      }
    }
    collectEdges(child, lines);
  }
}

function renderRoof(parent, child, label) {
  const half = Math.max(0.22, (child.labelWidth || qtreeLabelWidth(child.label)) / 2);
  const top = { x: parent.x, y: displayY(parent) - 0.13 };
  const left = { x: child.x - half, y: displayY(child) + 0.24 };
  const right = { x: child.x + half, y: displayY(child) + 0.24 };
  const labelNode = label
    ? `\n\\node[qtree edge label,font=\\scriptsize] at (${fmt((top.x + child.x) / 2)},${fmt((top.y + child.y) / 2)}) {${label}};`
    : "";
  return `\\draw[draw,qtree roof] (${fmt(top.x)},${fmt(top.y)}) -- (${fmt(left.x)},${fmt(left.y)}) -- (${fmt(right.x)},${fmt(right.y)}) -- cycle;${labelNode}`;
}

function normalizeLabel(label) {
  if (label && typeof label === "object") {
    if (label.kind === "roof") return { kind: "text", text: label.text };
    return label;
  }
  return { kind: "text", text: String(label || "") };
}

function nodeRef(item) {
  const label = normalizeLabel(item.label);
  return label.kind === "node" && label.name ? label.name : item.id;
}

function displayY(item) {
  return item.edge?.options && /roof/.test(item.edge.options) ? item.y - 0.22 : item.y;
}

function qtreeLayoutOptions(source, treeIndex) {
  const pictureOptions = enclosingTikzPictureOptions(source, treeIndex);
  return {
    levelDistance: parseQtreeDimension(pictureOptions["level distance"], LEVEL_DISTANCE),
    siblingDistance: parseQtreeDimension(pictureOptions["sibling distance"], SIBLING_DISTANCE)
  };
}

function enclosingTikzPictureOptions(source, index) {
  const begin = source.lastIndexOf("\\begin{tikzpicture}", index);
  if (begin === -1) return {};
  const previousEnd = source.lastIndexOf("\\end{tikzpicture}", index);
  if (previousEnd > begin) return {};
  let cursor = skipWhitespace(source, begin + "\\begin{tikzpicture}".length);
  if (source[cursor] !== "[") return {};
  const options = extractBalanced(source, cursor, "[", "]");
  return options ? parseOptionList(options.content) : {};
}

function parseOptionList(input = "") {
  const result = {};
  for (const part of splitTopLevelCommas(String(input))) {
    const text = part.trim();
    if (!text) continue;
    const equals = topLevelEquals(text);
    if (equals === -1) result[text] = true;
    else result[text.slice(0, equals).trim()] = text.slice(equals + 1).trim();
  }
  return result;
}

function splitTopLevelCommas(input) {
  const parts = [];
  let start = 0;
  let depth = 0;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === "{" || char === "[" || char === "(") depth += 1;
    else if (char === "}" || char === "]" || char === ")") depth = Math.max(0, depth - 1);
    else if (char === "," && depth === 0) {
      parts.push(input.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(input.slice(start));
  return parts;
}

function topLevelEquals(input) {
  let depth = 0;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === "{" || char === "[" || char === "(") depth += 1;
    else if (char === "}" || char === "]" || char === ")") depth = Math.max(0, depth - 1);
    else if (char === "=" && depth === 0) return index;
  }
  return -1;
}

function parseQtreeDimension(value, fallback) {
  if (value === undefined || value === null || value === true || value === "") return fallback;
  const parsed = parseDimension(String(value), {});
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function qtreeLabelWidth(label) {
  const normalized = normalizeLabel(label);
  const text = normalized.kind === "node" ? normalized.text : normalized.text;
  const width = texTextWidthCm(cleanQtreeText(text));
  return Math.max(0.18, width + NODE_INNER_XSEP);
}

function cleanQtreeText(text) {
  return String(text || "")
    .replace(/\$([^$]*)\$/g, "$1")
    .replace(/\\(?:textbf|textit|emph|mathrm|mathbf)\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\[A-Za-z]+\b/g, "")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function positiveNumber(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function walk(root, callback) {
  callback(root);
  for (const child of root.children) walk(child, callback);
}

function minNodeX(root) {
  let min = Infinity;
  walk(root, (item) => {
    min = Math.min(min, item.x);
  });
  return Number.isFinite(min) ? min : 0;
}

function extractBalanced(text, start, open, close) {
  if (text[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (char === open) depth += 1;
    if (char === close) depth -= 1;
    if (depth === 0) return { content: text.slice(start + 1, index), start, end: index + 1 };
  }
  return null;
}

function skipWhitespace(source, start) {
  let index = start;
  while (index < source.length && /\s/.test(source[index])) index += 1;
  return index;
}

function fmt(value) {
  return Number(value.toFixed(4)).toString();
}
