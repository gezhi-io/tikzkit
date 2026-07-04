export const tikzCommand = {
  name: "fill",
  kind: "command",
  status: "core",
  implementedBy: [
    "src/parser.js:parsePathStatement",
    "src/options.js:defaultStyleForCommand",
    "src/interpreter.js:interpretPathStatement"
  ],
  aliases: ["path[fill]"],
  optionScope: "path",
  options: [
    {
      name: "fill",
      category: "operation",
      status: "implemented",
      implementedBy: "src/options.js:defaultStyleForCommand",
      notes: "\\fill is interpreted as a path with fill enabled and no stroke unless draw is requested."
    },
    {
      name: "fill opacity / opacity",
      category: "paint",
      status: "partial",
      implementedBy: "src/options.js:normalizeOptions",
      notes: "Common opacity options are normalized to SVG style fields."
    },
    {
      name: "even odd rule / nonzero rule",
      category: "fill rule",
      status: "partial",
      implementedBy: "src/options.js:normalizeOptions + src/renderer-svg.js",
      notes: "Common fill rules are carried through to SVG fill-rule where supported."
    }
  ],
  examples: [
    String.raw`\fill[blue!20] (0,0) rectangle (1,1);`
  ]
};
