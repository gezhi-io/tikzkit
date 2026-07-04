export const tikzCommand = {
  name: "foreach",
  kind: "command",
  status: "core",
  implementedBy: [
    "src/parser.js:parseForeachStatement",
    "src/preprocess.js:expandForeachBlocks",
    "src/interpreter.js:interpretForeach"
  ],
  optionScope: "macro",
  options: [
    {
      name: "\\foreach \\x in {...} { ... }",
      category: "loop",
      status: "implemented",
      implementedBy: "src/parser.js + src/interpreter.js",
      notes: "Basic list loops and nested statement interpretation are supported."
    },
    {
      name: "count=\\i from 0",
      category: "loop option",
      status: "partial",
      implementedBy: "src/parser.js + src/interpreter.js",
      notes: "Count variables are supported for common gallery and corpus cases."
    },
    {
      name: "evaluate=\\x as \\y using ...",
      category: "loop option",
      status: "partial",
      implementedBy: "src/interpreter.js:evaluateForeachOptions",
      notes: "Practical PGF math evaluation slices are implemented, not the full TeX macro system."
    }
  ],
  examples: [
    String.raw`\foreach \x in {0,1,2} { \draw (\x,0) -- (\x,1); }`
  ]
};
