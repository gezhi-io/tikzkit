export const tikzLibrary = {
  "name": "decorations.pathmorphing",
  "status": "partial",
  "implementedBy": "src/engine/evaluate.js:applyPathMorphing/applySnakeDecorationToSubpaths",
  "localSourceReviewed": true,
  "features": [
    "native-style snake startup/cycle/end states",
    "snake phase continuity across line/curve subpaths",
    "whole-subpath pre length/post length independent of terminal arrow shortening",
    "zigzag approximation"
  ],
  "implements": [
    "snake pathmorphing subset",
    "zigzag approximation"
  ],
  "notes": "Snake follows the local PGF state-machine shape across a complete input subpath. Explicit pre/post lengths control only the decoration; late terminal-arrow shortening does not shift the wave phase. Zigzag and exact native handling at sharp corners or flattened curves remain partial."
};
