const SQRT_TWO = Math.SQRT2;
const DIAGONAL_COMPONENT = Math.SQRT1_2;

export function ellipseSplitGeometry(metrics = {}, data = {}) {
  const upper = normalizedBox(metrics.upper);
  const lower = normalizedBox(metrics.lower);
  const innerXSep = positive(data.innerXSep);
  const innerYSep = positive(data.innerYSep);
  const lineWidth = positive(data.lineWidth);
  const outerXSep = positive(data.outerXSep);
  const outerYSep = positive(data.outerYSep);
  const minimumWidth = positive(data.minimumWidth);
  const minimumHeight = positive(data.minimumHeight);
  const verticalPadding = innerYSep * 2 + lineWidth / 2;
  const visibleRadiusX = Math.max(
    SQRT_TWO * Math.max(upper.width / 2 + innerXSep, lower.width / 2 + innerXSep),
    minimumWidth / 2
  );
  const visibleRadiusY = Math.max(
    SQRT_TWO * Math.max(upper.height + upper.depth + verticalPadding, lower.height + lower.depth + verticalPadding),
    minimumHeight / 2
  );
  const anchorRadiusX = visibleRadiusX + outerXSep;
  const anchorRadiusY = visibleRadiusY + outerYSep;
  const upperCenterY = innerYSep + lineWidth / 2 + (upper.height + upper.depth) / 2;
  const lowerCenterY = -(innerYSep + lineWidth / 2 + (lower.height + lower.depth) / 2);
  const textAnchor = {
    x: -upper.width / 2,
    y: innerYSep + lineWidth / 2 + upper.depth
  };
  const lowerAnchor = {
    x: -lower.width / 2,
    y: -(innerYSep + lineWidth / 2 + lower.height)
  };
  const baseAnchor = { x: 0, y: textAnchor.y };
  const midAnchor = { x: 0, y: textAnchor.y + (Number(data.midlineOffset) || 0) };

  return {
    size: { width: visibleRadiusX * 2, height: visibleRadiusY * 2 },
    anchorSize: { width: anchorRadiusX * 2, height: anchorRadiusY * 2 },
    visibleRadiusX,
    visibleRadiusY,
    anchorRadiusX,
    anchorRadiusY,
    innerXSep,
    innerYSep,
    lineWidth,
    outerXSep,
    outerYSep,
    parts: [
      { name: "text", centerX: 0, centerY: upperCenterY },
      { name: "lower", centerX: 0, centerY: lowerCenterY }
    ],
    anchors: {
      text: textAnchor,
      lower: lowerAnchor,
      base: baseAnchor,
      mid: midAnchor,
      "base east": { x: anchorRadiusX, y: baseAnchor.y },
      "base west": { x: -anchorRadiusX, y: baseAnchor.y },
      "mid east": { x: anchorRadiusX, y: midAnchor.y },
      "mid west": { x: -anchorRadiusX, y: midAnchor.y },
      north: { x: 0, y: anchorRadiusY },
      south: { x: 0, y: -anchorRadiusY },
      east: { x: anchorRadiusX, y: 0 },
      west: { x: -anchorRadiusX, y: 0 },
      "north east": { x: DIAGONAL_COMPONENT * anchorRadiusX, y: DIAGONAL_COMPONENT * anchorRadiusY },
      "north west": { x: -DIAGONAL_COMPONENT * anchorRadiusX, y: DIAGONAL_COMPONENT * anchorRadiusY },
      "south east": { x: DIAGONAL_COMPONENT * anchorRadiusX, y: -DIAGONAL_COMPONENT * anchorRadiusY },
      "south west": { x: -DIAGONAL_COMPONENT * anchorRadiusX, y: -DIAGONAL_COMPONENT * anchorRadiusY }
    }
  };
}

export function diamondSplitGeometry(metrics = {}, data = {}) {
  const upper = normalizedBox(metrics.upper);
  const lower = normalizedBox(metrics.lower);
  const innerXSep = positive(data.innerXSep);
  const innerYSep = positive(data.innerYSep);
  const outerXSep = positive(data.outerXSep);
  const outerYSep = positive(data.outerYSep);
  const minimumWidth = positive(data.minimumWidth);
  const minimumHeight = positive(data.minimumHeight);
  const aspect = positive(data.aspect) || 1;
  const contentWidth = Math.max(upper.width, lower.width + innerXSep);
  const contentHeight = Math.max(
    upper.height + upper.depth,
    lower.height + lower.depth + innerYSep
  );
  const anchorRadiusX = Math.max(contentWidth + aspect * contentHeight, minimumWidth / 2) + outerXSep;
  const anchorRadiusY = Math.max(contentWidth / aspect + contentHeight, minimumHeight / 2) + outerYSep;
  const visibleRadiusX = Math.max(0, anchorRadiusX - SQRT_TWO * outerXSep);
  const visibleRadiusY = Math.max(0, anchorRadiusY - SQRT_TWO * outerYSep);
  const separatorRadiusX = Math.max(0, anchorRadiusX - outerXSep);
  const textAnchor = {
    x: -upper.width / 2,
    y: 0.25 * (upper.height + upper.depth) + outerYSep
  };
  const lowerAnchor = {
    x: -lower.width / 2,
    y: -1.25 * (lower.height + lower.depth) - outerYSep
  };
  const baseAnchor = { x: 0, y: textAnchor.y };
  const midAnchor = { x: 0, y: textAnchor.y + (Number(data.midlineOffset) || 0) };

  return {
    size: { width: visibleRadiusX * 2, height: visibleRadiusY * 2 },
    anchorSize: { width: anchorRadiusX * 2, height: anchorRadiusY * 2 },
    visibleRadiusX,
    visibleRadiusY,
    anchorRadiusX,
    anchorRadiusY,
    separatorRadiusX,
    innerXSep,
    innerYSep,
    outerXSep,
    outerYSep,
    aspect,
    parts: [
      {
        name: "text",
        centerX: 0,
        centerY: textAnchor.y + (upper.height - upper.depth) / 2
      },
      {
        name: "lower",
        centerX: 0,
        centerY: lowerAnchor.y + (lower.height - lower.depth) / 2
      }
    ],
    anchors: {
      text: textAnchor,
      lower: lowerAnchor,
      base: baseAnchor,
      mid: midAnchor,
      north: { x: 0, y: anchorRadiusY },
      south: { x: 0, y: -anchorRadiusY },
      east: { x: anchorRadiusX, y: 0 },
      west: { x: -anchorRadiusX, y: 0 },
      "north east": { x: anchorRadiusX / 2, y: anchorRadiusY / 2 },
      "north west": { x: -anchorRadiusX / 2, y: anchorRadiusY / 2 },
      "south east": { x: anchorRadiusX / 2, y: -anchorRadiusY / 2 },
      "south west": { x: -anchorRadiusX / 2, y: -anchorRadiusY / 2 }
    }
  };
}

function normalizedBox(box = {}) {
  return {
    width: positive(box.width),
    height: positive(box.height),
    depth: positive(box.depth)
  };
}

function positive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export const tikzLibrary = {
  "name": "shapes.multipart",
  "status": "partial",
  "implementedBy": "src/engine/evaluate.js:rectangleSplitLayout + rectangleSplitTextAnchorShift + rectangleSplitLocalAnchor + circleSplitLayout/circleSplitPartMetric/circleSplitLocalAnchor + ellipseSplitLayout/ellipseSplitLocalAnchor + diamondSplitLayout/diamondSplitLocalAnchor + addMultipartTextItems/nodeBorderPoint + src/tikz/libraries/shapes.multipart.js:ellipseSplitGeometry/diamondSplitGeometry + src/renderers/svg/rectangleSplitNodes.js + src/renderers/svg/circleSplitNodes.js + src/renderers/svg/ellipseSplitNodes.js + src/renderers/svg/diamondSplitNodes.js + src/renderers/svg/mathNode.js",
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.multipart.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex",
  "localSourceReviewed": true,
  "notes": "Horizontal rectangle splits use PGF's fixed cmtt10 advances for multipart layout and support one explicit empty-part width/height/depth rule per key: widths accumulate while heights and depths take their TeX hbox maxima. `rectangle split draw splits=false` leaves the part geometry, fills, and anchors intact while omitting only the internal separators. `rectangle split part fill` enables per-part backgrounds; the source-defined `rectangle split uses custom fill=false` disables them again and restores the ordinary node `fill` background. With `rounded corners`, custom fills now round only the outer corners of the first/last part while internal split corners stay square, matching PGF's behind-background path. With `anchor=text`, the placement point and `(node.text)` resolve to the first visible text-part origin, including `rectangle split ignore empty parts`. Circle split now uses PGF-style independent upper/lower TeX boxes: the separator stays at the circle center, text parts use their own height/depth, and `(node.lower)` resolves to the lower box origin rather than the semicircle center. Ellipse split was source-reviewed on 2026-09-04 against `pgflibraryshapes.multipart.code.tex`: upper/lower boxes determine sqrt(2)-expanded radii, outer separation affects anchors without enlarging the painted ellipse, the center rule separates both boxes, and the text/lower/base/mid/compass anchor family follows PGF. Automatic edges use the exact ellipse border. Diamond split was source-reviewed on 2026-09-04 against `pgflibraryshapes.multipart.code.tex` and the inherited diamond geometry in `pgflibraryshapes.geometric.code.tex`: independent text/lower boxes, aspect-dependent radii, minimum dimensions, outer-separation anchor radii, exact diamond border clipping, the separator, and text/lower/base/mid/compass anchors are implemented. Because `/pgf/aspect` is declared by `shapes.geometric`, source-compatible cases load that library alongside `shapes.multipart`. Three-way diamond flowchart, math, and physics evidence is stored in `outputs/qa/2026-09-04-shapes-diamond-split`. Repeated empty-part key accumulation and circle solidus remain partial.",
  "features": [
    "horizontal rectangle split",
    "per-part horizontal center/top/bottom/base alignment",
    "vertical rectangle split",
    "per-part vertical center/left/right alignment",
    "circle split with text/lower node parts",
    "ellipse split with text/lower node parts",
    "ellipse split text/lower/base/mid/compass anchors",
    "ellipse split exact border clipping",
    "diamond split with text/lower node parts",
    "diamond split aspect and minimum dimensions",
    "diamond split text/lower/base/mid/compass anchors",
    "diamond split exact border clipping",
    "nodepart text boxes",
    "named part anchors",
    "rectangle split text anchor",
    "per-part fill",
    "rectangle split uses custom fill",
    "ordinary rectangle split background fill",
    "rounded outer rectangle split fills",
    "rectangle split draw splits",
    "empty part width/height/depth rule metrics",
    "TeX text/script/scriptscript math sizing for part and external labels",
    "cmtt10 width accumulation for horizontal split parts"
  ],
  "implements": ["rectangle split", "circle split", "ellipse split", "diamond split"]
};
