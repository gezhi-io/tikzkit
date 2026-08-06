export const texPackage = {
  "name": "mathtools",
  "status": "partial",
  "implementedBy": "src/tikz/textMetrics.js + src/renderers/svg/mathScriptFallback.js + src/renderers/svg/renderSvg.js + src/frontend/latex-shell.js:parseDeclareMathOperator + web/workbench.js",
  "features": [
    "KaTeX delegated math rendering",
    "\\DeclareMathOperator macro expansion",
    "\\operatorname SVG text fallback"
  ],
  "requires": [
    "amsmath",
    "keyval",
    "calc",
    "mhsetup"
  ],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/latex/mathtools/mathtools.sty",
  "localDoc": null,
  "localSourceReviewed": true,
  "caseCount": 23,
  "caseExamples": [
    "bose einstein distribution 3d",
    "bose einstein distribution",
    "branch cuts 1",
    "change of variables",
    "complex sign function",
    "complex sign plane",
    "fermi dirac distro",
    "generative adversarial network",
    "grand canonical occupation fluctuations",
    "harmonic oscillator energy vs freq",
    "kohn sham cycle",
    "matsubara contour 1"
  ],
  "observedOptions": [],
  "notes": "Reviewed TeX Live 2025 mathtools.sty: it loads keyval/calc/mhsetup and forwards its amsmath layer rather than changing TikZ node placement. TikZKit maps common operator and matrix formulas to scoped browser math in the workbench, with a calibrated SVG-text fallback for comparison artifacts."
};
