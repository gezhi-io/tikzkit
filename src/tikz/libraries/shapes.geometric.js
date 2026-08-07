export const tikzLibrary = {
  "name": "shapes.geometric",
  "status": "partial",
  "implementedBy": [
    "src/engine/evaluate.js:regularPolygonLayoutSize/regularPolygonStartAngle/regularPolygonOuterRadiusExtension/nodeBorderPoint/polygonBorderPointWithPadding",
    "src/renderers/svg/nodeShapes.js:regularPolygonNodePoints"
  ],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex",
  "localSourceReviewed": true,
  "features": [
    "regular polygon with PGF circumcircle sizing, odd/even orientation, rotation, and border crop",
    "star",
    "trapezium",
    "cloud",
    "isosceles triangle with apex angle, minimum height, rotation, and named anchors"
  ],
  "implements": [
    "regular polygon",
    "star",
    "trapezium",
    "cloud",
    "isosceles triangle"
  ],
  "notes": "Reviewed locally on 2026-08-07 against the regular-polygon definition in pgflibraryshapes.geometric.code.tex and the PGF shapes manual. Regular polygons use the source's sqrt(2)*apothem*sec(180/sides) content radius, circumcircle minimum size, odd/even default orientation, `shape border rotate`/`regular polygon rotate`, and the outer-separation mitre extension used by curved terminal arrows. The permanent visual driver is arrows/regular-polygon-curved-terminal.tex. Also reviewed the source's diamond, star, and trapezium anchorborder definitions: their curve-arrow terminal crops now offset the active polygon edge by the path's half line width, preserving the original shape sizing. `arrows/shape-curved-terminal-padding.tex` verifies the rectangle/diamond/star/trapezium slice. Exact vertex-ray miters and full native sizing/rotation semantics for star and trapezium remain partial."
};
