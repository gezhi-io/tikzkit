export const texPackage = {
  "name": "pgfmath",
  "status": "partial",
  "implementedBy": "src/engine/pgf-fixed-point.js + src/engine/safe-expression.js + src/engine/math.js + src/frontend/latex-shell.js + src/pgfplots/expressions.js",
  "features": [
    "\\pgfmathsetmacro",
    "\\pgfmathtruncatemacro",
    "common expression subset",
    "left-associative PGF carets and same-precedence numeric logical operators, distinct from gnuplot plot functions",
    "signed half-away-from-zero round",
    "scaled-point round/floor/ceil arguments with exact decimal-token conversion",
    "rounding arguments with fixed add/subtract/multiply and division",
    "native fractional /, divide, div and reciprocal with decimal carry and signed branches",
    "TeX decimal printing and bounded invalid or overflowing division diagnostics",
    "bounded native scientific-literal conversion inside rounding arguments",
    "distinct PGFPlots default FPU rounding and use fpu=false",
    "distinct mod and Mod semantics shared by coordinates and PGFPlots"
  ],
  "requires": [],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/latex/pgf/math/pgfmath.sty",
  "localSourceReviewed": "yes",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-math-parsing.tex",
  "caseCount": 11,
  "caseExamples": [
    "ai artificial intelligence aiama arr",
    "ai artificial intelligence jmccarthy arr",
    "ai computational intelligence pool,mackworth arr",
    "impact concentric blocks diagram",
    "rounding-coordinate-boundaries",
    "rounding-arithmetic-boundaries",
    "rounding-pgfplots-fpu-control",
    "division-coordinate-boundaries",
    "reciprocal-coordinate-boundaries",
    "division-pgfplots-fpu-control",
    "division-layout-controls"
  ],
  "observedOptions": [],
  "notes": "Reviewed local pgfmathfunctions.round/basic/misc.code.tex, pgfmathparser.code.tex, pgflibraryfpu.code.tex, pgfplotsutil.code.tex and TeX82 sections 102/103/452. Signed round/mod/Mod semantics and exact 17-digit rounding-argument conversion are preserved. The second 2026-10-29 follow-up implements fractional /, divide, div and reciprocal using native dimension arithmetic, decimal carries, signed reciprocal branches and shared TeX printing. 288 independent numeric probes agree. One wrong grid column and four missing reciprocal points visibly improve in actual Chromium against tikztosvg. PGFPlots default FPU, gnuplot-compatible plot functions and the existing exact-radian route retain their floating policies. Three SVG PNG pairs pass; the FPU frame/grid control and independent PDF raster acceptance remain open. General intermediate-function precision, geometry-specific legacy arithmetic helpers and full FPU arithmetic remain partial. Evidence: docs/qa/2026-10-29-native-division-reciprocal.md; preceding rounding evidence: docs/qa/2026-10-29-native-rounding-boundaries.md."
};
texPackage.notes += " PGF power/sign binding and numeric logical results were checked against pgfmathparser.code.tex and pgfmathfunctions.basic/comparison.code.tex. Short-circuit evaluation remains intentional. See docs/qa/2026-11-18-project-review-fixes.md.";
