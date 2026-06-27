export const texPackage = {
  "name": "pgf",
  "status": "partial",
  "implementedBy": "src/preprocess.js + src/interpreter.js",
  "features": [
    "core PGF-style path/color/math compatibility"
  ],
  "requires": [],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/latex/pgf/basiclayer/pgf.sty",
  "localDoc": null,
  "caseCount": 4,
  "caseExamples": [
    "geom ellipse on coords geometry pgf def script",
    "nn 04 auto net neuralnet matrix style foreach",
    "nn discriminator neuralnet matrix foreach style",
    "nn generator neuralnet matrix"
  ],
  "observedOptions": [],
  "notes": "Only the PGF surface required by current TikZKit cases is interpreted."
};
