export const tikzLibrary = {
  "name": "shapes",
  "status": "builtin",
  "implementedBy": "src/engine/evaluate.js:nodeShape + nodeShapeData",
  "localSourceReviewed": "yes",
  "notes": "Common node shapes use shared text-box metrics. Reviewed PGF's shapes.misc rounded-rectangle construction on 2026-08-07: default convex 180-degree ends add the text-box chord derived from content height, inner separation, and arc radius rather than a fixed horizontal em padding. Straight and curved node-to-node paths now clip against those convex circular end caps, including terminal arrow padding, instead of the outer rectangular corner. Ellipse dimensions follow PGF's text-box, inner-separation, and sqrt(2) radius construction; non-default rounded-rectangle arc modes and full shape coverage remain outside this builtin subset.",
  "features": [
    "circle",
    "rectangle",
    "rounded rectangle",
    "ellipse",
    "diamond",
    "regular polygon",
    "star"
  ],
  "implements": [
    "circle",
    "rectangle",
    "rounded rectangle",
    "ellipse",
    "diamond",
    "regular polygon",
    "star"
  ]
};
