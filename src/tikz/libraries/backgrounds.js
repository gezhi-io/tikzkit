const frames = {
  rectangle: { operator: "rectangle", macro: "framed" },
  grid: { operator: "grid", paint: { "help lines": true, draw: true } },
  top: { atY: "maxY" },
  bottom: { atY: "minY" },
  left: { atX: "minX" },
  right: { atX: "maxX" }
};

const hookKinds = new Map();
export const backgroundStyles = {
  framed: { "show background rectangle": true },
  gridded: { "show background grid": true },
  "tight background": { "inner frame sep": "0ex" },
  "loose background": { "inner frame sep": "2ex" }
};
for (const [kind, frame] of Object.entries(frames)) {
  const hook = `\\tikz@background@${frame.macro ?? kind}`;
  hookKinds.set(hook, kind);
  backgroundStyles[`show background ${kind}`] = { "execute at end picture": hook };
  backgroundStyles[`background ${kind}`] = frame.paint ?? { draw: true };
}

export function backgroundFrameKind(code) {
  return typeof code === "string" ? hookKinds.get(code.trim()) ?? null : null;
}

function expandBox(box, dx, dy) {
  return { minX: box.minX - dx, minY: box.minY - dy, maxX: box.maxX + dx, maxY: box.maxY + dy };
}

// TikZ saves both boxes at the first native end hook. Only the final values
// of the four length registers are evaluated, in the caller's physical units.
export function backgroundFrameBounds(content, opts, parseLength) {
  const sep = { inner: { x: "1ex", y: "1ex" }, outer: { x: "0ex", y: "0ex" } };
  for (const [key, value] of Object.entries(opts ?? {})) {
    const match = /^(?:\/tikz\/)?(inner|outer) frame ([xy]?)sep$/.exec(key);
    if (!match) continue;
    const axes = sep[match[1]];
    if (match[2]) axes[match[2]] = value;
    else axes.x = axes.y = value;
  }
  const inner = expandBox(content, parseLength(sep.inner.x), parseLength(sep.inner.y));
  return { inner, outer: expandBox(inner, parseLength(sep.outer.x), parseLength(sep.outer.y)) };
}

export function backgroundFramePath(kind, { inner, outer }) {
  const { operator = "--", atX, atY } = frames[kind];
  let { minX, minY, maxX, maxY } = inner;
  if (atY) {
    minY = maxY = inner[atY];
    ({ minX, maxX } = outer);
  } else if (atX) {
    minX = maxX = inner[atX];
    ({ minY, maxY } = outer);
  }
  return { style: `background ${kind}`, operator, from: { x: minX, y: minY }, to: { x: maxX, y: maxY } };
}

export const tikzLibrary = {
  name: "backgrounds",
  status: "partial",
  implementedBy: "src/tikz/libraries/backgrounds.js:backgroundStyles/backgroundFrameBounds/backgroundFramePath; src/tikz/libraries/backgroundScopes.js; src/engine/evaluate.js:enterBackgroundScope/runPictureEndHooks; src/frontend/parser.js:parseScopedStatement",
  localSourceReviewed: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarybackgrounds.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorelayers.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex",
  localDoc: "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-backgrounds.tex",
  features: ["background scopes and scope shorthand", "ordered end-of-picture frames", "overridable background path styles", "independent inner and outer frame separators"],
  implements: [...Object.keys(backgroundStyles), "on background layer", "every on background layer", "inner frame sep", "inner frame xsep", "inner frame ysep",
    "outer frame sep", "outer frame xsep", "outer frame ysep"],
  notes: "Explicit scopes switch before applying every on background layer and its argument. Raw background entries skip that style. Ink, pen, clip, coordinate and canvas transforms are checked separately across re-entry. The first automatic frame freezes the padded picture box; outer separation extends only side rules. General layer lists, arbitrary custom shape bounds and unrestricted TeX hooks remain outside coverage. See docs/qa/2026-11-26-native-background-scopes.md and docs/qa/2026-11-25-native-backgrounds.md."
};
