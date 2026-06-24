const BUILTIN_LIBRARY_SUPPORT = {
  positioning: {
    status: "builtin",
    implementedBy: "src/interpreter.js:resolvePositioning",
    features: [
      "node distance=<vertical> and <horizontal>",
      "right/left/above/below=of <node>",
      "edge-to-edge placement using node bounds"
    ]
  },
  matrix: {
    status: "builtin",
    implementedBy: "src/parser.js:parseMatrix + src/interpreter.js:createMatrix",
    features: [
      "matrix of nodes",
      "row sep / column sep",
      "nodes={...}",
      "nodes in empty cells",
      "named cell anchors m-row-column"
    ]
  },
  arrows: {
    status: "builtin",
    implementedBy: "src/options.js:parseArrowOption + src/tikz-metrics.js:createArrowTip",
    features: ["->", "<-", "<->", "-stealth", "-latex", "-latex'"]
  },
  "arrows.meta": {
    status: "builtin",
    implementedBy: "src/options.js:parseArrowOption + src/tikz-metrics.js:createArrowTip",
    features: ["Stealth", "Latex", "Triangle", "arrow tip dimensions"]
  },
  calc: {
    status: "builtin",
    implementedBy: "src/interpreter.js:resolveCoordinate",
    features: ["$(A)+(x,y)$", "$(A)!t!(B)$", "polar coordinates"]
  },
  backgrounds: {
    status: "builtin",
    implementedBy: "src/preprocess.js:expandTransparentEnvironment",
    features: ["pgfonlayer transparency", "background-compatible statements"]
  },
  intersections: {
    status: "partial",
    implementedBy: "src/interpreter.js:materializeIntersections",
    features: ["name path", "name intersections", "by", "total", "line/flattened curve intersections"]
  },
  shapes: {
    status: "builtin",
    implementedBy: "src/interpreter.js:nodeShape + nodeShapeData",
    features: ["circle", "rectangle", "ellipse", "diamond", "regular polygon", "star"]
  },
  shadows: {
    status: "partial",
    implementedBy: "src/interpreter.js:nodeGeneralShadows + src/renderer-svg.js:renderNodeBoxShadow",
    features: ["general shadow", "shadow xshift/yshift", "shadow scale", "node shadow rendering"]
  },
  trees: {
    status: "partial",
    implementedBy: "src/interpreter.js:createChildTreeNodes",
    features: ["node child trees", "grow direction", "level distance", "sibling distance"]
  },
  mindmap: {
    status: "partial",
    implementedBy: "src/interpreter.js:applyConceptNodeOptions + createNodeTreeChildren",
    features: ["concept/root/level styles", "concept color", "grow cyclic", "clockwise/counterclockwise from", "sibling angle"]
  },
  spy: {
    status: "partial",
    implementedBy: "src/parser.js:parseSpy + src/interpreter.js:createSpy",
    features: ["spy using outlines", "\\spy on ... in node ... at ...", "connect spies", "clipped magnified simple paths"]
  },
  snakes: {
    status: "builtin",
    implementedBy: "src/interpreter.js:createPathItem",
    features: ["snake-like decorations used by current gallery cases"]
  },
  decorations: {
    status: "builtin",
    implementedBy: "src/interpreter.js:createDecorationItems",
    features: ["decorations.markings subset", "path markings", "arrow marks"]
  },
  "decorations.markings": {
    status: "builtin",
    implementedBy: "src/interpreter.js:createDecorationItems",
    features: ["mark=at position ... with {...}", "postaction decorate"]
  },
  "decorations.pathmorphing": {
    status: "builtin",
    implementedBy: "src/interpreter.js:createPathItem",
    features: ["snake/zigzag approximation"]
  },
  "decorations.pathreplacing": {
    status: "partial",
    implementedBy: "src/interpreter.js:applyBraceDecoration",
    features: ["brace path replacement", "mirror", "raise", "amplitude", "aspect"]
  },
  plotmarks: {
    status: "partial",
    implementedBy: "src/interpreter.js:buildPlotMark",
    features: ["mark=x", "mark=+", "mark=*", "mark=o", "square/triangle subset", "mark size"]
  },
  patterns: {
    status: "builtin",
    implementedBy: "src/options.js:normalizeOptions",
    features: ["pattern fill metadata for supported renderers"]
  },
  fit: {
    status: "builtin",
    implementedBy: "src/interpreter.js:estimateNodeLayoutSize",
    features: ["minimal fit-node bounds for gallery cases"]
  },
  quotes: {
    status: "builtin",
    implementedBy: "src/parser.js:parsePathCommand",
    features: ["edge labels in supported path syntax"]
  },
  graphs: {
    status: "builtin",
    implementedBy: "src/preprocess.js:expandTkzGraphMacros",
    features: ["current gallery graph compatibility layer"]
  },
  braids: {
    status: "builtin",
    implementedBy: "src/preprocess.js:expandBraidMacros",
    features: ["two-strand s_1 braid expansion for current gallery DNA cases"]
  },
  bpmn: {
    status: "extension",
    implementedBy: "src/extensions/tikz-bpmn.js",
    features: ["BPMN task/gateway/event style expansion"]
  },
  bayesnet: {
    status: "extension",
    implementedBy: "src/extensions/tikz-bayesnet.js",
    features: ["latent/obs/det/factor styles", "\\edge and \\factoredge", "\\factor, \\plate, \\gate, \\vgate, \\hgate"]
  },
  cd: {
    status: "extension",
    implementedBy: "src/extensions/tikz-cd.js",
    features: ["tikzcd environment and arrow conversion"]
  },
  feynman: {
    status: "extension",
    implementedBy: "src/extensions/tikz-feynman.js",
    features: ["feynmandiagram subset"]
  },
  feynhand: {
    status: "extension",
    implementedBy: "src/extensions/tikz-feynhand.js",
    features: ["feynhand propagator subset"]
  }
};

export const BUILTIN_TIKZ_LIBRARIES = Object.freeze(
  Object.fromEntries(
    Object.entries(BUILTIN_LIBRARY_SUPPORT).map(([name, support]) => [
      name,
      Object.freeze({ name, ...support, features: Object.freeze([...support.features]) })
    ])
  )
);

export function collectTikzLibraries(source) {
  const names = [];
  const pattern = /\\usetikzlibrary(?:\[[^\]]*\])?\{([^{}]*)\}/g;
  let match;
  while ((match = pattern.exec(String(source)))) {
    for (const name of parseTikzLibraryList(match[1])) {
      if (!names.includes(name)) names.push(name);
    }
  }
  return resolveTikzLibraries(names);
}

export function stripTikzLibraryDeclarations(source) {
  return String(source).replace(/\\usetikzlibrary(?:\[[^\]]*\])?\{[^{}]*\}\s*;?/g, "");
}

export function resolveTikzLibraries(names = []) {
  return names.map((rawName) => {
    const name = String(rawName).trim();
    const support = BUILTIN_TIKZ_LIBRARIES[name];
    if (support) {
      return {
        name: support.name,
        status: support.status,
        implementedBy: support.implementedBy,
        features: [...support.features]
      };
    }
    return {
      name,
      status: "unsupported",
      implementedBy: null,
      features: []
    };
  });
}

export function parseTikzLibraryList(input = "") {
  return String(input)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}
