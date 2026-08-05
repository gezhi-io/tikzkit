export const tikzLibrary = {
  "name": "chains",
  "status": "partial",
  "implementedBy": [
    "src/engine/evaluate.js"
  ],
  "features": [
    "start chain=<name> going <direction>",
    "continue chain=<name> going <direction> in scopes",
    "on chain=<name>",
    "chain-begin, chain-end, and chain-<n> aliases",
    "join=by and join=with <node> by <style>"
  ],
  "implements": [
    "start chain",
    "continue chain",
    "on chain",
    "join"
  ],
  "localSourceReviewed": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarychains.code.tex",
  "notes": "Does not yet implement placed-chain directions, start/continue branch, or \\chainin."
};
