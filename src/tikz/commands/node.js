const STRUCTURED_LINE_BREAK_PATTERN = /\\(?:begin\s*\{(?:array|matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|cases|aligned|alignedat|align\*?|gathered|split|tabular\*?|minipage)\}|shortstack\b|parbox\b|makecell\b)/;

export function nodeLineBreaksEnabled(options = {}) {
  const align = optionText(options.align).toLowerCase();
  if (align === "none") return false;
  if (align && align !== "true" && align !== "false") return true;
  if (optionText(options["text width"])) return true;
  return Boolean(optionText(options["node halign header"]));
}

export function applyNodeLineBreakSemantics(value, options = {}) {
  const source = String(value ?? "");
  if (nodeLineBreaksEnabled(options) || STRUCTURED_LINE_BREAK_PATTERN.test(source)) return source;

  let output = "";
  let cursor = 0;
  while (cursor < source.length) {
    const mathSpan = readNodeMathSpan(source, cursor);
    if (mathSpan) {
      output += source.slice(cursor, mathSpan);
      cursor = mathSpan;
      continue;
    }
    if (source[cursor] === "\\" && source[cursor + 1] === "\\") {
      cursor += 2;
      if (source[cursor] === "*") cursor += 1;
      while (/\s/.test(source[cursor] || "")) cursor += 1;
      if (source[cursor] === "[") cursor = skipBalancedNodeText(source, cursor, "[", "]");
      continue;
    }
    output += source[cursor];
    cursor += 1;
  }
  return output;
}

function optionText(value) {
  if (value === undefined || value === null || value === true || value === false) return "";
  const text = String(value).trim();
  return text === "{}" ? "" : text;
}

function readNodeMathSpan(source, start) {
  if (source[start] === "$" && !isEscapedNodeText(source, start)) {
    const delimiter = source[start + 1] === "$" ? "$$" : "$";
    for (let cursor = start + delimiter.length; cursor < source.length; cursor += 1) {
      if (!source.startsWith(delimiter, cursor) || isEscapedNodeText(source, cursor)) continue;
      return cursor + delimiter.length;
    }
  }
  const opener = source.slice(start, start + 2);
  const closer = opener === "\\(" ? "\\)" : opener === "\\[" ? "\\]" : null;
  if (!closer) return null;
  const end = source.indexOf(closer, start + 2);
  return end < 0 ? source.length : end + closer.length;
}

function skipBalancedNodeText(source, start, open, close) {
  let depth = 0;
  for (let cursor = start; cursor < source.length; cursor += 1) {
    if (source[cursor] === open) depth += 1;
    if (source[cursor] !== close) continue;
    depth -= 1;
    if (depth === 0) return cursor + 1;
  }
  return source.length;
}

function isEscapedNodeText(source, index) {
  let slashes = 0;
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === "\\"; cursor -= 1) slashes += 1;
  return slashes % 2 === 1;
}

export const tikzCommand = {
  name: "node",
  kind: "command",
  status: "core",
  implementedBy: [
    "src/frontend/parser.js:parseNodeStatement",
    "src/engine/evaluate.js:createNode",
    "src/engine/evaluate.js:addInlinePathNode",
    "src/engine/options.js:normalizeOptions",
    "src/tikz/text.js",
    "src/tikz/textMetrics.js"
  ],
  optionScope: "node",
  options: [
    {
      name: "circle / rectangle / ellipse / diamond",
      category: "shape",
      status: "partial",
      implementedBy: "src/engine/evaluate.js:nodeShape/estimateNodeSize + src/renderers/svg/renderSvg.js",
      notes: "Common node shapes and anchors are implemented. Reviewed against PGF's circle text-box diagonal construction on 2026-08-07: multi-line math circles use calibrated TeX row metrics rather than the wider SVG renderer box. Specialized PGF shapes remain incremental."
    },
    {
      name: "draw / fill / text",
      category: "paint",
      status: "implemented",
      implementedBy: "src/engine/options.js:normalizeOptions + src/renderers/svg/renderSvg.js",
      notes: "Node border, fill, and text color are normalized separately."
    },
    {
      name: "minimum size / minimum width / minimum height",
      category: "box model",
      status: "implemented",
      implementedBy: "src/engine/evaluate.js:estimateNodeLayoutSize",
      notes: "Minimum dimensions wrap text/math metrics before shape sizing."
    },
    {
      name: "inner sep / outer sep",
      category: "box model",
      status: "partial",
      implementedBy: "src/engine/evaluate.js:estimateNodeAnchorSize",
      notes: "Inner separation participates in node size and anchor-boundary clipping."
    },
    {
      name: "text width / align=center / \\\\ line breaks",
      category: "text layout",
      status: "partial",
      implementedBy: "src/tikz/commands/node.js:applyNodeLineBreakSemantics + src/engine/evaluate.js:estimateNodeLayoutSize + src/renderers/svg/renderSvg.js",
      notes: "TikZ line breaks are active only with align, text width, or a node halign header; align=none and ordinary nodes keep TeX's single hbox behavior. Structured math/tabular/minipage content retains its own row separators. Wrapped svg-text paragraphs keep inline math as TeX-sized word groups; full TeX paragraph shaping, hyphenation, and justification remain partial."
    },
    {
      name: "font=\\tt / \\huge / \\scriptsize / \\bf",
      category: "text",
      status: "partial",
      implementedBy: "src/tikz/text.js + src/tikz/textMetrics.js + src/renderers/svg/mathScopedCss.js",
      notes: "Common TeX font commands are normalized for SVG/KaTeX-backed labels."
    },
    {
      name: "right=of / below=of / node distance",
      category: "positioning",
      status: "implemented",
      implementedBy: "src/tikz/libraries/positioning.js + src/engine/evaluate.js:resolvePositioning",
      notes: "Positioning library computes edge-to-edge spacing with node dimensions."
    },
    {
      name: "anchor / node.north / node.120",
      category: "anchors",
      status: "partial",
      implementedBy: "src/engine/evaluate.js:nodeAnchorCoordinate + src/engine/evaluate.js:resolveCoordinate",
      notes: "Compass and numeric anchors are supported for common shapes."
    },
    {
      name: "scale / rotate / transform shape",
      category: "transform",
      status: "partial",
      implementedBy: "src/engine/evaluate.js:nodeCanvasEnv + src/renderers/svg/renderSvg.js",
      notes: "Node-level scale and rotation are supported for practical cases."
    }
  ],
  examples: [
    String.raw`\node[vtx] (a) at (0,0) {$a_1$};`,
    String.raw`\node[box, right=1cm of input] (hidden) {Hidden\\$h$};`
  ]
};
