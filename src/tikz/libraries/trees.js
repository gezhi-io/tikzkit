export function parseGrowViaThreePoints(value) {
  const text = unwrapOuterGroup(String(value ?? "").trim());
  let cursor = 0;

  cursor = consumeThreePointPhrase(text, cursor, /^\s*one\s+child\s+at\s*/);
  if (cursor < 0) return null;
  const one = readThreePointCoordinate(text, cursor);
  if (!one) return null;

  cursor = consumeThreePointPhrase(text, one.end, /^\s*and\s+two\s+children\s+at\s*/);
  if (cursor < 0) return null;
  const left = readThreePointCoordinate(text, cursor);
  if (!left) return null;

  cursor = consumeThreePointPhrase(text, left.end, /^\s*and\s*/);
  if (cursor < 0) return null;
  const right = readThreePointCoordinate(text, cursor);
  if (!right || text.slice(right.end).trim()) return null;

  return {
    one: one.value,
    left: left.value,
    right: right.value
  };
}

export function threePointChildOffset(one, left, right, index, count) {
  const childCount = Math.max(1, Math.trunc(Number(count)) || 1);
  const childIndex = Math.max(0, Math.trunc(Number(index)) || 0);
  const firstPairScale = childCount - 1;
  return {
    x: one.x + firstPairScale * (left.x - one.x) + childIndex * (right.x - left.x),
    y: one.y + firstPairScale * (left.y - one.y) + childIndex * (right.y - left.y)
  };
}

function consumeThreePointPhrase(text, cursor, pattern) {
  const match = text.slice(cursor).match(pattern);
  return match ? cursor + match[0].length : -1;
}

function readThreePointCoordinate(text, cursor) {
  while (/\s/.test(text[cursor] || "")) cursor += 1;
  if (text[cursor] !== "(") return null;
  let depth = 0;
  for (let index = cursor; index < text.length; index += 1) {
    if (text[index] === "(") depth += 1;
    if (text[index] === ")") depth -= 1;
    if (depth === 0) {
      return { value: text.slice(cursor, index + 1), end: index + 1 };
    }
  }
  return null;
}

function unwrapOuterGroup(value) {
  if (!value.startsWith("{") || !value.endsWith("}")) return value;
  let depth = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "{") depth += 1;
    if (value[index] === "}") depth -= 1;
    if (depth === 0 && index < value.length - 1) return value;
  }
  return depth === 0 ? value.slice(1, -1).trim() : value;
}

export const tikzLibrary = {
  "name": "trees",
  "status": "partial",
  "implementedBy": "src/frontend/parser.js:parseNodeTreeChild/parseNodeTreeForeach + src/engine/evaluate.js:createNodeTreeChildren/expandTreeChildForeach/mergeTreeGrowthOptions/treeGrowthSpec/treeChildOffset/treeGrowthParentPoint/treeEdgeEndpoints/treeEveryChildNodeOptions + src/tikz/libraries/trees.js:parseGrowViaThreePoints/threePointChildOffset + src/tikz/commands/foreach.js:foreachIterationVariables",
  "localSourceReviewed": "yes",
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarytrees.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-trees.tex",
  "notes": "Reviewed locally on 2026-08-07 against the trees source and manual. Child placement starts from `growth parent anchor`; `every child node` is merged before each generated child node; parent/child anchors select the endpoints of the generated edge, with `border` retaining automatic node-border clipping. The four documented fork routes use those same anchors. Reviewed again on 2026-09-05 against tikz.code.tex lines 4550-4677 and the manual's Missing Children section: bare and bodied `child[missing]` entries count toward sibling totals and indices but emit no coordinate, node, parent edge, body, or descendants; a child-local `missing=false` overrides inherited `every child` missing state. Reviewed on 2026-09-05 against tikz.code.tex lines 4544-4677, pgffor.code.tex, and the manual's child foreach examples: `child foreach` is expanded before sibling totals and positions are computed, slash-separated values bind slash-separated variables in local iteration scope, and nested child loops inherit outer bindings. Reviewed on 2026-09-05 against tikz.code.tex lines 1380-1395 and 4639-4677 plus the manual's Default Growth Function section: `grow'` preserves the main growth angle and swaps the two orthogonal sibling angles; named and numeric directions use all children in the native total/current index; a child-local `grow` or `grow'` suppresses only its current-level sibling displacement and remains active for descendants. Reviewed on 2026-09-05 against tikzlibrarytrees.code.tex lines 18-54 and pgfmanual-en-library-trees.tex: `grow via three points` stores one-child and two-child reference coordinates, then places one child exactly at the first point, two at the left/right points, and larger sibling sets by the installed source's linear extrapolation formula. The parsed coordinates retain TikZ coordinate units, basis projection, and active canvas transforms. Graph drawing, arbitrary edge-from-parent paths, arbitrary custom growth callbacks, and collision-avoiding tree layouts remain partial.",
  "features": [
    "node child trees",
    "grow direction",
    "grow prime mirrored sibling order",
    "grow via three points linear extrapolation",
    "numeric grow angles with orthogonal sibling spacing",
    "cardinal and diagonal grow direction aliases",
    "child-local grow special-level placement and descendant inheritance",
    "grow cyclic",
    "level distance",
    "sibling distance",
    "sibling angle",
    "growth parent anchor",
    "every child node",
    "parent anchor and child anchor tree edges",
    "edge from parent fork down/up/left/right",
    "clockwise/counterclockwise from",
    "missing child sibling-slot occupancy",
    "bare and bodied missing children",
    "missing=false override of every child",
    "child foreach expansion before sibling layout",
    "slash-separated child foreach variables and values",
    "nested child foreach with outer-variable inheritance",
    "picture-level stroke style inheritance for generated child edges",
    "focused TCS logo macro expansion"
  ],
  "implements": [
    "node child trees",
    "grow direction",
    "grow prime mirrored sibling order",
    "grow via three points linear extrapolation",
    "numeric grow angles with orthogonal sibling spacing",
    "cardinal and diagonal grow direction aliases",
    "child-local grow special-level placement and descendant inheritance",
    "grow cyclic",
    "level distance",
    "sibling distance",
    "sibling angle",
    "growth parent anchor",
    "every child node",
    "parent anchor and child anchor tree edges",
    "edge from parent fork down/up/left/right",
    "clockwise/counterclockwise from",
    "missing child sibling-slot occupancy",
    "bare and bodied missing children",
    "missing=false override of every child",
    "child foreach expansion before sibling layout",
    "slash-separated child foreach variables and values",
    "nested child foreach with outer-variable inheritance",
    "picture-level stroke style inheritance for generated child edges",
    "focused TCS logo macro expansion"
  ]
};
