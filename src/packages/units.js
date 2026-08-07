export const texPackage = {
  "name": "units",
  "status": "partial",
  "implementedBy": "src/tikz/text.js:normalizeBrowserMathMacros + src/tikz/textMetrics.js + src/renderers/svg/mathUprightFallback.js + src/renderers/svg/mathNiceFractionFallback.js",
  "features": [
    "Loads nicefrac semantics for math-mode \\nicefrac output",
    "Math-mode \\unit[<value>]{<unit>} with tight spacing, italic variables, and scoped upright unit text",
    "Math-mode \\unitfrac[<value>]{<numerator>}{<denominator>} through upright \\nicefrac, including nested denominator scripts"
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
  "notes": "Reviewed TeX Live 2025 units.sty and nicefrac.sty on 2026-08-08: units emits the optional value plus tight \\, spacing, scopes \\mathrm to only the unit, and delegates \\unitfrac to nicefrac with upright parts. TikZKit now preserves that local alphabet scope in SVG text, retains the 3mu gap, and lays nested denominator scripts out as scripts. Evidence: docs/qa/2026-08-08-units-math-mode.md. Text-mode spacing and the package's loose option remain unsupported."
};
