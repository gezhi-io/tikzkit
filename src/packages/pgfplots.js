export const texPackage = {
  "name": "pgfplots",
  "status": "partial",
  "implementedBy": "src/pgfplots/axisEnvironment.js:expandPgfplotsAxes; src/pgfplots/axisTikzLowering.js:renderPgfplotsAxisAsTikz; src/pgfplots/axisLines.js:axisOuterBounds; src/frontend/latex-shell.js:pgfplotsPictureStyleOptions; src/pgfplots/histogram.js:preparePgfplotsHistogram; src/pgfplots/plotNodes.js:renderNodesNearCoords/lowerNodeNearCoordTextTemplate; src/pgfplots/rangeResolver.js:computeAxisRanges; src/pgfplots/axis3d.js:renderAxisLabels3D; src/pgfplots/labels.js:renderAxisLabels; src/pgfplots/gnuplot.js:sampleRawGnuplotAddplot; src/pgfplots/rawGnuplotRuntime.js; scripts/gallery-resources.js:galleryRenderOptions",
  "features": [
    "axis-like environments",
    "\\addplot coordinates/table/functions",
    "ticks/labels/legends subset",
    "ybar/ybar interval and histogram bins",
    "nodes near coords and current-axis bbox crop subset, including rotatebox/point-meta numeric templates",
    "xtick/ytick/ztick distance",
    "3D surf and ternary slices",
    "raw gnuplot numeric/function subset lowered to coordinates",
    "matching-size primary/right secondary y-axis overlay plot box",
    "scaled tick-label measurement for large grouped numeric axes",
    "legacy middle-axis terminal labels anchored at PGF current-axis terminals"
  ],
  "requires": [
    "tikz",
    "graphicx"
  ],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-plots.tex",
  "localSourceReviewed": true,
  "caseCount": 371,
  "caseExamples": [
    "Amplitude modulation / amplitude_modulation",
    "Frequency modulation / frequency_modulation",
    "GMHMM / gmhmm",
    "IQ sampling / iq_sampling",
    "Multiplex chain GMHMM (beta) / multiplex_chain_gmhmm_beta",
    "Multiplex chain GMHMM / multiplex_chain_gmhmm",
    "Sampling / sampling",
    "X LSTM / x lstm",
    "Tikzfxgraph wrapped pgfplots graph",
    "amplitude modulation",
    "bose einstein distribution 3d",
    "bose einstein distribution"
  ],
  "observedOptions": [],
  "registryNoteSuffix": "Gallery fixture resources now flow through one manifest-backed table resolver for audit and JS batch rendering, while native gallery references materialize the same resource files in their TeX work directory. `csv-line-plot-two-axes` recovers all four table-driven series and its right-axis overlay with no resolver diagnostics; evidence is in docs/qa/2026-08-05-pgfplots-fixture-table-resources.md. Legacy middle axes now retain PGFPlots' direct `current axis.right/above origin` terminal anchors even with `tick align=outside`; the arrow renderer owns any visible arrow-tip extension, so labels do not add an extra 2.5pt canvas reserve. `learn-curve-ml` and `linear-functions` visually match native MacTeX/tikztosvg after the correction. Evidence is in docs/qa/2026-08-05-pgfplots-middle-axis-anchor-bounds.md. The zero-preserving middle-axis family now applies the native 10% surveyed-range expansion for an inferred far bound under `enlargelimits=true`; x-square-with-circle verifies y=0..2.475 before the independent transform reserve. Evidence is in docs/qa/2026-08-05-pgfplots-middle-axis-enlargelimits.md. Default `xlabel near ticks` now reserves the complete TeX tick-label node, including the standard `.3333em` inner separation; csv-2d-point-plot validates the browser canvas and label baseline against MacTeX/tikztosvg. Raw gnuplot now has a browser-safe numeric subset for assignments, single-expression function definitions, ranges, samples, common scalar functions, and one plot expression; it deliberately does not execute gnuplot or arbitrary JavaScript. The local MacTeX reference for this feature still needs a local gnuplot executable. General multi-axis placement, modern ticklabel* cs, full enlarge-limit grammar, arbitrary number-format configuration, arbitrary TeX label templates, and final text/bbox calibration remain partial.",
  "notes": "Reviewed locally on 2026-07-22: pgfplots.code.tex axis-description defaults plus PGF pgfcorescopes.code.tex bounding-box reset and tikz.code.tex use-as-bounding-box semantics. TikZKit handles common numeric tick-distance keys in the preprocessor. The histogram-large-1d-dataset driver now reaches a 453x179px JS canvas versus 452x178px tikztosvg, with residual text rasterization and antialiasing differences. Picture-level TikZ transforms are now kept out of inherited PGFPlots axis defaults, so \`tikzpicture[scale=...]\` scales lowered 3D geometry exactly once while explicit axis \`scale\` remains supported. 3D surf QA also reviewed pgfplots.code.tex every-3d-description and non-boxed-axis defaults: inferred x/y surface domains remain tight, and the z label uses ticklabel cs:0.5 with near-ticklabel placement. The ellipsoid driver improved from 48.23% to 25.89% changed pixels after matching those shared defaults; its surface, axes, ticks, labels, and viridis mesh visibly align with native MacTeX and tikztosvg. Matching-size consecutive `hide x axis, axis y line*=right` overlays now retain the preceding primary plot box for visible coordinates while preserving their own TeX-style layout bounds. On 2026-07-27 the csv-line-plot-two-axes QA additionally verified PGFPlots-style tick scaling before tick-label geometry measurement: grouped x labels such as 1,000 remain numeric and large y values use their visible scaled labels. This removes a 0.34cm spurious left reserve while retaining the primary/right overlay alignment. On 2026-08-05, explicit-width oblique 3D `colorbar` axes gained their independently measured outer-right bbox reserve: `3d-function-4`, `3d-function-8`, `3d-function-continuous`, and `hyperbolic-paraboloid` now keep their colorbars, ticks, and whitespace aligned with local MacTeX/tikztosvg. Reviewed on 2026-08-05: pgfplots.code.tex nodes-near-coords defaults install a real post-marker node with point meta, and the ybar style adds its bar-shift semantics; pgfplotsplothandlers.code.tex resolves physical bar widths through the active x coordinate direction. TikZKit now lowers the common rotated numeric label template rather than emitting its TeX control words. Evidence is in docs/qa/2026-08-05-pgfplots-ybar-nodes-near-coords.md."
};
