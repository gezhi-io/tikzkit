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
  "implementedBy": "src/engine/evaluate.js:appendCircuitikzToSegment/circuitikzVoltageSourceItems/appendCircuitikzVoltageSourceSymbolNodes/appendCircuitikzVoltageLabel/circuitikzInductorSettings/circuitikzInductorItems/circuitikzChokeCoreItems/registerCircuitikzInductorNode",
  "features": [
    "short wires",
    "R/C/basic independent current and voltage source slices",
    "american voltage-source circle with internal + and - polarity symbols, including backward V< direction",
    "L/vL cute, American, and European inductor slice with scale/width/coils",
    "cute choke single/double core lines with cthick",
    "named inductor core west/east anchors with configurable core distance",
    "terminal markers",
    "op amp and tube node subset",
    "package option siunitx: normalize \\SI and circuitikz angle-unit labels",
    "package option RPvoltages: set reference-polarity direction for American +/- and European arrow voltage notation"
  ],
  "requires": [],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/latex/circuitikz/circuitikz.sty",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/latex/circuitikz/circuitikzmanual.pdf",
  "localSourceReviewed": [
    "/usr/local/texlive/2025/texmf-dist/tex/latex/circuitikz/circuitikz.sty (circuitikz environment aliases tikzpicture, line 400)",
    "/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex (resistor defaults and american/european independent voltage-source geometry, lines 32-113 and 2280-2372)",
    "/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircvoltage.tex (V< direction and external voltage-label conventions)",
    "/usr/local/texlive/2025/texmf-dist/doc/latex/circuitikz/circuitikzmanual.tex (RPvoltages semantics and american source selection, lines 435, 2921-2930, 3177-3198, 8942-9176)",
    "/usr/local/texlive/2025/texmf-dist/doc/latex/circuitikz/circuitikzmanual.tex (Inductors customizations and anchors, lines 2539-2685)",
    "/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex (inductor, choke, and core-anchor path geometry, lines 1286-1906)"
  ],
  "caseCount": 488,
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
    "circuitikz manual snippet 010",
    "circuitikz inductors",
    "circuitikz chokes and core anchors",
    "circuitikz basic bipoles"
  ],
  "observedOptions": [
    "siunitx,RPvoltages"
  ],
  "notes": "Current implementation is a case-driven circuitikz subset, not the full circuitikz engine. The verified basic-bipoles fixture covers R/C, an independent V source, [american] internal +/- polarity, V< direction, siunitx unit labels, and RPvoltages reference polarity: American bipoles use +/- signs while European notation uses voltage arrows. L/vL select cute, American, or European bodies through explicit styles, tikzpicture style keys, or \\ctikzset{inductor=...}; documented inductors/scale, inductors/width, and inductors/coils are honored. \\ctikzset style changes now override inherited tikzpicture defaults. cute choke supports onelinechoke/twolineschoke and bipoles/cutechoke/cthick; named L/vL/choke elements expose core west/east with bipoles/inductors/core distance. Labels and annotations inherit the current TikZ font; internal symbol roles follow the 5/6pt, 10/12pt, and 12/14pt sizes declared by pgfcirc.defines.tex. Controlled and battery source variants, source rotations/mirroring, transformers, inductive sensors, dot anchors, and the broader bipole catalog remain partial or unsupported."
};
