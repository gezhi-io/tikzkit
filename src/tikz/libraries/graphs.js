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
    "grow right/left/up/down Cartesian placement",
    "branch right/left/up/down Cartesian placement",
    "inline \\tikz \\graph wrapper"
  ],
  implements: [
    "graph command",
    "named node chains",
    "chain groups and all-to-all group edges",
    "->, --, <-, and <-> edge operators",
    "nodes and edges graph styles",
    "grow right/left/up/down Cartesian placement",
    "branch right/left/up/down Cartesian placement",
    "inline \\tikz \\graph wrapper"
  ],
  notes: "Reviewed locally on 2026-08-07: the graphs library separates graph syntax from drawing. Its parser records node chains and chain groups, invokes a new-edge key for every compatible entry/exit pair, and asks placement/place to turn accumulated logical chain width and group depth into node shifts. TikZKit lowers the focused Cartesian subset to ordinary named nodes and edges: basic graph chains, one-or-more chain groups, the four built-in edge kinds, graph-wide node/edge styles, and grow/branch vectors. Subgraphs, graph drawing algorithms, node sets, circular/grid placement, graph operators, aliases, per-edge node syntax, and exact source TeX key callbacks remain partial."
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
  for (const option of splitTopLevel(optionText, ",")) {
    const part = option.trim();
    if (!part) continue;
    if (part.startsWith("as=")) label = stripOuterBraces(part.slice(3).trim()) || label;
    else nodeOptions.push(part);
  }
  return { type: "node", name, label, options: nodeOptions.join(",") };
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
  const context = { nodes: new Map(), edges: [], layout, graphNodeOptions: options.nodes || "", graphEdgeOptions: options.edges || "" };
  layoutGraphGroup(graph, 0, 0, context, diagnostics);
  const nodes = [...context.nodes.values()].map((node) => {
    const nodeOptions = joinOptions([context.graphNodeOptions, node.options]);
    return `\\node${nodeOptions ? `[${nodeOptions}]` : ""} (${node.name}) at (${formatCoordinate(node.x)},${formatCoordinate(node.y)}) {${node.label}};`;
  });
  const edges = context.edges.map((edge) => {
    const options = joinOptions([context.graphEdgeOptions, edge.options, edge.kind === "--" ? "" : edge.kind]);
    return `\\draw${options ? `[${options}]` : ""} (${edge.from}) -- (${edge.to});`;
  });
  return `\n${[...nodes, ...edges].join("\n")}\n`;
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
    options[key] = stripOuterBraces(separator < 0 ? "" : entry.slice(separator + 1).trim());
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
