export const tikzLibrary = {
  "name": "shapes.multipart",
  "status": "partial",
  "implementedBy": "src/engine/evaluate.js + src/renderers/svg/rectangleSplitNodes.js + src/renderers/svg/circleSplitNodes.js + src/renderers/svg/mathNode.js",
  "features": [
    "horizontal rectangle split",
    "circle split with text/lower node parts",
    "nodepart text boxes",
    "named part anchors",
    "per-part fill",
    "TeX text/script/scriptscript math sizing for part and external labels"
  ],
  "implements": ["rectangle split", "circle split"]
};
