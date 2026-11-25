// These are ordinary, overridable TikZ styles. Keep the every-* hooks last:
// their options must override the defaults without leaking to sibling nodes.
export const petriStyles = {
  "every place": {},
  place: { circle: true, draw: true, "inner sep": "0pt", "minimum size": "5ex", "every place": true },
  "every transition": {},
  transition: { rectangle: true, draw: true, "inner sep": "0pt", "minimum size": "4mm", "every transition": true },
  "every token": {},
  token: {
    fill: "black", draw: "none", circle: true, "inner sep": "0.5pt", "minimum size": "1ex",
    text: "white", font: "\\tiny", "every token": true
  },
  pre: { "<-": true, "shorten <=": "1pt" },
  post: { "->": true, "shorten >=": "1pt" },
  "pre and post": { "<->": true, "shorten >=": "1pt", "shorten <=": "1pt" }
};

export const tikzLibrary = {
  name: "petri",
  status: "partial",
  implementedBy: "src/tikz/libraries/petri.js:petriStyles; src/tikz/libraries/petriTokens.js:petriTokenGroups/petriTokenOffset; src/engine/evaluate.js:createNodeTreeChildren",
  localSourceReviewed: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarypetri.code.tex",
  localDoc: "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-petri.tex",
  features: ["scoped place, transition and token styles", "pre, post and bidirectional relations", "ordered plain, colored and structured token arrangements", "explicit token children and physical token spacing"],
  implements: [...Object.keys(petriStyles), "tokens", "colored tokens", "structured tokens", "children are tokens", "token distance"],
  notes: "Places, transitions and tokens use ordinary node geometry. Counts 1-9 follow the PGF placement table in child order; higher counts coincide at the center. Colored or numbered children do not draw connecting edges. Pre/post relations shorten their arrow ends by 1pt. Custom TeX growth functions and arbitrary append-after-command code are not interpreted. See docs/qa/2026-11-25-native-petri.md."
};
