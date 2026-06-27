export const tikzCommand = {
  name: "draw",
  kind: "command",
  status: "core",
  implementedBy: [
    "src/parser.js:parsePathStatement",
    "src/interpreter.js:interpretPathStatement",
    "src/options.js:normalizeOptions",
    "src/renderer-svg.js:renderSvg"
  ],
  aliases: ["path[draw]"],
  optionScope: "path",
  options: [
    {
      name: "draw",
      category: "operation",
      status: "implemented",
      implementedBy: "src/options.js:defaultStyleForCommand",
      notes: "\\draw is interpreted as a path with stroke enabled."
    },
    {
      name: "color names / xcolor mixes",
      category: "paint",
      status: "partial",
      implementedBy: "src/options.js:normalizeColor",
      notes: "Named colors, \\definecolor, \\colorlet, and common xcolor mixes are supported."
    },
    {
      name: "thin / thick / very thick / line width",
      category: "stroke",
      status: "implemented",
      implementedBy: "src/options.js:normalizeOptions + src/tikz-metrics.js",
      notes: "TikZ line-width keywords normalize to SVG stroke widths."
    },
    {
      name: "dashed / densely dashed / dotted / dash pattern",
      category: "stroke",
      status: "partial",
      implementedBy: "src/options.js:parseDashPattern + src/renderer-svg.js",
      notes: "Common dash and dot styles are mapped to SVG stroke-dasharray."
    },
    {
      name: "line cap / line join / rounded corners",
      category: "stroke",
      status: "partial",
      implementedBy: "src/options.js:normalizeOptions + src/interpreter.js:buildPath",
      notes: "SVG cap/join are mapped; geometric rounded-corner rewriting is partial."
    },
    {
      name: "-> / -latex / -Stealth / stealth-stealth",
      category: "arrows",
      status: "partial",
      implementedBy: "src/options.js:arrowTipsFromOptions + src/renderer-svg.js",
      notes: "Core arrow tips and endpoint shortening are implemented; full arrows.meta remains ongoing."
    },
    {
      name: "double",
      category: "stroke",
      status: "partial",
      implementedBy: "src/interpreter.js:interpretPathStatement + src/renderer-svg.js",
      notes: "Double-line drawing is represented in path style for common cases."
    },
    {
      name: "node[midway, above] {text}",
      category: "inline node",
      status: "partial",
      implementedBy: "src/parser.js:parsePathInlineNode + src/interpreter.js:addInlinePathNode",
      notes: "Path-attached labels reuse node layout and anchor code."
    },
    {
      name: "decorate / decoration={...}",
      category: "decorations",
      status: "partial",
      implementedBy: "src/libraries/decorations.* + src/interpreter.js:buildPath",
      notes: "Markings, snake/path morphing, brace, and text decorations are implemented by focused slices."
    }
  ],
  examples: [
    String.raw`\draw[tour, -Stealth] (a) -- node[above] {$w$} (b);`,
    String.raw`\draw[-stealth, decoration={snake, segment length=2mm, amplitude=.3mm}, decorate] (a) -- (b);`
  ]
};
