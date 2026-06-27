export const tikzCommand = {
  name: "node",
  kind: "command",
  status: "core",
  implementedBy: [
    "src/parser.js:parseNodeStatement",
    "src/interpreter.js:createNode",
    "src/interpreter.js:addInlinePathNode",
    "src/options.js:normalizeOptions",
    "src/tex-text.js",
    "src/math-metrics.js"
  ],
  optionScope: "node",
  options: [
    {
      name: "circle / rectangle / ellipse / diamond",
      category: "shape",
      status: "partial",
      implementedBy: "src/interpreter.js:nodeShape + src/renderer-svg.js",
      notes: "Common node shapes and anchors are implemented; specialized PGF shapes are incremental."
    },
    {
      name: "draw / fill / text",
      category: "paint",
      status: "implemented",
      implementedBy: "src/options.js:normalizeOptions + src/renderer-svg.js",
      notes: "Node border, fill, and text color are normalized separately."
    },
    {
      name: "minimum size / minimum width / minimum height",
      category: "box model",
      status: "implemented",
      implementedBy: "src/interpreter.js:estimateNodeLayoutSize",
      notes: "Minimum dimensions wrap text/math metrics before shape sizing."
    },
    {
      name: "inner sep / outer sep",
      category: "box model",
      status: "partial",
      implementedBy: "src/interpreter.js:estimateNodeAnchorSize",
      notes: "Inner separation participates in node size and anchor-boundary clipping."
    },
    {
      name: "text width / align=center / \\\\ line breaks",
      category: "text layout",
      status: "partial",
      implementedBy: "src/interpreter.js:estimateNodeLayoutSize + src/renderer-svg.js",
      notes: "Text wrapping and line layout are approximated; TeX paragraph shaping is not complete."
    },
    {
      name: "font=\\tt / \\huge / \\scriptsize / \\bf",
      category: "text",
      status: "partial",
      implementedBy: "src/tex-text.js + src/math-metrics.js + src/math-scoped-css.js",
      notes: "Common TeX font commands are normalized for SVG/KaTeX-backed labels."
    },
    {
      name: "right=of / below=of / node distance",
      category: "positioning",
      status: "implemented",
      implementedBy: "src/libraries/positioning.js + src/interpreter.js:resolvePositioning",
      notes: "Positioning library computes edge-to-edge spacing with node dimensions."
    },
    {
      name: "anchor / node.north / node.120",
      category: "anchors",
      status: "partial",
      implementedBy: "src/interpreter.js:nodeAnchorCoordinate + src/interpreter.js:resolveCoordinate",
      notes: "Compass and numeric anchors are supported for common shapes."
    },
    {
      name: "scale / rotate / transform shape",
      category: "transform",
      status: "partial",
      implementedBy: "src/interpreter.js:nodeCanvasEnv + src/renderer-svg.js",
      notes: "Node-level scale and rotation are supported for practical cases."
    }
  ],
  examples: [
    String.raw`\node[vtx] (a) at (0,0) {$a_1$};`,
    String.raw`\node[box, right=1cm of input] (hidden) {Hidden\\$h$};`
  ]
};
