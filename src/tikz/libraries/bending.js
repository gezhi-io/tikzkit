export const tikzLibrary = {
  "name": "bending",
  "status": "partial",
  "implementedBy": "src/engine/options.js:parseArrowTipBending + src/renderers/svg/arrowBending.js:curvedArrowPaint/pgfCurvilinearTime/shortenCubicCurve + src/renderers/svg/paths.js:shortenPathTerminals",
  "features": [
    "arrows.meta flex and flex' rigidity modes",
    "arrows.meta bend orthogonal deformation",
    "curvature-aware arrow sequences and bounds",
    "PGF four-point physical distance lookup and cubic control-point shortening"
  ],
  "implements": ["bend", "flex", "flex'"],
  "localSourceReviewed": true,
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmodulebending.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-arrows.tex",
  "notes": "Implements the focused curved-arrow slice. flex keeps each tip rigid and aligns its visual span to the terminal cubic; flex' uses the ultimate assembly span; bend maps arrow geometry through the terminal cubic's distance frame. If one tip in a sequence requests bending, quick siblings use flex as in PGF. Reviewed on 2026-10-25: pgflibrarycurvilinear.code.tex supplies the four-point physical-pt distance table, replacing the previous generic arc-length integral. pgfmodulebending.code.tex supplies cubic subdivision for shortening, including both controls and negative extension. Native numeric probes and focused regressions pass. The modern-options browser control still fails its unchanged 0.12px gate because to-path automatic control distance differs by up to 0.228px at 3x. Polar declaration bending modes and arbitrary nonlinear transforms remain unsupported. See docs/qa/2026-10-25-core-to-arrows.md."
};
