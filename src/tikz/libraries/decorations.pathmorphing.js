export const tikzLibrary = {
  "name": "decorations.pathmorphing",
  "status": "partial",
  "implementedBy": "src/engine/evaluate.js:applyPathMorphingToSubpaths/appendNativeSnakePolyline/appendNativeZigzagPolyline",
  "localSourceReviewed": true,
  "features": [
    "native-style snake startup/cycle/end states",
    "snake phase continuity across line/curve subpaths",
    "whole-subpath pre length/post length independent of terminal arrow shortening",
    "native zigzag quarter-apex, alternating-state, and center-finish phase",
    "zigzag phase continuity across linear polyline subpaths"
  ],
  "implements": [
    "snake pathmorphing subset",
    "zigzag pathmorphing subset"
  ],
  "notes": "Snake and zigzag follow their local PGF state machines across a complete input subpath. Explicit pre/post lengths control only the decoration; late terminal-arrow shortening does not shift the wave phase. Standard snake retains each PGF state's entry tangent/normal when that state crosses a sharp polyline corner; evidence: docs/qa/2026-08-08-pathmorphing-snake-state-frame.md. Zigzag keeps its initial quarter-apex, alternating half-state phase, and center-finish behavior for straight and flattened polyline inputs. Exact native normal changes for zigzag, arbitrary flattened curves, and legacy snakes mirror/raise variants remain partial."
};
