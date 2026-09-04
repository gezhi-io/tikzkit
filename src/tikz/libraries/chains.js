export const tikzLibrary = {
  "name": "chains",
  "status": "partial",
  "implementedBy": [
    "src/frontend/parser.js:parseChaininStatement",
    "src/engine/evaluate.js:applyChainControlOptions/chainInExistingNode/addChainJoinPath",
    "src/engine/evaluate.js:edgeCurveSpec/constrainedCurveControlDistance",
    "src/engine/options.js:isRepeatableOption",
    "src/tikz/commands/chainin.js"
  ],
  "features": [
    "start chain=<name> going <direction>",
    "start/continue chain=<name> placed <positioning> in scopes or nodes",
    "on chain=<name> with per-node going/placed override",
    "chain-begin, chain-end, and chain-<n> aliases",
    "repeatable join=by and join=with <node> by <style> on one node",
    "every on chain for direct or inherited on-chain nodes",
    "every edge then every join before join-local styles, including arrow-direction replacement",
    "join edge geometry with bend left/right, out/in, looseness, and independent distance bounds",
    "start/continue branch=<name> with parent/branch aliases",
    "\\chainin (existing node) with accumulated inherited and direct join options"
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
  "notes": "Supports native going and placed chain positioning, including a per-node placed override that leaves the stored chain placement unchanged. Branches seed the fork node as branch-1 and preserve parent/branch aliases. Repeated join options on one node are retained in source order, each resolves its own previous or explicit source alias, every on chain runs for direct or inherited on-chain nodes, and join paths use the shared edge pipeline: every edge, every join, and each join-local style are applied in native order before bend left/right, out/in, looseness, exact distance, or independent min/max distance geometry, node-border clipping, and tangent-aware arrows. \\chainin retains inherited and explicit join actions in source order and continues from the inserted node's real dimensions. Arbitrary after-node-path code, arbitrary custom to path callbacks, edge nodes inside join specifications, and arbitrary path continuation after \\chainin remain partial."
};
