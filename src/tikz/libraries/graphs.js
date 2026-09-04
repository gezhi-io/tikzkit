const GRAPH_EDGE_KINDS = ["<->", "->", "<-", "--"];
const CM_PER_PT = 1 / 28.4527559;

export const tikzLibrary = {
  name: "graphs",
  status: "partial",
  implementedBy: "src/tikz/libraries/graphs.js:expandTikzGraphs",
  localSource: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/graphs/tikzlibrarygraphs.code.tex",
  localDoc: "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-graphs.tex",
  localSourceReviewed: "yes",
  features: [
    "graph command",
    "named node chains",
    "chain groups and all-to-all group edges",
    "->, --, <-, and <-> edge operators",
    "nodes and edges graph styles",
    "quoted edge labels with auto/swap placement",
    "local edge styles including bend left/right",
    "grow right/left/up/down Cartesian placement",
    "branch right/left/up/down Cartesian placement",
    "math nodes graph typesetting",
    "empty nodes graph typesetting",
    "node-local as text override precedence",
    "inline \\tikz \\graph wrapper"
  ],
  implements: [
    "graph command",
    "named node chains",
    "chain groups and all-to-all group edges",
    "->, --, <-, and <-> edge operators",
    "nodes and edges graph styles",
    "quoted edge labels with auto/swap placement",
    "local edge styles including bend left/right",
    "grow right/left/up/down Cartesian placement",
    "branch right/left/up/down Cartesian placement",
    "math nodes graph typesetting",
    "empty nodes graph typesetting",
    "node-local as text override precedence",
    "inline \\tikz \\graph wrapper"
  ],
  notes: "Reviewed locally on 2026-08-07: the graphs library separates graph syntax from drawing. Its parser records node chains and chain groups, invokes a new-edge key for every compatible entry/exit pair, and asks placement/place to turn accumulated logical chain width and group depth into node shifts. Its edge implementation uses a normal TikZ edge path, while the quotes library turns quoted labels into edge nodes with every edge quotes={auto}. TikZKit lowers the focused Cartesian subset to ordinary named nodes and edge paths: basic graph chains, one-or-more chain groups, the four built-in edge kinds, graph-wide node/edge styles, quoted edge labels with basic auto/swap placement, local edge styles such as bend left/right, and grow/branch vectors. Reviewed again on 2026-09-05 against tikzlibrarygraphs.code.tex lines 980-1165 and pgfmanual-en-tikz-graphs.tex: graph node names and displayed text are separate; math nodes wraps the graph-node text in math mode, empty nodes discards it, later graph options win, and a node-local as value has final precedence. TikZKit now preserves those semantics, including explicit empty as values, and shares TeX scriptstyle metrics with normal nodes so a_1, b^2, and c_3^n retain the native 8mm circle minimum. Subgraphs, graph drawing algorithms, node sets, circular/grid placement, graph operators, aliases, source/target edge options, arbitrary typeset callbacks, arbitrary quote key callbacks, and exact source TeX key callbacks remain partial."
};

// Lower the useful, declarative core of the graphs library before the normal
// TikZ parser sees it. The resulting nodes and paths use the normal shared
// positioning, border clipping, and SVG arrow renderer.
export function expandTikzGraphs(source, diagnostics = []) {
  const input = String(source || "");
  let output = "";
  let cursor = 0;
  let graphIndex = findGraphCommand(input, cursor);

  while (graphIndex >= 0) {
    let prefix = input.slice(cursor, graphIndex);
    const inline = trailingInlineTikz(prefix);
    if (inline) {
      prefix = `${prefix.slice(0, inline.start)}\\begin{tikzpicture}${inline.options ? `[${inline.options}]` : ""}\n`;
    }

    let position = skipWhitespace(input, graphIndex + "\\graph".length);
    let graphOptions = "";
    if (input[position] === "[") {
      const options = readBalanced(input, position, "[", "]");
      if (!options) {
        diagnostics.push({ severity: "warning", message: "Malformed \\graph options" });
        output += `${prefix}\\graph`;
        cursor = graphIndex + "\\graph".length;
        graphIndex = findGraphCommand(input, cursor);
        continue;
      }
      graphOptions = options.content;
      position = skipWhitespace(input, options.end);
    }
    const body = readBalanced(input, position, "{", "}");
    if (!body) {
      diagnostics.push({ severity: "warning", message: "Malformed \\graph body" });
      output += `${prefix}\\graph`;
      cursor = graphIndex + "\\graph".length;
      graphIndex = findGraphCommand(input, cursor);
      continue;
    }

    const graph = parseGraphSpecification(body.content, diagnostics);
    if (!graph.chains.length) {
      diagnostics.push({ severity: "warning", message: "Empty \\graph body" });
      output += `${prefix}\\graph${graphOptions ? `[${graphOptions}]` : ""}{${body.content}}`;
      cursor = body.end;
      graphIndex = findGraphCommand(input, cursor);
      continue;
    }

    let after = body.end;
    if (inline) {
      after = skipWhitespace(input, after);
      if (input[after] === ";") after += 1;
    }
    output += `${prefix}${lowerGraph(graph, graphOptions, diagnostics)}${inline ? "\n\\end{tikzpicture}" : ""}`;
    cursor = after;
    graphIndex = findGraphCommand(input, cursor);
  }

  return `${output}${input.slice(cursor)}`;
}

function findGraphCommand(source, from) {
  const match = /\\graph(?![A-Za-z@])/.exec(source.slice(from));
  return match ? from + match.index : -1;
}

function trailingInlineTikz(prefix) {
  const match = /\\tikz(?:\s*\[([^\]]*)\])?\s*$/.exec(prefix);
  if (!match) return null;
  return {
    start: prefix.length - match[0].length,
    options: String(match[1] || "").trim()
  };
}

function parseGraphSpecification(body, diagnostics) {
  return {
    chains: splitTopLevel(body, ";,").map((part) => parseGraphChain(part, diagnostics)).filter((chain) => chain.terms.length)
  };
}

function parseGraphChain(source, diagnostics) {
  const terms = [];
  const operators = [];
  let index = 0;
  while (index < source.length) {
    index = skipWhitespace(source, index);
    if (index >= source.length) break;
    const term = readGraphTerm(source, index, diagnostics);
    if (!term) break;
    terms.push(term.value);
    index = skipWhitespace(source, term.end);
    const operator = readGraphOperator(source, index);
    if (!operator) break;
    index = skipWhitespace(source, operator.end);
    let options = "";
    if (source[index] === "[") {
      const parsed = readBalanced(source, index, "[", "]");
      if (!parsed) {
        diagnostics.push({ severity: "warning", message: `Malformed ${operator.kind} graph edge options` });
      } else {
        options = parsed.content;
        index = skipWhitespace(source, parsed.end);
      }
    }
    operators.push({ kind: operator.kind, options });
  }
  if (operators.length && operators.length !== terms.length - 1) {
    diagnostics.push({ severity: "warning", message: "Incomplete graph node chain" });
  }
  return { terms, operators: operators.slice(0, Math.max(0, terms.length - 1)) };
}

function readGraphTerm(source, start, diagnostics) {
  if (source[start] === "{") {
    const group = readBalanced(source, start, "{", "}");
    if (!group) return null;
    return {
      value: { type: "group", ...parseGraphSpecification(group.content, diagnostics) },
      end: group.end
    };
  }
  let index = start;
  let braces = 0;
  let brackets = 0;
  let parens = 0;
  let quoted = false;
  while (index < source.length) {
    const char = source[index];
    if (char === '"' && braces === 0 && brackets === 0 && parens === 0) quoted = !quoted;
    if (!quoted) {
      if (char === "{") braces += 1;
      else if (char === "}") braces = Math.max(0, braces - 1);
      else if (char === "[") brackets += 1;
      else if (char === "]") brackets = Math.max(0, brackets - 1);
      else if (char === "(") parens += 1;
      else if (char === ")") parens = Math.max(0, parens - 1);
      if (braces === 0 && brackets === 0 && parens === 0 && (source[index] === "," || source[index] === ";" || readGraphOperator(source, index))) break;
    }
    index += 1;
  }
  const raw = source.slice(start, index).trim();
  if (!raw) return null;
  return { value: parseGraphNode(raw), end: index };
}

function parseGraphNode(raw) {
  let text = String(raw || "").trim();
  let optionText = "";
  const optionStart = topLevelIndexOf(text, "[");
  if (optionStart >= 0 && text.endsWith("]")) {
    optionText = text.slice(optionStart + 1, -1).trim();
    text = text.slice(0, optionStart).trim();
  }
  const slash = topLevelIndexOf(text, "/");
  let name = slash >= 0 ? text.slice(0, slash).trim() : text;
  let label = slash >= 0 ? text.slice(slash + 1).trim() : name;
  name = unquoteGraphText(name);
  label = unquoteGraphText(label) || name;
  const nodeOptions = [];
  let hasExplicitAs = false;
  for (const option of splitTopLevel(optionText, ",")) {
    const part = option.trim();
    if (!part) continue;
    const separator = topLevelIndexOf(part, "=");
    const rawKey = (separator < 0 ? part : part.slice(0, separator)).trim();
    const key = rawKey.replace(/^\/tikz\/graphs\//, "");
    if (key === "as" && separator >= 0) {
      label = stripOuterBraces(part.slice(separator + 1).trim());
      hasExplicitAs = true;
    } else {
      nodeOptions.push(part);
    }
  }
  return { type: "node", name, label, hasExplicitAs, options: nodeOptions.join(",") };
}

function graphNodeText(node, mode) {
  if (node.hasExplicitAs) return node.label;
  if (mode === "empty") return "";
  if (mode === "math") return `$${node.label}$`;
  return node.label;
}

function readGraphOperator(source, start) {
  for (const kind of GRAPH_EDGE_KINDS) {
    if (source.startsWith(kind, start)) return { kind, end: start + kind.length };
  }
  return null;
}

function lowerGraph(graph, rawOptions, diagnostics) {
  const options = graphOptions(rawOptions);
  const layout = graphLayout(options);
  const context = {
    nodes: new Map(),
    edges: [],
    layout,
    nodeTextMode: options.nodeTextMode || "default",
    graphNodeOptions: options.nodes || "",
    graphEdgeOptions: options.edges || ""
  };
  layoutGraphGroup(graph, 0, 0, context, diagnostics);
  const nodes = [...context.nodes.values()].map((node) => {
    const nodeOptions = joinOptions([context.graphNodeOptions, node.options]);
    const nodeText = graphNodeText(node, context.nodeTextMode);
    return `\\node${nodeOptions ? `[${nodeOptions}]` : ""} (${node.name}) at (${formatCoordinate(node.x)},${formatCoordinate(node.y)}) {${nodeText}};`;
  });
  const edges = context.edges.map((edge) => {
    const local = parseGraphEdgeOptions(edge.options);
    const pathOptions = joinOptions([context.graphEdgeOptions, edge.kind === "--" ? "" : edge.kind]);
    const labelNodes = local.labels.map(renderGraphEdgeLabel).join("");
    return `\\path${pathOptions ? `[${pathOptions}]` : ""} (${edge.from}) edge${local.styleOptions ? `[${local.styleOptions}]` : ""}${labelNodes} (${edge.to});`;
  });
  return `\n${[...nodes, ...edges].join("\n")}\n`;
}

// The native graphs library executes each connector through its `new ->`
// handler, which creates an ordinary TikZ `edge[...]` path. Keep edge options
// on that edge rather than flattening them into `--`: this preserves curves,
// edge-local styles and the geometry used by path labels. The quotes library
// translates `"label"` into `edge node={node[every edge quotes]{label}}` with
// `every edge quotes={auto}`; this focused equivalent accepts the common
// quoted label and apostrophe/swap form without requiring a separate renderer.
function parseGraphEdgeOptions(rawOptions) {
  const styleOptions = [];
  const labels = [];
  for (const entry of splitTopLevel(rawOptions, ",")) {
    const label = parseGraphEdgeQuote(entry);
    if (label) labels.push(label);
    else if (entry.trim()) styleOptions.push(entry.trim());
  }
  return { styleOptions: styleOptions.join(","), labels };
}

function parseGraphEdgeQuote(raw) {
  const text = String(raw || "").trim();
  if (!text.startsWith('"')) return null;
  const end = findGraphQuoteEnd(text, 1);
  if (end < 0) return null;
  let rest = text.slice(end + 1).trim();
  let swap = false;
  if (rest.startsWith("'")) {
    swap = true;
    rest = rest.slice(1).trim();
  }
  return {
    text: text.slice(1, end).replaceAll('""', '"'),
    swap,
    options: stripOuterBraces(rest)
  };
}

function findGraphQuoteEnd(text, start) {
  for (let index = start; index < text.length; index += 1) {
    if (text[index] !== '"') continue;
    if (text[index + 1] === '"') {
      index += 1;
      continue;
    }
    return index;
  }
  return -1;
}

function renderGraphEdgeLabel(label) {
  const options = joinOptions(["auto", label.swap ? "swap" : "", label.options]);
  return ` node${options ? `[${options}]` : ""} {${label.text}}`;
}

function layoutGraphGroup(group, originX, originY, context, diagnostics) {
  const entries = [];
  const exits = [];
  let width = 0;
  let chainOffset = 0;
  for (const chain of group.chains) {
    const x = originX + context.layout.branch.x * chainOffset;
    const y = originY + context.layout.branch.y * chainOffset;
    const result = layoutGraphChain(chain, x, y, context, diagnostics);
    entries.push(...result.entries);
    exits.push(...result.exits);
    width = Math.max(width, result.width);
    chainOffset += 1;
  }
  return { entries: unique(entries), exits: unique(exits), width: Math.max(width, group.chains.length ? 1 : 0) };
}

function layoutGraphChain(chain, originX, originY, context, diagnostics) {
  let cursorX = originX;
  let cursorY = originY;
  let previous = null;
  let width = 0;
  for (let index = 0; index < chain.terms.length; index += 1) {
    const term = chain.terms[index];
    const result = term.type === "group"
      ? layoutGraphGroup(term, cursorX, cursorY, context, diagnostics)
      : layoutGraphNode(term, cursorX, cursorY, context);
    if (previous) {
      const operator = chain.operators[index - 1] || { kind: "--", options: "" };
      for (const from of previous.exits) {
        for (const to of result.entries) context.edges.push({ from, to, kind: operator.kind, options: operator.options });
      }
    }
    previous = result;
    width += result.width;
    cursorX += context.layout.grow.x * result.width;
    cursorY += context.layout.grow.y * result.width;
  }
  return { entries: chain.terms.length ? firstTermEntries(chain, originX, originY, context, diagnostics) : [], exits: previous?.exits || [], width };
}

function firstTermEntries(chain, originX, originY, context, diagnostics) {
  const first = chain.terms[0];
  if (!first) return [];
  if (first.type === "group") {
    // Groups are already expanded during the normal layout pass; retain their
    // named nodes without placing them a second time.
    return collectGraphTermNames(first);
  }
  return [first.name];
}

function collectGraphTermNames(term) {
  if (term.type === "node") return [term.name];
  return unique(term.chains.flatMap((chain) => chain.terms.length ? collectGraphTermNames(chain.terms[0]) : []));
}

function layoutGraphNode(node, x, y, context) {
  if (!context.nodes.has(node.name)) context.nodes.set(node.name, { ...node, x, y });
  return { entries: [node.name], exits: [node.name], width: 1 };
}

function graphOptions(raw) {
  const options = {};
  for (const entry of splitTopLevel(raw, ",")) {
    const separator = topLevelIndexOf(entry, "=");
    const key = (separator < 0 ? entry : entry.slice(0, separator)).trim().toLowerCase();
    if (!key) continue;
    if (key === "empty nodes") options.nodeTextMode = "empty";
    else if (key === "math nodes") options.nodeTextMode = "math";
    else options[key] = stripOuterBraces(separator < 0 ? "" : entry.slice(separator + 1).trim());
  }
  return options;
}

function graphLayout(options) {
  const grow = vectorFromOptions(options, "grow", { x: 1, y: 0 });
  const branch = vectorFromOptions(options, "branch", { x: 0, y: -1 });
  return { grow, branch };
}

function vectorFromOptions(options, prefix, fallback) {
  const directions = ["right", "left", "up", "down"];
  for (const direction of directions) {
    const key = `${prefix} ${direction}`;
    if (!(key in options)) continue;
    const length = parseGraphLength(options[key], 1);
    const unit = direction === "right" ? { x: 1, y: 0 }
      : direction === "left" ? { x: -1, y: 0 }
        : direction === "up" ? { x: 0, y: 1 }
          : { x: 0, y: -1 };
    return { x: unit.x * length, y: unit.y * length };
  }
  return fallback;
}

function parseGraphLength(value, fallback) {
  const match = String(value || "").trim().match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(cm|mm|pt)?$/i);
  if (!match) return fallback;
  const number = Number(match[1]);
  if (!Number.isFinite(number)) return fallback;
  const unit = (match[2] || "cm").toLowerCase();
  if (unit === "mm") return number / 10;
  if (unit === "pt") return number * CM_PER_PT;
  return number;
}

function splitTopLevel(source, separators) {
  const parts = [];
  let start = 0;
  let braces = 0;
  let brackets = 0;
  let parens = 0;
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"' && braces === 0 && brackets === 0 && parens === 0) quoted = !quoted;
    if (quoted) continue;
    if (char === "{") braces += 1;
    else if (char === "}") braces = Math.max(0, braces - 1);
    else if (char === "[") brackets += 1;
    else if (char === "]") brackets = Math.max(0, brackets - 1);
    else if (char === "(") parens += 1;
    else if (char === ")") parens = Math.max(0, parens - 1);
    else if (braces === 0 && brackets === 0 && parens === 0 && separators.includes(char)) {
      const part = source.slice(start, index).trim();
      if (part) parts.push(part);
      start = index + 1;
    }
  }
  const tail = source.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

function readBalanced(source, start, open, close) {
  if (source[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === open) depth += 1;
    else if (source[index] === close) {
      depth -= 1;
      if (depth === 0) return { content: source.slice(start + 1, index), end: index + 1 };
    }
  }
  return null;
}

function topLevelIndexOf(source, target) {
  let braces = 0;
  let brackets = 0;
  let parens = 0;
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"' && braces === 0 && brackets === 0 && parens === 0) quoted = !quoted;
    if (quoted) continue;
    if (char === target && braces === 0 && brackets === 0 && parens === 0) return index;
    if (char === "{") braces += 1;
    else if (char === "}") braces = Math.max(0, braces - 1);
    else if (char === "[") brackets += 1;
    else if (char === "]") brackets = Math.max(0, brackets - 1);
    else if (char === "(") parens += 1;
    else if (char === ")") parens = Math.max(0, parens - 1);
  }
  return -1;
}

function skipWhitespace(source, index) {
  while (index < source.length && /\s/.test(source[index])) index += 1;
  return index;
}

function unquoteGraphText(value) {
  const text = String(value || "").trim();
  return text.startsWith('"') && text.endsWith('"') ? text.slice(1, -1) : text;
}

function stripOuterBraces(value) {
  const text = String(value || "").trim();
  const parsed = readBalanced(text, 0, "{", "}");
  return parsed && parsed.end === text.length ? parsed.content.trim() : text;
}

function joinOptions(parts) {
  return parts.map((part) => String(part || "").trim()).filter(Boolean).join(",");
}

function unique(values) {
  return [...new Set(values)];
}

function formatCoordinate(value) {
  const rounded = Math.abs(value) < 1e-10 ? 0 : Number(value.toFixed(8));
  return `${rounded}cm`;
}
