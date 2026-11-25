const placements = {
  left:  { angle: 180, x: -1, y: 0, anchor: "east" },
  right: { angle: 0,   x: 1,  y: 0, anchor: "west" },
  above: { angle: 90,  x: 0,  y: 1, anchor: "south" },
  below: { angle: 270, x: 0,  y: -1, anchor: "north" }
};

// tikzlibraryautomata.code.tex installs the arrow as an after-node edge.
// The shorthand writes the same register as an explicit "where" option.
function directionalStyles(kind) {
  const byArrow = kind + " by arrow";
  return {
    [byArrow]: { ["tikzkit automata " + kind]: true },
    ...Object.fromEntries(Object.keys(placements).map(where => [
      kind + " " + where, { [byArrow]: true, [kind + " where"]: where }
    ]))
  };
}

export const automataStyles = {
  "every state": {},
  "state without output": { circle: true, draw: true, "minimum size": "2.5em", "every state": true },
  "state with output": { "circle split": true, draw: true, "minimum size": "2.5em", "every state": true },
  state: { "state without output": true },
  initial: { "initial by arrow": true },
  "initial by diamond": { shape: "diamond" },
  accepting: { "accepting by double": true },
  "accepting by double": { double: true, "outer sep": ".5\\pgflinewidth+.3pt" },
  ...directionalStyles("initial"),
  ...directionalStyles("accepting")
};

export function automataPlacement(kind, where) {
  const key = String(where ?? "").trim();
  return Object.hasOwn(placements, key) ? placements[key] : placements[kind === "initial" ? "left" : "right"];
}

const afterNodeParameters = new Set(["initial where", "initial text", "initial distance",
  "accepting where", "accepting text", "accepting distance"]);
const firstWrite = "tikzkit first after-node ";

export function automataParameterName(key) {
  if (key.startsWith("/tikz/")) key = key.slice(6);
  return afterNodeParameters.has(key) ? key : null;
}

export function preserveAutomataWrite(options, key, value) {
  if (key.startsWith(firstWrite)) {
    const parameter = key.slice(firstWrite.length);
    if (!Object.hasOwn(options, key)) options[key] = options[parameter] ?? value;
    return true;
  }
  if (afterNodeParameters.has(key) && Object.hasOwn(options, key) && !Object.hasOwn(options, firstWrite + key)) {
    options[firstWrite + key] = options[key];
  }
  return false;
}

export function replayAutomataNodeParameters(options, ...localLayers) {
  // tikzaddafternodepathoption stores the value immediately AND prepends
  // its assignment to the after-node path. The first node-local write is
  // therefore replayed last. A surrounding scope supplies only a default.
  for (const key of afterNodeParameters) {
    const layer = localLayers.find(layer => layer && Object.hasOwn(layer, key));
    if (layer) options[key] = layer[firstWrite + key] ?? layer[key];
  }
}

export const tikzLibrary = {
  "name": "automata",
  "status": "partial",
  "implementedBy": "src/tikz/libraries/automata.js:automataStyles + automataPlacement + replayAutomataNodeParameters; src/engine/evaluate.js:addAutomataArrow + addInlinePathNode + circleSplitLayout/circleSplitLocalAnchor; src/tikz/roundNodeGeometry.js; src/renderers/svg/nodeOutline.js",
  "localSourceReviewed": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryautomata.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-automata.tex",
  "features": [
    "state / state without output",
    "state with output / circle split",
    "accepting by double: coincident pens, white or colored gap, and separate line-width-dependent outer anchors on ordinary states",
    "accepting arrows at the default, above, below, left, and right positions",
    "accepting distance",
    "default and custom accepting text",
    "initial by diamond (requires shapes.geometric, matching PGF)",
    "initial arrows at the default, above, below, left, and right positions",
    "initial distance",
    "cardinal where keys, anonymous states, empty label boxes, local font and separation",
    "default and custom initial text",
    "every initial by arrow and every accepting by arrow text/stroke/line/dash/opacity/arrow styles"
  ],
  "implements": [
    "state",
    "state with output",
    "accepting",
    "accepting by double",
    "accepting by arrow",
    "accepting above",
    "accepting below",
    "accepting left",
    "accepting right",
    "accepting distance",
    "accepting text",
    "accepting where",
    "initial by diamond",
    "initial",
    "initial above",
    "initial below",
    "initial left",
    "initial right",
    "initial distance",
    "initial text",
    "initial where"
  ],
  "notes": "States support the circle-split lower text anchor and ordinary double borders. Initial and accepting arrows use anchored rectangle nodes, including empty labels and anonymous states; path-scoped fonts and separation do not leak into state text. Explicit where/text/distance follow the local MacTeX after-node replay order. Sampled cardinal labels and picture bounds have native TeX probes. Complex custom after-node programs and all arrowhead variants are not certified. Initial by diamond requires shapes.geometric, as in PGF."
};
