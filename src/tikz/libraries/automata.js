export const tikzLibrary = {
  "name": "automata",
  "status": "partial",
  "implementedBy": "src/engine/evaluate.js:BUILTIN_STYLES + addAutomataInitialArrow",
  "localSourceReviewed": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryautomata.code.tex",
  "features": [
    "state / state without output",
    "accepting double outline",
    "initial arrows at the default, above, below, left, and right positions",
    "initial distance",
    "default and custom initial text"
  ],
  "implements": [
    "state",
    "accepting",
    "initial",
    "initial above",
    "initial below",
    "initial left",
    "initial right",
    "initial distance",
    "initial text"
  ],
  "notes": "Does not yet implement state with output/circle split, accepting arrows or text, accepting distance, or every accepting by arrow."
};
