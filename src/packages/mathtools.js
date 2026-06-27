export const texPackage = {
  "name": "mathtools",
  "status": "partial",
  "implementedBy": "src/math-metrics.js + src/renderer-svg.js + src/preprocess.js:parseDeclareMathOperator",
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
  "notes": "TeX Live mathtools.sty loads keyval/calc/mhsetup and then amsmath; TikZKit maps the common math-operator layer into TeX-lite/KaTeX and SVG text fallback labels."
};
