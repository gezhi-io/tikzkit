export const tikzLibrary = {
  "name": "decorations.pathmorphing",
  "status": "partial",
  "implementedBy": "src/engine/evaluate.js:applyPathMorphing/applyPathMorphingToSubpaths/flattenDecorationPath/pointOnPolyline/createPgfDecorationPathWalker/pgfDecorationCurveTimeAfterDistance/appendNativeSnakePolylineInStateFrames/appendNativeZigzagPolyline/appendNativeCoilPolyline/appendNativeSawPolyline/appendNativeBumpsPolyline",
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathmorphing.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex",
  "localSourceReviewed": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathmorphing.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduledecorations.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarysnakes.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcoretransformations.code.tex; /usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex",
  "features": [
    "native-style snake startup/cycle/end states",
    "snake phase continuity across line/curve subpaths",
    "snake analytic cubic tangent frames",
    "whole-subpath pre length/post length independent of terminal arrow shortening",
    "native zigzag quarter-apex, alternating-state, and center-finish phase",
    "zigzag phase continuity across line/curve subpaths",
    "zigzag state-origin tangent frames",
    "PGF-style recursive cubic length sampling with 1pt coordinate tolerance",
    "PGF iterative curved-path distance-to-time search",
    "native coil four-cubic cycle and two-cubic final state",
    "coil aspect projection, amplitude, segment length, pre length, and post length",
    "native saw full-tooth and automatic-end states",
    "saw signed amplitude, explicit path has corners, pre length, and post length",
    "native bumps two-cubic half-ellipse state and 0.51 segment automatic-end threshold",
    "bumps signed amplitude, explicit path has corners, pre length, and post length",
    "shared mirror and raise state transforms for snake, zigzag, and coil",
    "shared mirror and raise state transforms for saw",
    "shared mirror and raise state transforms for bumps",
    "legacy mirror snake and raise snake transformation order"
  ],
  "implements": [
    "snake pathmorphing subset",
    "zigzag pathmorphing subset",
    "coil pathmorphing subset",
    "saw pathmorphing subset",
    "bumps pathmorphing subset",
    "mirror/raise transform subset"
  ],
  "notes": "Snake and zigzag follow their local PGF state machines across a complete input subpath. Explicit pre/post lengths control only the decoration; late terminal-arrow shortening does not shift the wave phase. Standard snake retains each PGF state's entry tangent/normal when that state crosses a sharp polyline corner; evidence: docs/qa/2026-08-08-pathmorphing-snake-state-frame.md. Curved pathmorphing uses recursive cubic subdivision with the native 1pt per-axis stopping tolerance, while exact cubic points and analytic tangents install each state's local coordinate frame; PGF's signed-chord iterative search refines distance to curve time. Coil follows the installed TeX Live four-cubic cycle and two-cubic final state, including aspect-projected radius, amplitude, segment length, pre length, and post length on straight and curved paths. Modern mirror and raise keys now use PGF's segment-transform order for snake, zigzag, and coil, including curved tangent frames. Saw follows PGF's full-tooth state and automatic short final state, preserves signed amplitude, optionally restarts at input corners when path has corners is explicit, and applies the same tangent-frame mirror/raise transform. Bumps follows PGF's half-segment two-cubic state, 0.51-segment automatic-end and automatic-corner thresholds, raw-endpoint final state, signed amplitude, and tangent-frame mirror/raise transforms on straight and curved paths. The legacy mirror snake/raise snake spelling follows the reflected translation rule and no longer inserts a false entry segment. Evidence: docs/qa/2026-09-04-pathmorphing-curve-frames.md, docs/qa/2026-09-04-pathmorphing-coil.md, docs/qa/2026-09-04-pathmorphing-mirror-raise.md, docs/qa/2026-09-04-pathmorphing-saw.md, and docs/qa/2026-09-04-pathmorphing-bumps.md. Other pathmorphing decorations such as random steps, bent, straight zigzag, and expanding waves remain partial or unsupported."
};
