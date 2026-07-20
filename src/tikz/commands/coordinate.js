export const tikzCommand = {
  name: "coordinate",
  kind: "command",
  status: "core",
  implementedBy: [
    "src/frontend/parser.js:parseCoordinateStatement",
    "src/engine/evaluate.js:interpretStatement",
    "src/engine/evaluate.js:resolveCoordinate",
    "src/tikz/libraries/calc.js"
  ],
  optionScope: "coordinate",
  options: [
    {
      name: "(name) at (x,y)",
      category: "definition",
      status: "implemented",
      implementedBy: "src/engine/evaluate.js:interpretStatement",
      notes: "Named coordinates are stored in env.coordinates."
    },
    {
      name: "$(A)!t!(B)$",
      category: "calc",
      status: "implemented",
      implementedBy: "src/tikz/libraries/calc.js:resolveCalcExpression",
      notes: "Coordinate interpolation comes from the calc library helper."
    },
    {
      name: "$(A)!modifier!(B)$",
      category: "calc",
      status: "implemented",
      implementedBy: "src/tikz/libraries/calc.js:resolveCalcModifierChain",
      notes: "Supports numeric factors, dimensions, rotated targets, projection coordinates, and repeated modifiers."
    },
    {
      name: "$(A)+(dx,dy)$",
      category: "calc",
      status: "implemented",
      implementedBy: "src/tikz/libraries/calc.js:resolveCalcExpression",
      notes: "Vector offsets are resolved in the active picture basis."
    },
    {
      name: "(angle:radius)",
      category: "polar",
      status: "implemented",
      implementedBy: "src/tikz/libraries/calc.js:resolveLocalVectorCoordinate",
      notes: "Polar coordinates use PGF-style degrees."
    },
    {
      name: "(node.anchor)",
      category: "anchors",
      status: "partial",
      implementedBy: "src/engine/evaluate.js:resolveCoordinate + src/engine/evaluate.js:nodeAnchorCoordinate",
      notes: "Node anchors resolve through node metadata and shape boundary functions."
    },
    {
      name: "perpendicular cs / |- / -|",
      category: "intersections",
      status: "implemented",
      implementedBy: "src/engine/evaluate.js:resolveExplicitCoordinateSystem + splitCoordinateProjection",
      notes: "Horizontal and vertical intersections are combined in final canvas coordinates."
    },
    {
      name: "+ / ++",
      category: "relative",
      status: "implemented",
      implementedBy: "src/frontend/parser.js:parsePathSegments + src/engine/evaluate.js:resolveRelativeCoordinate",
      notes: "Relative vectors use the picture's full linear transform; a single plus keeps the previous base."
    },
    {
      name: "[turn]",
      category: "relative",
      status: "implemented",
      implementedBy: "src/engine/evaluate.js:resolveTurnCoordinate",
      notes: "Coordinates are rotated to the tangent entering the current path point."
    },
    {
      name: "xshift / yshift",
      category: "transform",
      status: "implemented",
      implementedBy: "src/engine/evaluate.js:parseCoordinateOptionPrefix + applyCoordinateOptionTransform",
      notes: "Coordinate-local shifts and affine transforms are conjugated through the parent picture transform."
    }
  ],
  examples: [
    String.raw`\coordinate (m) at ($(a)!0.5!(b)$);`,
    String.raw`\draw (node.east) -- (other.120);`
  ]
};
