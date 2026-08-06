export const tikzCommand = {
  name: "tikzpicture",
  kind: "environment",
  status: "core",
  implementedBy: [
    "src/frontend/parser.js:parseTikz",
    "src/frontend/parser.js:parseTikzPicture",
    "src/engine/evaluate.js:interpretTikz",
    "src/engine/options.js:parseOptions",
    "src/engine/options.js:styleDefinitionsFromOptions"
  ],
  optionScope: "picture",
  options: [
    {
      name: ">=Stealth",
      category: "arrows",
      status: "partial",
      implementedBy: "src/engine/options.js:arrowTipsFromOptions + src/renderers/svg/renderSvg.js",
      notes: "Picture-level default arrow tip. Full arrows.meta key space is still partial."
    },
    {
      name: "font=\\tt",
      category: "text",
      status: "partial",
      implementedBy: "src/engine/options.js:normalizeOptions + src/engine/evaluate.js:createNode",
      notes: "Inherited by nodes and path labels; exact TeX font metrics are approximated."
    },
    {
      name: "node distance",
      category: "positioning",
      status: "implemented",
      implementedBy: "src/tikz/libraries/positioning.js",
      notes: "Supports one- and two-axis distances such as 1.1cm and 1.6cm."
    },
    {
      name: "x / y / z / scale",
      category: "coordinate system",
      status: "partial",
      implementedBy: "src/engine/evaluate.js:interpretTikz",
      notes: "Picture basis and transform options are mapped into canvas coordinates."
    },
    {
      name: "transform canvas={scale / rotate / shift}",
      category: "canvas transform",
      status: "partial",
      implementedBy: "src/engine/evaluate.js:transformCanvasTransform",
      notes: "Backend canvas transforms remain separate from the TikZ coordinate matrix and disable automatic picture-size tracking as in PGF."
    },
    {
      name: "name/.style={...}",
      category: "style definition",
      status: "implemented",
      implementedBy: "src/engine/options.js:styleDefinitionsFromOptions",
      notes: "Picture-local style definitions are merged into env.styles before statements run."
    },
    {
      name: "every node / every path",
      category: "style definition",
      status: "partial",
      implementedBy: "src/engine/options.js:expandStyleOptions",
      notes: "Common inherited styles are supported; uncommon PGF key handlers may still be no-ops."
    },
    {
      name: "background rectangle / show background rectangle",
      category: "backgrounds",
      status: "partial",
      implementedBy: "src/engine/evaluate.js:interpretTikz + src/tikz/libraries/backgrounds.js",
      notes: "Background rectangle support exists for gallery use; full layers library is partial."
    }
  ],
  examples: [
    String.raw`\begin{tikzpicture}[>=Stealth,font=\tt,vtx/.style={circle, draw, very thick, minimum size=7mm, inner sep=1pt},lbl/.style={fill=white, inner sep=1.5pt},tour/.style={thick, red, dashed}]`
  ]
};
