export const texPackage = {
  "name": "units",
  "status": "partial",
  "implementedBy": "src/tikz/text.js + src/tikz/textMetrics.js + src/renderers/svg/mathNiceFractionFallback.js",
  "features": [
    "Loads nicefrac semantics for math-mode \\nicefrac output"
  ],
  "requires": ["ifthen", "nicefrac"],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/latex/units/units.sty",
  "localDoc": null,
  "caseCount": 4,
  "caseExamples": [
    "3d hypersurface 3",
    "hidden-markov-model-abc-2"
  ],
  "observedOptions": ["tight", "loose"],
  "notes": "MacTeX units.sty loads nicefrac.sty and defines \\unit and \\unitfrac. TikZKit currently covers the resulting math-mode \\nicefrac layout; standalone \\unit and \\unitfrac spacing remain unsupported."
};
