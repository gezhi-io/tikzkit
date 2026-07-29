export const tikzLibrary = {
  "name": "automata",
  "status": "partial",
  "implementedBy": "src/engine/evaluate.js:BUILTIN_STYLES + nodeShape + diamondLayoutSize + addAutomataInitialArrow + addAutomataAcceptingArrow + circleSplitLayout",
  "localSourceReviewed": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryautomata.code.tex",
  "features": [
    "state / state without output",
    "state with output / circle split",
    "accepting double outline",
    "accepting arrows at the default, above, below, left, and right positions",
    "accepting distance",
    "default and custom accepting text",
    "initial by diamond (requires shapes.geometric, matching PGF)",
    "initial arrows at the default, above, below, left, and right positions",
    "initial distance",
    "default and custom initial text"
  ],
  "implements": [
    "state",
    "state with output",
    "accepting",
    "accepting by arrow",
    "accepting above",
    "accepting below",
    "accepting left",
    "accepting right",
    "accepting distance",
    "accepting text",
    "initial by diamond",
    "initial",
    "initial above",
    "initial below",
    "initial left",
    "initial right",
    "initial distance",
    "initial text"
  ],
  "notes": "Does not yet implement every accepting/initial by arrow custom styles. As in PGF, automata itself does not load shapes.geometric; sources using initial by diamond must load it."
};
