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
      implementedBy: "src/engine/evaluate.js:estimateNodeLayoutSize + src/renderers/svg/renderSvg.js",
      notes: "Wrapped svg-text paragraphs keep inline math as TeX-sized word groups before line breaking. An outer node minipage supplies this shared text width unless TikZ explicitly sets text width; full TeX paragraph shaping, hyphenation, and justification remain partial."
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
