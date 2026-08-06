export const tikzLibrary = {
  "name": "chains",
  "status": "partial",
  "implementedBy": [
    "src/frontend/parser.js:parseChaininStatement",
    "src/engine/evaluate.js:applyChainControlOptions/chainInExistingNode",
    "src/tikz/commands/chainin.js"
  ],
  "features": [
    "start chain=<name> going <direction>",
    "start/continue chain=<name> placed <positioning> in scopes or nodes",
    "on chain=<name> with per-node going/placed override",
    "chain-begin, chain-end, and chain-<n> aliases",
    "join=by and join=with <node> by <style>",
    "start/continue branch=<name> with parent/branch aliases",
    "\\chainin (existing node) with direct join options"
  ],
  "implements": [
    "start chain",
    "continue chain",
    "on chain",
    "join",
    "start branch",
    "continue branch",
    "chainin"
  ],
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-chains.tex",
  "localSourceReviewed": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarychains.code.tex",
  "notes": "Supports native going and placed chain positioning, including a per-node placed override that leaves the stored chain placement unchanged. Branches seed the fork node as branch-1 and preserve parent/branch aliases; \\chainin inserts an existing named node into the active chain. every chain in inheritance and chainin continuation into an arbitrary path remain partial."
};
