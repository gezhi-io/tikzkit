export const texPackage = {
  "name": "pgfplots",
  "status": "partial",
  "implementedBy": "src/pgfplots/axisEnvironment.js:expandPgfplotsAxes; src/pgfplots/axisTikzLowering.js:renderPgfplotsAxisAsTikz; src/pgfplots/axisLines.js:axisOuterBounds; src/frontend/latex-shell.js:pgfplotsPictureStyleOptions; src/pgfplots/histogram.js:preparePgfplotsHistogram; src/pgfplots/plotNodes.js:renderPlotNodes; src/pgfplots/rangeResolver.js:computeAxisRanges; src/pgfplots/axis3d.js:renderAxisLabels3D; src/pgfplots/labels.js:renderAxisLabels",
  "features": [
    "axis-like environments",
    "\\addplot coordinates/table/functions",
    "ticks/labels/legends subset",
    "ybar/ybar interval and histogram bins",
    "nodes near coords and current-axis bbox crop subset",
    "xtick/ytick/ztick distance",
    "3D surf and ternary slices",
    "matching-size primary/right secondary y-axis overlay plot box",
    "scaled tick-label measurement for large grouped numeric axes",
    "legacy middle-axis terminal labels with outside ticks"
  ],
  "requires": [
    "tikz",
    "graphicx"
  ],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex",
  "localDoc": null,
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
  "registryNoteSuffix": "Legacy middle axes with `tick align=outside` now move their default terminal x/y labels through the completed-axis anchor calibration in `renderAxisLabels`; `activation-functions` aligns at its arrow tips. Evidence is in docs/qa/2026-08-05-pgfplots-middle-axis-terminal-labels.md. General multi-axis placement, modern ticklabel* cs, and final text/bbox calibration remain partial.",
  "notes": "Reviewed locally on 2026-07-22: pgfplots.code.tex axis-description defaults plus PGF pgfcorescopes.code.tex bounding-box reset and tikz.code.tex use-as-bounding-box semantics. TikZKit handles common numeric tick-distance keys in the preprocessor. The histogram-large-1d-dataset driver now reaches a 453x179px JS canvas versus 452x178px tikztosvg, with residual text rasterization and antialiasing differences. Picture-level TikZ transforms are now kept out of inherited PGFPlots axis defaults, so \`tikzpicture[scale=...]\` scales lowered 3D geometry exactly once while explicit axis \`scale\` remains supported. 3D surf QA also reviewed pgfplots.code.tex every-3d-description and non-boxed-axis defaults: inferred x/y surface domains remain tight, and the z label uses ticklabel cs:0.5 with near-ticklabel placement. The ellipsoid driver improved from 48.23% to 25.89% changed pixels after matching those shared defaults; its surface, axes, ticks, labels, and viridis mesh visibly align with native MacTeX and tikztosvg. Matching-size consecutive `hide x axis, axis y line*=right` overlays now retain the preceding primary plot box for visible coordinates while preserving their own TeX-style layout bounds. On 2026-07-27 the csv-line-plot-two-axes QA additionally verified PGFPlots-style tick scaling before tick-label geometry measurement: grouped x labels such as 1,000 remain numeric and large y values use their visible scaled labels. This removes a 0.34cm spurious left reserve while retaining the primary/right overlay alignment. On 2026-08-05, explicit-width oblique 3D `colorbar` axes gained their independently measured outer-right bbox reserve: `3d-function-4`, `3d-function-8`, `3d-function-continuous`, and `hyperbolic-paraboloid` now keep their colorbars, ticks, and whitespace aligned with local MacTeX/tikztosvg. Evidence is in docs/qa/2026-08-05-pgfplots-3d-colorbar-bbox.md. General multi-axis placement and final text/bbox calibration remain partial."
};
