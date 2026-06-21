import { parseOptions, splitTopLevel, stripOuterBraces } from "../options.js";

export const tikzFeynhandExtension = {
  name: "tikz-feynhand",
  phase: "preprocess",
  description: "Expands common TikZ-FeynHand vertices and propagators into ordinary TikZ nodes and paths.",
  commands: ["vertex", "propag", "propagator"],
  preprocess(source, context = {}) {
    return expandTikzFeynhand(String(source), context.diagnostics || []);
  }
};

export function expandTikzFeynhand(source, diagnostics = []) {
  if (!usesTikzFeynhand(source)) return source;
  let text = source
    .replace(/\\begin\{feynhand\}(\s*\[[^\]]*\])?/g, (_match, options = "") => `\\begin{scope}${options}`)
    .replace(/\\end\{feynhand\}/g, "\\end{scope}");
  text = expandCommand(text, "\\vertex", parseVertexCommand, diagnostics);
  text = expandCommand(text, "\\propagator", parsePropagCommand, diagnostics);
  text = expandCommand(text, "\\propag", parsePropagCommand, diagnostics);
  return text;
}

function usesTikzFeynhand(source) {
  return /\\usepackage(?:\[[^\]]*\])?\{tikz-feynhand\}|\\usetikzlibrary(?:\[[^\]]*\])?\{[^}]*feynhand[^}]*\}|\\begin\{feynhand\}|\\propag(?:ator)?\b/.test(
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
  const label = text ? text.content : "";
  cursor = text ? text.end : cursor;
  if (source[cursor] === ";") cursor += 1;

  const options = mergeRawOptions(beforeOptions?.content, afterNameOptions?.content, trailingOptions?.content);
  const nodeOptions = feynhandVertexOptions(options);
  return {
    body: `\\node[${nodeOptions}] (${name.content.trim()})${at} {${label}};`,
    end: cursor
  };
}

function parsePropagCommand(source, start, command, diagnostics) {
  let cursor = skipWhitespace(source, start + command.length);
  const options = readOptional(source, cursor, "[", "]");
  cursor = options ? skipWhitespace(source, options.end) : cursor;
  const from = extractBalanced(source, cursor, "(", ")");
  if (!from) {
    diagnostics.push({ severity: "warning", message: `Malformed ${command} source` });
    return { body: "", end: cursor };
  }
  cursor = skipWhitespace(source, from.end);
  if (!source.startsWith("to", cursor)) {
    diagnostics.push({ severity: "warning", message: `Malformed ${command} target operation` });
    return { body: "", end: cursor };
  }
  cursor = skipWhitespace(source, cursor + 2);
  const edgeOptions = readOptional(source, cursor, "[", "]");
  cursor = edgeOptions ? skipWhitespace(source, edgeOptions.end) : cursor;
  const to = extractBalanced(source, cursor, "(", ")");
  if (!to) {
    diagnostics.push({ severity: "warning", message: `Malformed ${command} target` });
    return { body: "", end: cursor };
  }
  cursor = to.end;
  if (source[cursor] === ";") cursor += 1;

  const parsed = feynhandPropagOptions(options?.content || "", edgeOptions?.content || "");
  const nodes = parsed.nodes.length ? ` ${parsed.nodes.join(" ")}` : "";
  const toOptions = parsed.edgeOptions ? `[${parsed.edgeOptions}]` : "";
  return {
    body: `\\draw[${parsed.drawOptions}] (${from.content.trim()}) to${toOptions}${nodes} (${to.content.trim()});`,
    end: cursor
  };
}

function feynhandVertexOptions(raw) {
  const parts = splitTopLevel(raw || ",").map((part) => part.trim()).filter(Boolean);
  const mapped = [];
  let kind = "vertex";
  for (const part of parts) {
    const canonical = canonicalToken(part);
    if (["particle", "dot", "ringdot", "squaredot", "crossdot", "blob", "ringblob", "grayblob", "nwblob", "neblob"].includes(canonical)) {
      kind = canonical;
      continue;
    }
    mapped.push(part);
  }
  return [...vertexStyle(kind), ...mapped].join(",");
}

function vertexStyle(kind) {
  if (kind === "particle") return ["rectangle", "draw=none", "fill=none", "inner sep=0.333em", "feynhand particle"];
  if (kind === "dot") return ["circle", "draw", "fill", "inner sep=0pt", "minimum size=1.5mm", "line width=0.5pt", "feynhand dot"];
  if (kind === "ringdot") return ["circle", "draw", "fill=none", "inner sep=0pt", "minimum size=1.5mm", "line width=0.5pt", "feynhand dot"];
  if (kind === "squaredot") return ["rectangle", "draw", "fill", "inner sep=0pt", "minimum size=1.5mm", "line width=0.5pt", "feynhand dot"];
  if (kind === "crossdot") return ["circle cross split", "draw", "fill=none", "inner sep=0pt", "minimum size=3mm", "line width=0.5pt", "feynhand dot"];
  if (kind === "blob") return ["circle", "draw", "fill", "inner sep=0pt", "minimum size=7.5mm", "line width=0.5pt", "feynhand blob"];
  if (kind === "ringblob") return ["circle", "draw", "fill=white", "inner sep=0pt", "minimum size=7.5mm", "line width=0.5pt", "feynhand blob"];
  if (kind === "grayblob") return ["circle", "draw", "fill=gray!50!white", "inner sep=0pt", "minimum size=7.5mm", "line width=0.5pt", "feynhand blob"];
  if (kind === "nwblob") return ["circle", "draw", "fill=none", "pattern=north west lines", "inner sep=0pt", "minimum size=7.5mm", "line width=0.5pt", "feynhand blob"];
  if (kind === "neblob") return ["circle", "draw", "fill=none", "pattern=north east lines", "inner sep=0pt", "minimum size=7.5mm", "line width=0.5pt", "feynhand blob"];
  return ["coordinate"];
}

function feynhandPropagOptions(rawOptions, rawEdgeOptions) {
  const options = splitTopLevel(rawOptions || "").map((part) => part.trim()).filter(Boolean);
  const edge = parseOptions(rawEdgeOptions || "");
  const draw = ["line width=0.5pt"];
  const nodes = [];
  let subtype = "plain";
  let addArrow = false;
  let reverseArrow = false;
  let momentum = "";

  for (const part of options) {
    const key = optionKey(part);
    const canonical = canonicalToken(key);
    const value = optionValue(part);
    const type = propagatorType(canonical);
    if (type) {
      subtype = type.subtype;
      draw.push(...type.options);
      addArrow ||= type.arrow === "forward";
      reverseArrow ||= type.arrow === "reverse";
      continue;
    }
    if (["mom", "momentum"].includes(canonical)) {
      momentum = stripOuterBraces(value);
      continue;
    }
    if (["revmom", "reversed momentum", "reversedmomentum"].includes(canonical)) {
      momentum = stripOuterBraces(value);
      reverseArrow = true;
      continue;
    }
    if (canonical === "top") {
      draw.push("feynhand top");
      continue;
    }
    if (canonical === "with arrow") {
      addArrow = true;
      continue;
    }
    if (canonical === "with reversed arrow") {
      reverseArrow = true;
      continue;
    }
    draw.push(part);
  }

  const label = edge["edge label"];
  const labelPrime = edge["edge label'"];
  delete edge["edge label"];
  delete edge["edge label'"];
  if (label) nodes.push(`node[midway,above] {${label}}`);
  if (labelPrime) nodes.push(`node[midway,below] {${labelPrime}}`);
  if (momentum) nodes.push(`node[pos=0.62,below] {${momentum}}`);
  if (addArrow || reverseArrow || momentum) {
    draw.push(`postaction={decorate}`, `decoration={markings, mark=at position 0.5 with {\\arrow{stealth} feynhand momentum${reverseArrow ? " reversed" : ""}}}`);
  }

  draw.push(`feynhand ${subtype}`);
  return {
    drawOptions: draw.filter(Boolean).join(","),
    edgeOptions: Object.entries(edge)
      .map(([key, value]) => (value === true ? key : `${key}=${value}`))
      .join(","),
    nodes
  };
}

function propagatorType(name) {
  const map = {
    plain: { subtype: "plain", options: [] },
    fermion: { subtype: "fermion", options: [], arrow: "forward" },
    fer: { subtype: "fermion", options: [], arrow: "forward" },
    "anti fermion": { subtype: "fermion", options: [], arrow: "reverse" },
    antfer: { subtype: "fermion", options: [], arrow: "reverse" },
    gluon: { subtype: "gluon", options: ["decorate", "decoration={snake, segment length=1.2mm, amplitude=0.25mm}"] },
    glu: { subtype: "gluon", options: ["decorate", "decoration={snake, segment length=1.2mm, amplitude=0.25mm}"] },
    boson: { subtype: "boson", options: ["decorate", "decoration={snake, segment length=2mm, amplitude=0.22mm}"] },
    bos: { subtype: "boson", options: ["decorate", "decoration={snake, segment length=2mm, amplitude=0.22mm}"] },
    photon: { subtype: "boson", options: ["decorate", "decoration={snake, segment length=2mm, amplitude=0.22mm}"] },
    pho: { subtype: "boson", options: ["decorate", "decoration={snake, segment length=2mm, amplitude=0.22mm}"] },
    "charged boson": { subtype: "boson", options: ["decorate", "decoration={snake, segment length=2mm, amplitude=0.22mm}"], arrow: "forward" },
    chabos: { subtype: "boson", options: ["decorate", "decoration={snake, segment length=2mm, amplitude=0.22mm}"], arrow: "forward" },
    antbos: { subtype: "boson", options: ["decorate", "decoration={snake, segment length=2mm, amplitude=0.22mm}"], arrow: "reverse" },
    scalar: { subtype: "scalar", options: ["dashed"] },
    sca: { subtype: "scalar", options: ["dashed"] },
    "charged scalar": { subtype: "scalar", options: ["dashed"], arrow: "forward" },
    chasca: { subtype: "scalar", options: ["dashed"], arrow: "forward" },
    antsca: { subtype: "scalar", options: ["dashed"], arrow: "reverse" },
    ghost: { subtype: "ghost", options: ["densely dotted"] },
    gho: { subtype: "ghost", options: ["densely dotted"] },
    chagho: { subtype: "ghost", options: ["densely dotted"], arrow: "forward" },
    antgho: { subtype: "ghost", options: ["densely dotted"], arrow: "reverse" },
    majorana: { subtype: "majorana", options: [], arrow: "forward" },
    maj: { subtype: "majorana", options: [], arrow: "forward" },
    antmaj: { subtype: "majorana", options: [], arrow: "reverse" }
  };
  return map[name] || null;
}

function mergeRawOptions(...parts) {
  return parts.filter((part) => part && String(part).trim()).join(",");
}

function canonicalToken(value) {
  return String(value || "").trim().replace(/^\/tikzfeynhand\//, "").replace(/\s+/g, " ").toLowerCase();
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

function readOptional(source, cursor, open, close) {
  cursor = skipWhitespace(source, cursor);
  if (source[cursor] !== open) return null;
  return extractBalanced(source, cursor, open, close);
}

function extractBalanced(source, start, open, close) {
  if (source[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === open && source[index - 1] !== "\\") depth += 1;
    if (char === close && source[index - 1] !== "\\") depth -= 1;
    if (depth === 0) return { content: source.slice(start + 1, index), end: index + 1 };
  }
  return null;
}

function skipWhitespace(source, index) {
  let cursor = index;
  while (cursor < source.length && /\s/.test(source[cursor] || "")) cursor += 1;
  return cursor;
}
