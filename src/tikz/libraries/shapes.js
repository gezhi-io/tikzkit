export const tikzLibrary = {
  "name": "shapes",
  "status": "builtin",
  "implementedBy": "src/engine/evaluate.js:nodeShape + nodeShapeData",
  "localSourceReviewed": "yes",
  "notes": "Common node shapes use shared text-box metrics. Ellipse dimensions follow PGF's text-box, inner-separation, and sqrt(2) radius construction; full shape coverage remains outside this builtin subset.",
  "features": [
    "circle",
    "rectangle",
    "ellipse",
    "diamond",
    "regular polygon",
    "star"
  ],
  "implements": [
    "circle",
    "rectangle",
    "ellipse",
    "diamond",
    "regular polygon",
    "star"
  ]
};
