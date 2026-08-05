export const tikzLibrary = {
  "name": "decorations.pathmorphing",
  "status": "partial",
  "implementedBy": "src/engine/evaluate.js:applySnakeDecorationToSubpaths",
  "localSourceReviewed": true,
  "features": [
    "native-style snake startup/cycle/end states",
    "snake phase continuity across line/curve subpaths",
    "whole-subpath pre length/post length",
    "zigzag approximation"
  ],
  "implements": [
    "snake pathmorphing subset",
    "zigzag approximation"
  ],
  "notes": "Snake follows the local PGF state-machine shape across a complete input subpath, including polyline corners and endpoint lengths. Zigzag and exact native handling at sharp corners or flattened curves remain partial."
};
