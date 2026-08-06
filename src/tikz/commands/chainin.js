export const tikzCommand = {
  name: "chainin",
  kind: "command",
  status: "partial",
  implementedBy: [
    "src/frontend/parser.js:parseChaininStatement",
    "src/engine/evaluate.js:chainInExistingNode"
  ],
  optionScope: "chain",
  options: [
    {
      name: "\\chainin (existing node) [join]",
      category: "chain membership",
      status: "implemented",
      implementedBy: "src/engine/evaluate.js:chainInExistingNode",
      notes: "Adds an existing named node to the active chain without drawing it again; join uses the ordinary chain join path."
    },
    {
      name: "every chain in",
      category: "style",
      status: "partial",
      implementedBy: "src/tikz/libraries/chains.js",
      notes: "Direct command options are handled; inherited every-chain-in styles are not yet expanded."
    }
  ],
  examples: [
    String.raw`\chainin (existing) [join];`
  ]
};
