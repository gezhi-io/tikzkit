export const texPackage = {
  "name": "units",
  "status": "partial",
  "implementedBy": "src/tikz/text.js:normalizeBrowserMathMacros + src/tikz/textMetrics.js + src/renderers/svg/mathNiceFractionFallback.js",
  "features": [
    "Loads nicefrac semantics for math-mode \\nicefrac output",
    "Math-mode \\unit[<value>]{<unit>} with tight spacing and upright unit text",
    "Math-mode \\unitfrac[<value>]{<numerator>}{<denominator>} through upright \\nicefrac"
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
  "notes": "MacTeX units.sty loads nicefrac.sty and defines \\unit and \\unitfrac. TikZKit implements their default tight math-mode form: an optional value followed by \\, and an upright unit, with unitfrac reusing the existing upright nicefrac fallback. Text-mode spacing and the package's loose option remain unsupported."
};
