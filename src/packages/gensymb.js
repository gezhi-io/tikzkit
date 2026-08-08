export const texPackage = {
  name: "gensymb",
  status: "partial",
  implementedBy: "src/tikz/text.js:normalizeBrowserMathMacros/mathFallbackText + src/renderers/svg/mathUprightFallback.js + src/renderers/svg/mathScriptFallback.js + src/renderers/svg/mathNode.js",
  features: [
    "default math-mode \\degree rendered as the native superscript circle",
    "default math-mode \\celsius rendered as a superscript circle plus upright C",
    "default math-mode \\ohm rendered as uppercase Omega"
  ],
  requires: [],
  localSource: "/usr/local/texlive/2025/texmf-dist/tex/latex/gensymb/gensymb.sty",
  localDoc: null,
  localSourceReviewed: [
    "/usr/local/texlive/2025/texmf-dist/tex/latex/gensymb/gensymb.sty (default degree/celsius fallbacks and ohm selection, lines 22-107)"
  ],
  caseCount: 22,
  caseExamples: [
    "LaTeX-examples Dot Product 4"
  ],
  observedOptions: [],
  notes: "Without textcomp, MacTeX gensymb defaults \\degree to ^\\circ, \\celsius to ^\\circ\\mathrm{C}, and \\ohm to \\Omega; TikZKit normalizes those forms before browser/SVG fallback. textcomp glyph selection, perthousand, micro, and Upomega/upmu option branches remain unsupported."
};
