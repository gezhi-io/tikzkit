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
  "implementedBy": "src/engine/evaluate.js:appendCircuitikzToSegment/circuitikzVoltageSourceItems/circuitikzCurrentSourceItems/circuitikzSinusoidalSourceItems/circuitikzSourceScale/circuitikzDiamondPath/circuitikzVoltageSourceSymbolNodes/appendCircuitikzVoltageLabel/circuitikzBatteryItems/circuitikzBatteryScale/circuitikzInductorSettings/circuitikzInductorItems/circuitikzChokeCoreItems/registerCircuitikzInductorNode",
  "features": [
    "short wires",
    "R/C/basic independent current and voltage source slices",
    "controlled cV/cI diamond sources in European and American styles with csources/scale",
    "independent sV/sI sinusoidal sources with sources/scale, sources/symbol/thickness, and bipoles/isourcesin/angle",
    "battery, battery1, and battery2 plate families with batteries/scale",
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
    "/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex (inductor, choke, and core-anchor path geometry, lines 1286-1906)",
    "/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcirc.defines.tex (csources scale-class geometry, lines 694-798 and 1058-1064)",
    "/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex (controlled voltage/current source diamond paths and aliases, lines 3404-3586 and 3824-3998)",
    "/usr/local/texlive/2025/texmf-dist/doc/latex/circuitikz/circuitikzmanual.tex (controlled source defaults and csources/scale, lines 2950-2970 and 3125-3130)",
    "/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcirc.defines.tex (batteries scale-class dimensions and defaults, lines 694-800 and 1054-1056)",
    "/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex (battery/battery1/battery2 plate, connector, and line-width geometry, lines 1959-1964 and 2095-2201)",
    "/usr/local/texlive/2025/texmf-dist/doc/latex/circuitikz/circuitikzmanual.tex (battery class and supported battery types, lines 2902-2914)",
    "/usr/local/texlive/2025/texmf-dist/doc/latex/circuitikz/circuitikzmanual.tex (independent sinusoidal sV/sI sources and open-current example, lines 2928-2947)",
    "/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcirc.defines.tex (sources scale class, lines 1058-1061)",
    "/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex (source symbol thickness/rotation defaults, sV waveform, sI open outline, and aliases, lines 1937-1975, 2270-2278, 2384-2407, 3353-3383, and 3849-3952)"
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
    "circuitikz basic bipoles",
    "circuitikz battery plate families",
    "circuitikz independent sinusoidal voltage and current sources"
  ],
  "observedOptions": [
    "siunitx,RPvoltages"
  ],
  "notes": "Current implementation is a case-driven circuitikz subset, not the full circuitikz engine. The verified basic-bipoles fixture covers R/C, an independent V source, [american] internal +/- polarity, V< direction, siunitx unit labels, and RPvoltages reference polarity: American bipoles use +/- signs while European notation uses voltage arrows. Independent sV/sI plus vsourcesin/isourcesin and the named sinusoidal styles now share the local four-cubic wave form, sources/scale, sources/symbol/thickness, the sI external current label, and bipoles/isourcesin/angle's two-arc open outline. Controlled cV/cI, cvsource/cisource, and explicit EU/AM variants now draw the native diamond exterior, its EU center line or AM internal signs/current arrow, and honor csources/scale. The battery fixture verifies the default battery's four alternating plates, battery1's long/short pair with equal line width, battery2's three-times-thick short plate, default vertical leads, batteries/scale, and generic l= labels. L/vL select cute, American, or European bodies through explicit styles, tikzpicture style keys, or \\ctikzset{inductor=...}; documented inductors/scale, inductors/width, and inductors/coils are honored. \\ctikzset style changes now override inherited tikzpicture defaults. cute choke supports onelinechoke/twolineschoke and bipoles/cutechoke/cthick; named L/vL/choke elements expose core west/east with bipoles/inductors/core distance. Labels and annotations inherit the current TikZ font; internal symbol roles follow the 5/6pt, 10/12pt, and 12/14pt sizes declared by pgfcirc.defines.tex. Battery voltage-direction conventions, battery inversion/mirroring, solar and baertty symbols, controlled sinusoidal source variants, sources/symbol/rotate, transformers, inductive sensors, dot anchors, and the broader bipole catalog remain partial or unsupported."
};
