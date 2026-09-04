export const tikzLibrary = {
  name: "topaths",
  status: "partial",
  implementedBy: "src/engine/evaluate.js:edgeCurveSpec/constrainedCurveControlDistance",
  features: [
    "default curve-to angles out=45 and in=135",
    "bend left/right with relative chord directions",
    "out/in and relative angle controls",
    "looseness plus independent out/in looseness",
    "distance and independent in/out exact distances",
    "min/max distance and independent in/out bounds",
    "source-ordered updates for distinct curve option keys"
  ],
  implements: [
    "to",
    "edge",
    "bend left",
    "bend right",
    "out",
    "in",
    "relative",
    "looseness",
    "out looseness",
    "in looseness",
    "distance",
    "min distance",
    "max distance",
    "out distance",
    "in distance",
    "out min distance",
    "out max distance",
    "in min distance",
    "in max distance"
  ],
  localSource: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarytopaths.code.tex",
  localDoc: "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-edges.tex",
  localSourceReviewed: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarytopaths.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex (core loads topaths); /usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-edges.tex",
  notes: "Reviewed locally on 2026-09-04. PGF initializes curve-to with out=45, in=135 and a 30-degree bend angle. Its base control distance is approximately 0.3915 times the endpoint distance, then each side applies its looseness and independent minimum/maximum clamp. Exact distance sets both bounds, and distinct option keys update this state in source order. TikZKit shares these semantics across ordinary to/edge paths and chain joins. Explicit out control/in control/controls, arbitrary custom to path callbacks, and repeated identical-key timeline preservation remain partial."
};
