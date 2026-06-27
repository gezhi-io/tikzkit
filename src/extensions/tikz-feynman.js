import { parseOptions, splitTopLevel, stripOuterBraces } from "../options.js";

export const tikzFeynmanExtension = {
  name: "tikz-feynman",
  phase: "preprocess",
  description: "Expands common TikZ-Feynman diagram syntax into ordinary TikZ nodes and paths.",
  commands: ["feynmandiagram", "diagram", "vertex"],
  preprocess(source, context = {}) {
    return expandTikzFeynman(String(source), context.diagnostics || []);
  }
};

export function expandTikzFeynman(source, diagnostics = []) {
  if (!usesTikzFeynman(source)) return source;
  let text = source
    .replace(/\\begin\{feynman\}(\s*\[[^\]]*\])?/g, (_match, options = "") => `\\begin{scope}${options}`)
    .replace(/\\end\{feynman\}/g, "\\end{scope}");
  text = expandCommand(text, "\\feynmandiagram", parseFeynmanDiagramCommand, diagnostics);
  text = expandCommand(text, "\\diagram", parseDiagramCommand, diagnostics);
  text = expandCommand(text, "\\vertex", parseVertexCommand, diagnostics);
  text = wrapInlineFeynmanEquations(text);
  return text;
}

function usesTikzFeynman(source) {
  return /\\usepackage(?:\[[^\]]*\])?\{tikz-feynman\}|\\usetikzlibrary(?:\[[^\]]*\])?\{[^}]*feynman[^}]*\}|\\begin\{feynman\}|\\feynmandiagram\b|\\diagram\*?\b/.test(
    source
  );
}

function expandCommand(source, command, parser, diagnostics) {
  let output = "";
  let index = 0;
  while (index < source.length) {
    if (!source.startsWith(command, index) || /[A-Za-z@]/.test(source[index + command.length] || "")) {
      output += source[index];
      index += 1;
      continue;
    }
    const parsed = parser(source, index, command, diagnostics);
    output += parsed?.body ?? source[index];
    index = parsed?.end ?? index + 1;
  }
  return output;
}

function parseFeynmanDiagramCommand(source, start, command, diagnostics) {
  return parseDiagramLikeCommand(source, start, command, diagnostics, { forceLayout: true });
}

function parseDiagramCommand(source, start, command, diagnostics) {
  return parseDiagramLikeCommand(source, start, command, diagnostics, { allowStar: true });
}

function parseDiagramLikeCommand(source, start, command, diagnostics, settings = {}) {
  let cursor = skipWhitespace(source, start + command.length);
  let starred = false;
  if (settings.allowStar && source[cursor] === "*") {
    starred = true;
    cursor = skipWhitespace(source, cursor + 1);
  }
  const options = readOptional(source, cursor, "[", "]");
  cursor = options ? skipWhitespace(source, options.end) : cursor;
  const body = extractBalanced(source, cursor, "{", "}");
  if (!body) {
    diagnostics.push({ severity: "warning", message: `Malformed ${command} command` });
    return { body: "", end: cursor };
  }
  cursor = skipWhitespace(source, body.end);
  if (source[cursor] === ";") cursor += 1;
  const expanded = expandDiagramBody(body.content, options?.content || "", { starred: starred && !settings.forceLayout });
  return { body: expanded, end: cursor };
}

function parseVertexCommand(source, start, command, diagnostics) {
  let cursor = skipWhitespace(source, start + command.length);
  const beforeOptions = readOptional(source, cursor, "[", "]");
  cursor = beforeOptions ? skipWhitespace(source, beforeOptions.end) : cursor;
  const name = extractBalanced(source, cursor, "(", ")");
  if (!name) {
    diagnostics.push({ severity: "warning", message: "Malformed \\vertex command" });
    return { body: "", end: cursor };
  }
  cursor = skipWhitespace(source, name.end);
  const afterNameOptions = readOptional(source, cursor, "[", "]");
  cursor = afterNameOptions ? skipWhitespace(source, afterNameOptions.end) : cursor;
  let at = "";
  if (source.startsWith("at", cursor)) {
    cursor = skipWhitespace(source, cursor + 2);
    const coordinate = extractBalanced(source, cursor, "(", ")");
    if (!coordinate) {
      diagnostics.push({ severity: "warning", message: "Malformed \\vertex coordinate" });
      return { body: "", end: cursor };
    }
    at = ` at (${coordinate.content.trim()})`;
    cursor = skipWhitespace(source, coordinate.end);
  }
  const trailingOptions = readOptional(source, cursor, "[", "]");
  cursor = trailingOptions ? skipWhitespace(source, trailingOptions.end) : cursor;
  const text = extractBalanced(source, cursor, "{", "}");
  let label = text ? text.content : "";
  cursor = text ? text.end : cursor;
  if (source[cursor] === ";") cursor += 1;

  const options = mergeRawOptions(beforeOptions?.content, afterNameOptions?.content, trailingOptions?.content);
  const nodeOptions = feynmanVertexOptions(options);
  const parsed = parseOptions(options || "");
  if (!label && parsed.particle) label = parsed.particle;
  return {
    body: `\\node[${nodeOptions}] (${name.content.trim()})${at} {${label}};`,
    end: cursor
  };
}

function expandDiagramBody(body, rawOptions, settings = {}) {
  const graph = parseGraph(body);
  const layout = settings.starred ? new Map() : layoutGraph(graph, rawOptions);
  const nodes = [];
  for (const node of graph.nodes.values()) {
    if (node.external) continue;
    const options = feynmanVertexOptions(node.options);
    const text = feynmanVertexText(node.options);
    const point = layout.get(node.name);
    const at = point ? ` at (${formatNumber(point.x)},${formatNumber(point.y)})` : "";
    nodes.push(`\\node[${options}] (${node.name})${at} {${text}};`);
  }
  const paths = graph.edges.map((edge) => {
    const parsed = feynmanEdgeOptions(edge.options);
    const edgeOptions = parsed.edgeOptions ? `[${parsed.edgeOptions}]` : "";
    const inlineNodes = parsed.nodes.length ? ` ${parsed.nodes.join(" ")}` : "";
    return `\\draw[${parsed.drawOptions}] (${edge.from}) to${edgeOptions}${inlineNodes} (${edge.to});`;
  });
  return [...nodes, ...paths].join("\n");
}

function parseGraph(body) {
  const graph = { nodes: new Map(), edges: [] };
  const sequences = splitGraphStatements(body);
  for (const sequence of sequences) {
    parseGraphSequence(sequence, graph);
  }
  return graph;
}

function parseGraphSequence(sequence, graph) {
  let cursor = 0;
  let previous = readGraphVertexSet(sequence, cursor);
  if (!previous) return;
  cursor = previous.end;
  for (const vertex of previous.vertices) addGraphNode(graph, vertex);
  while (cursor < sequence.length) {
    cursor = skipWhitespace(sequence, cursor);
    if (!sequence.startsWith("--", cursor)) break;
    cursor = skipWhitespace(sequence, cursor + 2);
    const edgeOptions = readOptional(sequence, cursor, "[", "]");
    cursor = edgeOptions ? skipWhitespace(sequence, edgeOptions.end) : cursor;
    const next = readGraphVertexSet(sequence, cursor);
    if (!next) break;
    cursor = next.end;
    for (const vertex of next.vertices) addGraphNode(graph, vertex);
    for (const from of previous.vertices) {
      for (const to of next.vertices) {
        graph.edges.push({
          from: from.name,
          to: to.name,
          options: edgeOptions?.content || ""
        });
      }
    }
    previous = next;
  }
}

function readGraphVertexSet(text, start) {
  let cursor = skipWhitespace(text, start);
  if (text[cursor] !== "{") {
    const vertex = readGraphVertex(text, cursor);
    return vertex ? { vertices: [vertex], end: vertex.end } : null;
  }
  const balanced = extractBalanced(text, cursor, "{", "}");
  if (!balanced) return null;
  const vertices = splitTopLevel(balanced.content, ",")
    .map((part) => readGraphVertex(part.trim(), 0))
    .filter(Boolean);
  if (!vertices.length) return null;
  return { vertices, end: balanced.end };
}

function readGraphVertex(text, start) {
  let cursor = skipWhitespace(text, start);
  if (cursor >= text.length) return null;
  if (text[cursor] === "{") return null;
  let external = false;
  let name = "";
  if (text[cursor] === "(") {
    const balanced = extractBalanced(text, cursor, "(", ")");
    if (!balanced) return null;
    name = balanced.content.trim();
    cursor = balanced.end;
    external = true;
  } else {
    const begin = cursor;
    while (cursor < text.length && !/[\s\[\],;{}]/.test(text[cursor]) && !text.startsWith("--", cursor)) cursor += 1;
    name = text.slice(begin, cursor).trim();
  }
  cursor = skipWhitespace(text, cursor);
  const options = readOptional(text, cursor, "[", "]");
  cursor = options ? options.end : cursor;
  if (!name) return null;
  return { name, options: options?.content || "", external, end: cursor };
}

function addGraphNode(graph, vertex) {
  const existing = graph.nodes.get(vertex.name);
  if (existing) {
    if (vertex.options) existing.options = mergeRawOptions(existing.options, vertex.options);
    existing.external &&= vertex.external;
    return;
  }
  graph.nodes.set(vertex.name, {
    name: vertex.name,
    options: vertex.options || "",
    external: vertex.external
  });
}

function layoutGraph(graph, rawOptions) {
  const options = parseOptions(rawOptions || "");
  const orientation = orientationFromOptions(options);
  const nodes = [...graph.nodes.values()].filter((node) => !node.external);
  const layers = new Map();
  const order = new Map(nodes.map((node, index) => [node.name, index]));
  if (orientation.start && graph.nodes.has(orientation.start)) layers.set(orientation.start, 0);
  if (orientation.end && graph.nodes.has(orientation.end)) layers.set(orientation.end, 1);
  if (!layers.size && nodes[0]) layers.set(nodes[0].name, 0);

  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of graph.edges) {
      if (!graph.nodes.has(edge.from) || !graph.nodes.has(edge.to)) continue;
      if (layers.has(edge.from) && !layers.has(edge.to)) {
        layers.set(edge.to, layers.get(edge.from) + 1);
        changed = true;
      } else if (!layers.has(edge.from) && layers.has(edge.to)) {
        layers.set(edge.from, layers.get(edge.to) - 1);
        changed = true;
      }
    }
  }
  for (const node of nodes) {
    if (!layers.has(node.name)) layers.set(node.name, order.get(node.name));
  }

  const grouped = new Map();
  for (const node of nodes) {
    const layer = layers.get(node.name) ?? 0;
    if (!grouped.has(layer)) grouped.set(layer, []);
    grouped.get(layer).push(node);
  }
  const spacing = diagramSpacing(options);
  const result = new Map();
  for (const [layer, group] of grouped) {
    group.sort((a, b) => (order.get(a.name) ?? 0) - (order.get(b.name) ?? 0));
    const anchored = group.findIndex((node) => node.name === orientation.start || node.name === orientation.end);
    const shift = anchored >= 0 ? anchored : (group.length - 1) / 2;
    for (let index = 0; index < group.length; index += 1) {
      const along = layer * spacing.x;
      const cross = (shift - index) * spacing.y;
      const point = orientation.axis === "vertical" ? { x: cross, y: -along } : { x: along, y: cross };
      result.set(group[index].name, point);
    }
  }
  return result;
}

function orientationFromOptions(options) {
  for (const key of ["horizontal", "horizontal'", "vertical", "vertical'"]) {
    if (!Object.hasOwn(options, key)) continue;
    const match = String(options[key]).match(/^\s*\(?([^) ]+)\)?\s+to\s+\(?([^) ]+)\)?\s*$/);
    return {
      axis: key.startsWith("vertical") ? "vertical" : "horizontal",
      start: match?.[1] || "",
      end: match?.[2] || ""
    };
  }
  return { axis: "horizontal", start: "", end: "" };
}

function diagramSpacing(options) {
  if (options.small) return { x: 1.55, y: 0.82 };
  if (options.large) return { x: 2.15, y: 1.12 };
  return { x: 1.85, y: 0.95 };
}

function feynmanVertexOptions(raw) {
  const parsed = parseOptions(raw || "");
  const parts = splitTopLevel(raw || "").map((part) => part.trim()).filter(Boolean);
  const mapped = [];
  let kind = parsed["crossed dot"] ? "crossed dot" : parsed.dot ? "dot" : parsed.blob ? "blob" : parsed.particle ? "particle" : "vertex";
  for (const part of parts) {
    const key = optionKey(part);
    const canonical = canonicalToken(key);
    if (["particle", "dot", "blob", "crossed dot"].includes(canonical)) continue;
    mapped.push(part);
  }
  return [...vertexStyle(kind), ...mapped, `feynman ${kind}`].join(",");
}

function feynmanVertexText(raw) {
  const parsed = parseOptions(raw || "");
  return parsed.particle ? stripOuterBraces(parsed.particle) : "";
}

function vertexStyle(kind) {
  if (kind === "particle") return ["rectangle", "draw=none", "fill=none", "inner sep=0.333em"];
  if (kind === "dot") return ["circle", "draw", "fill", "inner sep=0pt", "minimum size=1.5mm", "line width=0.5pt"];
  if (kind === "crossed dot") return ["shape=circle cross split", "draw", "fill=none", "inner sep=0pt", "minimum size=3mm", "line width=0.5pt"];
  if (kind === "blob") return ["circle", "draw", "fill", "inner sep=0pt", "minimum size=7.5mm", "line width=0.5pt"];
  return ["coordinate"];
}

function feynmanEdgeOptions(rawOptions) {
  const parts = splitTopLevel(rawOptions || "").map((part) => part.trim()).filter(Boolean);
  const draw = ["line width=0.5pt"];
  const nodes = [];
  const edge = {};
  let subtype = "plain";
  const arrowPositions = [];
  let momentum = "";
  let momentumPrime = false;

  for (const part of parts) {
    const key = optionKey(part);
    const canonical = canonicalToken(key);
    const value = optionValue(part);
    const type = propagatorType(canonical);
    if (type) {
      subtype = type.subtype;
      draw.push(...type.options);
      for (const arrow of type.arrows || []) arrowPositions.push(arrow);
      continue;
    }
    if (["momentum", "momentum'", "reversed momentum", "reversed momentum'"].includes(canonical)) {
      momentum = stripOuterBraces(value);
      momentumPrime = canonical.includes("'");
      if (canonical.startsWith("reversed")) arrowPositions.push({ pos: 0.5, reverse: true, momentum: true });
      else arrowPositions.push({ pos: 0.5, reverse: false, momentum: true });
      continue;
    }
    if (canonical === "edge label") {
      nodes.push(`node[midway,above] {${stripOuterBraces(value)}}`);
      continue;
    }
    if (canonical === "edge label'") {
      nodes.push(`node[midway,below] {${stripOuterBraces(value)}}`);
      continue;
    }
    const bend = feynmanBendModifier(canonical);
    if (bend) {
      edge[bend.key] = bend.value;
      if (bend.looseness && !Object.hasOwn(edge, "looseness")) edge.looseness = bend.looseness;
      continue;
    }
    edge[key] = value || true;
  }

  if (momentum) nodes.push(`node[pos=0.62,${momentumPrime ? "below" : "above"}] {${momentum}}`);
  if (arrowPositions.length) {
    draw.push(`postaction={decorate,decoration={markings, ${arrowPositions.map(marking).join(", ")}}}`);
  }
  draw.push(`feynman ${subtype}`);
  return {
    drawOptions: draw.filter(Boolean).join(","),
    edgeOptions: Object.entries(edge)
      .map(([key, value]) => (value === true ? key : `${key}=${value}`))
      .join(","),
    nodes
  };
}

function marking(arrow) {
  const body = `\\arrow{stealth} ${arrow.momentum ? "feynman momentum" : "feynman arrow"}${arrow.reverse ? " reversed" : ""}`;
  return `mark=at position ${arrow.pos} with {${body}}`;
}

function propagatorType(name) {
  const wavy = ["decorate", "decoration={snake, segment length=2mm, amplitude=0.22mm}"];
  const curly = ["decorate", "decoration={snake, segment length=1.1mm, amplitude=0.32mm}"];
  const map = {
    plain: { subtype: "plain", options: [] },
    fermion: { subtype: "fermion", options: [], arrows: [{ pos: 0.5 }] },
    "anti fermion": { subtype: "fermion", options: [], arrows: [{ pos: 0.5, reverse: true }] },
    majorana: { subtype: "majorana", options: [], arrows: [{ pos: 0.33 }, { pos: 0.73, reverse: true }] },
    "anti majorana": { subtype: "majorana", options: [], arrows: [{ pos: 0.33, reverse: true }, { pos: 0.73 }] },
    boson: { subtype: "boson", options: wavy },
    photon: { subtype: "boson", options: wavy },
    "charged boson": { subtype: "boson", options: wavy, arrows: [{ pos: 0.5 }] },
    "anti charged boson": { subtype: "boson", options: wavy, arrows: [{ pos: 0.5, reverse: true }] },
    gluon: { subtype: "gluon", options: curly },
    scalar: { subtype: "scalar", options: ["dashed"] },
    "charged scalar": { subtype: "scalar", options: ["dashed"], arrows: [{ pos: 0.5 }] },
    "anti charged scalar": { subtype: "scalar", options: ["dashed"], arrows: [{ pos: 0.5, reverse: true }] },
    ghost: { subtype: "ghost", options: ["densely dotted"] }
  };
  return map[name] || null;
}

function feynmanBendModifier(name) {
  const map = {
    "half left": { key: "bend left", value: 90, looseness: 1.5 },
    "half right": { key: "bend right", value: 90, looseness: 1.5 },
    "quarter left": { key: "bend left", value: 45 },
    "quarter right": { key: "bend right", value: 45 }
  };
  return map[name] || null;
}

function splitGraphStatements(input) {
  const statements = [];
  let current = "";
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === "(") paren += 1;
    if (char === ")") paren = Math.max(0, paren - 1);
    if (char === "[") bracket += 1;
    if (char === "]") bracket = Math.max(0, bracket - 1);
    if (char === "{") brace += 1;
    if (char === "}") brace = Math.max(0, brace - 1);
    if ((char === "," || char === ";") && paren === 0 && bracket === 0 && brace === 0) {
      if (current.trim()) statements.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

function readOptional(source, start, open, close) {
  if (source[start] !== open) return null;
  return extractBalanced(source, start, open, close);
}

function extractBalanced(text, start, open, close) {
  if (text[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (char === open) depth += 1;
    if (char === close) depth -= 1;
    if (depth === 0) {
      return {
        content: text.slice(start + 1, index),
        start,
        end: index + 1
      };
    }
  }
  return null;
}

function skipWhitespace(source, start) {
  let index = start;
  while (index < source.length && /\s/.test(source[index])) index += 1;
  return index;
}

function mergeRawOptions(...parts) {
  return parts.filter((part) => part && String(part).trim()).join(",");
}

function canonicalToken(value) {
  return String(value || "").trim().replace(/^\/tikzfeynman\//, "").replace(/\s+/g, " ").toLowerCase();
}

function optionKey(part) {
  const index = findTopLevelEquals(part);
  return (index === -1 ? part : part.slice(0, index)).trim();
}

function optionValue(part) {
  const index = findTopLevelEquals(part);
  return index === -1 ? "" : part.slice(index + 1).trim();
}

function findTopLevelEquals(text) {
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "(") paren += 1;
    if (char === ")") paren = Math.max(0, paren - 1);
    if (char === "[") bracket += 1;
    if (char === "]") bracket = Math.max(0, bracket - 1);
    if (char === "{") brace += 1;
    if (char === "}") brace = Math.max(0, brace - 1);
    if (char === "=" && paren === 0 && bracket === 0 && brace === 0) return index;
  }
  return -1;
}

function formatNumber(value) {
  return Number(value.toFixed(4)).toString();
}

function wrapInlineFeynmanEquations(source) {
  if (source.includes("\\begin{tikzpicture}") || !source.includes("\\raisebox")) return source;
  const raiseboxes = collectFeynmanRaiseboxes(source);
  if (!raiseboxes.length) return source;
  const mathStart = source.lastIndexOf("$", raiseboxes[0].start);
  const mathEnd = source.indexOf("$", raiseboxes.at(-1).end);
  if (mathStart < 0 || mathEnd < 0 || mathEnd <= mathStart) return source;
  const prefix = source.slice(mathStart + 1, raiseboxes[0].start);
  const picture = inlineFeynmanPicture(prefix, raiseboxes, source);
  return `${source.slice(0, mathStart)}${picture}${source.slice(mathEnd + 1)}`;
}

function collectFeynmanRaiseboxes(source) {
  const boxes = [];
  let index = 0;
  while (index < source.length) {
    const start = source.indexOf("\\raisebox", index);
    if (start === -1) break;
    let cursor = skipWhitespace(source, start + "\\raisebox".length);
    const amount = extractBalanced(source, cursor, "{", "}");
    if (!amount) {
      index = start + 1;
      continue;
    }
    cursor = skipWhitespace(source, amount.end);
    const content = extractBalanced(source, cursor, "{", "}");
    if (!content) {
      index = amount.end;
      continue;
    }
    if (/\\(?:node|draw|path)\b|feynman\s/.test(content.content)) {
      boxes.push({
        start,
        end: content.end,
        amount: amount.content.trim(),
        body: content.content.trim()
      });
    }
    index = content.end;
  }
  return boxes;
}

function inlineFeynmanPicture(prefix, raiseboxes, source) {
  const diagramScale = 0.46;
  let cursor = 0.95;
  const commands = [
    "\\begin{tikzpicture}[font=\\normalsize]",
    `\\node[anchor=east] at (0,0) {${asMathNodeText(prefix)}};`
  ];
  for (let index = 0; index < raiseboxes.length; index += 1) {
    const box = raiseboxes[index];
    const bounds = feynmanBodyBounds(box.body);
    const shiftX = cursor - bounds.minX * diagramScale;
    commands.push(`{[shift={(${formatNumber(shiftX)},0.08)},scale=${diagramScale}]`);
    commands.push(box.body);
    commands.push("}");
    cursor += Math.max(1.1, (bounds.maxX - bounds.minX) * diagramScale) + 0.42;
    const gap = source.slice(box.end, raiseboxes[index + 1]?.start ?? box.end);
    if (/\+/.test(gap)) {
      commands.push(`\\node at (${formatNumber(cursor)},0) {$+$};`);
      cursor += 0.52;
    }
  }
  commands.push("\\end{tikzpicture}");
  return commands.join("\n");
}

function asMathNodeText(text) {
  const cleaned = String(text || "")
    .replace(/\\enskip/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.startsWith("$") ? cleaned : `$${cleaned}$`;
}

function feynmanBodyBounds(body) {
  const xs = [];
  const ys = [];
  const pattern = /\bat\s*\(([^,()]+),([^()]+)\)/g;
  let match;
  while ((match = pattern.exec(body))) {
    const x = Number(match[1].trim());
    const y = Number(match[2].trim());
    if (Number.isFinite(x)) xs.push(x);
    if (Number.isFinite(y)) ys.push(y);
  }
  if (!xs.length || !ys.length) return { minX: -1, maxX: 3, minY: -1, maxY: 1 };
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys)
  };
}
