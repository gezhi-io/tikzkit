export const tikzLibrary = {
  "name": "shapes.multipart",
  "status": "partial",
  "implementedBy": "src/engine/evaluate.js:rectangleSplitLayout + rectangleSplitTextAnchorShift + rectangleSplitLocalAnchor + circleSplitLayout/circleSplitPartMetric/circleSplitLocalAnchor + src/renderers/svg/rectangleSplitNodes.js + src/renderers/svg/circleSplitNodes.js + src/renderers/svg/mathNode.js",
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.multipart.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex",
  "localSourceReviewed": true,
  "notes": "Horizontal rectangle splits use PGF's fixed cmtt10 advances for multipart layout and support one explicit empty-part width/height/depth rule per key: widths accumulate while heights and depths take their TeX hbox maxima. `rectangle split draw splits=false` leaves the part geometry, fills, and anchors intact while omitting only the internal separators. `rectangle split part fill` enables per-part backgrounds; the source-defined `rectangle split uses custom fill=false` disables them again and restores the ordinary node `fill` background. With `anchor=text`, the placement point and `(node.text)` resolve to the first visible text-part origin, including `rectangle split ignore empty parts`. Circle split now uses PGF-style independent upper/lower TeX boxes: the separator stays at the circle center, text parts use their own height/depth, and `(node.lower)` resolves to the lower box origin rather than the semicircle center. Repeated empty-part key accumulation and advanced multipart shapes remain partial.",
  "features": [
    "horizontal rectangle split",
    "per-part horizontal center/top/bottom/base alignment",
    "vertical rectangle split",
    "per-part vertical center/left/right alignment",
    "circle split with text/lower node parts",
    "nodepart text boxes",
    "named part anchors",
    "rectangle split text anchor",
    "per-part fill",
    "rectangle split uses custom fill",
    "ordinary rectangle split background fill",
    "rectangle split draw splits",
    "empty part width/height/depth rule metrics",
    "TeX text/script/scriptscript math sizing for part and external labels",
    "cmtt10 width accumulation for horizontal split parts"
  ],
  "implements": ["rectangle split", "circle split"]
};
