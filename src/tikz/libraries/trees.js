export const tikzLibrary = {
  "name": "trees",
  "status": "partial",
  "implementedBy": "src/engine/evaluate.js:createNodeTreeChildren/treeGrowthParentPoint/treeEdgeEndpoints/treeEveryChildNodeOptions",
  "localSourceReviewed": "yes",
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarytrees.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-trees.tex",
  "notes": "Reviewed locally on 2026-08-07 against the trees source and manual. Child placement starts from `growth parent anchor`; `every child node` is merged before each generated child node; parent/child anchors select the endpoints of the generated edge, with `border` retaining automatic node-border clipping. The four documented fork routes use those same anchors. Graph drawing, arbitrary edge-from-parent paths, and collision-avoiding tree layouts remain partial.",
  "features": [
    "node child trees",
    "grow direction",
    "grow cyclic",
    "level distance",
    "sibling distance",
    "sibling angle",
    "growth parent anchor",
    "every child node",
    "parent anchor and child anchor tree edges",
    "edge from parent fork down/up/left/right",
    "clockwise/counterclockwise from",
    "picture-level stroke style inheritance for generated child edges",
    "focused TCS logo macro expansion"
  ],
  "implements": [
    "node child trees",
    "grow direction",
    "grow cyclic",
    "level distance",
    "sibling distance",
    "sibling angle",
    "growth parent anchor",
    "every child node",
    "parent anchor and child anchor tree edges",
    "edge from parent fork down/up/left/right",
    "clockwise/counterclockwise from",
    "picture-level stroke style inheritance for generated child edges",
    "focused TCS logo macro expansion"
  ]
};
