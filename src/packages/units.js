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
  "localSourceReviewed": true,
  "caseCount": 4,
  "caseExamples": [
    "3d hypersurface 3",
    "hidden-markov-model-abc-2"
  ],
  "observedOptions": ["tight", "loose"],
  "notes": "Reviewed TeX Live 2025 units.sty on 2026-08-07: it loads nicefrac.sty, emits the optional value plus tight \\, spacing, uses \\mathrm in math mode, and delegates \\unitfrac to nicefrac with an upright optional style. TikZKit implements that math-mode slice and uses the same packed fraction metrics when it determines multi-line circle-node geometry. Text-mode spacing and the package's loose option remain unsupported."
};
