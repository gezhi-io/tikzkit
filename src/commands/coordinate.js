export const tikzCommand = {
  name: "coordinate",
  kind: "command",
  status: "core",
  implementedBy: [
    "src/parser.js:parseCoordinateStatement",
    "src/interpreter.js:interpretStatement",
    "src/interpreter.js:resolveCoordinate",
    "src/libraries/calc.js"
  ],
  optionScope: "coordinate",
  options: [
    {
      name: "(name) at (x,y)",
      category: "definition",
      status: "implemented",
      implementedBy: "src/interpreter.js:interpretStatement",
      notes: "Named coordinates are stored in env.coordinates."
    },
    {
      name: "$(A)!t!(B)$",
      category: "calc",
      status: "implemented",
      implementedBy: "src/libraries/calc.js:resolveCalcExpression",
      notes: "Coordinate interpolation comes from the calc library helper."
    },
    {
      name: "$(A)+(dx,dy)$",
      category: "calc",
      status: "implemented",
      implementedBy: "src/libraries/calc.js:resolveCalcExpression",
      notes: "Vector offsets are resolved in the active picture basis."
    },
    {
      name: "(angle:radius)",
      category: "polar",
      status: "implemented",
      implementedBy: "src/libraries/calc.js:resolveLocalVectorCoordinate",
      notes: "Polar coordinates use PGF-style degrees."
    },
    {
      name: "(node.anchor)",
      category: "anchors",
      status: "partial",
      implementedBy: "src/interpreter.js:resolveCoordinate + src/interpreter.js:nodeAnchorCoordinate",
      notes: "Node anchors resolve through node metadata and shape boundary functions."
    },
    {
      name: "xshift / yshift",
      category: "transform",
      status: "partial",
      implementedBy: "src/interpreter.js:resolveCoordinate",
      notes: "Shifted coordinate syntax is supported for common references."
    }
  ],
  examples: [
    String.raw`\coordinate (m) at ($(a)!0.5!(b)$);`,
    String.raw`\draw (node.east) -- (other.120);`
  ]
};
