export const tikzLibrary = {
  name: "datavisualization.polar",
  status: "partial",
  category: "datavisualization",
  implementedBy: "src/frontend/latex-shell.js:renderDatavisualizationAsPolarTikz + src/tikz/libraries/datavisualizationPolarTicks.js:polarTickTextAnchor + src/tikz/libraries/datavisualizationLegend.js:renderNativeOutsideLineLegend",
  localSourceReviewed: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/datavisualization/tikzlibrarydatavisualization.polar.code.tex:62-124,214-270,332-390; tikzlibrarydatavisualization.code.tex:535-605,634-638,890-950,1032; tikz.code.tex:4485-4536",
  features: [
    "scientific polar axes with focused clean/grid rendering",
    "new polar axes={angle axis}{radius axis} with direct-degree low-level mapping",
    "angle axis unit vectors for low-level polar coordinate transforms",
    "low-level new polar axes avoid default axes unless ticks/grid are explicitly requested",
    "angle/radius function data projection",
    "scientific polar explicit data point scatter with angle/radius attributes",
    "format=named scatter data for official manual low-level polar examples",
    "0 to pi, 0 to 2pi, and common degree/radian fixed angle ranges",
    "radius axis length as total physical axis span for scientific manual scatter examples",
    "radius axis max value",
    "scientific polar logarithmic angle-axis mapping",
    "polar radius axis ticks={some} using native about ticks",
    "polar radius tick label style color propagation without recoloring angle labels",
    "logarithmic angle minor grid rays from minor steps between steps",
    "logarithmic angle outer minor tick marks from minor steps between steps",
    "smooth line visualizers with legend labels",
    "native outside line legend sample plots and measured label cells anchored to actual visualization bounds",
    "clean full-circle outer boundary",
    "clean partial-range pale radius axes plus outward-offset clean boundary axes",
    "endpoint radius tick labels for clean partial ranges",
    "non-clean scientific polar radius axes plus symmetric radius ticks and native-like inner/outer angle ticks",
    "non-clean half-plane 0-degree radius-axis high-side duplicate tick text",
    "degree tick suffixes rendered as math labels",
    "clean partial polar ticks use native 2pt marks, directional anchors and deferred 8pt text with surrounding-font outer separation",
    "full-circle default outside-right legends aligned to the 0-degree radius",
    "duplicate 360-degree endpoint tick suppression"
  ],
  notes:
    "Focused implementation of the common manual Chapter 85 polar datavisualization path. It projects angle/radius data into ordinary TikZ coordinates, supports scientific explicit data point scatter and the official low-level named-data scatter example including angle axis unit vectors, maps logarithmic scientific angle axes before projection, and draws approximate polar grid arcs/rays, logarithmic minor angle grid rays plus outer minor tick marks, clean/non-clean outer boundaries, clean partial-range radius axes, inner/outer angle ticks with close-to-native outside label placement, endpoint radius labels including the non-clean 0-degree high-side duplicate layer visible in tikztosvg, and simple legend rows when an axis system or explicit ticks/grid request them; it is not the full native polar axis object system. Reviewed 2026-10-25: clean partial ranges use PGF compass selection, a 5pt outward radius-axis shift, 2pt ticks, 1pt inner separation and surrounding-font 0.1666em outer separation before 8pt label selection. Both quadrant-origin labels are retained; half-plane duplicate zero is suppressed. Fifteen browser glyph origins pass against local tikztosvg. Half-plane legend placement/sample waves, full-circle and arbitrary font contexts remain partial. Evidence: docs/qa/2026-10-25-scoped-fonts-failures.md."
};

tikzLibrary.localSourceReviewed += "; tikzlibrarydatavisualization.code.tex:630-657,1670-1825,1934-2010,2047-2117 (line legend examples, matrices, text-right struts and outside placement)";
tikzLibrary.localSourceReviewed += "; pgfmoduledatavisualization.code.tex and pgflibraryfpu.code.tex (mantissa-normalized interval scaling); pgflibrarydatavisualization.polar.code.tex (fixed-point projection and path arc axes); pgfcorepathconstruct.code.tex:289-428 (unit-arc cubic controls before axis transforms)";
tikzLibrary.notes += " Follow-up: ordinary outside line legends use native sample waves, measured 9pt label cells and actual visualization bounds. Numeric ticks retain precision before projection; the radian mapper follows the source FPU division and PGF degree lookup. Partial-range boundary/grid arcs preserve unit-arc rounding before radius scaling. The clean maximum-radius pale axis is painted independently of the coincident grid arc, as declared in the local style. All 69 half-plane and 15 degree-control browser glyph origins pass the unchanged 0.09px gate at 3x, with the half-plane maximum reduced from 0.178px to 0.022px. Independent native tick centers, arc controls and paint layers are regression-tested. Both polar JS/tikztosvg PNG pairs now pass the unchanged threshold; independent PDF raster comparisons still differ and are not certified pixel-identical. Custom legend matrices, fonts, full-circle variants and arbitrary native axis objects remain partial. See docs/qa/2026-10-25-polar-timeline.md.";
