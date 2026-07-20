export const tikzCommand = {
  name: "fill",
  kind: "command",
  status: "core",
  implementedBy: [
    "src/frontend/parser.js:parsePathStatement",
    "src/engine/options.js:defaultStyleForCommand",
    "src/engine/evaluate.js:interpretPathStatement"
  ],
  aliases: ["path[fill]"],
  optionScope: "path",
  options: [
    {
      name: "fill",
      category: "operation",
      status: "implemented",
      implementedBy: "src/engine/options.js:defaultStyleForCommand",
      notes: "\\fill is interpreted as a path with fill enabled and no stroke unless draw is requested."
    },
    {
      name: "fill opacity / opacity",
      category: "paint",
      status: "partial",
      implementedBy: "src/engine/options.js:normalizeOptions",
      notes: "Common opacity options are normalized to SVG style fields."
    },
    {
      name: "even odd rule / nonzero rule",
      category: "fill rule",
      status: "partial",
      implementedBy: "src/engine/options.js:normalizeOptions + src/renderers/svg/renderSvg.js",
      notes: "Common fill rules are carried through to SVG fill-rule where supported."
    }
  ],
  examples: [
    String.raw`\fill[blue!20] (0,0) rectangle (1,1);`
  ]
};
