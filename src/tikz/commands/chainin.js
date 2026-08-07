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
      status: "implemented",
      implementedBy: "src/engine/evaluate.js:chainInExistingNode",
      notes: "Applied in native order before direct command options; the style can supply join=by and its edge style."
    }
  ],
  examples: [
    String.raw`\chainin (existing) [join];`
  ]
};
