export const tikzLibrary = {
  "name": "automata",
  "status": "partial",
  "implementedBy": "src/engine/evaluate.js:BUILTIN_STYLES + addAutomataInitialArrow + circleSplitLayout",
  "localSourceReviewed": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryautomata.code.tex",
  "features": [
    "state / state without output",
    "state with output / circle split",
    "accepting double outline",
    "initial arrows at the default, above, below, left, and right positions",
    "initial distance",
    "default and custom initial text"
  ],
  "implements": [
    "state",
    "state with output",
    "accepting",
    "initial",
    "initial above",
    "initial below",
    "initial left",
    "initial right",
    "initial distance",
    "initial text"
  ],
  "notes": "Does not yet implement accepting arrows or text, accepting distance, initial by diamond, or every accepting/initial by arrow custom styles."
};
