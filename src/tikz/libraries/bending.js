export const tikzLibrary = {
  "name": "bending",
  "status": "partial",
  "implementedBy": "src/engine/options.js:parseArrowTipBending + src/renderers/svg/arrowBending.js:curvedArrowPaint",
  "features": [
    "arrows.meta flex and flex' rigidity modes",
    "arrows.meta bend orthogonal deformation",
    "curvature-aware arrow sequences and bounds"
  ],
  "implements": ["bend", "flex", "flex'"],
  "localSourceReviewed": true,
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmodulebending.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-arrows.tex",
  "notes": "Implements the focused curved-arrow slice. flex keeps each tip rigid and aligns its visual span to the terminal cubic; flex' uses the ultimate assembly span; bend maps arrow geometry through the terminal cubic's arc-length frame. If one tip in a sequence requests bending, quick siblings use flex as in PGF. The implementation uses a deterministic high-resolution arc-length table instead of PGF's four-point speed approximation. Polar declaration bending modes and arbitrary nonlinear transforms remain unsupported."
};
