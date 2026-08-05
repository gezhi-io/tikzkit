export const tikzLibrary = {
  "name": "chains",
  "status": "partial",
  "implementedBy": [
    "src/engine/evaluate.js"
  ],
  "features": [
    "start chain=<name> going <direction>",
    "start/continue chain=<name> placed <positioning> in scopes or nodes",
    "on chain=<name> with per-node going/placed override",
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
  "notes": "Supports native going and placed chain positioning, including a per-node placed override that leaves the stored chain placement unchanged. start/continue branch and \\chainin remain partial."
};
