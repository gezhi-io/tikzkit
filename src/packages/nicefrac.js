export const texPackage = {
  name: "nicefrac",
  status: "partial",
  implementedBy: "src/tikz/text.js + src/tikz/textMetrics.js + src/renderers/svg/mathNiceFractionFallback.js",
  features: [
    "math-mode nice fractions",
    "script-size numerator and denominator",
    "TeX -2mu/-1mu solidus kerning",
    "optional math alphabet style"
  ],
  requires: ["ifthen"],
  localSource: "/usr/local/texlive/2025/texmf-dist/tex/latex/units/nicefrac.sty",
  localDoc: null,
  caseCount: 3,
  caseExamples: [
    "linear-functions",
    "hidden-markov-model-abc",
    "hidden-markov-model-abc-2"
  ],
  observedOptions: ["nice"],
  notes: "Implements the math-mode layout used by nicefrac.sty: optical script text, raised numerator, and mu-kerned solidus. Text-mode and the package's ugly option remain unsupported."
};
