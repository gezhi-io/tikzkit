export const circuitikzFontRoles = Object.freeze({
  label: "label",
  annotation: "annotation",
  tiny: "tinySymbol",
  sixPoint: "sixPointSymbol",
  normal: "normalSymbol",
  large: "largeSymbol"
});

export const texPackage = {
  "name": "circuitikz",
  "status": "partial",
  "implementedBy": "src/engine/evaluate.js:appendCircuitikzToSegment",
  "features": [
    "short wires",
    "R/C/current/voltage source slices",
    "terminal markers",
    "op amp and tube node subset",
    "package option siunitx: normalize \\SI and circuitikz angle-unit labels",
    "package option RPvoltages: use reference-polarity voltage arrows instead of +/- labels"
  ],
  "requires": [],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/latex/circuitikz/circuitikz.sty",
  "localDoc": null,
  "caseCount": 486,
  "caseExamples": [
    "Tikzquads quadripoles and load line",
    "seebeck effect",
    "circuitikz manual snippet 001",
    "circuitikz manual snippet 002",
    "circuitikz manual snippet 003",
    "circuitikz manual snippet 004",
    "circuitikz manual snippet 005",
    "circuitikz manual snippet 006",
    "circuitikz manual snippet 007",
    "circuitikz manual snippet 008",
    "circuitikz manual snippet 009",
    "circuitikz manual snippet 010"
  ],
  "observedOptions": [
    "siunitx,RPvoltages"
  ],
  "notes": "Current implementation is a case-driven circuitikz subset, not the full circuitikz engine. Labels and annotations inherit the current TikZ font; internal symbol roles follow the 5/6pt, 10/12pt, and 12/14pt sizes declared by pgfcirc.defines.tex."
};
