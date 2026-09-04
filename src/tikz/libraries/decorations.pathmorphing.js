export const tikzLibrary = {
  "name": "decorations.pathmorphing",
  "status": "partial",
  "implementedBy": "src/engine/evaluate.js:applyPathMorphingToSubpaths/flattenDecorationPath/appendDecorationCubicSamples/pointOnPolyline/appendNativeSnakePolylineInStateFrames/appendNativeZigzagPolyline",
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathmorphing.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex",
  "localSourceReviewed": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathmorphing.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduledecorations.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.pathmorphing.code.tex; /usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex",
  "features": [
    "native-style snake startup/cycle/end states",
    "snake phase continuity across line/curve subpaths",
    "snake analytic cubic tangent frames",
    "whole-subpath pre length/post length independent of terminal arrow shortening",
    "native zigzag quarter-apex, alternating-state, and center-finish phase",
    "zigzag phase continuity across line/curve subpaths",
    "zigzag state-origin tangent frames",
    "PGF-style recursive cubic length sampling with 1pt coordinate tolerance"
  ],
  "implements": [
    "snake pathmorphing subset",
    "zigzag pathmorphing subset"
  ],
  "notes": "Snake and zigzag follow their local PGF state machines across a complete input subpath. Explicit pre/post lengths control only the decoration; late terminal-arrow shortening does not shift the wave phase. Standard snake retains each PGF state's entry tangent/normal when that state crosses a sharp polyline corner; evidence: docs/qa/2026-08-08-pathmorphing-snake-state-frame.md. Curved snake and zigzag paths now use the local PGF decoration model: recursive cubic subdivision estimates consumed distance with the native 1pt per-axis stopping tolerance, while exact cubic points and analytic tangents install each state's local coordinate frame. Zigzag keeps its initial quarter-apex, alternating half-state phase, and center-finish behavior across line and curve inputs. Evidence: docs/qa/2026-09-04-pathmorphing-curve-frames.md. PGF's iterative curve distance-to-time refinement, legacy snakes mirror/raise variants, and other pathmorphing decorations such as saw, random steps, bent, bumps, and coil remain partial or unsupported."
};
